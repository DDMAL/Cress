// MappingStorage.ts
// The common orchestration layer. Talks ONLY to StorageBackend + the CSV pure
// functions, so it is identical whether the backend is Option 1 (Worker) or
// Option 2 (user repo). This is the "doesn't get thrown away" core.
//
// Responsibilities:
//   - turn Cress table rows into CSV and back (delegates to csv.ts)
//   - remember the last-seen SHA per file so updates are conflict-checked
//   - when not logged in, fall back to a local store (PouchDB in Cress; an
//     in-memory map in this prototype) so the app still works offline.

import { rowsToCsv, csvToRows, CsvRow } from './csv';
import {
  StorageBackend,
  ConflictError,
  NotAuthenticatedError,
  StoredFileMeta,
} from './backend';

/** Minimal local store interface. In Cress this is backed by PouchDB
 *  (Cress-User-Storage). In the prototype it's an in-memory Map. */
export interface LocalStore {
  get(path: string): Promise<string | null>;
  set(path: string, content: string): Promise<void>;
  list(): Promise<string[]>;
  remove(path: string): Promise<void>;
}

export interface MappingStorageDeps {
  backend: StorageBackend;
  local: LocalStore;
  /** Returns the current token, or null if logged out. Wraps getGithubToken(). */
  getToken: () => string | null;
}

/**
 * Subdir prefix for soft-deleted mappings on the remote. A trashed file lives
 * at `${TRASH_PREFIX}<path>` (the backend adds .csv at its own boundary, giving
 * e.g. `.trash/my-map.csv`), so it no longer appears among the top-level
 * mappings yet stays recoverable.
 */
const TRASH_PREFIX = '.trash/';

export type SaveOutcome =
  | { status: 'saved-remote'; path: string; sha: string }
  | { status: 'saved-local'; path: string } // logged out -> local only
  | { status: 'conflict'; path: string };

export class MappingStorage {
  // path -> last known remote SHA, for conflict-safe updates within a session.
  private shaCache = new Map<string, string>();

  constructor(private deps: MappingStorageDeps) {}

  private isLoggedIn(): boolean {
    return this.deps.getToken() != null;
  }

  /** Serialize table rows and persist. Remote when logged in, local otherwise. */
  async saveMapping(path: string, rows: CsvRow[]): Promise<SaveOutcome> {
    const csv = rowsToCsv(rows);

    // Logged-out fallback: keep working against the local store only.
    if (!this.isLoggedIn()) {
      await this.deps.local.set(path, csv);
      return { status: 'saved-local', path };
    }

    const knownSha = this.shaCache.get(path) ?? null;
    try {
      const { sha } = await this.deps.backend.writeFile(path, csv, knownSha);
      this.shaCache.set(path, sha);
      // mirror to local so logged-out reads still see latest
      await this.deps.local.set(path, csv);
      return { status: 'saved-remote', path, sha };
    } catch (err) {
      if (err instanceof ConflictError) return { status: 'conflict', path };
      if (err instanceof NotAuthenticatedError) {
        await this.deps.local.set(path, csv);
        return { status: 'saved-local', path };
      }
      throw err;
    }
  }

  /** Load a mapping as table rows. Remote when logged in (falling back to local
   *  if the remote file is missing), local-only when logged out. */
  async loadMapping(path: string): Promise<CsvRow[] | null> {
    if (this.isLoggedIn()) {
      const remote = await this.deps.backend.readFile(path);
      if (remote) {
        if (remote.sha) this.shaCache.set(path, remote.sha);
        await this.deps.local.set(path, remote.content); // refresh local mirror
        return csvToRows(remote.content);
      }
      // fall through to local if not on remote
    }
    const local = await this.deps.local.get(path);
    return local == null ? null : csvToRows(local);
  }

  /** Force-overwrite the remote file, ignoring the cached SHA. Used after the
   *  user chooses "keep mine" on a conflict. Re-reads current SHA first so the
   *  PUT is accepted. */
  async resolveConflictKeepLocal(
    path: string,
    rows: CsvRow[],
  ): Promise<SaveOutcome> {
    if (!this.isLoggedIn()) {
      await this.deps.local.set(path, rowsToCsv(rows));
      return { status: 'saved-local', path };
    }
    const current = await this.deps.backend.readFile(path);
    const csv = rowsToCsv(rows);
    const { sha } = await this.deps.backend.writeFile(
      path,
      csv,
      current?.sha ?? null,
    );
    this.shaCache.set(path, sha);
    await this.deps.local.set(path, csv);
    return { status: 'saved-remote', path, sha };
  }

  /** List available mappings. Merges remote + local names when logged in. */
  async listMappings(): Promise<string[]> {
    const localNames = await this.deps.local.list();
    if (!this.isLoggedIn()) return localNames.sort();
    let remote: StoredFileMeta[] = [];
    try {
      remote = await this.deps.backend.listFiles();
    } catch (err) {
      if (!(err instanceof NotAuthenticatedError)) throw err;
    }
    remote.forEach((m) => this.shaCache.set(m.path, m.sha ?? ''));
    const set = new Set<string>([...localNames, ...remote.map((m) => m.path)]);
    return [...set].sort();
  }

  async deleteMapping(path: string): Promise<void> {
    await this.deps.local.remove(path);
    await this.trashRemote(path);
  }

  /**
   * Soft-delete on the remote: move the file under TRASH_PREFIX instead of
   * deleting, so it stays recoverable. GitHub has no
   * rename, so the move is copy-then-delete via existing backend ops -- the
   * StorageBackend interface is unchanged, so the Worker backend inherits this.
   * No-op when logged out or when the source isn't on the remote.
   */
  async trashRemote(path: string): Promise<void> {
    if (this.isLoggedIn()) {
      await this.moveRemote(path, this.trashPathFor(path));
    }
  }

  /**
   * Reverse of trashRemote: move the file back out of TRASH_PREFIX to its
   * original path. Used by Put Back. No-op when logged out or when the trashed
   * copy is absent.
   */
  async restoreRemote(path: string): Promise<void> {
    if (this.isLoggedIn()) {
      await this.moveRemote(this.trashPathFor(path), path);
    }
  }

  /** TRASH_PREFIX-qualified path for a bare mapping path. Idempotent: never
   *  double-prefixes. */
  private trashPathFor(path: string): string {
    return path.startsWith(TRASH_PREFIX) ? path : `${TRASH_PREFIX}${path}`;
  }

  /**
   * Move a remote file from->to by copy-then-delete, since GitHub's contents
   * API has no atomic rename. Reads the source (for its content + delete SHA),
   * writes it at the destination (probing the destination's SHA first so an
   * already-occupied path updates instead of failing the create), then deletes
   * the source. No-op if the source doesn't exist, so callers don't special-
   * case local-only files. shaCache is kept in step: destination SHA recorded,
   * source entry dropped.
   *
   * NOT atomic. If the process dies between write and delete you get the file
   * at BOTH paths; a subsequent same-direction move self-heals. Acceptable for
   * single-user trash; revisit if concurrent movers appear.
   */
  private async moveRemote(from: string, to: string): Promise<void> {
    const src = await this.deps.backend.readFile(from);
    if (!src) return; // nothing at source -> nothing to move

    // The destination may already be occupied -- e.g. the user re-saved the
    // file (recreating the top-level copy) before pressing Put Back. A bare
    // create (sha=null) would then 422, the error would be swallowed by the
    // caller's .catch, and the source would never be deleted (file stuck at
    // BOTH paths). So probe the destination first:
    const dest = await this.deps.backend.readFile(to);
    if (dest && dest.content !== src.content) {
      // Same path, DIFFERENT content: almost certainly a same-named file.
      // Do NOT silently clobber it -- surface a conflict for the caller to
      // handle. (Same-name collisions are a known limitation of name-as-key
      // storage; the real fix is uuid keys.)
      throw new ConflictError(
        `moveRemote: destination "${to}" exists with different content`,
        to,
      );
    }
    // dest absent -> create (null); dest present with same content -> overwrite
    // using its sha (idempotent, self-healing if a prior move half-completed).
    const { sha: newSha } = await this.deps.backend.writeFile(
      to,
      src.content,
      dest?.sha ?? null,
    );
    this.shaCache.set(to, newSha);

    if (src.sha) {
      await this.deps.backend.deleteFile(from, src.sha);
    }
    this.shaCache.delete(from);
  }
}

/** Trivial in-memory LocalStore for the prototype/tests. Cress swaps in PouchDB. */
export class InMemoryLocalStore implements LocalStore {
  private m = new Map<string, string>();
  async get(p: string) {
    return this.m.has(p) ? this.m.get(p)! : null;
  }
  async set(p: string, c: string) {
    this.m.set(p, c);
  }
  async list() {
    return [...this.m.keys()];
  }
  async remove(p: string) {
    this.m.delete(p);
  }
}

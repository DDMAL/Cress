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

/**
 * Read-only view of ANOTHER user's mappings. Deliberately has no write or
 * delete methods: "foreign files are read-only" is enforced at compile time
 * by the missing methods, not by relying on GitHub's runtime 403.
 * GitHubUserRepoBackend implements this; the Worker backend does not, so
 * wiring that omits `foreignReader` simply has no copy feature.
 */
export interface ForeignReader {
  readForeignFile(
    owner: string,
    path: string,
  ): Promise<{ content: string; sha: string } | null>;
  listForeignFiles(owner: string): Promise<StoredFileMeta[]>;
}

export interface MappingStorageDeps {
  backend: StorageBackend;
  local: LocalStore;
  /** Returns the current token, or null if logged out. Wraps getGithubToken(). */
  getToken: () => string | null;
  /** Optional read-only access to other users' mappings. When absent, the
   *  copy-foreign feature is unavailable (e.g. Worker backend wiring). */
  foreignReader?: ForeignReader;
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

  /**
   * List mapping names that exist on the REMOTE only (no local-mirror merge).
   * Used by the dashboard's tree reconcile: the FileSystem tree must be
   * compared against GitHub as the source of truth for existence, so
   * local-only names (mirror orphans, unsynced docs) must not leak into this
   * list the way they do in listMappings. Returns [] when logged out or when
   * the backend reports NotAuthenticated, so callers can no-op silently.
   */
  async listRemoteMappings(): Promise<string[]> {
    if (!this.isLoggedIn()) return [];
    let remote: StoredFileMeta[] = [];
    try {
      remote = await this.deps.backend.listFiles();
    } catch (err) {
      if (!(err instanceof NotAuthenticatedError)) throw err;
    }
    remote.forEach((m) => this.shaCache.set(m.path, m.sha ?? ''));
    return remote.map((m) => m.path).sort();
  }

  /**
   * Copy another user's mapping into the current user's own storage.
   * Read foreign -> parse (csvToRows doubles as a bad-file gate) -> same-name
   * check -> saveMapping through the single write path (sha cache + local
   * mirror come for free).
   *
   * Same-name handling (Finder/Windows model, matching moveRemote):
   *   - destination exists with SAME content -> idempotent no-op, returns the
   *     existing state as 'saved-remote'.
   *   - destination exists with DIFFERENT content -> throw ConflictError; the
   *     UI decides (replace / rename / cancel). "Keep both" is the UI calling
   *     again with `newName`.
   * Equality is compared on normalized csv (rowsToCsv(csvToRows(x))) so
   * hand-edited-but-equivalent files still count as identical.
   *
   * Authz note: read source repo + write own repo passes GitHub-native
   * permissions with zero Worker involvement.
   */
  async copyForeignMapping(
    fromOwner: string,
    path: string,
    newName?: string,
  ): Promise<SaveOutcome> {
    const reader = this.deps.foreignReader;
    if (!reader) {
      throw new Error('copyForeignMapping: no foreignReader configured');
    }
    if (!this.isLoggedIn()) {
      // Reading a foreign repo needs a token, and the copy must land in the
      // user's own remote repo; a local-only copy of someone else's file has
      // no meaning here.
      throw new NotAuthenticatedError('copyForeignMapping requires login');
    }

    const src = await reader.readForeignFile(fromOwner, path);
    if (!src) {
      throw new Error(
        `copyForeignMapping: "${path}" not found in ${fromOwner}'s mappings`,
      );
    }

    const rows = csvToRows(src.content); // parse = validation gate
    const destPath = newName ?? path;
    const normalized = rowsToCsv(rows);

    // Explicit destination probe: shaCache is empty for files this session
    // never touched, so a bare saveMapping could not tell "identical copy"
    // apart from a real conflict.
    const existing = await this.deps.backend.readFile(destPath);
    if (existing) {
      const existingNormalized = rowsToCsv(csvToRows(existing.content));
      if (existingNormalized === normalized) {
        // Already have an identical copy: refresh caches, done.
        if (existing.sha) this.shaCache.set(destPath, existing.sha);
        await this.deps.local.set(destPath, existing.content);
        return { status: 'saved-remote', path: destPath, sha: existing.sha };
      }
      throw new ConflictError(
        `copyForeignMapping: "${destPath}" exists with different content`,
        destPath,
      );
    }

    return this.saveMapping(destPath, rows);
  }

  /**
   * Copy a foreign mapping, overwriting the current user's OWN same-named file
   * if one exists. This is the "Replace" branch of the same-name dialog:
   * copyForeignMapping throws ConflictError on a name clash and leaves the
   * decision to the caller; this method is what the caller invokes once the
   * user has chosen to replace.
   *
   * Only ever writes the current user's own repo -- the foreign source is read
   * through ForeignReader (which has no write methods), so "replace" can never
   * touch anyone else's file, only the caller's own destination. The overwrite
   * follows resolveConflictKeepLocal's shape: re-read the destination's current
   * sha, then write past it so the PUT is accepted regardless of the (possibly
   * empty) sha cache.
   */
  async copyForeignMappingReplacing(
    fromOwner: string,
    path: string,
    newName?: string,
  ): Promise<SaveOutcome> {
    const reader = this.deps.foreignReader;
    if (!reader) {
      throw new Error(
        'copyForeignMappingReplacing: no foreignReader configured',
      );
    }
    if (!this.isLoggedIn()) {
      throw new NotAuthenticatedError(
        'copyForeignMappingReplacing requires login',
      );
    }

    const src = await reader.readForeignFile(fromOwner, path);
    if (!src) {
      throw new Error(
        `copyForeignMappingReplacing: "${path}" not found in ${fromOwner}'s mappings`,
      );
    }

    const rows = csvToRows(src.content); // parse = validation gate
    const destPath = newName ?? path;
    const csv = rowsToCsv(rows);

    // Re-read the destination's current sha so the overwrite PUT is accepted
    // even when this session never touched the file (empty shaCache). Mirrors
    // resolveConflictKeepLocal: current sha may be null (destination absent),
    // which writeFile treats as a create.
    const current = await this.deps.backend.readFile(destPath);
    const { sha } = await this.deps.backend.writeFile(
      destPath,
      csv,
      current?.sha ?? null,
    );
    this.shaCache.set(destPath, sha);
    await this.deps.local.set(destPath, csv);
    return { status: 'saved-remote', path: destPath, sha };
  }

  /**
   * List another user's mappings for the view-all UI. Thin passthrough to the
   * ForeignReader so callers depend only on MappingStorage, never on the
   * backend directly. Returns [] when no foreignReader is configured (e.g.
   * Worker wiring), so the UI can render "nothing foreign" without special-
   * casing.
   */
  async listForeignMappings(owner: string): Promise<StoredFileMeta[]> {
    const reader = this.deps.foreignReader;
    if (!reader) return [];
    return reader.listForeignFiles(owner);
  }

  /**
   * Read another user's mapping file as parsed rows, for read-only viewing in
   * the editor (issue #151). Pure read: unlike copyForeignMapping it never
   * writes to the current user's repo or local store. Thin passthrough to the
   * ForeignReader + the same csvToRows parse gate copyForeignMapping uses.
   * Returns null when no foreignReader is configured or the file is absent.
   */
  async readForeignMapping(
    owner: string,
    path: string,
  ): Promise<CsvRow[] | null> {
    const reader = this.deps.foreignReader;
    if (!reader) return null;
    if (!this.isLoggedIn()) {
      throw new NotAuthenticatedError('readForeignMapping requires login');
    }
    const src = await reader.readForeignFile(owner, path);
    if (!src) return null;
    return csvToRows(src.content);
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

  /**
   * Rename a mapping on the remote: move old path -> new path
   * (copy-then-delete via moveRemote, same mechanism as trash/restore).
   * No-op when logged out or when the old path isn't on the remote.
   * Throws ConflictError if the new path already exists with different
   * content (never silently clobbers another file).
   */
  async renameRemote(from: string, to: string): Promise<void> {
    if (this.isLoggedIn()) {
      await this.moveRemote(from, to);
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
    //
    // Write with 409 retry. GitHub's contents API is eventually consistent: in
    // rapid back-to-back moves, a destination path touched by the previous move
    // can briefly report a stale sha, so a write that just probed it may 409.
    // On conflict, wait (letting GitHub settle), re-probe the destination sha,
    // and retry with backoff. A single move never enters the retry path (the
    // loop breaks on first success).
    let newSha = '';
    let probeSha = dest?.sha ?? null;
    for (let attempt = 0; ; attempt++) {
      try {
        ({ sha: newSha } = await this.deps.backend.writeFile(
          to,
          src.content,
          probeSha,
        ));
        break;
      } catch (err) {
        if (!(err instanceof ConflictError) || attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        const reprobe = await this.deps.backend.readFile(to);
        probeSha = reprobe?.sha ?? null;
      }
    }
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

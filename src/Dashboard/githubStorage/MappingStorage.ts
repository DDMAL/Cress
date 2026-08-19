// storage.ts
// The common orchestration layer. Talks ONLY to StorageBackend + the CSV pure
// functions, so it is identical whether the backend is Option 1 (Worker) or
// Option 2 (user repo). This is the "doesn't get thrown away" core.
//
// Responsibilities:
//   - turn Cress table rows into CSV and back (delegates to csv.ts)
//   - remember the last-seen SHA per file so updates are conflict-checked
//   - when not logged in, fall back to a local store (PouchDB in Cress; an
//     in-memory map in this prototype) so the app still works offline (#138).

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

    // Logged-out fallback: keep working against the local store only (#138).
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
    if (!this.isLoggedIn()) return;
    const sha = this.shaCache.get(path);
    if (sha) {
      await this.deps.backend.deleteFile(path, sha);
      this.shaCache.delete(path);
    }
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

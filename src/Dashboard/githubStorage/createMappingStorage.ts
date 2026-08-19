// createMappingStorage.ts
// App-wiring assembly point. The barrel (index.ts) only exports classes;
// this is where they are composed into a ready-to-use MappingStorage instance.
//
// Importing this file from an entry (editor.ts) is what finally pulls the whole
// githubStorage/ module into the webpack bundle + type-check. Until now nothing
// imported it, so it was never compiled into the app.
//
// AUTH CONTRACT (shared with the OAuth frontend on feat/github-oauth-frontend):
//   localStorage 'cress_github_token'    -> bearer token (null when logged out)
//   localStorage 'cress_github_username' -> GitHub login (repo owner)
// We read these keys directly instead of importing getGithubToken(), so this
// branch (feat/github-storage) does NOT depend on the OAuth branch's symbols.
// AFTER the OAuth PR merges into main, swap getToken below for the imported
// getGithubToken() (it reads the same key and also yields the username).

import { MappingStorage } from './MappingStorage';
import { GitHubUserRepoBackend } from './GitHubUserRepoBackend';
import { PouchDbLocalStore } from './PouchDbLocalStore';
// To route writes through a Worker instead, swap in WorkerBackend at the assembly line below.
// import { WorkerBackend } from './WorkerBackend';

const TOKEN_KEY = 'cress_github_token';
const USERNAME_KEY = 'cress_github_username';
const MAPPINGS_REPO = 'cress-mappings'; // target repo name

const getToken = (): string | null =>
  window.localStorage.getItem(TOKEN_KEY) || null;

const getOwner = (): string => window.localStorage.getItem(USERNAME_KEY) || '';

/**
 * Map a Cress document's display name to the storage path (the key used on both
 * ends: GitHub filename AND the PouchDbLocalStore path/name). MUST be applied
 * identically at the load point and the save point, or the two ends desync.
 *
 * - GitHub contents API treats '/' and '\' as directory separators, so they are
 *   replaced. Whitespace is collapsed. Unicode/spaces are otherwise preserved
 *   (contentsUrl() URL-encodes the path).
 * - No .csv suffix here: PouchDB docs are keyed by bare name. The GitHub
 *   backend adds .csv at its own boundary (listFiles filters *.csv).
 */
export function nameToPath(name: string): string {
  // Bare, sanitized name -- NO .csv suffix. PouchDB's existing docs are keyed
  // by name without an extension (see Dashboard.ts handleAddFile -> addDocument),
  // and PouchDbLocalStore.resolveId matches on that name, so adding .csv here
  // makes the local lookup miss. The .csv suffix that GitHub needs (for
  // listFiles' *.csv filter) is the GitHub backend's concern and will be added
  // at that boundary when remote storage is wired, not here.
  return name
    .trim()
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, ' ');
}

// Lazy singleton: assembled on first use, by which point the editor load flow
// has run and the login state (token + username in localStorage) is settled.
let _instance: MappingStorage | null = null;
let _backend: GitHubUserRepoBackend | null = null;

export function getMappingStorage(): MappingStorage {
  if (_instance) return _instance;

  // Default backend writes directly to the user's repo (end-to-end verified).
  // To route through a Worker instead, replace _backend below with:
  //   new WorkerBackend({ fetch: window.fetch.bind(window), getToken,
  //                       workerUrl: '<lab worker url>' })
  // and drop the ensureReady() repo-creation step (the Worker owns the repo).
  _backend = new GitHubUserRepoBackend({
    fetch: window.fetch.bind(window),
    getToken,
    owner: getOwner(), // read once at first use; editor login state is settled by then
    repo: MAPPINGS_REPO,
  });

  _instance = new MappingStorage({
    backend: _backend,
    local: new PouchDbLocalStore(),
    getToken,
  });
  return _instance;
}

/**
 * Ensure the remote is ready to receive the first write. This creates the
 * user's `cress-mappings` repo if missing (idempotent). No-op when
 * logged out (we'll just save locally) or when the backend has no such concept
 * (e.g. WorkerBackend, where the lab owns the repo).
 *
 * Call once before the first saveMapping() of a session. ensureRepo() is NOT on
 * the StorageBackend interface (only this backend needs it), so the asymmetry is
 * hidden here in the wiring layer rather than leaking into the save call site.
 */
export async function ensureReady(): Promise<void> {
  if (!getToken()) return; // logged out -> local fallback, nothing to provision
  getMappingStorage(); // make sure _backend is assembled
  if (_backend && typeof _backend.ensureRepo === 'function') {
    await _backend.ensureRepo();
  }
}

// For the rare case login state changes within a live page (e.g. user logs in
// without a reload) and the backend must pick up the new owner/token.
export function resetMappingStorage(): void {
  _instance = null;
  _backend = null;
}

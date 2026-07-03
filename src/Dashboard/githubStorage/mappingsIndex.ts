// mappingsIndex.ts
// Reads the central user-discovery index: a public repo (cress-mappings-index)
// holding users.csv, one GitHub username per line. View-all resolves "which
// users exist" by reading this list, then calls listForeignFiles per user.
//
// TEMPORARY OWNERSHIP: during testing the index lives under a personal account
// and is curated by hand. Self-registration is deliberately avoided: it would
// require cross-user writes to a shared repo, reintroducing the authz problem
// the per-user-repo design removed. Long-term the index moves to the lab org
// or is replaced by an automatic registration mechanism (see PR description).
//
// Deliberately NOT part of StorageBackend / ForeignReader: those are scoped to
// mappings repos. The index is a different repo with a different lifecycle, so
// it gets its own thin reader.

import { NotAuthenticatedError } from './backend';

export interface MappingsIndexDeps {
  fetch: typeof fetch;
  getToken: () => string | null;
  /** Account that hosts the index repo (personal during testing). */
  indexOwner: string;
  indexRepo?: string; // default "cress-mappings-index"
  apiBase?: string; // default "https://api.github.com"
}

const INDEX_FILE = 'users.csv';

/**
 * Fetch the list of usernames from the index. Lines are trimmed; empty lines
 * and #-comment lines are skipped. Returns [] when the index repo or file is
 * missing, so view-all degrades to showing nothing foreign instead of
 * breaking.
 *
 * Uses the raw media type so the response body is the plain file content (no
 * base64 decoding step).
 */
export async function fetchIndexedUsers(
  deps: MappingsIndexDeps,
): Promise<string[]> {
  const token = deps.getToken();
  if (!token) throw new NotAuthenticatedError();

  const base = deps.apiBase ?? 'https://api.github.com';
  const repo = deps.indexRepo ?? 'cress-mappings-index';
  const url = `${base}/repos/${deps.indexOwner}/${repo}/contents/${INDEX_FILE}`;

  const res = await deps.fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`fetchIndexedUsers failed: ${res.status}`);
  }

  const text = await res.text();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

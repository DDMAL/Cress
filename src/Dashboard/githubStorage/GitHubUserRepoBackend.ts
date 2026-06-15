// GitHubUserRepoBackend.ts
// Option 2 backend: reads/writes files in the user's OWN repo via the GitHub
// contents API, using the logged-in user's token (from getGithubToken()).
//
// ensureRepo() creates the repo (POST /user/repos) on first use if it's
// missing. Call it once before the first save; it is idempotent (no-op when the
// repo already exists). All other ops (read/write/list/delete + SHA conflict)
// are common logic shared with Option 1, just pointed at GitHub directly.

import {
  StorageBackend,
  StoredFileMeta,
  ReadResult,
  WriteResult,
  ConflictError,
  NotAuthenticatedError,
} from './backend';

// Injectable fetch + token getter so this is unit-testable without a browser
// or real network. In Cress these default to window.fetch and the real
// getGithubToken() exported from cress-frontend-auth.ts.
export interface GitHubBackendDeps {
  fetch: typeof fetch;
  getToken: () => string | null;
  owner: string; // GitHub username (repo owner)
  repo: string; // e.g. "cress-mappings"
  branch?: string; // default branch; undefined = repo default
  apiBase?: string; // default "https://api.github.com"
}

// base64 helpers that work in both browser and node (prototype runs in node).
function toBase64(s: string): string {
  if (typeof Buffer !== 'undefined')
    return Buffer.from(s, 'utf-8').toString('base64');
  // browser
  return btoa(unescape(encodeURIComponent(s)));
}
function fromBase64(b64: string): string {
  const clean = b64.replace(/\n/g, '');
  if (typeof Buffer !== 'undefined')
    return Buffer.from(clean, 'base64').toString('utf-8');
  return decodeURIComponent(escape(atob(clean)));
}

export class GitHubUserRepoBackend implements StorageBackend {
  readonly kind = 'user-repo';
  constructor(private deps: GitHubBackendDeps) {}

  private get base() {
    return this.deps.apiBase ?? 'https://api.github.com';
  }

  private authHeaders(): Record<string, string> {
    const token = this.deps.getToken();
    if (!token) throw new NotAuthenticatedError();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private contentsUrl(path: string): string {
    const { owner, repo } = this.deps;
    return `${this.base}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  }

  /** True if the target repo already exists for this user (GET /repos/:owner/:repo). */
  async repoExists(): Promise<boolean> {
    const { owner, repo } = this.deps;
    const res = await this.deps.fetch(`${this.base}/repos/${owner}/${repo}`, {
      headers: this.authHeaders(),
    });
    if (res.status === 404) return false;
    if (!res.ok) {
      throw new Error(
        `repoExists failed: ${res.status} ${await safeText(res)}`,
      );
    }
    return true;
  }

  /**
   * Create the target repo if it does not exist. Idempotent: a no-op when the
   * repo is already present.
   *
   * auto_init: true creates an initial commit (a README) so the repo has a
   * default branch immediately; without it the contents API has no branch to
   * write the first file against.
   *
   * NOTE: this writes to the real GitHub account behind the token. It creates a
   * public repo named `repo` (default "cress-mappings"). private:false because
   * the OAuth scope is public_repo.
   */
  async ensureRepo(): Promise<void> {
    if (await this.repoExists()) return;

    const res = await this.deps.fetch(`${this.base}/user/repos`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.deps.repo,
        private: false,
        auto_init: true,
        description: 'Cress mapping files (auto-created)',
      }),
    });

    // 201 Created on success. 422 can mean "name already exists" (race with
    // another tab) -- treat that as success since the repo is now present.
    if (res.status === 422) {
      if (await this.repoExists()) return;
    }
    if (!res.ok) {
      throw new Error(
        `ensureRepo failed: ${res.status} ${await safeText(res)}`,
      );
    }
  }

  async readFile(path: string): Promise<ReadResult | null> {
    const url = new URL(this.contentsUrl(path));
    if (this.deps.branch) url.searchParams.set('ref', this.deps.branch);
    const res = await this.deps.fetch(url.toString(), {
      headers: this.authHeaders(),
    });

    if (res.status === 404) return null;
    if (!res.ok)
      throw new Error(`readFile failed: ${res.status} ${await safeText(res)}`);

    const json = (await res.json()) as { content?: string; sha?: string };
    if (json.content === undefined) {
      // Could be a directory response (array) — not a file.
      throw new Error(`readFile: ${path} is not a file`);
    }
    return { content: fromBase64(json.content), sha: json.sha ?? null };
  }

  async writeFile(
    path: string,
    content: string,
    sha?: string | null,
  ): Promise<WriteResult> {
    const body: Record<string, unknown> = {
      message: `cress: save ${path}`,
      content: toBase64(content),
    };
    if (this.deps.branch) body.branch = this.deps.branch;
    if (sha) body.sha = sha; // update; omit for create

    const res = await this.deps.fetch(this.contentsUrl(path), {
      method: 'PUT',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // 409 = sha is stale (someone else wrote). 422 can also indicate sha issues.
    if (res.status === 409) {
      throw new ConflictError(
        `Write conflict on ${path} (remote changed)`,
        path,
      );
    }
    if (!res.ok) {
      throw new Error(`writeFile failed: ${res.status} ${await safeText(res)}`);
    }

    const json = (await res.json()) as { content?: { sha?: string } };
    const newSha = json.content?.sha;
    if (!newSha) throw new Error('writeFile: no sha in response');
    return { sha: newSha };
  }

  async listFiles(): Promise<StoredFileMeta[]> {
    // List the repo root (prototype). Real impl may scope to a subdir.
    const url = new URL(this.contentsUrl(''));
    if (this.deps.branch) url.searchParams.set('ref', this.deps.branch);
    const res = await this.deps.fetch(
      url.toString().replace(/contents\/$/, 'contents'),
      {
        headers: this.authHeaders(),
      },
    );
    if (res.status === 404) return [];
    if (!res.ok)
      throw new Error(`listFiles failed: ${res.status} ${await safeText(res)}`);

    const json = (await res.json()) as Array<{
      name: string;
      sha: string;
      type: string;
    }>;
    return json
      .filter((e) => e.type === 'file' && e.name.endsWith('.csv'))
      .map((e) => ({ path: e.name, sha: e.sha }));
  }

  async deleteFile(path: string, sha: string): Promise<void> {
    const body: Record<string, unknown> = {
      message: `cress: delete ${path}`,
      sha,
    };
    if (this.deps.branch) body.branch = this.deps.branch;
    const res = await this.deps.fetch(this.contentsUrl(path), {
      method: 'DELETE',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(
        `deleteFile failed: ${res.status} ${await safeText(res)}`,
      );
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}

// WorkerBackend.ts
// Option 1 backend: instead of writing to GitHub directly with the user's
// token, the frontend sends each storage operation to a lab-owned Cloudflare
// Worker endpoint. The Worker authenticates the user (by their OAuth token),
// then performs the GitHub write using LAB-held credentials (a GitHub App
// installation token or a fine-grained PAT). This lets the lab own/centralize
// the data while users never hold write access to the lab repo.
//
// This class implements the SAME StorageBackend interface as
// GitHubUserRepoBackend, so MappingStorage / csv / cressRows are unchanged --
// only which backend is injected differs.
//
// WORKER ENDPOINT CONTRACT (what the lab Worker must implement for this to
// work end-to-end). The Worker base URL is passed in as `workerUrl`. Every
// request carries the user's OAuth token in the Authorization header so the
// Worker can verify identity before acting:
//
//   POST   {workerUrl}/files/read     { path }            -> 200 { content, sha } | 404
//   POST   {workerUrl}/files/write    { path, content, sha? } -> 200 { sha } | 409 conflict
//   POST   {workerUrl}/files/list                          -> 200 { files: [{path, sha}] }
//   POST   {workerUrl}/files/delete   { path, sha }         -> 200 {}
//
// content is the raw UTF-8 file text (the Worker base64-encodes for GitHub).
// The Worker is the only holder of GitHub write credentials; the user token is
// used purely for authn/authz at the Worker.
//
// STATUS: frontend side is complete and mock-tested. The Worker endpoints above
// do NOT exist yet -- the current Worker only does OAuth token exchange. Wiring
// this end-to-end requires extending the Worker, which is deferred until
// Option 1 is confirmed as the chosen direction.

import {
  StorageBackend,
  StoredFileMeta,
  ReadResult,
  WriteResult,
  ConflictError,
  NotAuthenticatedError,
} from './backend';

export interface WorkerBackendDeps {
  fetch: typeof fetch;
  getToken: () => string | null;
  workerUrl: string; // e.g. "https://cress-auth.ddmal.workers.dev"
}

export class WorkerBackend implements StorageBackend {
  readonly kind = 'worker';
  constructor(private deps: WorkerBackendDeps) {}

  private authHeaders(): Record<string, string> {
    const token = this.deps.getToken();
    if (!token) throw new NotAuthenticatedError();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private endpoint(op: string): string {
    return `${this.deps.workerUrl.replace(/\/$/, '')}/files/${op}`;
  }

  async readFile(path: string): Promise<ReadResult | null> {
    const res = await this.deps.fetch(this.endpoint('read'), {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({ path }),
    });
    if (res.status === 404) return null;
    if (!res.ok)
      throw new Error(`readFile failed: ${res.status} ${await safeText(res)}`);
    const json = (await res.json()) as { content: string; sha: string | null };
    return { content: json.content, sha: json.sha ?? null };
  }

  async writeFile(
    path: string,
    content: string,
    sha?: string | null,
  ): Promise<WriteResult> {
    const body: Record<string, unknown> = { path, content };
    if (sha) body.sha = sha;
    const res = await this.deps.fetch(this.endpoint('write'), {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      throw new ConflictError(
        `Write conflict on ${path} (remote changed)`,
        path,
      );
    }
    if (!res.ok)
      throw new Error(`writeFile failed: ${res.status} ${await safeText(res)}`);
    const json = (await res.json()) as { sha?: string };
    if (!json.sha) throw new Error('writeFile: no sha in response');
    return { sha: json.sha };
  }

  async listFiles(): Promise<StoredFileMeta[]> {
    const res = await this.deps.fetch(this.endpoint('list'), {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok)
      throw new Error(`listFiles failed: ${res.status} ${await safeText(res)}`);
    const json = (await res.json()) as {
      files: Array<{ path: string; sha: string | null }>;
    };
    return json.files.map((f) => ({ path: f.path, sha: f.sha ?? null }));
  }

  async deleteFile(path: string, sha: string): Promise<void> {
    const res = await this.deps.fetch(this.endpoint('delete'), {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({ path, sha }),
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

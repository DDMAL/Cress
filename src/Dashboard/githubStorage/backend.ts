// backend.ts
// The abstraction that lets Option 1 (Worker proxy) and Option 2 (user's own repo)
// share all the common logic above it. The save/load/list orchestration in
// storage.ts talks ONLY to this interface, so switching options = swapping the
// backend implementation, with zero change to the orchestration layer.

export interface StoredFileMeta {
  /** Path/identifier of the file within the backend (e.g. "my-map.csv"). */
  path: string;
  /** GitHub blob SHA, needed to update/delete without a conflict. Null if unknown. */
  sha: string | null;
}

export interface ReadResult {
  content: string; // decoded UTF-8 file content
  sha: string | null; // SHA of the blob we just read (for later conflict-safe writes)
}

export interface WriteResult {
  sha: string; // SHA of the newly written blob
}

/** Raised when a write is rejected because the remote blob changed since we read it
 *  (HTTP 409 from the GitHub contents API, or an SHA mismatch). */
export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Raised when the backend cannot operate because there is no auth token. */
export class NotAuthenticatedError extends Error {
  constructor(message = 'Not logged in to GitHub') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

export interface StorageBackend {
  /** Human-readable label for logging / UI ("user-repo", "worker"). */
  readonly kind: string;

  /** Read a file. Resolves null if the file does not exist. */
  readFile(path: string): Promise<ReadResult | null>;

  /** Create or update a file. If `sha` is provided, the write is conflict-checked
   *  against it (throws ConflictError on mismatch). Omit `sha` for a fresh create. */
  writeFile(
    path: string,
    content: string,
    sha?: string | null,
  ): Promise<WriteResult>;

  /** List stored files (just metadata, not content). */
  listFiles(): Promise<StoredFileMeta[]>;

  /** Delete a file by path + sha. */
  deleteFile(path: string, sha: string): Promise<void>;
}

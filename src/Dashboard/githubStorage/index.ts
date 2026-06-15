// index.ts
// Public surface of the githubStorage module. Matches the barrel pattern used
// by Dashboard/FileSystem/index.ts.

export { rowsToCsv, csvToRows } from './csv';
export type { CsvRow } from './csv';

export { cressPayloadToRows, rowsToCressPayload } from './cressRows';
export type { CressTablePayload } from './cressRows';

export { ConflictError, NotAuthenticatedError } from './backend';
export type {
  StorageBackend,
  StoredFileMeta,
  ReadResult,
  WriteResult,
} from './backend';

export { GitHubUserRepoBackend } from './GitHubUserRepoBackend';
export type { GitHubBackendDeps } from './GitHubUserRepoBackend';

export { MappingStorage, InMemoryLocalStore } from './MappingStorage';
export type {
  LocalStore,
  MappingStorageDeps,
  SaveOutcome,
} from './MappingStorage';

export { PouchDbLocalStore } from './PouchDbLocalStore';

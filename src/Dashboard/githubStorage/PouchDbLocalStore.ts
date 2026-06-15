// PouchDbLocalStore.ts
// Adapter that implements the LocalStore interface (from MappingStorage.ts) on
// top of Cress's existing PouchDB layer in ../Storage.ts. This is the
// logged-out / offline fallback store (#138): Storage.ts itself is NOT changed,
// we only call its existing exported functions.
//
// PROTOTYPE STATUS: skeleton. The reads/writes are wired to the real Storage.ts
// function names, but two things are deliberately simplified and flagged with
// TODO for when this is finalized against the running app:
//
//   1. id vs name. Storage.ts identifies documents by a PouchDB `_id` AND a
//      display `name` (see addDocument(id, name, content) and fetchUploads()
//      which returns {id, name}). LocalStore has a single `path`. This adapter
//      treats `path` as BOTH the _id and the name. If Cress needs distinct ids
//      (e.g. uuid _id + human name), resolve path->id via fetchUploads() here.
//
//   2. Content shape. Storage.ts stores a JSON attachment of
//      [headers, ...rowObjects] (Cress internal), NOT a raw CSV string.
//      LocalStore.get/set speak CSV strings (to stay backend-agnostic with the
//      remote side). So this adapter converts at the boundary using cressRows +
//      csv. The exact attachment read path (db.getAttachment vs the JSON in the
//      doc) must be confirmed against how the editor currently loads it; the
//      readAttachmentAsPayload() helper below marks that seam.

import { LocalStore } from './MappingStorage';
import { rowsToCsv, csvToRows } from './csv';
import {
  cressPayloadToRows,
  rowsToCressPayload,
  CressTablePayload,
} from './cressRows';

// These are the real exports from ../Storage.ts. Imported by name so the
// compiler checks the signatures when this is dropped into src/Dashboard/.
import {
  fetchUploads,
  addDocument,
  updateAttachment,
  deleteDocument,
  // NOTE: Storage.ts also exports `db` (the PouchDB instance) and parseWORD,
  // createJson, updateDocName. We use `db` for attachment reads below.
  db,
} from '../Storage';

export class PouchDbLocalStore implements LocalStore {
  /**
   * Resolve a path (which we treat as the document name) to its PouchDB _id.
   * Returns null if no document with that name exists.
   * TODO: if path===_id is adopted, this becomes the identity function.
   */
  private async resolveId(path: string): Promise<string | null> {
    const uploads = await fetchUploads();
    const hit = uploads.find((u) => u.name === path);
    return hit ? hit.id : null;
  }

  /**
   * Read the [headers, ...rowObjects] payload stored as the doc's "table"
   * attachment. SEAM: confirm this matches how the editor currently reads it.
   */
  private async readAttachmentAsPayload(
    id: string,
  ): Promise<CressTablePayload | null> {
    try {
      const blob = (await db.getAttachment(id, 'table')) as Blob;
      const text = await blob.text();
      return JSON.parse(text) as CressTablePayload;
    } catch (e) {
      console.error('PouchDbLocalStore.readAttachmentAsPayload failed:', e);
      return null;
    }
  }

  async get(path: string): Promise<string | null> {
    const id = await this.resolveId(path);
    if (!id) return null;
    const payload = await this.readAttachmentAsPayload(id);
    if (!payload) return null;
    // Cress internal payload -> string[][] -> CSV string (LocalStore contract).
    return rowsToCsv(cressPayloadToRows(payload));
  }

  async set(path: string, content: string): Promise<void> {
    // CSV string -> string[][] -> Cress internal [headers, ...rowObjects].
    const payload = rowsToCressPayload(csvToRows(content));
    const id = await this.resolveId(path);
    if (id) {
      // Existing doc: update its attachment in place.
      await updateAttachment(id, payload as unknown as any[]);
    } else {
      // New doc: create it. addDocument expects a Blob attachment of the JSON.
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      });
      // path used as BOTH id and name (see header note, simplification #1).
      await addDocument(path, path, blob);
    }
  }

  async list(): Promise<string[]> {
    const uploads = await fetchUploads();
    return uploads.map((u) => u.name);
  }

  async remove(path: string): Promise<void> {
    const id = await this.resolveId(path);
    if (id) await deleteDocument(id);
  }
}

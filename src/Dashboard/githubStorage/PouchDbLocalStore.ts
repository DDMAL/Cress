// PouchDbLocalStore.ts
// Adapter that implements the LocalStore interface (from MappingStorage.ts) on
// top of Cress's existing PouchDB layer in ../Storage.ts. This is the
// logged-out / offline fallback store: Storage.ts itself is NOT changed,
// we only call its existing exported functions.
//
// Two seams that were previously TODO are now resolved against the real
// Storage.ts / CressTable.ts:
//
//   1. id vs name. Storage.ts identifies documents by a PouchDB `_id` AND a
//      display `name` (addDocument(id, name, content); fetchUploads() returns
//      {id, name}). LocalStore exposes a single `path`. RESOLUTION: `path` is
//      the human-facing NAME. For an EXISTING document we look up its real
//      PouchDB `_id` via fetchUploads() (resolveId) and update against that id,
//      so we never assume name===_id for updates. For a NEW document we still
//      mint the id from the name (sanitized to satisfy PouchDB _id rules); when
//      the app wiring lands we can switch to a uuid _id here without touching
//      anything above this adapter.
//
//   2. Content shape. Storage.ts stores a JSON attachment of
//      [headers, ...rowObjects] (Cress internal), NOT a raw CSV string. The
//      attachment is read back via db.getAttachment(id, 'table'). PouchDB types
//      that as Blob | Buffer, so readAttachmentAsPayload() narrows at runtime
//      (Blob.text() in the browser, Buffer.toString() under node tests) instead
//      of an unchecked cast. LocalStore.get/set speak CSV strings to stay
//      backend-agnostic, so this adapter converts at the boundary using
//      cressRows + csv.

import { LocalStore } from './MappingStorage';
import { rowsToCsv, csvToRows } from './csv';
import {
  cressPayloadToRows,
  rowsToCressPayload,
  CressTablePayload,
} from './cressRows';

// Real exports from ../Storage.ts. Imported by name so the compiler checks the
// signatures when this is dropped into src/Dashboard/.
import {
  fetchUploads,
  addDocument,
  updateAttachment,
  deleteDocument,
  db,
} from '../Storage';

/**
 * Sanitize a human name into something usable as a PouchDB _id.
 * PouchDB forbids ids beginning with '_' (reserved). We also trim whitespace.
 * This only affects NEW documents; existing ones are addressed by their real
 * stored _id via resolveId().
 */
function nameToId(name: string): string {
  const trimmed = name.trim();
  const safe = trimmed.startsWith('_') ? trimmed.replace(/^_+/, '') : trimmed;
  if (safe !== trimmed) {
    console.warn(
      `PouchDbLocalStore: name "${name}" is not a valid PouchDB _id; ` +
        `using "${safe}" as id (name preserved for display).`,
    );
  }
  return safe;
}

export class PouchDbLocalStore implements LocalStore {
  /**
   * Resolve a path (treated as the document NAME) to its PouchDB _id.
   * Returns null if no document with that name exists.
   * NOTE: fetchUploads() does not guarantee unique names; we take the first
   * match. The app-wiring step should decide whether duplicate names are
   * allowed or disambiguated.
   */
  private async resolveId(path: string): Promise<string | null> {
    const uploads = await fetchUploads();
    const matches = uploads.filter((u) => u.name === path);
    if (matches.length > 1) {
      console.warn(
        `PouchDbLocalStore: ${matches.length} documents named "${path}"; ` +
          `using the first. Consider unique names.`,
      );
    }
    return matches.length > 0 ? matches[0].id : null;
  }

  /**
   * Read the [headers, ...rowObjects] payload stored as the doc's "table"
   * attachment. Narrows the PouchDB Blob | Buffer return at runtime.
   */
  private async readAttachmentAsPayload(
    id: string,
  ): Promise<CressTablePayload | null> {
    try {
      const att = await db.getAttachment(id, 'table');
      let text: string;
      if (typeof Blob !== 'undefined' && att instanceof Blob) {
        text = await att.text();
      } else if (typeof Buffer !== 'undefined' && att instanceof Buffer) {
        text = att.toString('utf-8');
      } else {
        // Fallback: some PouchDB adapters return a base64 string.
        text = String(att);
      }
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
    // This is exactly the shape updateAttachment/addDocument expect
    // ([header, ...content]); see Storage.ts JSDoc and CressTable's
    // updateAttachment(id, [inputHeader, ...body]).
    const payload = rowsToCressPayload(csvToRows(content));
    const id = await this.resolveId(path);
    if (id) {
      // Existing doc: update its attachment in place, addressed by real _id.
      await updateAttachment(id, payload);
    } else {
      // New doc: mint an id from the name; keep `path` as the display name.
      const newId = nameToId(path);
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      });
      await addDocument(newId, path, blob);
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

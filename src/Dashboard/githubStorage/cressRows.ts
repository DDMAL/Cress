// cressRows.ts
// Bridges Cress's INTERNAL table representation and the CSV layer.
//
// Cress internal format (see Storage.ts createJson / updateAttachment):
//   a JSON array shaped as [headers, ...rows], where:
//     - headers is string[]            e.g. ["classification", "name", "mei", "image"]
//     - each row is an OBJECT keyed by header
//                                      e.g. { classification: "neume.pes", name: "pes", ... }
//   The PouchDB attachment stores JSON.stringify([headers, ...rowObjects]).
//
// CSV layer (csv.ts) works on string[][]: row 0 = header cells, following rows
// = data cells, all strings.
//
// This module converts between the two so the storage orchestration can keep
// CSV on the wire (what GitHub stores and what Rodan's MEI Conversion Job
// consumes) while Cress keeps its object-per-row shape in memory / PouchDB.

import { CsvRow } from './csv';

/** Cress's in-memory table payload: [headers, ...rowObjects]. */
export type CressTablePayload = [string[], ...Array<Record<string, unknown>>];

/**
 * Convert Cress's [headers, ...rowObjects] into string[][] (header row first),
 * ready for rowsToCsv(). Missing keys become "". Values are stringified;
 * null/undefined become "".
 */
export function cressPayloadToRows(payload: CressTablePayload): CsvRow[] {
  if (!Array.isArray(payload) || payload.length === 0) return [];
  const headers = payload[0];
  if (!Array.isArray(headers)) {
    throw new Error(
      'cressPayloadToRows: first element must be the header array',
    );
  }

  const out: CsvRow[] = [headers.slice()];
  for (let i = 1; i < payload.length; i++) {
    const rowObj = payload[i] as Record<string, unknown>;
    const cells = headers.map((h) => {
      const v = rowObj ? rowObj[h] : undefined;
      return v == null ? '' : String(v);
    });
    out.push(cells);
  }
  return out;
}

/**
 * Convert string[][] (header row first) back into Cress's
 * [headers, ...rowObjects]. Extra cells beyond the header length are dropped;
 * short rows fill missing trailing columns with "".
 */
export function rowsToCressPayload(rows: CsvRow[]): CressTablePayload {
  if (rows.length === 0) return [[]];
  const headers = rows[0].slice();
  const rowObjects: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = idx < cells.length ? cells[idx] : '';
    });
    rowObjects.push(obj);
  }
  return [headers, ...rowObjects];
}

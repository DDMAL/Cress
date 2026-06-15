// csv.ts
// Pure CSV serialization / parsing. No Handsontable / ExportTools dependency yet.
// When wiring into Cress, the data source (Handsontable rows / ExportTools output)
// feeds rowsToCsv(); these functions stay unchanged.
//
// Follows RFC 4180:
//   - fields containing comma, double-quote, CR or LF are wrapped in double quotes
//   - embedded double-quotes are escaped by doubling them ("")
//
// NOTE on neume images: in Cress the image column holds a base64-encoded string
// (sometimes itself containing commas inside a data URI / JSON-ish "[]"). Those are
// just field contents as far as CSV is concerned, so escaping handles them.

export type CsvRow = string[];

const NEEDS_QUOTING = /[",\r\n]/;

function escapeField(field: string): string {
  if (NEEDS_QUOTING.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

/** Serialize a 2D array of strings to a CSV string. First row is treated as data
 *  (caller decides whether row 0 is a header). Uses \r\n line endings per RFC 4180. */
export function rowsToCsv(rows: CsvRow[]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n');
}

/** Parse a CSV string back into a 2D array of strings. Handles quoted fields,
 *  escaped quotes, and embedded commas / newlines. Accepts \n or \r\n. */
export function csvToRows(csv: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let field = '';
  let row: CsvRow = [];
  let inQuotes = false;
  let i = 0;

  // Strip a leading UTF-8 BOM if present.
  if (csv.charCodeAt(0) === 0xfeff) i = 1;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < csv.length) {
    const c = csv[i];

    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      pushField();
      i++;
      continue;
    }
    if (c === '\r') {
      // handle \r\n and lone \r
      if (csv[i + 1] === '\n') i++;
      pushRow();
      i++;
      continue;
    }
    if (c === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // Flush trailing field/row unless the input ended exactly on a newline with
  // nothing after it (avoid a spurious empty final row).
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

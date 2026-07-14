import {
  getMappingStorage,
  nameToPath,
} from '../../src/Dashboard/githubStorage/createMappingStorage';
import { rowsToCressPayload } from '../../src/Dashboard/githubStorage';

import CressView from '../../src/CressView';
import { parseWORD } from '../../src/Dashboard/Storage';
import { IEntry, IFolder } from '../../src/Dashboard/FileSystem';
import { CressDoc, Doc, GlyphArray } from '../../src/Types';
import PouchDB from 'pouchdb';
import * as Papa from 'papaparse';

const sampleId = getGetParam('sample');
const uploadId = getGetParam('upload');
const isForeign = getGetParam('foreign');
const foreignOwner = getGetParam('owner');
const foreignPath = getGetParam('path');

if (isForeign && foreignOwner && foreignPath) {
  // Read-only foreign view (#151): load another user's file straight from
  // their GitHub repo, never touching PouchDB. readForeignMapping is a pure
  // read; CressTable's readOnly flag blocks every write path so the file can
  // never be saved back into the current user's repo.
  (async () => {
    try {
      const rows = await getMappingStorage().readForeignMapping(
        foreignOwner,
        foreignPath,
      );
      if (!rows) {
        console.error(
          `No foreign mapping found for "${foreignOwner}/${foreignPath}"`,
        );
        return;
      }
      const payload = rowsToCressPayload(rows);
      const cressDoc: CressDoc = {
        id: `foreign:${foreignOwner}/${foreignPath}`,
        name: foreignPath,
        header: payload[0],
        body: payload.slice(1) as Record<string, unknown>[],
        readOnly: true,
        owner: foreignOwner,
      };
      const view = new CressView(cressDoc);
      view.start();
    } catch (e) {
      console.error('Failed to load foreign mapping:', e);
    }
  })();
} else if (sampleId) {
  const fs = window.localStorage.getItem('cress-fs');
  if (fs) {
    try {
      const localFileSystem = JSON.parse(fs) as IFolder;
      const filename = findFileNameById(localFileSystem);
      if (filename) {
        let filePath = `${__ASSET_PREFIX__}assets/samples/${filename}`;
        window
          .fetch(filePath)
          .then((response) => {
            if (!response.ok) {
              throw new Error(response.statusText);
            }
            return response;
          })
          .then(async (response) => {
            try {
              // get file extension
              let extension = filePath.split('.').pop();
              if (extension === 'csv') {
                // handle csv sample
                const text = await response.text();
                let results = Papa.parse(text, { header: true });
                let cressDoc: CressDoc = {
                  id: sampleId,
                  name: filename,
                  header: results.meta.fields,
                  body: results.data,
                };
                const view = new CressView(cressDoc);
                view.start();
              } else if (extension === 'docx') {
                // handle docx sample
                const arrayBuffer = await response.arrayBuffer();
                let headers: string[], data: any[];
                [headers, data] = await parseWORD(arrayBuffer);
                let cressDoc: CressDoc = {
                  id: sampleId,
                  name: filename,
                  header: headers,
                  body: data,
                };
                const view = new CressView(cressDoc);
                view.start();
              }
            } catch (e) {
              console.error(e);
              console.debug(response);
            }
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        console.error('Error finding file in local file system.');
      }
    } catch (e) {
      console.error('Error parsing local file system:', e);
    }
  } else {
    console.error('Local file system data not found.');
  }
} else {
  const db = new PouchDB('Cress-User-Storage');
  (async () => {
    try {
      // Name comes from the PouchDB doc (dashboard entry point); the storage
      // key is name-based so it matches the GitHub filename + the local store.
      const doc: Doc = await db.get(uploadId);
      const name = doc.name;
      const path = nameToPath(name);

      // Remote when logged in (fall back to local if the file isn't on GitHub
      // yet -> progressive migration of old PouchDB docs); local-only when
      // logged out. Returns CsvRow[] (string[][]) or null.
      const rows = await getMappingStorage().loadMapping(path);
      if (!rows) {
        console.error(`No mapping found for "${path}"`);
        return;
      }

      // string[][] -> Cress internal [headers, ...rowObjects].
      const payload = rowsToCressPayload(rows);
      const cressDoc: CressDoc = {
        id: uploadId,
        name,
        header: payload[0],
        body: payload.slice(1) as Record<string, unknown>[],
      };
      const view = new CressView(cressDoc);
      view.start();
    } catch (e) {
      console.error('Failed to load mapping:', e);
    }
  })();
}
function getGetParam(paramName): string {
  let result;

  window.location.search
    .substr(1)
    .split('&')
    .forEach((item) => {
      const tmp = item.split('=');
      if (tmp[0] === paramName) {
        result = decodeURIComponent(tmp[1]);
      }
    });
  return result;
}

// Recursive function to find the filename by ID
function findFileNameById(node: IEntry): string | null {
  if (node.id === sampleId) {
    return node.name;
  }

  if (node.children) {
    for (const child of node.children) {
      const result = findFileNameById(child);
      if (result !== null) {
        return result;
      }
    }
  }

  return null;
}

function dataListToDict(rows: any[]) {
  let headers = rows[0];
  const glyphArray: GlyphArray = [];
  for (let i = 1; i < rows.length; i++) {
    const glyph: any = {};
    for (let j = 0; j < headers.length; j++) {
      glyph[headers[j]] = rows[i][j];
    }
    glyphArray.push(glyph);
  }
  return glyphArray;
}

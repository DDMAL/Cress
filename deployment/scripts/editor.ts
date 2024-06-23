import CressView from '../../src/CressView';
import { parseWORD } from '../../src/Dashboard/Storage';  
import { IEntry, IFolder } from '../../src/Dashboard/FileSystem';
import { CressDoc, Doc, GlyphArray } from '../../src/Types';
import PouchDB from 'pouchdb';
import * as Papa from 'papaparse';

const sampleId = getGetParam('sample');
const uploadId = getGetParam('upload');

if (sampleId) {
  const fs = window.localStorage.getItem('cress-fs');
  if (fs) {
    try {
      const localFileSystem = JSON.parse(fs) as IFolder;
      const filename = findFileNameById(localFileSystem);
      if (filename) {
        let filePath = `./Cress-gh/assets/samples/${filename}`;
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
                let file = Papa.parse(text);
                let data = file.data;
                let cressDoc: CressDoc = {
                  id: sampleId,
                  name: filename,
                  header: [],
                  body: dataListToDict(data),
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
  db.getAttachment(uploadId, 'table')
    .then((blob) => {
      return new window.Response(blob).json();
    })
    .then(async (table) => {
      console.log(table);
      const doc: Doc = await db.get(uploadId);
      const name = doc.name;
      let cressDoc: CressDoc = {
        id: uploadId,
        name: name,
        header: table[0],
        body: table.slice(1),
      };
      const view = new CressView(cressDoc);
      view.start();
    });
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

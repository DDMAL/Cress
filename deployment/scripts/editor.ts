import CressView from '../../src/CressView';
import { IEntry, IFolder } from '../../src/Dashboard/FileSystem';
import { CressDoc, Doc, GlyphArray } from '../../src/Types';
import PouchDB from 'pouchdb';
import * as Papa from 'papaparse';

const id = getGetParam('glyphs');
const storage = getGetParam('storage');

if (id) {
  const fs = window.localStorage.getItem('cress-fs');
    if (fs) {
        try {
            const localFileSystem = JSON.parse(fs) as IFolder;
            const filename = findFileNameById(localFileSystem);
            if (filename) {
              const filePath = `./Cress-gh/samples/${filename}.csv`;

              window.fetch(filePath)
                  .then(response => {
                      if (!response.ok) {
                          throw new Error(response.statusText);
                      }
                      return response.text();
                  })
                  .then(async text => {
                      try {
                          let file = Papa.parse(text);
                          let data = file.data;
                          console.log(data);
                          let cressDoc: CressDoc = {
                            id: id,
                            name: filename,
                            glyphs: dataListToDict(data)
                          }
                          const view = new CressView(cressDoc);
                          view.start();
                      } catch (e) {
                          console.error(e);
                          console.debug(text);
                      }
                  })
                  .catch(error => {
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
  db.getAttachment(storage, 'glyphs').then(blob => {
    return new window.Response(blob).json();
  }).then(async glyphs => {
    console.log(glyphs);
    const doc: Doc = await db.get(storage);
    const name = doc.name;
    let cressDoc: CressDoc = {
      id: storage,
      name: name,
      glyphs: glyphs
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
    if (node.id === id) {
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
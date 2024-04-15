import CressView from '../../src/CressView';
import { IEntry, IFolder } from '../../src/Dashboard/FileSystem';
import { GlyphArray } from '../../src/Types';
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
            const filePath = `./samples/${filename}.csv`;

            window.fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }
                    return response.text();
                })
                .then(async text => {
                    try {
                        let data = Papa.parse(text);
                        console.log(data);
                        const view = new CressView();
                        view.start();
                    } catch (e) {
                        console.error(e);
                        console.debug(text);
                    }
                })
                .catch(error => {
                    console.error(error);
                });
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
    const view = new CressView();
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
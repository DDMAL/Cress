import PouchDB from 'pouchdb';
import { AllDocs, Doc, uploadsInfo } from '../Types';
import * as Papa from 'papaparse';

export const db = new PouchDB('Cress-User-Storage');

function getAllDocuments(): Promise<AllDocs> {
  return new Promise((resolve, reject) => {
    db.allDocs({ include_docs: true })
      .then(result => resolve(result))
      .catch(err => reject(err));
  });
}

export async function fetchUploads(): Promise<uploadsInfo> {
  try {
    const res = await getAllDocuments();
    return res.rows.map(row => ({
      id: row.id,
      name: row.doc ? row.doc.name : 'undefined',
    }));
  } catch (err) {
    console.log('Couldn\'t fetch uploaded documents', err.message);
    return [];
  }
}

async function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('Error parsing CSV file'));
        } else {
          resolve(results.data);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}


export function createJson(file: File, type: string): Promise<Blob> {
  return new Promise(async (resolve) => {
    let data: any[];
    if ( type === 'csv' ) {
      console.log(file);
      data = await parseCSV(file);
    } else if ( type === 'xlsx') {
      // data = await parseXLSX(file);
    } else {
      console.error('Unsupported file format');
      return;
    }
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    resolve(jsonBlob);
  });
}

/**
 * Add new entry to the database
 * @param id 
 * @param title 
 * @param content 
 * @returns Promise<boolean>
 */
export function addDocument(id: string, name: string, content: Blob): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.put({
      _id: id,
      name: name,
      _attachments: {
        glyphs: {
          content_type: 'application/json',
          data: content
        }
      }
    }).then(() => {
      resolve(true);
    }).catch(err => {
      window.alert(`Error Uploading Document: ${err.message}, title: ${name}, id: ${id}.`);
      reject(false);
    });
  });
}

/**
 * Delete entry from the database
 * @param id 
 * @returns Promise<boolean>
 */
export function deleteDocument(id: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get(id)
      .then(doc => {
        db.remove(doc)
          .then(_ => {
            resolve(true);
          })
          .catch(err => {
            console.log(err);
            reject(err);
          });
      })
      .catch(err => {
        console.log(err);
        reject(err);
      });
  });
}

/**
 * Update the doc from the database
 * @param id 
 * @param newName 
 * @returns Promise<boolean>
 */
export function updateDocName(id: string, newName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Retrieve doc from database (to get _rev)
    db.get<Doc>(id).then(doc => {
      doc.name = newName;
      return db.put(doc);
    }).catch(err => reject(err)); // db.get
  });
}

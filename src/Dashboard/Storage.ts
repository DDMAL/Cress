import PouchDB from 'pouchdb';
import { AllDocs, Doc, uploadsInfo } from '../Types';
import csv from 'csvtojson';

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

export function createJson(id: string, title: string, file: File): Promise<string> {
  return new Promise(async (resolve) => {
    
  });
}

/**
 * Add new entry to the database
 * @param id 
 * @param title 
 * @param content 
 * @param single is it a single page or a manuscript
 * @returns Promise<boolean>
 */
export function addDocument(id: string, name: string, content: Blob): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.put({
      _id: id,
      name: name,
      _attachments: {
        table: {
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

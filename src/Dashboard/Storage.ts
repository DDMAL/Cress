import PouchDB from 'pouchdb';
import { AllDocs, Doc, uploadsInfo } from '../Types';
import * as Papa from 'papaparse';
import * as mammoth from 'mammoth/mammoth.browser';

export const db = new PouchDB('Cress-User-Storage');

function getAllDocuments(): Promise<AllDocs> {
  return new Promise((resolve, reject) => {
    db.allDocs({ include_docs: true })
      .then((result) => resolve(result))
      .catch((err) => reject(err));
  });
}

export async function fetchUploads(): Promise<uploadsInfo> {
  try {
    const res = await getAllDocuments();
    return res.rows.map((row) => ({
      id: row.id,
      name: row.doc ? row.doc.name : 'undefined',
    }));
  } catch (err) {
    console.log("Couldn't fetch uploaded documents", err.message);
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
          resolve([results.meta.fields, results.data]);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

async function parseXLSX(file: File): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const data = await workbook.xlsx.load(file.arrayBuffer());
    // to json
    let worksheet = data.worksheets[0];
    let headerNames = [];
    // TODO: enhance performance, get rid of loop
    worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
      if (rowNumber === 1) {
        row.values.forEach((header) => {
          headerNames.push(header.toString());
        });
      }
    });
    let rows = [];
    worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
      if (rowNumber !== 1) {
        let rowData = {};
        row.values.forEach((cell, cellNumber) => {
          let headerKey = headerNames[cellNumber - 1];
          if (cell) {
            rowData[headerKey] = cell.toString();
          } else {
            rowData[headerKey] = '';
          }
        });
        rows.push(rowData);
      }
    });
    for (const image of worksheet.getImages()) {
      // fetch the media item with the data
      const img = workbook.model.media.find((m) => m.index === image.imageId);
      const base64 = img.buffer.toString('base64');
      const dataUrl = `data:${img.type};base64,${base64}`;
      rows[image.range.tl.nativeRow - 1]['imagePath'] = dataUrl;
    }
    resolve([headerNames, rows]);
  });
}

export async function parseWORD(arrayBuffer: ArrayBuffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    mammoth
      .convertToHtml({ arrayBuffer: arrayBuffer })
      .then(function (result) {
        let html = result.value;
        let messages = result.messages;
        console.log(messages);

        // html to dom
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');
        // extract tables
        let table = doc.getElementsByTagName('table')[0];
        let headerElements = table
          .getElementsByTagName('tr')[0]
          .getElementsByTagName('td');
        let headers = Array.from(
          table.getElementsByTagName('tr')[0].getElementsByTagName('td'),
          (element) => element.innerText,
        );
        // remove header row
        table.deleteRow(0);
        // get all rows
        let rows = table.getElementsByTagName('tr');
        let data = [];
        for (let j = 0; j < rows.length; j++) {
          let row = rows[j];
          let cells = row.getElementsByTagName('td');
          let rowData = {};
          // populate row data
          for (let k = 0; k < cells.length; k++) {
            let cell = cells[k];
            // get all <p> elements
            let paragraphs = cell.getElementsByTagName('p');
            let text = '';
            for (let p of paragraphs) {
              // if there is text in the paragraph
              if (p.textContent !== '') {
                text += p.textContent;
                text += '\n';
              } else {
                // if there are <img> elements
                let images = p.getElementsByTagName('img');
                for (let img of images) {
                  let imgSrc = img.src;
                  // if imgSrc not incluse 'emf', save the src into the text
                  if (!imgSrc.includes('emf')) {
                    text += imgSrc;
                  }
                }
              }
            }
            rowData[headerElements[k].textContent] = text;
          }
          data.push(rowData);
        }
        resolve([headers, data]);
      })
      .catch(function (error) {
        console.error(error);
        reject(error);
      });
  });
}

export function createJson(file: File, type: string): Promise<Blob> {
  return new Promise(async (resolve) => {
    let headers: string[], data: any[];
    if (type === 'csv') {
      [headers, data] = await parseCSV(file);
    } else if (type === 'xlsx') {
      [headers, data] = await parseXLSX(file);
    } else if (type === 'doc' || type === 'docx') {
      let arrayBuffer = await file.arrayBuffer();
      [headers, data] = await parseWORD(arrayBuffer);
    } else {
      console.error('Unsupported file format');
      return;
    }
    const jsonBlob = new Blob([JSON.stringify([headers, ...data], null, 2)], {
      type: 'application/json',
    });
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
export function addDocument(
  id: string,
  name: string,
  content: Blob,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.put({
      _id: id,
      name: name,
      _attachments: {
        table: {
          content_type: 'application/json',
          data: content,
        },
      },
    })
      .then(() => {
        resolve(true);
      })
      .catch((err) => {
        window.alert(
          `Error Uploading Document: ${err.message}, title: ${name}, id: ${id}.`,
        );
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
      .then((doc) => {
        db.remove(doc)
          .then((_) => {
            resolve(true);
          })
          .catch((err) => {
            console.log(err);
            reject(err);
          });
      })
      .catch((err) => {
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
    db.get<Doc>(id)
      .then((doc) => {
        doc.name = newName;
        return db.put(doc);
      })
      .catch((err) => reject(err)); // db.get
  });
}

/**
 * Update the doc from the database
 * @param id
 * @param body [header, ...content]
 * @returns Promise<boolean>
 */
export async function updateAttachment(
  id: string,
  body: any[],
): Promise<boolean> {
  try {
    // Retrieve the document using the provided id
    const doc = await db.get(id);

    // Convert the body array to a JSON blob
    const jsonBlob = new Blob([JSON.stringify(body)], {
      type: 'application/json',
    });

    // Update the attachment
    doc._attachments = doc._attachments || {};
    doc._attachments['table'] = {
      content_type: 'application/json',
      data: jsonBlob,
    };

    // Save the document back to the database
    await db.put(doc);

    return true;
  } catch (error) {
    console.error('Error updating attachment:', error);
    return false;
  }
}

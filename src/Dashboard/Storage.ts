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


async function parseXLSX(file: File): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const data = await workbook.xlsx.load(file.arrayBuffer());
    // to json
    var worksheet = data.worksheets[0];
    var headerNames = [];
    worksheet.eachRow({ includeEmpty: true }, function(row, rowNumber) {
      if (rowNumber === 1) {
        row.values.forEach((header) => {
          headerNames.push(header.toString());
        });
      }
    });
    var rows = [];
    worksheet.eachRow({ includeEmpty: true }, function(row, rowNumber) {
      if (rowNumber !== 1) {
        var rowData = {};
        row.values.forEach((cell, cellNumber) => {
          var headerKey = headerNames[cellNumber - 1];
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
      const img = workbook.model.media.find(m => m.index === image.imageId);
      const base64 = img.buffer.toString('base64');
      const dataUrl = `data:${img.type};base64,${base64}`;
      rows[image.range.tl.nativeRow - 1]['imagePath'] = dataUrl;
    }
    resolve(rows);
  });
}


async function parseWORD(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    var mammoth = require("mammoth");
    mammoth.convertToHtml({arrayBuffer: file.arrayBuffer()})
      .then(function(result){
          var html = result.value;
          var messages = result.messages;
          console.log(messages);

          // html to dom
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          // extract tables
          var table = doc.getElementsByTagName('table')[0];
          var headers = table.getElementsByTagName('tr')[0].getElementsByTagName('td');
          // remove header row
          table.deleteRow(0);
          // get all rows
          var rows = table.getElementsByTagName('tr');
          var data = [];
          for (var j = 0; j < rows.length; j++) {
              var row = rows[j];
              var cells = row.getElementsByTagName('td');
              // initialize row data
              var rowData = {};
              for (var header of headers) {
                  rowData[header.textContent] = '';
              }
              // populate row data
              for (var k = 0; k < cells.length; k++) {
                  var cell = cells[k];
                  // get all <p> elements
                  var paragraphs = cell.getElementsByTagName('p');
                  var text = '';
                  for (var p of paragraphs) {
                      // if there is text in the paragraph
                      if (p.textContent !== '') {
                          text += p.textContent;
                          text += '\n';
                      } else {
                          // if there are <img> elements
                          var images = p.getElementsByTagName('img');
                          for (var img of images) {
                              var imgSrc = img.src;
                              // if imgSrc not incluse 'emf', save the src into the text
                              if (!imgSrc.includes('emf')) {
                                  text += imgSrc;
                              }
                          }
                      }
                  }
                  rowData[headers[k].textContent] = text;
              }
              data.push(rowData);
          }
          resolve(data);
      })
      .catch(function(error) {
          console.error(error);
          reject(error);
      });
  });
}

export function createJson(file: File, type: string): Promise<Blob> {
  return new Promise(async (resolve) => {
    let data: any[];
    if ( type === 'csv' ) {
      data = await parseCSV(file);
    } else if ( type === 'xlsx') {
      data = await parseXLSX(file);
    } else if ( type === 'doc' || type === 'docx') {
      data = await parseWORD(file);
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

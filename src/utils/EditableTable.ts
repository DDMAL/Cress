import Handsontable from 'handsontable';
import * as Validation from '../Validation';

export class EditableTable {
  private exportToCsvButton: HTMLElement;
  private exportToExcelButton: HTMLElement;
  private table: Handsontable;

  constructor(inputHeader: string[], body: any[]) {
    const container = document.getElementById('hot-container');

    // headers for the table
    const headers = ['image', 'name', 'classification', 'mei'];

    // for loop to get the columns
    const columns = [];
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].includes('image')) {
        let inputImgHeader = inputHeader.find((header) =>
          header.includes('image')
        );
        columns.push({
          data: inputImgHeader,
          renderer: this.imgRenderer,
          readOnly: false,
        });
      } else if (headers[i].includes('mei')) {
        columns.push({
          data: headers[i],
          validator: Validation.meiValidator,
          allowInvalid: true,
        });
      } else {
        columns.push({
          data: headers[i],
        });
      }
    }

    // column widths
    const colWidths = [];
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].includes('image')) {
        colWidths.push(150);
      } else if (headers[i].includes('mei')) {
        colWidths.push(200);
      } else {
        colWidths.push(100);
      }
    }

    // create indices for the rows
    const indices = [];
    // get mei for validation
    const meiData = [];
    for (let i = 0; i < body.length; i++) {
      indices.push(i + 1);
      meiData.push(body[i].mei);
    }

    this.table = new Handsontable(container, {
      data: body,
      startCols: 11,
      startRows: body.length,
      height: '91vh',
      width: '100%',
      manualRowResize: true,
      manualColumnResize: true,
      manualRowMove: true,
      selectionMode: 'multiple',
      rowHeights: 100,
      colWidths: colWidths,
      columns: columns,
      rowHeaders: indices,
      colHeaders: headers,
      stretchH: 'all',
      minSpareRows: 0,
      autoWrapRow: true,
      autoWrapCol: true,
      contextMenu: true,
      dropdownMenu: true,
      className: 'table-menu-btn',
      licenseKey: 'non-commercial-and-evaluation',
      afterChange() {
        this.validateCells();
      },
    });

    this.exportToCsvButton = document.getElementById('export-to-csv');
    const exportPlugin = this.table.getPlugin('exportFile');
    this.exportToCsvButton.addEventListener('click', () => {
      exportPlugin.downloadFile('csv', {
        bom: true,
        columnDelimiter: ',',
        rowHeaders: false,
        columnHeaders: true,
        exportHiddenColumns: true,
        exportHiddenRows: true,
        fileExtension: 'csv',
        filename: 'table-CSV-file_[YYYY]-[MM]-[DD]',
        mimeType: 'text/csv;charset=UTF-8',
        rowDelimiter: '\r\n',
      });
    });

    this.exportToExcelButton = document.getElementById('export-to-excel');
    this.exportToExcelButton.addEventListener('click', async () => {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      worksheet.properties.defaultRowHeight = 60;
      worksheet.properties.defaultColWidth = 30;

      // Add headers to exported excel file
      worksheet.addRow(headers);

      // Add body data to exported excel file
      for (let i = 0; i < body.length; i++) {
        const row = [];
        for (let j = 0; j < headers.length; j++) {
          let inputCurrentHeader = inputHeader.find((header) =>
            header.includes(headers[j])
          );
          let cellValue = body[i][inputCurrentHeader];
          // check if cellValue is an image
          if (headers[j].includes('image')) {
            if (cellValue.includes('http') || cellValue.includes('base64')) {
              cellValue = '';
              // Add image to excel file
              const img = workbook.addImage({
                base64: body[i][inputCurrentHeader],
                extension: 'png',
              });
              // get the size of the image
              const [width, height] = await this.getImageDimensions(
                body[i][inputCurrentHeader]
              );
              worksheet.addImage(img, {
                tl: { col: j, row: i + 1 },
                ext: { width: width, height: height },
              });
            }
          }
          row.push(cellValue);
        }
        worksheet.insertRow(i + 2, row);
      }

      // for all columns, set alignment
      worksheet.columns.forEach((column) => {
        column.eachCell((cell) => {
          cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        });
      });

      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const fileName = `table-XLSX-file_${year}-${month}-${day}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();

      window.URL.revokeObjectURL(url);
    });
  }

  // Render image and upload buttons if no image found
  imgRenderer = (instance, td, row, col, prop, value, cellProperties) => {
    td.innerText = '';
    if (value && (value.includes('http') || value.includes('base64'))) {
      const container = document.createElement('div');
      container.style.paddingTop = '5px';
      const img = this.createImageElement(value);
      const buttons = this.createButtons(instance, row, col);

      container.appendChild(img);
      container.appendChild(buttons);

      td.appendChild(container);
      cellProperties.readOnly = true;
    } else if (!value) {
      const input = this.handleImgUpload(instance, row, col);
      td.appendChild(input);
      cellProperties.readOnly = true;
    } else {
      td.innerText = value;
    }
    return td;
  };

  handleImgUpload = (instance, row, col) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*'; // Only accept image upload
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.padding = '5px';
    input.addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = e.target.result as string;
          instance.setDataAtCell(row, col, base64String);
        };
        reader.readAsDataURL(file);
      }
    });
    return input;
  };

  createImageElement = (value) => {
    const img = document.createElement('img');
    img.style.overflow = 'hidden';
    img.style.maxWidth = '100px';
    img.style.maxHeight = '60px';
    img.src = value;
    img.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    return img;
  };

  createButtons = (instance, row, col) => {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.marginTop = '5px';

    const deleteButton = document.createElement('button');
    deleteButton.innerText = 'Delete Image';
    deleteButton.style.marginRight = '5px';
    deleteButton.addEventListener('click', () => {
      instance.setDataAtCell(row, col, '');
      instance.render();
    });

    const changeButton = document.createElement('button');
    changeButton.innerText = 'Change Image';
    changeButton.addEventListener('click', () => {
      const changeInput = this.handleImgUpload(instance, row, col);
      changeInput.click();
    });

    buttonContainer.appendChild(deleteButton);
    buttonContainer.appendChild(changeButton);

    return buttonContainer;
  };

  // Function to get image dimensions from a base64 string
  getImageDimensions = (base64String: string): Promise<[number, number]> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const maxWidth = 60;
      const maxHeight = 60;
      img.onload = () => {
        // Resize image if it's too big or too small
        const widthRatio = maxWidth / img.width;
        const heightRatio = maxHeight / img.height;
        let ratio;
        if (img.width > maxWidth || img.height > maxHeight) {
          ratio = Math.min(widthRatio, heightRatio);
        }
        else {
          ratio = Math.max(widthRatio, heightRatio);
        }
        img.width = img.width * ratio;
        img.height = img.height * ratio;
        resolve([img.width, img.height]);
      };
      img.onerror = reject;
      img.src = base64String;
    });
  };
}

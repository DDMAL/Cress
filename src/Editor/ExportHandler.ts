import { saveAs } from 'file-saver';

export class ExportHandler {
  exportToCsv(exportPlugin: any) {
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
  }

  async exportToExcel(inputHeader: string[], body: any[], headers: string[], images: any[]) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.properties.defaultRowHeight = 150;
    worksheet.columns = headers.map(header => {
      return { width: header.includes('mei') ? 70 : 30 };
    });

    worksheet.addRow(headers);

    for (let i = 0; i < body.length; i++) {
      const row = [];
      for (let j = 0; j < headers.length; j++) {
        let inputCurrentHeader = inputHeader.find(header => header.includes(headers[j]));
        let cellValue = body[i][inputCurrentHeader];
        if (headers[j].includes('image')) {
          if (cellValue.includes('http') || cellValue.includes('base64')) {
            cellValue = '';
            const img = workbook.addImage({
              base64: body[i][inputCurrentHeader],
              extension: 'png',
            });
            const image = images.find(image => image.row === i);
            const width = image.width;
            const height = image.height;
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

    worksheet.columns.forEach(column => {
      column.eachCell(cell => {
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
    saveAs(blob, fileName);
  }
}

import Handsontable from 'handsontable';

export class EditableTable {

    private exportButton: HTMLElement;
    private table: Handsontable;

    constructor (data: any[]) {
        const container = document.getElementById('hot-container');

        // get headers
        const headers = data[0].slice(0, 11);

        // remove the header
        data = data.slice(1);
        data = data.map(row => row.slice(0, 11));
        console.log(data);

        // create indices for the rows
        const indices = [];
        for (let i = 1; i <= data.length; i++) {
            indices.push(i);
        }

        this.table = new Handsontable(container, {
            data: data,
            startCols: 11,
            startRows: data.length,
            height: 'auto', // '91vh',
            width: '100%',
            manualRowResize: true,
            manualColumnResize: true,
            manualRowMove: true,
            selectionMode: 'multiple',
            rowHeights: 30,
            colWidths: [120, 120, 100, 50, 80, 120, 60, 150, 50, 50, 130],
            columns: [{ renderer: this.imgRenderer }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
            rowHeaders: indices,
            colHeaders: headers,
            stretchH: 'all',
            minSpareRows: 2,
            autoWrapRow: true,
            autoWrapCol: true,
            contextMenu: true,
            dropdownMenu: true,
            className: 'customMenuButton',
            licenseKey: 'non-commercial-and-evaluation',
            afterChange(change, source) {
                if (source === 'loadData') {
                  return;
                }
            },
        });

        this.exportButton = document.getElementById('export');
        const exportPlugin = this.table.getPlugin('exportFile');

        this.exportButton.addEventListener('click', () => {
            exportPlugin.downloadFile('csv', {
                bom: false,
                columnDelimiter: ',',
                rowHeaders: false,
                columnHeaders: true,
                exportHiddenColumns: true,
                exportHiddenRows: true,
                fileExtension: 'csv',
                filename: 'table-CSV-file_[YYYY]-[MM]-[DD]',
                mimeType: 'text/csv',
                rowDelimiter: '\r\n',
            });
        });
    }

    imgRenderer(instance, td, row, col, prop, value, cellProperties) {
        if (!value) {
            return td;
        }
        if (value.includes('http') || value.includes('base64')) {
            const img = document.createElement('img');
            img.style.overflow = 'hidden';
            img.style.maxWidth = '100px';
            img.style.maxHeight = '100px';
            img.src = value;
            img.addEventListener('mousedown', (event) => {
                event.preventDefault();
            });
            td.innerText = '';
            td.appendChild(img);
        } else {
            td.innerText = value;
        }
        return td;
    }
}
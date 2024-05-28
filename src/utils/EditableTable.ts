import Handsontable from 'handsontable';

export class EditableTable {

    private exportButton: HTMLElement;
    private table: Handsontable;

    constructor (data: any[]) {
        const container = document.getElementById('hot-container');
        console.log(data);

        // headers for the table
        const headers = ['imagePath', 'name', 'classification', 'mei'];

        // for loop to get the columns
        const columns = [];
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].includes('image')) {
                columns.push({
                    data: headers[i],
                    renderer: this.imgRenderer,
                    readOnly: true,
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
        for (let i = 0; i < data.length; i++) {
            indices.push(i + 1);
        }

        this.table = new Handsontable(container, {
            data: data,
            startCols: 11,
            startRows: data.length,
            height: '91vh',
            width: '100%',
            manualRowResize: true,
            manualColumnResize: true,
            manualRowMove: true,
            selectionMode: 'multiple',
            rowHeights: 30,
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
        if (!value.includes('http') && !value.includes('base64')) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.addEventListener('change', (event) => {
                const file = (event.target as HTMLInputElement).files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64String = (e.target.result as string);
                        instance.setDataAtCell(row, col, base64String);
                    };
                    reader.readAsDataURL(file);
                }
            });
            td.innerText = '';
            td.appendChild(input);
        } else {
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
        }
        return td;
    }
}
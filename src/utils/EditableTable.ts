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
        } else {
            const input = this.handleFileUpload(instance, row, col);
            td.appendChild(input);
        }
        return td;
    }

    handleFileUpload = (instance, row, col) =>  {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.padding = '5px';
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
        return input;
    }

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
    }

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
            const changeInput = this.handleFileUpload(instance, row, col);
            changeInput.click();
        });

        buttonContainer.appendChild(deleteButton);
        buttonContainer.appendChild(changeButton);

        return buttonContainer;
    }
}
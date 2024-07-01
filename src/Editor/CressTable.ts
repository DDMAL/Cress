import Handsontable from 'handsontable';
import * as Validation from '../Validation';
import { ImageHandler } from './ImageHandler';
import { ExportHandler } from './ExportHandler';
import { ColumnTools } from './ColumnTools';
import { updateAttachment } from '../Dashboard/Storage';
import { setSavedStatus } from '../utils/Unsaved';
import * as Notification from '../utils/Notification';

export class CressTable {
  private table: Handsontable;
  private images: any[] = []; // Array to store images
  private imageHandler: ImageHandler;
  private exportHandler: ExportHandler;
  private ColumnTools: ColumnTools;

  constructor(id: string, inputHeader: string[], body: any[]) {
    const container = document.getElementById('hot-container');

    // Initialize handlers
    this.imageHandler = new ImageHandler(this.images);
    this.exportHandler = new ExportHandler();
    this.ColumnTools = new ColumnTools(inputHeader);

    // Convert all quote signs to inch marks in mei data
    this.ColumnTools.convertMeiQuoteSign(body);

    // Register the custom image renderer
    Handsontable.renderers.registerRenderer(
      'imgRenderer',
      this.imageHandler.imgRender.bind(this.imageHandler),
    );

    // Prepare table configuration
    const headers = ['image', 'name', 'classification', 'mei'];
    const columns = this.ColumnTools.getColumns(headers);
    const colWidths = this.ColumnTools.getColWidths(headers);
    const indices = this.ColumnTools.getIndices(body).map(String);

    // Process images
    let inputImgHeader = inputHeader.find((header) => header.includes('image'));
    this.imageHandler.storeImages(inputImgHeader, body);

    // Initialize table
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
        setSavedStatus(false);
        this.validateCells();
      },
      beforeValidate: (value) => this.setProcessStatus(value),
      afterValidate: (isValid) => this.setResultStatus(isValid),
    });

    this.initFileListener(id, inputHeader, body, headers);
  }

  private initFileListener(
    id: string,
    inputHeader: string[],
    body: any[],
    headers: string[],
  ) {
    const exportPlugin = this.table.getPlugin('exportFile');
    document.getElementById('export-to-csv').addEventListener('click', () => {
      this.exportHandler.exportToCsv(exportPlugin);
    });

    document
      .getElementById('export-to-excel')
      .addEventListener('click', async () => {
        await this.exportHandler.exportToExcel(
          inputHeader,
          body,
          headers,
          this.images,
        );
      });

    document.getElementById('save').addEventListener('click', async () => {
      const result = await updateAttachment(id, [inputHeader, ...body]);

      if (result) {
        setSavedStatus(true);
        Notification.queueNotification('Saved', 'success');
      } else {
        Notification.queueNotification('Save failed', 'error');
      }
    });

    document.body.addEventListener('keydown', async (evt) => {
      if (evt.key === 's') {
        const result = await updateAttachment(id, [inputHeader, ...body]);

        if (result) {
          setSavedStatus(true);
          Notification.queueNotification('Saved', 'success');
        } else {
          Notification.queueNotification('Save failed', 'error');
        }
      }
    });
  }

  private setProcessStatus(value: any) {
    if (!this.ColumnTools.validationInProgress) {
      this.ColumnTools.validationInProgress = true;
      Validation.updateStatus('processing');
    }
    // Update `pendingValidations` if value is not empty
    if (value) this.ColumnTools.pendingValidations++;
  }

  private setResultStatus(isValid: boolean) {
    if (!isValid) this.ColumnTools.hasInvalid = true;
    this.ColumnTools.pendingValidations--;
    if (this.ColumnTools.pendingValidations === 0) {
      this.ColumnTools.validationInProgress = false;
      Validation.updateStatus('done', this.ColumnTools.hasInvalid);
      this.ColumnTools.hasInvalid = false;
    }
  }
}

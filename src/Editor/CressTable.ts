import Handsontable from 'handsontable';
import * as Validation from '../Validation';
import { ImageHandler } from './ImageHandler';
import { ExportHandler } from './ExportHandler';
import { ColumnTools } from './ColumnTools';

export class CressTable {
  private exportToCsvButton: HTMLElement;
  private exportToExcelButton: HTMLElement;
  private table: Handsontable;
  private images: any[] = []; // Array to store images
  private imageHandler: ImageHandler;
  private exportHandler: ExportHandler;
  private ColumnTools: ColumnTools;

  constructor(inputHeader: string[], body: any[]) {
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
      this.imageHandler.imgRender.bind(this.imageHandler)
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
        this.validateCells();
      },
      beforeValidate: (value) => this.setProcessStatus(value),
      afterValidate: (isValid) => this.setResultStatus(isValid),
    });

    this.initializeExportButtons(inputHeader, body, headers);
  }

  private initializeExportButtons(
    inputHeader: string[],
    body: any[],
    headers: string[]
  ) {
    this.exportToCsvButton = document.getElementById('export-to-csv');
    const exportPlugin = this.table.getPlugin('exportFile');
    this.exportToCsvButton.addEventListener('click', () => {
      this.exportHandler.exportToCsv(exportPlugin);
    });

    this.exportToExcelButton = document.getElementById('export-to-excel');
    this.exportToExcelButton.addEventListener('click', async () => {
      await this.exportHandler.exportToExcel(
        inputHeader,
        body,
        headers,
        this.images
      );
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
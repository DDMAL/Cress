import Handsontable from 'handsontable';
import * as Validation from '../Validation';
import { ImageHandler } from './ImageHandler';
import { ExportHandler } from './ExportHandler';
import { ColumnHelper } from './ColumnHelper';

export class Table {
  private exportToCsvButton: HTMLElement;
  private exportToExcelButton: HTMLElement;
  private table: Handsontable;
  private images: any[] = []; // Array to store images
  private imageHandler: ImageHandler;
  private exportHandler: ExportHandler;
  private columnHelper: ColumnHelper;

  constructor(inputHeader: string[], body: any[]) {
    const container = document.getElementById('hot-container');

    // Initialize handlers
    this.imageHandler = new ImageHandler(this.images);
    this.exportHandler = new ExportHandler();
    this.columnHelper = new ColumnHelper(inputHeader);

    // Convert all quote signs to inch marks in mei data
    this.columnHelper.convertMeiQuotes(body);

    // Register the custom image renderer
    Handsontable.renderers.registerRenderer(
      'imgRenderer', 
      this.imageHandler.imgRender.bind(this.imageHandler)
    );

    // Prepare table configuration
    const headers = ['image', 'name', 'classification', 'mei'];
    const columns = this.columnHelper.getColumns(headers);
    const colWidths = this.columnHelper.getColWidths(headers);
    const indices = this.columnHelper.getIndices(body).map(String);
    const meiData = this.columnHelper.getMeiData(body);

    // Process images
    let inputImgHeader = inputHeader.find(header => header.includes('image'));
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
      beforeValidate: (value) => this.beforeValidate(value),
      afterValidate: (isValid) => this.afterValidate(isValid),
    });

    this.initializeExportButtons(inputHeader, body, headers);
  }

  private initializeExportButtons(inputHeader: string[], body: any[], headers: string[]) {
    this.exportToCsvButton = document.getElementById('export-to-csv');
    const exportPlugin = this.table.getPlugin('exportFile');
    this.exportToCsvButton.addEventListener('click', () => {
      this.exportHandler.exportToCsv(exportPlugin);
    });

    this.exportToExcelButton = document.getElementById('export-to-excel');
    this.exportToExcelButton.addEventListener('click', async () => {
      await this.exportHandler.exportToExcel(inputHeader, body, headers, this.images);
    });
  }

  private beforeValidate(value: any) {
    if (!this.columnHelper.validationInProgress) {
      this.columnHelper.validationInProgress = true;
      Validation.updateStatus('processing');
    }
    if (value) this.columnHelper.pendingValidations++;
  }

  private afterValidate(isValid: boolean) {
    if (!isValid) this.columnHelper.hasInvalid = true;
    this.columnHelper.pendingValidations--;
    if (this.columnHelper.pendingValidations === 0) {
      this.columnHelper.validationInProgress = false;
      Validation.updateStatus('done', this.columnHelper.hasInvalid);
      this.columnHelper.hasInvalid = false;
    }
  }
}

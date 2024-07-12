import Handsontable from 'handsontable';
import { ImageTools } from './ImageTools';
import { MeiTools } from './MeiTools';
import { ValidationTools } from './ValidationTools';
import { ExportTools } from './ExportTools';
import { ColumnTools } from './ColumnTools';
import { updateAttachment } from '../Dashboard/Storage';
import { setSavedStatus } from '../utils/Unsaved';
import * as Notification from '../utils/Notification';
import { TableEvent } from '../Types';

const changeHooks: TableEvent[] = [
  'afterChange',
  'afterColumnMove',
  'afterColumnSequenceChange',
  'afterCreateCol',
  'afterCreateRow',
  'afterCut',
  'afterRemoveCol',
  'afterRemoveRow',
  'afterRowMove',
  'afterRowSequenceChange',
];

export class CressTable {
  private table: Handsontable;
  private images: any[] = []; // Array to store images
  private imageTools: ImageTools;
  private meiTools: MeiTools;
  private validationTools: ValidationTools;
  private exportTools: ExportTools;
  private columnTools: ColumnTools;

  constructor(id: string, inputHeader: string[], body: any[]) {
    const container = document.getElementById('hot-container');

    // Initialize Toolss
    this.imageTools = new ImageTools(this.images);
    this.meiTools = new MeiTools();
    this.validationTools = new ValidationTools();
    this.exportTools = new ExportTools();
    this.columnTools = new ColumnTools(inputHeader);

    // Convert all quote signs to inch marks in mei data
    this.columnTools.convertMeiQuoteSign(body);

    // Register the custom image renderer
    Handsontable.renderers.registerRenderer(
      'imgRenderer',
      this.imageTools.imgRender.bind(this.imageTools),
    );

    // Register the custom mei renderer
    Handsontable.renderers.registerRenderer(
      'meiRenderer',
      this.meiTools.meiRender.bind(this.meiTools),
    );

    // Prepare table configuration
    const headers = ['image', 'name', 'classification', 'mei'];
    const columns = this.columnTools.getColumns(headers);
    const colWidths = this.columnTools.getColWidths(headers);
    const indices = this.columnTools.getIndices(body).map(String);

    // Process images
    let inputImgHeader = inputHeader.find((header) => header.includes('image'));
    this.imageTools.storeImages(inputImgHeader, body);

    // Process mei data
    let inputMeiHeader = inputHeader.find((header) => header.includes('mei'));
    this.meiTools.initMeiData(inputMeiHeader, body);

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
      afterChange: (changes, source) => this.validateMei(changes, source),
    });

    this.initFileListener(id, inputHeader, body, headers);
    this.initChangeListener();
  }

  private initFileListener(
    id: string,
    inputHeader: string[],
    body: any[],
    headers: string[],
  ) {
    const exportPlugin = this.table.getPlugin('exportFile');
    document.getElementById('export-to-csv').addEventListener('click', () => {
      this.exportTools.exportToCsv(exportPlugin);
    });

    document
      .getElementById('export-to-excel')
      .addEventListener('click', async () => {
        await this.exportTools.exportToExcel(
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

  private initChangeListener() {
    changeHooks.forEach((hook) => {
      this.table.addHook(hook, (source) => {
        if (source != 'loadData') {
          if (hook === 'afterChange') {
            const oldValue = source[0][2];
            const newValue = source[0][3];
            if (oldValue !== newValue) setSavedStatus(false);
          } else {
            setSavedStatus(false);
          }
        }
      });
    });
  }

  private validateMei(changes, source) {
    if (source == 'loadData') {
      // Validate mei data and update the validation status
      this.meiTools.getMeiData().forEach((mei) => {
        this.meiTools.setProcessStatus(mei);
        this.validationTools
          .meiValidator(mei.mei)
          .then(([isValid, errorMsg]) => {
            this.meiTools.updateMeiData(mei.row, mei.mei, isValid, errorMsg);
            this.table.render();
            this.meiTools.setResultStatus();
          });
      });
    } else {
      changes?.forEach(([row, prop, oldValue, newValue]) => {
        if (prop === 'mei' && oldValue !== newValue) {
          // validate the new edited mei data and update the validation status
          this.meiTools.setProcessStatus(newValue);
          this.meiTools.updateMeiData(row, newValue, undefined, undefined);
          this.table.render();
          this.validationTools
            .meiValidator(newValue)
            .then(([isValid, errorMsg]) => {
              this.meiTools.updateMeiData(row, undefined, isValid, errorMsg);
              this.table.render();
              this.meiTools.setResultStatus();
            });
        }
      });
    }
  }
}

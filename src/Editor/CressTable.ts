import {
  getMappingStorage,
  ensureReady,
  nameToPath,
} from '../Dashboard/githubStorage/createMappingStorage';
import { cressPayloadToRows } from '../Dashboard/githubStorage';

import Handsontable from 'handsontable';
import { ImageTools } from './ImageTools';
import { MeiTools } from './MeiTools';
import { ExportTools } from './ExportTools';
import { ColumnTools } from './ColumnTools';
import { updateAttachment } from '../Dashboard/Storage';
import { setSavedStatus } from '../utils/Unsaved';
import * as Notification from '../utils/Notification';
import { TableEvent } from '../Types';
import { FilterSidebar } from './hierarchicalFilter/FilterSidebar';

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
  private exportTools: ExportTools;
  private columnTools: ColumnTools;
  private defaultHeader = ['image', 'name', 'classification', 'mei'];
  private filterSidebar: FilterSidebar | null = null;
  private savePath: string;

  // constructor(id: string, inputHeader: string[], body: any[]) {
  constructor(
    id: string,
    name: string,
    inputHeader: string[],
    body: any[],
  ) {
    // const container = document.getElementById('hot-container');
    const container = document.getElementById('hot-container');
    this.savePath = nameToPath(name);

    // Initialize Toolss
    this.imageTools = new ImageTools(this.images);
    this.meiTools = new MeiTools();
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
    const columns = this.columnTools.getColumns(this.defaultHeader);
    const colWidths = this.columnTools.getColWidths(this.defaultHeader);
    const indices = this.columnTools.getIndices(body).map(String);

    // Process images
    let inputImgHeader = inputHeader.find(
      (header) =>
        header.toLowerCase().includes('image') ||
        header.toLowerCase().includes('img'),
    );
    if (inputImgHeader) {
      this.imageTools.storeImages(inputImgHeader, body);
    } else {
      Notification.queueNotification('Failed to extract image data', 'error');
    }

    // Process mei data
    let inputMeiHeader = inputHeader.find((header) =>
      header.toLowerCase().includes('mei'),
    );
    if (inputMeiHeader) {
      this.meiTools.initMeiData(inputMeiHeader, body);
    } else {
      Notification.queueNotification('Failed to extract MEI data', 'error');
    }

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
      colHeaders: this.defaultHeader,
      stretchH: 'all',
      minSpareRows: 0,
      autoWrapRow: true,
      autoWrapCol: true,
      contextMenu: true,
      // === DROPDOWN MENU: custom items, NO filter_by_condition / filter_by_value ===
      // Filter is handled by the hierarchical filter sidebar instead.
      dropdownMenu: {
        items: {
          col_left: { name: 'Insert column left' },
          col_right: { name: 'Insert column right' },
          remove_col: { name: 'Remove column' },
          separator1: { name: '---------' },
          clear_column: { name: 'Clear column' },
          separator2: { name: '---------' },
          make_read_only: { name: 'Read only' },
          alignment: {},
        },
      },
      filters: true,
      columnSorting: true,
      className: 'table-menu-btn',
      licenseKey: 'non-commercial-and-evaluation',
      afterLoadData: (_, initialLoad) => {
        if (initialLoad) setTimeout(this.initValidationListener.bind(this), 0);
      },
    });

    this.initFileListener(id, inputHeader, body, this.defaultHeader);
    this.initChangeListener();
    this.initFilterSidebar();
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
          await this.saveTable(inputHeader, body);
        });

    document.body.addEventListener('keydown', async (evt) => {
          if (evt.key === 's') {
            await this.saveTable(inputHeader, body);
          }
        });
  }
  private async saveTable(inputHeader: string[], body: any[]): Promise<void> {
      try {
        // Create the user's mappings repo on first save (no-op if it exists or
        // logged out). The Option-2 asymmetry is hidden in the wiring layer.
        await ensureReady();

        // Cress internal [headers, ...rowObjects] -> string[][] for the CSV layer.
        const payload = [inputHeader, ...body] as [
          string[],
          ...Array<Record<string, unknown>>,
        ];
        const rows = cressPayloadToRows(payload);

        const outcome = await getMappingStorage().saveMapping(this.savePath, rows);

        if (outcome.status === 'conflict') {
          setSavedStatus(false);
          Notification.queueNotification(
            'Save conflict: the remote file changed',
            'error',
          );
          return;
        }

        setSavedStatus(true);
        Notification.queueNotification('Saved', 'success');
      } catch (e) {
        console.error('saveTable failed:', e);
        setSavedStatus(false);
        Notification.queueNotification('Save failed', 'error');
      }
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

  private initValidationListener() {
    this.meiTools.validateMei(this.table, 'afterLoadData');
    this.table.addHook('afterChange', (changes, _) => {
      this.meiTools.validateMei(this.table, 'afterChange', changes);
    });
  }

  // === HIERARCHICAL FILTER ===
  private initFilterSidebar(): void {
    // Plain text button — matches File / Help style (no arrow icon)
    const filterBtn = document.createElement('div');
    filterBtn.className = 'filter-toolbar-btn';
    filterBtn.id = 'filter-toolbar-btn';
    filterBtn.textContent = 'Filter';
    filterBtn.title = 'Toggle classification filter panel';

    const bottomRow = document.querySelector(
      '.navbar-main-content-container-bottom',
    );
    if (bottomRow) {
      bottomRow.appendChild(filterBtn);
    }

    const editorContainer = document.getElementById('editor-body-container');
    if (!editorContainer) return;

    this.filterSidebar = new FilterSidebar(editorContainer, this.table);

    this.filterSidebar.onToggle((isOpen: boolean) => {
      filterBtn.classList.toggle('active', isOpen);
      setTimeout(() => {
        this.table.refreshDimensions();
      }, 260);
    });

    filterBtn.addEventListener('click', () => {
      if (this.filterSidebar) {
        this.filterSidebar.toggle();
      }
    });
  }
}

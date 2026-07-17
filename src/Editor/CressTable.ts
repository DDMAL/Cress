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
  private readOnly: boolean;

  // constructor(id: string, inputHeader: string[], body: any[]) {
  constructor(
    id: string,
    name: string,
    inputHeader: string[],
    body: any[],
    readOnly = false,
    owner?: string,
  ) {
    // const container = document.getElementById('hot-container');
    const container = document.getElementById('hot-container');
    this.savePath = nameToPath(name);
    this.readOnly = readOnly;

    // Initialize Toolss
    this.imageTools = new ImageTools(this.images, readOnly);
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
      // Read-only foreign view (#151): block cell editing and hide the
      // row/column mutation menus. Sorting (columnSorting) and the filter
      // sidebar stay available for inspection.
      readOnly: this.readOnly,
      contextMenu: !this.readOnly,
      // === DROPDOWN MENU: custom items, NO filter_by_condition / filter_by_value ===
      // Filter is handled by the hierarchical filter sidebar instead.
      dropdownMenu: this.readOnly
        ? false
        : {
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

    // #158 (Option 1, chosen by Gen): while a mei cell is in edit mode,
    // show a small hint bar attached to the bottom of the editor with the
    // new-line shortcut. Purely additive: the hint lives inside the editor's
    // input holder, so it appears/disappears together with the editor and
    // never affects other columns or read-only mode.
    this.table.addHook('afterBeginEditing', (_row, col) => {
      const editor = this.table.getActiveEditor() as any;
      const textarea: HTMLTextAreaElement | undefined = editor?.TEXTAREA;
      const holder: HTMLElement | null = textarea?.parentElement ?? null;
      if (!holder) return;
      let hint = holder.querySelector('.mei-editor-hint') as HTMLElement | null;
      if (this.table.colToProp(col) !== 'mei') {
        if (hint) hint.style.display = 'none';
        return;
      }
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'mei-editor-hint';
        hint.textContent = 'New line: Cmd+Enter (Mac) / Alt+Enter (Windows)';
        holder.appendChild(hint);
      }
      hint.style.display = 'block';
    });

    this.initFileListener(id, inputHeader, body, this.defaultHeader);
    // No change tracking in read-only mode: there are no edits to track, and
    // setSavedStatus(false) would wrongly flag an untouched foreign file dirty.
    if (!this.readOnly) {
      this.initChangeListener();
    }
    this.initFilterSidebar();

    if (this.readOnly) {
      this.applyReadOnlyUI();
    }
  }

  /**
   * Read-only foreign view (#151): remove every path that could write the file
   * back into the current user's repo, and signal the mode in the UI. The
   * cell-level block is handled by Handsontable's readOnly option; this hides
   * the Save control (so the save chain is unreachable) and adds a read-only
   * label in the top status row, next to "MEI Status" (both describe the file's
   * state). Which user's file it is is already conveyed by context (the tile was
   * opened from that user's row), so the label stays minimal. The 's' hotkey and
   * save-button listeners are never wired in this mode (see initFileListener).
   */
  private applyReadOnlyUI(): void {
    const saveBtn = document.getElementById('save');
    if (saveBtn) saveBtn.style.display = 'none';

    const statusRow = document.querySelector(
      '.navbar-main-content-container-top',
    );
    if (statusRow && !document.getElementById('readonly-banner')) {
      const banner = document.createElement('div');
      banner.id = 'readonly-banner';
      // navbar-element matches the height/padding/font of the sibling status
      // items; readonly-banner adds the muted grey + icon gap (see style.css).
      banner.className = 'navbar-element readonly-banner';
      banner.title = 'Read-only view. Copy this file to your mappings to edit.';
      // Eye icon as an <img> (same pattern as the other icons in assets/img).
      // Source: svgrepo.com/svg/524043/eye (CC0 / public domain). The file's
      // stroke is set to the label grey (#818181) so it matches without CSS.
      const eyeIcon = document.createElement('img');
      eyeIcon.src = './Cress-gh/assets/img/eye-icon.svg';
      eyeIcon.alt = '';
      eyeIcon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = 'Read-only';
      banner.appendChild(eyeIcon);
      banner.appendChild(label);
      statusRow.appendChild(banner);
    }
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

    // Save chain (button + Cmd/Ctrl+S hotkey) is the only way a file is
    // written back to the user's repo. In read-only foreign view it must
    // never be wired, or an autosave-like path could push another user's
    // file into the current user's mappings. Export stays available
    // (read-only safe).
    if (!this.readOnly) {
      document.getElementById('save').addEventListener('click', async () => {
        await this.saveTable(inputHeader, body);
      });

      document.body.addEventListener('keydown', async (evt) => {
        // Only trigger save on Cmd+S (Mac) / Ctrl+S (Windows, Linux).
        // A bare "s" keystroke used to trigger save, which caused
        // accidental saves while typing in a cell.
        if (!(evt.metaKey || evt.ctrlKey) || evt.key.toLowerCase() !== 's')
          return;

        // Prevent the browser's "Save page" dialog, which interrupts
        // in-flight fetch requests and makes the save fail.
        evt.preventDefault();

        // Commit any cell that is currently being edited, so the save
        // includes what the user sees on screen.
        const editor = this.table.getActiveEditor();
        if (editor && editor.isOpened()) {
          editor.finishEditing();
        }

        await this.saveTable(inputHeader, body);
      });
    }
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

      const outcome = await getMappingStorage().saveMapping(
        this.savePath,
        rows,
      );

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

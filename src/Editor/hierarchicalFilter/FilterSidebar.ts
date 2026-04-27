import Handsontable from 'handsontable';
import { FilterTree } from './FilterTree';

/**
 * FilterSidebar — manages the sidebar panel for hierarchical classification
 * filtering. Contains a FilterTree that renders checkboxes from the
 * classification column data.
 *
 * Public API:
 *   - toggle() / open() / close() / isOpen()
 *   - onToggle(cb) — for CressTable to call refreshDimensions
 *   - destroy()
 */
export class FilterSidebar {
  private sidebar: HTMLDivElement;
  private body: HTMLDivElement;
  private _isOpen = false;
  private onToggleCallback: ((isOpen: boolean) => void) | null = null;
  private filterTree: FilterTree | null = null;
  private table: Handsontable | null = null;

  // Resize state
  private isResizing = false;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: (() => void) | null = null;

  constructor(container: HTMLElement, table?: Handsontable) {
    this.table = table ?? null;
    this.sidebar = this.createSidebarDOM();
    container.appendChild(this.sidebar);

    if (this.table) {
      this.initTree();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  toggle(): void {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.sidebar.classList.add('open');
    this.fireToggle();
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.sidebar.style.width = ''; // Clear inline width from resize drag
    this.sidebar.classList.remove('open');
    this.fireToggle();
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  onToggle(cb: (isOpen: boolean) => void): void {
    this.onToggleCallback = cb;
  }

  destroy(): void {
    this.sidebar.remove();
    this.onToggleCallback = null;
    this.filterTree = null;
    this.table = null;
    // Clean up resize listeners
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Tree Initialization                                                */
  /* ------------------------------------------------------------------ */

  private initTree(): void {
    if (!this.table) return;

    // Read classification column (col index 2) from Handsontable
    const classifications = this.table.getDataAtCol(2) as (string | null)[];

    // Create tree component inside sidebar body
    this.filterTree = new FilterTree(this.body);
    this.filterTree.buildFromData(classifications);

    // Wire Apply callback → Handsontable filter
    this.filterTree.onApply((rawValues: string[]) => {
      this.applyFilter(rawValues);
    });

    // Wire Clear callback → clear Handsontable filter
    this.filterTree.onClear(() => {
      this.clearFilter();
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Handsontable Filter Integration                                    */
  /* ------------------------------------------------------------------ */

  private applyFilter(rawValues: string[]): void {
    if (!this.table) return;

    const fp = this.table.getPlugin('filters');
    fp.clearConditions(2);

    if (rawValues.length > 0) {
      // by_value expects an array of allowed values
      fp.addCondition(2, 'by_value', [rawValues]);
    }

    fp.filter();
  }

  private clearFilter(): void {
    if (!this.table) return;

    const fp = this.table.getPlugin('filters');
    fp.clearConditions(2);
    fp.filter();
  }

  /* ------------------------------------------------------------------ */
  /*  Resize Logic                                                       */
  /* ------------------------------------------------------------------ */

  private initResize(handle: HTMLDivElement): void {
    this.boundMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      e.preventDefault();

      // Sidebar is on the right edge. Width = viewport right edge - mouse X.
      const newWidth = window.innerWidth - e.clientX;

      // Clamp between 200px and 600px
      const clamped = Math.max(200, Math.min(600, newWidth));
      this.sidebar.style.width = `${clamped}px`;

      // Refresh Handsontable dimensions live during drag
      if (this.table) {
        this.table.refreshDimensions();
      }
    };

    this.boundMouseUp = () => {
      // Always clean up — no isResizing guard, so cleanup is never skipped
      this.isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      this.sidebar.style.transition = '';
      handle.classList.remove('active');
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      this.isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      handle.classList.add('active');

      // Disable CSS transition during drag for smooth resizing
      this.sidebar.style.transition = 'none';
    });

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  /* ------------------------------------------------------------------ */
  /*  DOM Construction                                                   */
  /* ------------------------------------------------------------------ */

  private createSidebarDOM(): HTMLDivElement {
    const sidebar = document.createElement('div');
    sidebar.className = 'filter-sidebar';

    // --- Resize handle (left edge of sidebar) ---
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'filter-sidebar-resize-handle';
    sidebar.appendChild(resizeHandle);
    this.initResize(resizeHandle);

    // --- Header ---
    const header = document.createElement('div');
    header.className = 'filter-sidebar-header';

    const title = document.createElement('span');
    title.className = 'filter-sidebar-title';
    title.textContent = 'Filter classification';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'filter-sidebar-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close filter panel';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // --- Body ---
    this.body = document.createElement('div');
    this.body.className = 'filter-sidebar-body';

    // --- Footer ---
    const footer = document.createElement('div');
    footer.className = 'filter-sidebar-footer';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'filter-sidebar-btn filter-sidebar-btn-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      if (this.filterTree) {
        this.filterTree.clear();
      }
    });

    const applyBtn = document.createElement('button');
    applyBtn.className = 'filter-sidebar-btn filter-sidebar-btn-apply';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      if (this.filterTree) {
        this.filterTree.apply();
      }
    });

    footer.appendChild(clearBtn);
    footer.appendChild(applyBtn);

    // --- Assemble ---
    sidebar.appendChild(header);
    sidebar.appendChild(this.body);
    sidebar.appendChild(footer);

    return sidebar;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal                                                           */
  /* ------------------------------------------------------------------ */

  private fireToggle(): void {
    if (this.onToggleCallback) {
      this.onToggleCallback(this._isOpen);
    }
  }
}

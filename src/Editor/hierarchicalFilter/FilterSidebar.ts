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
  /*  DOM Construction                                                   */
  /* ------------------------------------------------------------------ */

  private createSidebarDOM(): HTMLDivElement {
    const sidebar = document.createElement('div');
    sidebar.className = 'filter-sidebar';

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

/**
 * FilterSidebar — UI skeleton for the hierarchical classification filter.
 *
 * This class creates and manages the sidebar DOM element. It does NOT
 * contain tree rendering or filter logic — those will be added in later
 * stages. Right now it provides:
 *
 *   - Sidebar DOM creation (header / body placeholder / footer)
 *   - toggle() to open/close
 *   - close() to close only
 *   - isOpen() to query state
 *   - onToggle callback so CressTable can call refreshDimensions
 *   - destroy() for cleanup
 *
 * The sidebar element is appended to a given container (expected to be
 * #editor-body-container). CSS class `.open` controls the width transition.
 */
export class FilterSidebar {
  private sidebar: HTMLDivElement;
  private _isOpen = false;
  private onToggleCallback: ((isOpen: boolean) => void) | null = null;

  constructor(container: HTMLElement) {
    this.sidebar = this.createSidebarDOM();
    container.appendChild(this.sidebar);
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /** Toggle sidebar open/closed. */
  toggle(): void {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Open the sidebar. No-op if already open. */
  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.sidebar.classList.add('open');
    this.fireToggle();
  }

  /** Close the sidebar. No-op if already closed. */
  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.sidebar.classList.remove('open');
    this.fireToggle();
  }

  /** Whether the sidebar is currently open. */
  isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Register a callback that fires after every open/close.
   * CressTable uses this to call refreshDimensions after the CSS
   * transition finishes.
   */
  onToggle(cb: (isOpen: boolean) => void): void {
    this.onToggleCallback = cb;
  }

  /** Remove the sidebar from the DOM and clean up references. */
  destroy(): void {
    this.sidebar.remove();
    this.onToggleCallback = null;
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

    // --- Body (placeholder for now — tree UI goes here in next stage) ---
    const body = document.createElement('div');
    body.className = 'filter-sidebar-body';

    const placeholder = document.createElement('div');
    placeholder.className = 'filter-sidebar-placeholder';
    placeholder.textContent = 'Tree UI goes here';

    body.appendChild(placeholder);

    // --- Footer ---
    const footer = document.createElement('div');
    footer.className = 'filter-sidebar-footer';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'filter-sidebar-btn filter-sidebar-btn-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      // Placeholder — will clear filter state in a later stage
    });

    const applyBtn = document.createElement('button');
    applyBtn.className = 'filter-sidebar-btn filter-sidebar-btn-apply';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      // Placeholder — will apply filter in a later stage
    });

    footer.appendChild(clearBtn);
    footer.appendChild(applyBtn);

    // --- Assemble ---
    sidebar.appendChild(header);
    sidebar.appendChild(body);
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

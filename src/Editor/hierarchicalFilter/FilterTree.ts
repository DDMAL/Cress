import { TreeNode, UNCATEGORIZED_KEY } from './types';
import { parseClassifications } from './classificationTreeParser';

/**
 * Checkbox state for tree nodes.
 * - 'all': node and all descendants are selected
 * - 'none': node and all descendants are unselected
 * - 'some': some descendants are selected (indeterminate)
 */
type CheckState = 'all' | 'none' | 'some';

interface NodeState {
  expanded: boolean;
  checked: CheckState;
}

/**
 * FilterTree — renders a hierarchical classification tree with checkboxes
 * inside a container element (the sidebar body).
 *
 * Usage:
 *   const tree = new FilterTree(bodyEl);
 *   tree.buildFromData(classifications);  // string[]
 *   tree.onApply((rawValues) => { ... }); // selected leaf rawValues
 *   tree.clear();                         // reset all checkboxes
 */
export class FilterTree {
  private container: HTMLElement;
  private root: TreeNode | null = null;
  private stateMap: Map<string, NodeState> = new Map();
  private applyCallback: ((rawValues: string[]) => void) | null = null;
  private clearCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /** Build the tree from classification column data and render. */
  buildFromData(classifications: (string | null | undefined)[]): void {
    this.root = parseClassifications(classifications);
    this.stateMap.clear();
    this.initStates(this.root, '', 0);
    this.render();
  }

  /** Register callback for Apply button. Receives array of rawValues. */
  onApply(cb: (rawValues: string[]) => void): void {
    this.applyCallback = cb;
  }

  /** Register callback for Clear button. */
  onClear(cb: () => void): void {
    this.clearCallback = cb;
  }

  /** Reset all checkboxes to unchecked and re-render. */
  clear(): void {
    for (const state of this.stateMap.values()) {
      state.checked = 'none';
    }
    this.render();
    if (this.clearCallback) {
      this.clearCallback();
    }
  }

  /** Collect rawValues of all selected leaves. */
  getSelectedRawValues(): string[] {
    if (!this.root) return [];
    const result: string[] = [];
    this.collectSelected(this.root, '', result);
    return result;
  }

  /** Trigger apply with current selection. */
  apply(): void {
    const selected = this.getSelectedRawValues();

    // Empty selection = Clear (instead of showing 0 rows)
    if (selected.length === 0) {
      this.clear();
      return;
    }

    if (this.applyCallback) {
      this.applyCallback(selected);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  State Management                                                   */
  /* ------------------------------------------------------------------ */

  private getStateKey(node: TreeNode, parentPath: string): string {
    // Use fullPath for nodes that have it, otherwise build from parent
    if (node.fullPath) return node.fullPath;
    if (node.label === UNCATEGORIZED_KEY) return UNCATEGORIZED_KEY;
    return parentPath ? `${parentPath}.${node.label}` : node.label;
  }

  /** Initialize states. depth=0 is synthetic root, depth=1 = top-level children (expanded by default). */
  private initStates(node: TreeNode, parentPath: string, depth: number): void {
    for (const [, child] of node.children) {
      const key = this.getStateKey(child, parentPath);
      if (!this.stateMap.has(key)) {
        this.stateMap.set(key, {
          // First-level nodes (depth 1, i.e. direct children of root) default expanded
          expanded: depth === 0,
          checked: 'none',
        });
      }
      this.initStates(child, key, depth + 1);
    }
  }

  private getState(key: string): NodeState {
    let state = this.stateMap.get(key);
    if (!state) {
      state = { expanded: false, checked: 'none' };
      this.stateMap.set(key, state);
    }
    return state;
  }

  /** Toggle a node's checked state and propagate to children/parents. */
  private toggleCheck(node: TreeNode, key: string): void {
    const state = this.getState(key);
    const newChecked: CheckState = state.checked === 'all' ? 'none' : 'all';

    // Set this node
    state.checked = newChecked;

    // Propagate down: all descendants match parent
    this.propagateDown(node, key, newChecked);

    // Propagate up: recompute ancestors
    this.propagateUp(key);

    this.render();
  }

  private propagateDown(
    node: TreeNode,
    parentKey: string,
    checked: CheckState,
  ): void {
    for (const [, child] of node.children) {
      const childKey = this.getStateKey(child, parentKey);
      const childState = this.getState(childKey);
      childState.checked = checked;
      this.propagateDown(child, childKey, checked);
    }
  }

  private propagateUp(key: string): void {
    // Walk up by stripping last segment
    const dotIdx = key.lastIndexOf('.');
    if (dotIdx === -1) {
      // Top-level node, check if it's UNCATEGORIZED_KEY
      if (key === UNCATEGORIZED_KEY) return;
      return; // no parent to update
    }

    const parentKey = key.substring(0, dotIdx);
    const parentState = this.stateMap.get(parentKey);
    if (!parentState) {
      // Parent might be a synthetic root child — try without dot
      return;
    }

    // Find parent node and recompute its checked state from children
    const parentNode = this.findNode(parentKey);
    if (parentNode) {
      parentState.checked = this.computeCheckFromChildren(
        parentNode,
        parentKey,
      );
    }

    // Continue up
    this.propagateUp(parentKey);
  }

  private computeCheckFromChildren(
    node: TreeNode,
    nodeKey: string,
  ): CheckState {
    let allChecked = true;
    let noneChecked = true;

    for (const [, child] of node.children) {
      const childKey = this.getStateKey(child, nodeKey);
      const childState = this.getState(childKey);
      if (childState.checked !== 'all') allChecked = false;
      if (childState.checked !== 'none') noneChecked = false;
    }

    if (allChecked) return 'all';
    if (noneChecked) return 'none';
    return 'some';
  }

  private findNode(key: string): TreeNode | null {
    if (!this.root) return null;

    // Handle UNCATEGORIZED_KEY
    if (key === UNCATEGORIZED_KEY) {
      return this.root.children.get(UNCATEGORIZED_KEY) ?? null;
    }

    const parts = key.split('.');
    let cursor: TreeNode = this.root;
    for (const part of parts) {
      const child = cursor.children.get(part);
      if (!child) return null;
      cursor = child;
    }
    return cursor;
  }

  private collectSelected(
    node: TreeNode,
    parentKey: string,
    result: string[],
  ): void {
    for (const [, child] of node.children) {
      const key = this.getStateKey(child, parentKey);
      const state = this.getState(key);

      if (state.checked === 'all') {
        // Collect all leaf rawValues under this subtree
        this.collectAllLeafRawValues(child, result);
      } else if (state.checked === 'some') {
        // Partially checked — recurse into children
        this.collectSelected(child, key, result);
      }
      // 'none' — skip entirely
    }
  }

  private collectAllLeafRawValues(node: TreeNode, result: string[]): void {
    if (node.isLeaf && node.rawValue !== null) {
      result.push(node.rawValue);
    }
    for (const [, child] of node.children) {
      this.collectAllLeafRawValues(child, result);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Quality flag helpers                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Decide whether to show a quality warning for this node.
   * Only show for flags that represent real data issues (hasEnDash).
   * hasNewline is a systemic parseWORD artifact — not a user error.
   */
  private shouldShowQuality(node: TreeNode): boolean {
    if (!node.quality) return false;
    return !!node.quality.hasEnDash;
  }

  private getQualityTooltip(node: TreeNode): string {
    if (!node.quality) return '';
    const flags: string[] = [];
    if (node.quality.hasEnDash)
      flags.push('contains en-dash (–) — possible typo');
    if (node.quality.hasTrailingSpace) flags.push('has trailing whitespace');
    return flags.join('; ');
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  private render(): void {
    this.container.innerHTML = '';

    if (!this.root || this.root.children.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'filter-sidebar-placeholder';
      empty.textContent = 'No classification data';
      this.container.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'filter-tree';

    for (const [, child] of this.root.children) {
      const key = this.getStateKey(child, '');
      this.renderNode(child, key, list, 0);
    }

    this.container.appendChild(list);
  }

  private renderNode(
    node: TreeNode,
    key: string,
    parent: HTMLElement,
    depth: number,
  ): void {
    const state = this.getState(key);
    const hasChildren = node.children.size > 0;

    // --- Row ---
    const row = document.createElement('div');
    row.className = 'filter-tree-row';
    row.style.paddingLeft = `${8 + depth * 18}px`;

    // --- Expand/collapse arrow ---
    const arrow = document.createElement('span');
    arrow.className = 'filter-tree-arrow';
    if (hasChildren) {
      arrow.textContent = state.expanded ? '▾' : '▸';
      arrow.classList.add('clickable');
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        state.expanded = !state.expanded;
        this.render();
      });
    } else {
      arrow.textContent = ' ';
    }
    row.appendChild(arrow);

    // --- Checkbox ---
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'filter-tree-checkbox';
    checkbox.checked = state.checked === 'all';
    checkbox.indeterminate = state.checked === 'some';
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      this.toggleCheck(node, key);
    });
    row.appendChild(checkbox);

    // --- Label ---
    const label = document.createElement('span');
    label.className = 'filter-tree-label';
    label.textContent = node.label;
    row.appendChild(label);

    // --- Count badge ---
    const count = document.createElement('span');
    count.className = 'filter-tree-count';
    count.textContent = `(${node.count})`;
    row.appendChild(count);

    // --- Quality warning (only for real data issues, not systemic \n) ---
    if (this.shouldShowQuality(node)) {
      const warn = document.createElement('span');
      warn.className = 'filter-tree-quality';
      warn.textContent = '⚠';

      // Custom CSS tooltip (more reliable than title attr on small elements)
      const tooltip = document.createElement('span');
      tooltip.className = 'filter-tree-quality-tooltip';
      tooltip.textContent = this.getQualityTooltip(node);
      warn.appendChild(tooltip);

      row.appendChild(warn);
    }

    parent.appendChild(row);

    // --- Children (if expanded) ---
    if (hasChildren && state.expanded) {
      for (const [, child] of node.children) {
        const childKey = this.getStateKey(child, key);
        this.renderNode(child, childKey, parent, depth + 1);
      }
    }
  }
}

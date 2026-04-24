import {
  TreeNode,
  UNCATEGORIZED_KEY,
  UNCATEGORIZED_LABEL,
} from './types';

/**
 * Parse an array of classification strings (one per data row) into a tree.
 *
 * Design principles (see BACKLOG §1.3):
 *   - Split by '.'
 *   - Leaves = full trimmed classification strings that appear in the data
 *   - No normalization: no lowercase, no _ / . merging, no typo fixing
 *   - Preserve original raw string on leaf for Handsontable filter
 *   - Empty/null/whitespace → UNCATEGORIZED bucket
 *   - En-dash and other suspicious chars → quality flags, but do not split
 *
 * @param values  classification column values, one per row
 * @returns       synthetic root TreeNode; top-level categories are its children
 */
export function parseClassifications(
  values: ReadonlyArray<string | null | undefined>,
): TreeNode {
  const root: TreeNode = {
    label: '',
    fullPath: '',
    rawValue: null,
    isLeaf: false,
    children: new Map(),
    count: 0,
  };

  for (const raw of values) {
    insertOne(root, raw);
  }

  return root;
}

function insertOne(
  root: TreeNode,
  rawInput: string | null | undefined,
): void {
  // 1. Empty / null / whitespace-only → uncategorized
  if (rawInput == null || rawInput.trim() === '') {
    const bucket = ensureChild(root, UNCATEGORIZED_KEY, UNCATEGORIZED_LABEL);
    markAsLeaf(bucket, rawInput ?? '');
    propagateCount(root, [UNCATEGORIZED_KEY]);
    return;
  }

  // 2. Trim surrounding whitespace (including trailing \n) for the CLEANED view.
  //    rawInput stays original and becomes the leaf's rawValue.
  const cleaned = rawInput.trim();

  // 3. Split by '.'; drop empty segments (handles '..', trailing '.', etc.)
  const tokens = cleaned.split('.').filter((t) => t.length > 0);

  // 4. Degenerate case: string was ONLY dots (e.g. "..." or ".")
  //    → also goes to uncategorized, but preserve the raw value.
  if (tokens.length === 0) {
    const bucket = ensureChild(root, UNCATEGORIZED_KEY, UNCATEGORIZED_LABEL);
    markAsLeaf(bucket, rawInput);
    propagateCount(root, [UNCATEGORIZED_KEY]);
    return;
  }

  // 5. Walk/build the tree path, creating middle nodes as needed.
  let cursor = root;
  const pathSoFar: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    pathSoFar.push(token);
    cursor = ensureChild(cursor, token, token);
    cursor.fullPath = pathSoFar.join('.');
  }

  // 6. The final cursor is a LEAF. This path = an actual data entry.
  //    (It may already have children, in which case this is a self-node.)
  markAsLeaf(cursor, rawInput);

  // 7. Propagate count to every ancestor on the path.
  propagateCount(root, tokens);
}

function ensureChild(
  parent: TreeNode,
  key: string,
  label: string,
): TreeNode {
  const existing = parent.children.get(key);
  if (existing) return existing;

  const node: TreeNode = {
    label,
    fullPath: '',
    rawValue: null,
    isLeaf: false,
    children: new Map(),
    count: 0,
  };
  parent.children.set(key, node);
  return node;
}

function markAsLeaf(node: TreeNode, rawValue: string): void {
  node.isLeaf = true;
  // If multiple rows share the same classification string, keep the first
  // raw value. They're equal-after-trim anyway; the filter matches on
  // exact string and Handsontable will select all matching rows.
  if (node.rawValue === null) {
    node.rawValue = rawValue;
  }
  // Set quality flags. Only set when true (absence = clean, per types.ts).
  const q: NonNullable<TreeNode['quality']> = node.quality ?? {};
  if (rawValue.includes('\n')) q.hasNewline = true;
  if (rawValue.includes('–')) q.hasEnDash = true;       // U+2013 EN DASH
  if (rawValue !== rawValue.trim()) q.hasTrailingSpace = true;
  if (Object.keys(q).length > 0) node.quality = q;
}

function propagateCount(root: TreeNode, tokens: ReadonlyArray<string>): void {
  // Every node on the path (including the leaf) counts this row once.
  // Root is a synthetic container; we increment its count too so caller
  // can read the grand total from root.count.
  root.count += 1;

  let cursor = root;
  for (const token of tokens) {
    const child = cursor.children.get(token);
    if (!child) return; // should never happen — we just built this path
    child.count += 1;
    cursor = child;
  }
}

/* -------------------------------------------------------------------------- */
/*  Debug helpers (used by unit tests + for pretty printing in reviews)       */
/* -------------------------------------------------------------------------- */

export interface DumpOptions {
  showCounts?: boolean;
  showRawValue?: boolean;
  showQuality?: boolean;
  indent?: string;
}

/**
 * Render a TreeNode as a human-readable indented string. For test output
 * and manual review. Does NOT sort — preserves insertion order.
 */
export function dumpTree(
  node: TreeNode,
  options: DumpOptions = {},
  depth = 0,
): string {
  const {
    showCounts = true,
    showRawValue = false,
    showQuality = true,
    indent = '  ',
  } = options;

  const lines: string[] = [];

  if (depth > 0) {
    const prefix = indent.repeat(depth - 1);
    const marker = node.isLeaf ? '•' : '▸';
    const count = showCounts ? ` (${node.count})` : '';
    const raw =
      showRawValue && node.isLeaf && node.rawValue !== null
        ? `  rawValue=${JSON.stringify(node.rawValue)}`
        : '';
    const q =
      showQuality && node.quality
        ? `  ⚠️ ${Object.keys(node.quality).join(',')}`
        : '';
    lines.push(`${prefix}${marker} ${node.label}${count}${raw}${q}`);
  }

  for (const child of node.children.values()) {
    lines.push(dumpTree(child, options, depth + 1));
  }

  return lines.join('\n');
}

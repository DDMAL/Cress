/**
 * Tree node for hierarchical classification filter.
 *
 * Classification strings are hierarchical (`neume.pes.quassus.flexus.23episema`).
 * We split by `.` and build a tree where:
 *   - Middle nodes = grouping containers (expand/collapse)
 *   - Leaves = actual full strings that appear in the dataset
 *
 * A node can be BOTH a leaf AND have children ("self-node pattern"),
 * e.g. `neume.pes.quassus` is itself a data row AND has descendants
 * like `neume.pes.quassus.2episema`. In that case `isLeaf=true` and
 * `children.size > 0`.
 */
export interface TreeNode {
  /** Display label: trimmed, this-level token only. E.g. 'quassus'. */
  label: string;

  /** Full cleaned path from root. E.g. 'neume.pes.quassus'. */
  fullPath: string;

  /**
   * Original raw string (may contain \n, trailing space, etc).
   * Required by Handsontable's `by_value` filter — must match data exactly.
   * Only set when isLeaf=true. null for pure grouping nodes.
   */
  rawValue: string | null;

  /** True if this path is an actual entry in the source data. */
  isLeaf: boolean;

  /** Child nodes, keyed by next-level cleaned token. */
  children: Map<string, TreeNode>;

  /**
   * Count of data rows reachable from this node (self + all descendants).
   * Used to render "(30)" badges. Static — does not reflect other filters.
   */
  count: number;

  /**
   * Optional data quality flags. UI can show warning badges.
   * Absent = clean. Only set on leaves.
   */
  quality?: {
    hasNewline?: boolean;
    hasEnDash?: boolean;
    hasTrailingSpace?: boolean;
  };
}

/**
 * Sentinel label for rows where classification is empty/null/whitespace.
 * Treated as a top-level bucket named "(uncategorized)".
 */
export const UNCATEGORIZED_KEY = '__uncategorized__';
export const UNCATEGORIZED_LABEL = '(uncategorized)';

// Parent/child trees (locations, assets). Pure functions over flat lists.

export interface TreeNode {
  id: string;
  parentId: string | null;
  name: string;
}

export type Flattened<T> = T & { depth: number; path: string[]; hasChildren: boolean };

/** Depth-first order with depth and the names of all ancestors, siblings
 *  sorted by name. Items whose parent is missing are treated as roots. */
export function flattenTree<T extends TreeNode>(items: T[]): Flattened<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const byParent = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const out: Flattened<T>[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, path: string[]) => {
    for (const item of byParent.get(parent) ?? []) {
      if (seen.has(item.id)) continue; // guards against cycles in bad data
      seen.add(item.id);
      out.push({ ...item, depth, path, hasChildren: (byParent.get(item.id)?.length ?? 0) > 0 });
      walk(item.id, depth + 1, [...path, item.name]);
    }
  };
  walk(null, 0, []);
  return out;
}

/** The ids of `id` and everything below it. */
export function descendantIds(items: TreeNode[], id: string): Set<string> {
  const result = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of items) {
      if (item.parentId && result.has(item.parentId) && !result.has(item.id)) {
        result.add(item.id);
        grew = true;
      }
    }
  }
  return result;
}

/** Would making `parentId` the parent of `id` create a loop? */
export function wouldCycle(items: TreeNode[], id: string, parentId: string | null): boolean {
  return parentId != null && descendantIds(items, id).has(parentId);
}

/** "Plant 1 › Molding › Line 3" for a node, from a flattened tree. */
export function pathLabel(node: { name: string; path: string[] } | undefined | null): string {
  return node ? [...node.path, node.name].join(" › ") : "";
}

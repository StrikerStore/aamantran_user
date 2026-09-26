/**
 * Order-independent id equality for the ceremonies ticked on a second link.
 * @param {Iterable<string>} a
 * @param {Iterable<string>} b
 */
export function sameIdSet(a = [], b = []) {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

/**
 * Whether the ticked main-event ceremonies differ from the pair's current set.
 * An empty selection is not pushed: the API rejects an empty list, and calling
 * it anyway would still delete every subset ceremony (and the RSVPs on them).
 * @param {Iterable<string>} selectedIds
 * @param {Iterable<string>} pairedIds
 */
export function partialSelectionChanged(selectedIds, pairedIds) {
  const ids = [...(selectedIds || [])].filter((k) => k && !String(k).startsWith('new-'));
  if (!ids.length) return false;
  return !sameIdSet(ids, pairedIds || []);
}

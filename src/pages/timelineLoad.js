/**
 * A timeline fetch belongs to one invitation and one ceremony. If the couple
 * has already moved on, the response must be dropped — otherwise that
 * ceremony's moments stay on screen under the new name, and an edit or delete
 * changes the wrong plan.
 *
 * @param {boolean} live false once another load (or an unmount) superseded this request
 * @param {string} eventId invitation this request was for
 * @param {string} functionId ceremony this request was for
 * @param {Array<{ functionId?: string }>|null|undefined} entries
 * @returns {{ entries: object[], entriesFor: { eventId: string, functionId: string } } | null}
 */
export function timelineLoadResult(live, eventId, functionId, entries) {
  if (!live || !eventId || !functionId) return null;
  const rows = Array.isArray(entries) ? entries : [];
  return {
    entries: rows.filter((e) => e && e.functionId === functionId),
    entriesFor: { eventId, functionId },
  };
}

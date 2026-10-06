/**
 * The second link stores its own ceremony rows (copies), and the public page
 * renders those, not the main invitation's list. Deleting a ceremony on the
 * main invitation therefore leaves it live on the second link until something
 * rebuilds that link.
 *
 * Rebuilding replaces every copy and drops the replies attached to them. This
 * only points at the single copy of the ceremony just deleted, and only when
 * that name is not shared with another ceremony. Two ceremonies with the same
 * name cannot be told apart.
 *
 * @param {Array<{id?: string, name?: string}>|null|undefined} subsetFunctions
 * @param {string|null|undefined} savedName name stored on the main row, not an unsaved edit
 * @param {string[]} [siblingNames] names of the main ceremonies that remain
 * @returns {string|null} subset ceremony id to delete, or null when it is not safe
 */
export function subsetCopyToRemove(subsetFunctions, savedName, siblingNames = []) {
  const name = normalizeCeremonyName(savedName);
  if (!name) return null;
  if ((siblingNames || []).some((n) => normalizeCeremonyName(n) === name)) return null;

  const copies = (Array.isArray(subsetFunctions) ? subsetFunctions : [])
    .filter((f) => f && f.id && normalizeCeremonyName(f.name) === name);
  return copies.length === 1 ? copies[0].id : null;
}

function normalizeCeremonyName(name) {
  return String(name || '').trim().toLowerCase();
}

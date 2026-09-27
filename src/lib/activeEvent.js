/**
 * Which invitation a global page should keep after the couple leaves an
 * event URL (Home, Settings, Support, Leave a review).
 *
 * Event pages already prefer the id in the address. That visit has to be
 * remembered: otherwise Home falls back to an older stored id, and Take
 * offline, a review, or a support ticket lands on the other invitation.
 *
 * @param {string|null} routeEventId id from `/events/:id/…`, or null
 * @param {string[]} mainEventIds ids of this account's invitations (not second links)
 * @returns {string|null} id to store, or null to leave the stored choice alone
 */
export function eventIdToRemember(routeEventId, mainEventIds) {
  if (!routeEventId) return null;
  const ids = Array.isArray(mainEventIds) ? mainEventIds : [];
  return ids.includes(routeEventId) ? routeEventId : null;
}

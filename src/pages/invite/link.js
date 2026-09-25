/** What a couple may type in a link: letters, numbers and dashes (spaces become dashes). */
export function cleanLinkInput(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+/, '');
}

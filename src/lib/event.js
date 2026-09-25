/**
 * How the dashboard talks about an event — by the couple's names, its design
 * and its date, never by its link.
 */

const SLOTS = ['person1', 'person2'];

/** First names of the couple, in their order ("Jasleen & Prabhjeet"). */
export function coupleNames(ev, { full = false } = {}) {
  const people = Array.isArray(ev?.people) ? ev.people : [];
  const names = SLOTS
    .map((slot) => people.find((p) => p.role === slot)?.name || ev?.[`${slot}Name`] || '')
    .map((n) => String(n).trim())
    .filter(Boolean)
    .map((n) => (full ? n : n.split(/\s+/)[0]));
  if (names.length) return names.join(' & ');
  // Designs with other roles (birthday person, host…): the first named person.
  const other = people.find((p) => String(p.name || '').trim());
  return other ? (full ? other.name : other.name.split(/\s+/)[0]) : '';
}

/** The event's own kind in plain words: "wedding", "engagement", "anniversary"… */
export function eventTypeWord(ev) {
  const t = String(ev?.eventType || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return t || 'celebration';
}

/** Title to show for an event anywhere in the dashboard. */
export function eventTitle(ev) {
  const names = coupleNames(ev);
  if (names) return names;
  const kind = eventTypeWord(ev);
  return `Your ${kind === 'celebration' ? 'invitation' : `${kind} invitation`}`;
}

/** First ceremony date as "31 Oct 2026", or ''. */
export function firstCeremonyDate(ev) {
  const fns = Array.isArray(ev?.functions) ? ev.functions : [];
  const dated = fns.map((f) => f.date).filter(Boolean).map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()));
  if (!dated.length) return '';
  dated.sort((a, b) => a - b);
  return dated[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Sohna · 31 Oct 2026" */
export function eventMeta(ev) {
  return [ev?.template?.name, firstCeremonyDate(ev)].filter(Boolean).join(' · ');
}

/** "Live" / "Not live yet" */
export function liveLabel(ev) {
  return ev?.isPublished ? 'Live' : 'Not live yet';
}

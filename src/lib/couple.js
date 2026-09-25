import { useEffect, useState } from 'react';
import { api } from './api';

const SLOTS = ['person1', 'person2'];

/**
 * The couple's two names, person1 first. `label` is how the rest of the
 * dashboard refers to each one: the role they picked ("Groom"), else their
 * first name, else "Person 1".
 * @returns {Array<{ key: string, name: string, role: string, label: string, display: string }>}
 */
export function coupleMembers(event) {
  const people = Array.isArray(event?.people) ? event.people : [];
  return SLOTS.map((key, i) => {
    const row = people.find((p) => p.role === key);
    const name = String(row?.name || event?.[`${key}Name`] || '').trim();
    const role = String(row?.extraData?.role_choice || '').trim();
    const firstName = name.split(/\s+/)[0] || '';
    const label = role || firstName || `Person ${i + 1}`;
    const display = role && name ? `${firstName} (${role})` : label;
    return { key, name, role, label, display };
  });
}

/** The couple of one event, loaded once; person1/person2 fallbacks until it arrives. */
export function useCouple(eventId) {
  const [members, setMembers] = useState(() => coupleMembers(null));
  useEffect(() => {
    if (!eventId) return undefined;
    let live = true;
    api.events.get(eventId)
      .then((r) => { if (live) setMembers(coupleMembers(r.event)); })
      .catch(() => {});
    return () => { live = false; };
  }, [eventId]);
  return members;
}

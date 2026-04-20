import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { parseGoogleMapsUrl, formatDate } from '../lib/utils';
import { toHtmlDateInputValue } from '../utils/dateNormalize';
import { getInviteBaseUrl } from '../lib/config';
import { NameConfirmBar } from '../components/NameConfirmBar';
import { WhatsAppShare } from '../components/WhatsAppShare';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';
import './InvitationForm.css';

const SECTIONS = [
  { id: 'people', label: 'A. People & Names' },
  { id: 'venues', label: 'B. Venues' },
  { id: 'functions', label: 'C. Functions' },
  { id: 'media', label: 'D. Photos & Music' },
  { id: 'custom', label: 'E. Custom Fields' },
  { id: 'social', label: 'F. Links & guest features' },
  { id: 'language', label: 'G. Language' },
  { id: 'publish', label: 'H. Preview & Publish' },
];

/** @returns {null | { key: string, label: string, type: string, multiple: boolean, max: number, accept: string, allowUrl: boolean }[]} */
function normalizeMediaSlots(fullSchema) {
  const list = fullSchema?.mediaSlots;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list
    .filter((s) => s && String(s.key || '').trim())
    .map((s) => ({
      key: String(s.key).trim(),
      label: s.label || s.key,
      type: s.type === 'music' ? 'music' : s.type === 'video' ? 'video' : 'photo',
      multiple: !!s.multiple,
      max: typeof s.max === 'number' && s.max > 0 ? s.max : s.multiple ? 24 : 1,
      accept:
        typeof s.accept === 'string' && s.accept
          ? s.accept
          : s.type === 'music'
            ? 'audio/*'
            : s.type === 'video'
              ? 'video/*'
              : 'image/*',
      allowUrl: false,
    }));
}

function MediaSlotCard({ slot, eventId, slotItems, refreshMedia, onRemoveRequest, toast, globalAssets = [] }) {
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  async function selectGlobalAsset() {
    const asset = globalAssets.find(a => a.id === selectedAssetId);
    if (!asset) return;
    setBusy(true);
    try {
      await api.media.upload(eventId, {
        slotKey: slot.key,
        type: slot.type,
        url: asset.url,
        caption: asset.name
      });
      await refreshMedia();
      toast('Added!', 'success');
      setSelectedAssetId('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file, cap) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slotKey', slot.key);
    fd.append('type', slot.type);
    if (cap) fd.append('caption', cap);
    await api.media.upload(eventId, fd);
  }

  async function onPickFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const toAdd = slot.multiple ? files : files.slice(0, 1);
    const room = slot.max - slotItems.length;
    if (room <= 0) {
      toast('This section is full — remove an item first', 'error');
      return;
    }
    const batch = toAdd.slice(0, room);
    setBusy(true);
    try {
      for (const f of batch) {
        await uploadFile(f, caption.trim() || undefined);
        await refreshMedia();
      }
      toast('Uploaded!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 14,
        padding: '14px 16px',
        background: 'var(--bg-elevated, rgba(250, 246, 240, 0.95))',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
      }}
    >
      <div className="section-title" style={{ fontSize: '1rem', marginBottom: 4 }}>{slot.label}</div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
        {slot.multiple ? `Up to ${slot.max} files — select multiple on desktop or mobile where supported.` : 'Single file — a new upload replaces the previous one.'}
      </p>
      {slotItems.length > 0 && (
        <div className="items-list" style={{ marginBottom: 12 }}>
          {slotItems.map((m) => (
            <div key={m.id} className="item-row">
              <div className="item-info">
                <span className="item-label">{m.type}{m.caption ? ` — ${m.caption}` : ''}</span>
                {m.type === 'photo' && <img src={m.url} alt={m.caption || 'photo'} style={{ width: '100%', maxWidth: 200, borderRadius: 6, marginTop: 6, display: 'block' }} />}
                {m.type === 'music' && (
                  <div style={{ marginTop: 8, background: 'var(--bg-card,#fff)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>🎵 Background Music</div>
                    <audio
                      controls
                      src={m.url}
                      style={{ width: '100%', maxWidth: '100%', display: 'block', minWidth: 0, height: 40 }}
                      controlsList="nodownload"
                      preload="metadata"
                    />
                  </div>
                )}
                {m.type === 'video' && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent, #8b3a3a)', display: 'block', marginTop: 4 }}>▶ View Video</a>}
              </div>
              <div className="item-actions">
                <button type="button" className="btn btn-danger btn-sm" onClick={() => onRemoveRequest(m)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label className="form-label">Upload from device</label>
        <input
          type="file"
          className="form-input"
          accept={slot.accept}
          multiple={slot.multiple}
          disabled={busy || slotItems.length >= slot.max}
          onChange={onPickFiles}
        />
      </div>

      {slot.key === 'background_music' && globalAssets.filter(a => a.type === 'bg_music').length > 0 && (
        <div className="form-group" style={{ marginBottom: 12, marginTop: 12 }}>
          <label className="form-label">Or choose pre-added music</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              className="form-select"
              style={{ flex: 1 }}
              value={selectedAssetId}
              onChange={e => setSelectedAssetId(e.target.value)}
              disabled={busy || slotItems.length >= slot.max}
            >
              <option value="">— Select a track —</option>
              {globalAssets.filter(a => a.type === 'bg_music').map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              onClick={selectGlobalAsset}
              disabled={!selectedAssetId || busy || slotItems.length >= slot.max}
            >
              Add
            </button>
          </div>
          {selectedAssetId && (() => {
            const selected = globalAssets.find(a => a.id === selectedAssetId);
            if (!selected) return null;
            return (
              <div style={{ marginTop: 8, background: 'var(--bg-card,#fff)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Preview: {selected.name}</div>
                <audio controls src={selected.url} style={{ width: '100%', height: 40 }} preload="metadata" controlsList="nodownload" />
              </div>
            );
          })()}
        </div>
      )}
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label className="form-label">Caption (optional)</label>
        <input
          className="form-input"
          placeholder="Optional note"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={busy}
        />
      </div>
    </div>
  );
}

/** Demo placeholder names keyed by common role values from template schemas */
const DEMO_NAMES = {
  bride: 'e.g. Priya Sharma',
  groom: 'e.g. Rahul Verma',
  bride_father: 'e.g. Rajesh Sharma',
  bride_mother: 'e.g. Sunita Sharma',
  groom_father: 'e.g. Suresh Verma',
  groom_mother: 'e.g. Kavita Verma',
  father_bride: 'e.g. Rajesh Sharma',
  mother_bride: 'e.g. Sunita Sharma',
  father_groom: 'e.g. Suresh Verma',
  mother_groom: 'e.g. Kavita Verma',
};

/** Suggestions for common custom field keys — shown as datalist options */
const CUSTOM_FIELD_SUGGESTIONS = {
  hashtag: ['#PriyaRahulForever', '#SnehaWedsSohan', '#LoveStory2025'],
  couple_hashtag: ['#PriyaRahulForever', '#SnehaWedsSohan', '#LoveStory2025'],
  wedding_hashtag: ['#PriyaRahulWedding2025', '#TheBigDay'],
  venue_note: ['Valet parking available', 'Guests to arrive 30 minutes early', 'Traditional attire preferred'],
  dress_code: ['Ethnic wear', 'Formal attire', 'Pastel shades only', 'No black please', 'Saree / Sherwani', 'Traditional Indian'],
  rsvp_note: ['Please RSVP by 15th January', 'Kindly confirm by the end of this month'],
  special_note: ['No gifts please, your blessings are enough', 'Only family and close friends'],
  tagline: ['Two hearts, one journey', 'A love story worth celebrating', 'Forever starts today'],
  footer_note: ['Please carry this invite on your phone', 'Show this invite at the entrance'],
  couple_story: ['We met at college and the rest is history', 'A chance meeting turned into a lifetime'],
  contact_name: ['Rahul Sharma', 'Priya Patel'],
  contact_phone: ['+91 98765 43210'],
  bride_side_contact: ['e.g. +91 98765 43210'],
  groom_side_contact: ['e.g. +91 98765 43210'],
  invitation_note: ['Dinner will be served', 'Cocktails at 7 PM', 'Ceremony starts promptly at 11 AM'],
};

/** Map common field keys to human-readable suggestion labels shown below the input */
const CUSTOM_FIELD_HINT_LABEL = {
  hashtag: 'e.g.',
  couple_hashtag: 'e.g.',
  dress_code: 'Popular choices:',
  rsvp_note: 'e.g.',
  special_note: 'e.g.',
  tagline: 'Inspiration:',
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'bn', label: 'Bengali' },
  { code: 'pa', label: 'Punjabi' },
];

export default function GenerateInvitation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const outletCtx = useOutletContext() || {};

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('people');

  // People
  const [people, setPeople] = useState([]);
  const [personForm, setPersonForm] = useState({ role: '', name: '' }); // fallback mode only
  const [savingPerson, setSavingPerson] = useState(false);
  const [peopleInputs, setPeopleInputs] = useState({});

  // Functions — always-editable inline cards (admin-panel style)
  const [functions, setFunctions] = useState([]);
  const [savingFnId, setSavingFnId] = useState(null); // id or _cid of fn being saved
  const [savingAllFns, setSavingAllFns] = useState(false);

  // Venues
  const [venues, setVenues] = useState([]);
  const [venueForm, setVenueForm] = useState({ name: '', address: '', mapUrl: '', city: '', state: '' });
  const [editingVenue, setEditingVenue] = useState(null);
  const [savingVenue, setSavingVenue] = useState(false);

  // Media
  const [media, setMedia] = useState([]);
  const [mediaForm, setMediaForm] = useState({ type: 'photo', url: '', caption: '', file: null });
  const [savingMedia, setSavingMedia] = useState(false);

  // Custom fields
  const [customFields, setCustomFields] = useState([]);
  const [fieldSchema, setFieldSchema] = useState([]);
  const [savingFields, setSavingFields] = useState(false);

  // Template schema (full object) — used to filter languages etc.
  const [templateSchema, setTemplateSchema] = useState(null);
  const [templateDemoData, setTemplateDemoData] = useState(null);
  const [templateLanguages, setTemplateLanguages] = useState(null); // null = all supported
  const [globalAssets, setGlobalAssets] = useState([]);

  // Language
  const [language, setLanguage] = useState('en');
  const [savingLang, setSavingLang] = useState(false);

  // Social links + RSVP / guest notes toggles (template supplies icons; URLs from here)
  const [instagramUrl, setInstagramUrl] = useState('');
  const [socialYoutubeUrl, setSocialYoutubeUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [guestNotesEnabled, setGuestNotesEnabled] = useState(true);
  const [savingGuestFeatures, setSavingGuestFeatures] = useState(false);

  // Publish + partial invite
  const [publishing, setPublishing] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [slugFull, setSlugFull] = useState('');
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [partialSlug, setPartialSlug] = useState('');
  const [partialFnIds, setPartialFnIds] = useState(new Set()); // function IDs included in partial

  // Delete confirms
  const [deletingPerson, setDeletingPerson] = useState(null);
  const [deletingFn, setDeletingFn] = useState(null);
  const [deletingVenue, setDeletingVenue] = useState(null);
  const [deletingMedia, setDeletingMedia] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.events.get(id).then(r => {
      const ev = r.event;
      setEvent(ev);
      setPeople(ev.people || []);
      setFunctions(ev.functions || []);
      setVenues(ev.venues || []);
      setMedia(ev.media || []);
      setLanguage(ev.language || 'en');
      setInstagramUrl(ev.instagramUrl || '');
      setSocialYoutubeUrl(ev.socialYoutubeUrl || '');
      setWebsiteUrl(ev.websiteUrl || '');
      setRsvpEnabled(ev.rsvpEnabled !== false);
      setGuestNotesEnabled(ev.guestNotesEnabled !== false);
      // Parse full template schema object first (people/customFields/functionFields)
      // Supports both object schema and legacy flat-array schema.
      let fullSchema = null;
      if (ev.template?.fieldSchema) {
        try {
          fullSchema = typeof ev.template.fieldSchema === 'string'
            ? JSON.parse(ev.template.fieldSchema)
            : ev.template.fieldSchema;
        } catch { fullSchema = null; }
      }
      setTemplateSchema(fullSchema);

      let demoData = null;
      if (ev.template?.demoData) {
        try {
          demoData = typeof ev.template.demoData === 'string'
            ? JSON.parse(ev.template.demoData)
            : ev.template.demoData;
        } catch { demoData = null; }
      }
      setTemplateDemoData(demoData);

      // Custom fields schema can live at:
      // 1) fullSchema.customFields (preferred)
      // 2) fullSchema (legacy array shape)
      const customSchema = Array.isArray(fullSchema?.customFields)
        ? fullSchema.customFields
        : (Array.isArray(fullSchema) ? fullSchema : []);
      setFieldSchema(customSchema);
      setCustomFields(ev.customFields || []);

      // Template supported languages (comma-separated string from template.languages)
      if (ev.template?.languages) {
        const langs = String(ev.template.languages).split(',').map(s => s.trim()).filter(Boolean);
        setTemplateLanguages(langs.length ? langs : null);
      }

      setSlugFull(ev.slug || '');
      // If there's already a paired subset, pre-tick its functions.
      // pairedFunctionIds contains the MAIN event's function IDs (matched by name
      // on the backend), NOT the partial event's copied function IDs.
      if (ev.pairedEvent) {
        setPartialEnabled(true);
        setPartialSlug(ev.pairedEvent.slug || '');
        setPartialFnIds(new Set(ev.pairedEvent.pairedFunctionIds || []));
      }
      setLoading(false);
    }).catch(() => {
      toast('Failed to load event', 'error');
      setLoading(false);
    });

    // Also load global assets (music, etc)
    api.assets.list().then(res => {
      setGlobalAssets(res.assets || []);
    }).catch(() => { });
  }, [id]);

  const schemaPeopleRoles = useMemo(() => {
    const rows = Array.isArray(templateSchema?.people) ? templateSchema.people : [];
    return rows
      .filter((r) => r && typeof r === 'object' && r.role)
      .map((r) => ({
        role: String(r.role),
        label: String(r.label || r.role),
        required: Boolean(r.required),
      }));
  }, [templateSchema]);

  const mediaSlotsNorm = useMemo(() => normalizeMediaSlots(templateSchema), [templateSchema]);

  const refreshMedia = useCallback(async () => {
    if (!id) return;
    const r = await api.media.list(id);
    setMedia(r.media || []);
  }, [id]);
  const hasSchemaPeopleRoles = schemaPeopleRoles.length > 0;
  const peopleByRole = useMemo(() => {
    const map = {};
    for (const p of people) {
      if (!map[p.role]) map[p.role] = p;
    }
    return map;
  }, [people]);

  useEffect(() => {
    if (!hasSchemaPeopleRoles) return;
    const next = {};
    for (const roleDef of schemaPeopleRoles) {
      next[roleDef.role] = peopleByRole[roleDef.role]?.name || '';
    }
    setPeopleInputs(next);
  }, [hasSchemaPeopleRoles, schemaPeopleRoles, peopleByRole]);

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;
  if (!event) return <div className="page-fade"><p>Event not found.</p></div>;

  const frozen = event.namesAreFrozen;

  // ── PEOPLE ──────────────────────────────────────────────
  async function savePeopleBySchema() {
    if (!hasSchemaPeopleRoles) return;
    const missingRequired = schemaPeopleRoles.find((r) => r.required && !String(peopleInputs[r.role] || '').trim());
    if (missingRequired) {
      toast(`"${missingRequired.label}" is required`, 'error');
      return;
    }
    setSavingPerson(true);
    try {
      let nextPeople = [...people];
      for (const roleDef of schemaPeopleRoles) {
        const role = roleDef.role;
        const nextName = String(peopleInputs[role] || '').trim();
        const existing = nextPeople.find((p) => p.role === role);

        if (existing && !nextName && !roleDef.required) {
          await api.people.remove(id, existing.id);
          nextPeople = nextPeople.filter((p) => p.id !== existing.id);
          continue;
        }
        if (!nextName) continue;

        if (existing) {
          if (String(existing.name || '').trim() !== nextName) {
            // Pass required flag so backend allows optional-name edits after freeze
            const r = await api.people.update(id, existing.id, { role, name: nextName, required: roleDef.required });
            nextPeople = nextPeople.map((p) => (p.id === existing.id ? r.person : p));
          }
        } else {
          const r = await api.people.add(id, { role, name: nextName });
          nextPeople = [...nextPeople, r.person];
        }
      }
      setPeople(nextPeople);
      toast('People saved!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingPerson(false);
    }
  }

  async function removePerson(pid) {
    try {
      await api.people.remove(id, pid);
      setPeople(p => p.filter(x => x.id !== pid));
      setDeletingPerson(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ── FUNCTIONS ───────────────────────────────────────────
  const BLANK_FN = () => ({ _cid: `new-${Date.now()}`, _isNew: true, name: '', date: new Date().toISOString().slice(0, 10), startTime: '', venueName: '', venueAddress: '', venueMapUrl: '', dressCode: '', notes: '' });

  function updateFnField(fnKey, field, value) {
    setFunctions(prev => prev.map(f => (f._cid === fnKey || f.id === fnKey) ? { ...f, [field]: value } : f));
  }

  function insertFnAfter(fnKey) {
    setFunctions(prev => {
      const idx = prev.findIndex(f => f._cid === fnKey || f.id === fnKey);
      const next = [...prev];
      next.splice(idx + 1, 0, BLANK_FN());
      return next;
    });
  }

  async function saveFn(fn) {
    if (!fn.name || !fn.date) { toast('Name and date are required', 'error'); return; }
    const key = fn._cid || fn.id;
    const sortOrder = Math.max(0, functions.findIndex(f => (f._cid || f.id) === key));
    setSavingFnId(key);
    try {
      const payload = { name: fn.name, date: fn.date, startTime: fn.startTime || undefined, venueId: fn.venueId || undefined, venueName: fn.venueName || undefined, venueAddress: fn.venueAddress || undefined, venueMapUrl: fn.venueMapUrl || undefined, dressCode: fn.dressCode || undefined, notes: fn.notes || undefined, sortOrder };
      if (fn._isNew) {
        const r = await api.functions.add(id, payload);
        setFunctions(prev => prev.map(f => f._cid === fn._cid ? r.function : f));
        // Transition partial selection from _cid to real id
        setPartialFnIds(prev => {
          if (!prev.has(fn._cid)) return prev;
          const next = new Set(prev);
          next.delete(fn._cid);
          if (r.function.id) next.add(r.function.id);
          return next;
        });
      } else {
        const r = await api.functions.update(id, fn.id, payload);
        setFunctions(prev => prev.map(f => f.id === fn.id ? r.function : f));
      }
    } catch (err) {
      throw err; // re-throw so saveAllFunctions can collect errors
    } finally {
      setSavingFnId(null);
    }
  }

  async function saveAllFunctions() {
    // Validate all functions first
    const invalid = functions.filter(fn => !fn.name || !fn.date);
    if (invalid.length > 0) {
      toast(`${invalid.length} function(s) are missing a name or date`, 'error');
      return;
    }
    setSavingAllFns(true);
    const errors = [];
    for (let idx = 0; idx < functions.length; idx++) {
      const fn = functions[idx];
      const key = fn._cid || fn.id;
      setSavingFnId(key);
      try {
        const payload = { name: fn.name, date: fn.date, startTime: fn.startTime || undefined, venueId: fn.venueId || undefined, venueName: fn.venueName || undefined, venueAddress: fn.venueAddress || undefined, venueMapUrl: fn.venueMapUrl || undefined, dressCode: fn.dressCode || undefined, notes: fn.notes || undefined, sortOrder: idx };
        if (fn._isNew) {
          const r = await api.functions.add(id, payload);
          setFunctions(prev => prev.map(f => f._cid === fn._cid ? r.function : f));
        } else {
          const r = await api.functions.update(id, fn.id, payload);
          setFunctions(prev => prev.map(f => f.id === fn.id ? r.function : f));
        }
      } catch (err) {
        errors.push(fn.name || 'Untitled');
      } finally {
        setSavingFnId(null);
      }
    }
    setSavingAllFns(false);
    if (errors.length > 0) {
      toast(`Failed to save: ${errors.join(', ')}`, 'error');
    } else {
      toast('All functions saved!', 'success');
    }
  }

  async function removeFn(fn) {
    try {
      if (!fn._isNew) await api.functions.remove(id, fn.id);
      setFunctions(f => f.filter(x => x.id !== fn.id && x._cid !== fn._cid));
      setPartialFnIds(prev => { const next = new Set(prev); next.delete(fn.id); return next; });
      setDeletingFn(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ── VENUES ──────────────────────────────────────────────
  function handleVenueMapUrl(url) {
    const coords = parseGoogleMapsUrl(url);
    setVenueForm(f => ({
      ...f, mapUrl: url,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    }));
  }

  async function saveVenue() {
    if (!venueForm.name) { toast('Venue name is required', 'error'); return; }
    setSavingVenue(true);
    try {
      if (editingVenue) {
        const r = await api.venues.update(id, editingVenue.id, venueForm);
        setVenues(v => v.map(x => x.id === editingVenue.id ? r.venue : x));
        setEditingVenue(null);
      } else {
        const r = await api.venues.add(id, venueForm);
        setVenues(v => [...v, r.venue]);
      }
      setVenueForm({ name: '', address: '', mapUrl: '', city: '', state: '' });
      toast('Saved!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingVenue(false);
    }
  }

  async function removeVenue(vId) {
    try {
      await api.venues.remove(id, vId);
      setVenues(v => v.filter(x => x.id !== vId));
      setDeletingVenue(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ── MEDIA ───────────────────────────────────────────────
  async function addMedia() {
    if (mediaForm.file) {
      setSavingMedia(true);
      try {
        const fd = new FormData();
        fd.append('file', mediaForm.file);
        fd.append('type', mediaForm.type);
        if (String(mediaForm.caption || '').trim()) fd.append('caption', String(mediaForm.caption).trim());
        const r = await api.media.upload(id, fd);
        setMedia((m) => [...m, r.media]);
        setMediaForm({ type: 'photo', url: '', caption: '', file: null });
        toast('Added!', 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setSavingMedia(false);
      }
      return;
    }
    if (!mediaForm.url?.trim()) {
      toast('Choose a file or enter a URL', 'error');
      return;
    }
    setSavingMedia(true);
    try {
      const r = await api.media.upload(id, {
        type: mediaForm.type,
        url: mediaForm.url.trim(),
        caption: String(mediaForm.caption || '').trim() || undefined,
      });
      setMedia((m) => [...m, r.media]);
      setMediaForm({ type: 'photo', url: '', caption: '', file: null });
      toast('Added!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingMedia(false);
    }
  }

  async function removeMedia(mid) {
    try {
      await api.media.remove(id, mid);
      await refreshMedia();
      setDeletingMedia(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ── CUSTOM FIELDS ────────────────────────────────────────
  function setFieldValue(key, val) {
    const schemaRow = Array.isArray(fieldSchema) ? fieldSchema.find((r) => r.key === key) : null;
    const ft = schemaRow?.type || 'text';
    setCustomFields(f => {
      const existing = f.find(x => x.fieldKey === key);
      if (existing) return f.map(x => x.fieldKey === key ? { ...x, fieldValue: val, fieldType: ft } : x);
      return [...f, { fieldKey: key, fieldValue: val, fieldType: ft }];
    });
  }

  async function saveCustomFields() {
    setSavingFields(true);
    try {
      const rows = (Array.isArray(fieldSchema) ? fieldSchema : []).map((field) => {
        const saved = customFields.find((x) => x.fieldKey === field.key);
        return {
          fieldKey: field.key,
          fieldValue: saved?.fieldValue ?? '',
          fieldType: field.type || 'text',
        };
      });
      if (!rows.length) {
        toast('No custom fields on this template.', 'success');
        return;
      }
      const r = await api.customFields.upsert(id, { fields: rows });
      if (Array.isArray(r.fields)) {
        setCustomFields(r.fields.map((f) => ({
          fieldKey: f.fieldKey,
          fieldValue: String(f.fieldValue ?? ''),
          fieldType: f.fieldType || 'text',
        })));
      }
      toast('Custom fields saved!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingFields(false);
    }
  }

  // ── LANGUAGE ─────────────────────────────────────────────
  async function saveLanguage() {
    setSavingLang(true);
    try {
      await api.events.update(id, { language });
      setEvent(e => ({ ...e, language }));
      toast('Language saved!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingLang(false);
    }
  }

  async function saveGuestFeatures() {
    setSavingGuestFeatures(true);
    try {
      await api.events.update(id, {
        instagramUrl: instagramUrl.trim() || null,
        socialYoutubeUrl: socialYoutubeUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        rsvpEnabled,
        guestNotesEnabled,
      });
      setEvent((e) => ({
        ...e,
        instagramUrl: instagramUrl.trim() || null,
        socialYoutubeUrl: socialYoutubeUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        rsvpEnabled,
        guestNotesEnabled,
      }));
      toast('Links and guest options saved!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingGuestFeatures(false);
    }
  }

  // ── PUBLISH ──────────────────────────────────────────────
  async function handlePublish() {
    if (partialEnabled && partialFnIds.size === 0) {
      toast('Select at least one function for the partial invite, or disable partial invite.', 'error');
      return;
    }
    setPublishing(true);
    try {
      // If a paired invite already exists, push current partial selection first.
      if (event.invitePairId && partialEnabled) {
        const selectedIds = functions
          .filter((f) => !f._isNew && f.id && partialFnIds.has(f.id))
          .map((f) => f.id);
        if (selectedIds.length > 0) {
          await api.events.updatePartial(id, { partialFunctionIds: selectedIds });
        }
      }

      const body = {
        slugFull: slugFull || undefined,
        createPartial: partialEnabled && !event.invitePairId,
        partialSlug: partialEnabled ? partialSlug : undefined,
        partialFunctionIds: partialEnabled ? [...partialFnIds].filter(k => !String(k).startsWith('new-')) : undefined,
      };
      await api.events.publish(id, body);
      // Reload event to get updated slug, inviteScope, pairedEvent
      const r = await api.events.get(id);
      setEvent(r.event);
      if (r.event.pairedEvent) {
        setPartialEnabled(true);
        setPartialSlug(r.event.pairedEvent.slug);
        setPartialFnIds(new Set((r.event.pairedEvent.functions || []).map(f => f.id)));
      }
      toast('Invitation published!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPublishing(false);
    }
  }

  async function openPreview() {
    setLoadingPreview(true);
    try {
      const r = await api.events.previewToken(id);
      window.open(r.previewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err.message || 'Could not open preview', 'error');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleUnpublish() {
    setConfirmUnpublish(false);
    try {
      await api.events.unpublish(id);
      setEvent(e => ({ ...e, isPublished: false }));
      toast('Invitation unpublished', 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function refreshEvent() {
    try {
      // Refresh should also sync partial selection changes made via checkboxes.
      if (event.invitePairId && partialEnabled) {
        const selectedIds = functions
          .filter((f) => !f._isNew && f.id && partialFnIds.has(f.id))
          .map((f) => f.id);
        if (selectedIds.length > 0) {
          await api.events.updatePartial(id, { partialFunctionIds: selectedIds });
        }
      }

      const r = await api.events.get(id);
      setEvent(r.event);
      if (r.event.pairedEvent) {
        setPartialEnabled(true);
        setPartialSlug(r.event.pairedEvent.slug || '');
        setPartialFnIds(new Set(r.event.pairedEvent.pairedFunctionIds || []));
      }
      toast('Invite details refreshed', 'success');
    } catch (err) {
      toast(err.message || 'Failed to refresh invite data', 'error');
    }
  }

  const inviteBase = getInviteBaseUrl();
  const inviteUrl = `${inviteBase}/i/${event.slug}`;
  const pairedEvent = event.pairedEvent;
  const partialUrl = pairedEvent ? `${inviteBase}/i/${pairedEvent.slug}` : null;
  const partialInviteSlug = pairedEvent?.slug || partialSlug;
  const partialPreviewUrl = partialInviteSlug ? `${inviteBase}/i/${partialInviteSlug}` : null;
  const isEditMode = event.isPublished; // page title changes after publish

  return (
    <div className="invite-form-page page-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEditMode ? 'Edit Invitation' : 'Generate Invitation'}</h1>
          <p className="page-subtitle">{event.slug} · {event.community} {event.eventType}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href={inviteUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Preview</a>
        </div>
      </div>

      {/* Section tabs */}
      <div className="section-tabs">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`section-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="invite-form-body">

        {/* ── A. PEOPLE ── */}
        {activeSection === 'people' && (
          <div className="card">
            <NameConfirmBar
              event={event}
              onConfirmed={updated => setEvent(updated)}
              people={people}
            />

            <div className="section-header">
              <div className="section-title">People</div>
            </div>

            {!frozen && !hasSchemaPeopleRoles && (
              <div className="inline-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role <span className="form-hint-inline">(fallback mode)</span></label>
                    <input
                      className="form-input"
                      placeholder="e.g. Bride, Groom, Father of Bride"
                      value={personForm.role}
                      onChange={e => setPersonForm(f => ({ ...f, role: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Priya Sharma"
                      value={personForm.name}
                      onChange={e => setPersonForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="inline-form-actions">
                  <button className="btn btn-primary btn-sm" disabled={savingPerson} onClick={async () => {
                    if (!personForm.role || !personForm.name) { toast('Role and name are required', 'error'); return; }
                    setSavingPerson(true);
                    try {
                      const r = await api.people.add(id, personForm);
                      setPeople(p => [...p, r.person]);
                      setPersonForm({ role: '', name: '' });
                      toast('Saved!', 'success');
                    } catch (err) {
                      toast(err.message, 'error');
                    } finally {
                      setSavingPerson(false);
                    }
                  }}>
                    {savingPerson ? <span className="btn-spinner" /> : null}
                    Add Person
                  </button>
                </div>
              </div>
            )}

            {hasSchemaPeopleRoles && (
              <div className="inline-form">
                <div className="form-hint" style={{ marginBottom: 10 }}>
                  {frozen
                    ? 'Required names are locked after confirmation. You can still edit optional names below.'
                    : 'Roles are fixed by template schema. Fill names only.'}
                </div>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <div className="form-label">Role</div>
                  <div className="form-label">Full Name</div>
                </div>
                {schemaPeopleRoles.map((roleDef) => {
                  const isLocked = frozen && roleDef.required;
                  return (
                    <div className="form-row" key={roleDef.role}>
                      <div className="form-group">
                        <div className="item-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {roleDef.label}
                          {isLocked && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🔒</span>}
                        </div>
                      </div>
                      <div className="form-group">
                        <input
                          className="form-input"
                          placeholder={DEMO_NAMES[roleDef.role] || `e.g. ${roleDef.label} Name`}
                          value={peopleInputs[roleDef.role] || ''}
                          onChange={(e) => setPeopleInputs((prev) => ({ ...prev, [roleDef.role]: e.target.value }))}
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="inline-form-actions">
                  <button className="btn btn-primary btn-sm" disabled={savingPerson} onClick={savePeopleBySchema}>
                    {savingPerson ? <span className="btn-spinner" /> : null}
                    Save People
                  </button>
                </div>
              </div>
            )}

            {people.length > 0 ? (
              <div className="items-list">
                {people.map(p => (
                  <div key={p.id} className="item-row">
                    <div className="item-info">
                      <span className="item-label">{p.role}</span>
                      <span className="item-name">{p.name}</span>
                    </div>
                    {!frozen && (
                      <div className="item-actions">
                        {!hasSchemaPeopleRoles && (
                          <button className="btn btn-danger btn-sm" onClick={() => setDeletingPerson(p)}>Remove</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon">👤</div>
                <div className="empty-title">No people added yet</div>
                <div className="empty-desc">Add the bride, groom, and family members.</div>
              </div>
            )}
          </div>
        )}

        {/* ── B. FUNCTIONS ── */}
        {activeSection === 'functions' && (
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Ceremonies & Functions</div>
                {functions.length > 1 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Tick ✓ to include in partial invite
                  </div>
                )}
              </div>
              {functions.length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={savingAllFns}
                  onClick={saveAllFunctions}
                  title="Save all ceremonies at once"
                >
                  {savingAllFns ? <span className="btn-spinner" /> : '💾'}
                  Save All Functions
                </button>
              )}
            </div>

            {functions.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon">🎊</div>
                <div className="empty-title">No ceremonies added</div>
                <div className="empty-desc">Click the + button below to add your first ceremony.</div>
                <button className="fn-add-btn" onClick={() => setFunctions([BLANK_FN()])}>+</button>
              </div>
            ) : (
              <div className="fn-cards">
                {functions.map((fn, idx) => {
                  const key = fn._cid || fn.id;
                  const isSaving = savingFnId === key;
                  return (
                    <div key={key} className={`fn-card${isSaving ? ' fn-card-saving' : ''}`}>
                      {/* Card header */}
                      <div className="fn-card-header">
                        <span className="fn-card-title">Function {idx + 1}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {fn._isNew && <span className="fn-badge-new">Unsaved</span>}
                          {isSaving && <span className="btn-spinner" style={{ display: 'inline-block' }} />}
                          {functions.length > 1 && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeletingFn(fn)}>Remove</button>
                          )}
                        </div>
                      </div>

                      {/* Fields */}
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Function Name <span className="req">*</span></label>
                          <input className="form-input" placeholder="e.g. Wedding Ceremony, Mehendi, Sangeet"
                            value={fn.name}
                            onChange={e => updateFnField(key, 'name', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Date <span className="req">*</span></label>
                          <input className="form-input" type="date"
                            value={fn.date ? String(fn.date).slice(0, 10) : ''}
                            onChange={e => updateFnField(key, 'date', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Venue dropdown */}
                      <div className="form-group">
                        <label className="form-label">Venue</label>
                        {venues.length === 0 ? (
                          <div className="fn-venue-empty">
                            No venues added yet —{' '}
                            <button className="btn-link" onClick={() => setActiveSection('venues')}>add a venue first</button>
                          </div>
                        ) : (
                          <select
                            className="form-select"
                            value={fn.venueId || ''}
                            onChange={e => {
                              const v = venues.find(v => v.id === e.target.value);
                              if (v) {
                                setFunctions(prev => prev.map(f =>
                                  (f._cid === key || f.id === key)
                                    ? { ...f, venueId: v.id, venueName: v.name, venueAddress: v.address || '', venueMapUrl: v.mapUrl || '' }
                                    : f
                                ));
                              } else {
                                setFunctions(prev => prev.map(f =>
                                  (f._cid === key || f.id === key)
                                    ? { ...f, venueId: '', venueName: '', venueAddress: '', venueMapUrl: '' }
                                    : f
                                ));
                              }
                            }}
                          >
                            <option value="">— No venue —</option>
                            {venues.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name}{v.city ? ` · ${v.city}` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        {fn.venueId && fn.venueName && (
                          <div className="fn-venue-preview">
                            {fn.venueAddress && <span>{fn.venueAddress}</span>}
                            {fn.venueMapUrl && <a href={fn.venueMapUrl} target="_blank" rel="noreferrer" className="fn-venue-map-link">📍 Map</a>}
                          </div>
                        )}
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Start Time</label>
                          <input className="form-input" placeholder="e.g. 7:00 PM"
                            value={fn.startTime || ''}
                            onChange={e => updateFnField(key, 'startTime', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Dress Code</label>
                          <input className="form-input" placeholder="e.g. Traditional / Ethnic / Formal"
                            value={fn.dressCode || ''}
                            onChange={e => updateFnField(key, 'dressCode', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Partial invite checkbox — shown for all functions including unsaved */}
                      {functions.length > 1 && (
                        <label className="fn-partial-label">
                          <input
                            type="checkbox"
                            checked={partialFnIds.has(fn.id || fn._cid)}
                            onChange={e => setPartialFnIds(prev => {
                              const next = new Set(prev);
                              const k = fn.id || fn._cid;
                              e.target.checked ? next.add(k) : next.delete(k);
                              return next;
                            })}
                          />
                          Include in <strong>partial invite</strong>
                          {fn._isNew && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>(save first to apply)</span>}
                        </label>
                      )}

                      {/* Add-after button row (save now handled by master button at top) */}
                      <div className="fn-card-footer">
                        <button className="fn-add-btn" title="Add function after this one" onClick={() => insertFnAfter(key)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── C. VENUES ── */}
        {activeSection === 'venues' && (
          <div className="card">
            <div className="section-header">
              <div className="section-title">Venues</div>
            </div>

            <div className="inline-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Venue Name</label>
                  <input className="form-input" placeholder="e.g. Raj Palace Banquet Hall"
                    value={editingVenue ? editingVenue.name : venueForm.name}
                    onChange={e => editingVenue ? setEditingVenue(v => ({ ...v, name: e.target.value })) : setVenueForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" placeholder="Mumbai"
                    value={editingVenue ? editingVenue.city || '' : venueForm.city}
                    onChange={e => editingVenue ? setEditingVenue(v => ({ ...v, city: e.target.value })) : setVenueForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Full Address</label>
                <input className="form-input" placeholder="e.g. 14 MG Road, Bandra West, Mumbai 400050"
                  value={editingVenue ? editingVenue.address || '' : venueForm.address}
                  onChange={e => editingVenue ? setEditingVenue(v => ({ ...v, address: e.target.value })) : setVenueForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Google Maps Link</label>
                <input className="form-input" placeholder="https://maps.google.com/..."
                  value={editingVenue ? editingVenue.mapUrl || '' : venueForm.mapUrl}
                  onChange={e => {
                    if (editingVenue) {
                      const coords = parseGoogleMapsUrl(e.target.value);
                      setEditingVenue(v => ({ ...v, mapUrl: e.target.value, ...(coords || {}) }));
                    } else {
                      handleVenueMapUrl(e.target.value);
                    }
                  }}
                />
                <div className="form-hint">Lat/Lng are auto-extracted from Google Maps links.</div>
              </div>
              <div className="inline-form-actions">
                {editingVenue && <button className="btn btn-ghost btn-sm" onClick={() => setEditingVenue(null)}>Cancel</button>}
                <button className="btn btn-primary btn-sm" disabled={savingVenue} onClick={saveVenue}>
                  {savingVenue ? <span className="btn-spinner" /> : null}
                  {editingVenue ? 'Update Venue' : 'Add Venue'}
                </button>
              </div>
            </div>

            {venues.length > 0 ? (
              <div className="items-list">
                {venues.map(v => (
                  <div key={v.id} className="item-row">
                    <div className="item-info">
                      <span className="item-name">{v.name}</span>
                      <span className="item-meta">{[v.address, v.city].filter(Boolean).join(', ')}</span>
                    </div>
                    <div className="item-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingVenue(v)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeletingVenue(v)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon">📍</div>
                <div className="empty-title">No venues added</div>
                <div className="empty-desc">Add venue(s) for your ceremonies.</div>
              </div>
            )}
          </div>
        )}

        {/* ── D. MEDIA ── */}
        {activeSection === 'media' && (
          <div className="card">
            <div className="section-header">
              <div className="section-title">Photos & Music</div>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              {mediaSlotsNorm
                ? 'Each block matches a section of your template. Upload from your phone or computer, or paste a link when allowed.'
                : 'Add photos, music, or short videos. Upload a file from your device or paste a direct link to the file.'}
            </p>

            {mediaSlotsNorm ? (
              <>
                {mediaSlotsNorm.map((slot) => (
                  <MediaSlotCard
                    key={slot.key}
                    slot={slot}
                    eventId={id}
                    slotItems={media
                      .filter((m) => m.slotKey === slot.key)
                      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))}
                    refreshMedia={refreshMedia}
                    onRemoveRequest={(m) => setDeletingMedia(m)}
                    toast={toast}
                    globalAssets={globalAssets}
                  />
                ))}
                {media.some((m) => !m.slotKey) && (
                  <div className="items-list" style={{ marginTop: 8 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Earlier uploads (no section)</div>
                    {media
                      .filter((m) => !m.slotKey)
                      .map((m) => (
                        <div key={m.id} className="item-row">
                          <div className="item-info">
                            <span className="item-label">{m.type}</span>
                            {m.type === 'photo' && <img src={m.url} alt={m.caption || 'photo'} style={{ width: '100%', maxWidth: 200, borderRadius: 6, marginTop: 6, display: 'block' }} />}
                            {m.type === 'music' && <audio controls src={m.url} style={{ width: '100%', marginTop: 6 }} />}
                            {m.type === 'video' && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent, #8b3a3a)', display: 'block', marginTop: 4 }}>▶ View Video</a>}
                          </div>
                          <div className="item-actions">
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeletingMedia(m)}>Remove</button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="inline-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Type</label>
                      <select className="form-select" value={mediaForm.type} onChange={(e) => setMediaForm((f) => ({ ...f, type: e.target.value }))}>
                        <option value="photo">Photo</option>
                        <option value="music">Music</option>
                        <option value="video">Video</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Upload from device</label>
                      <input
                        type="file"
                        className="form-input"
                        accept={mediaForm.type === 'music' ? 'audio/*' : mediaForm.type === 'video' ? 'video/*' : 'image/*'}
                        onChange={(e) => setMediaForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Caption (optional)</label>
                    <input
                      className="form-input"
                      placeholder="Our engagement day"
                      value={mediaForm.caption}
                      onChange={(e) => setMediaForm((f) => ({ ...f, caption: e.target.value }))}
                    />
                  </div>
                  <div className="inline-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={savingMedia} onClick={addMedia}>
                      {savingMedia ? <span className="btn-spinner" /> : null}
                      Add Media
                    </button>
                  </div>
                </div>
                {media.length > 0 ? (
                  <div className="items-list">
                    {media.map((m) => (
                      <div key={m.id} className="item-row">
                        <div className="item-info">
                          <span className="item-label">{m.type}{m.slotKey ? ` (${m.slotKey})` : ''}</span>
                          {m.type === 'photo' && <img src={m.url} alt={m.caption || 'photo'} style={{ width: '100%', maxWidth: 200, borderRadius: 6, marginTop: 6, display: 'block' }} />}
                          {m.type === 'music' && <audio controls src={m.url} style={{ width: '100%', marginTop: 6 }} />}
                          {m.type === 'video' && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent, #8b3a3a)', display: 'block', marginTop: 4 }}>▶ View Video</a>}
                          {m.caption && <span className="item-meta">{m.caption}</span>}
                        </div>
                        <div className="item-actions">
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeletingMedia(m)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <div className="empty-icon">🖼️</div>
                    <div className="empty-title">No media added</div>
                    <div className="empty-desc">Add photos, music, or videos.</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── E. CUSTOM FIELDS ── */}
        {activeSection === 'custom' && (
          <div className="card">
            <div className="section-header">
              <div className="section-title">Custom Fields</div>
            </div>
            {fieldSchema.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon">📋</div>
                <div className="empty-title">No custom fields</div>
                <div className="empty-desc">This template has no additional fields.</div>
              </div>
            ) : (
              <>
                {fieldSchema.map(field => {
                  const saved = customFields.find(f => f.fieldKey === field.key);
                  const listId = `cf-list-${field.key}`;

                  let demoPlaceholder = '';
                  if (templateDemoData?.customFields) {
                    const demoCf = templateDemoData.customFields.find(cf => cf.key === field.key);
                    if (demoCf && demoCf.value) demoPlaceholder = demoCf.value;
                  }
                  const fallbackSuggestions = CUSTOM_FIELD_SUGGESTIONS[field.key] || [];
                  const finalPlaceholder = field.placeholder ||
                    (demoPlaceholder ? `e.g. ${demoPlaceholder}` :
                      (fallbackSuggestions[0] ? `e.g. ${fallbackSuggestions[0]}` : ''));

                  return (
                    <div key={field.key} className="form-group">
                      <label className="form-label">{field.label || field.key}</label>
                      {field.type === 'textarea' ? (
                        <textarea className="form-textarea"
                          placeholder={finalPlaceholder}
                          value={saved?.fieldValue || ''}
                          onChange={e => setFieldValue(field.key, e.target.value)}
                        />
                      ) : field.type === 'date' ? (
                        <input
                          className="form-input"
                          type="date"
                          value={toHtmlDateInputValue(saved?.fieldValue || '')}
                          onChange={(e) => setFieldValue(field.key, e.target.value)}
                        />
                      ) : (
                        <input
                          className="form-input"
                          type={field.type || 'text'}
                          placeholder={finalPlaceholder}
                          value={saved?.fieldValue || ''}
                          onChange={e => setFieldValue(field.key, e.target.value)}
                        />
                      )}
                      {field.hint && <div className="form-hint">{field.hint}</div>}
                    </div>
                  );
                })}
                <button className="btn btn-primary" disabled={savingFields} onClick={saveCustomFields}>
                  {savingFields ? <span className="btn-spinner" /> : null}
                  Save Custom Fields
                </button>
              </>
            )}
          </div>
        )}

        {/* ── F. LINKS & GUEST FEATURES ── */}
        {activeSection === 'social' && (
          <div className="card">
            <div className="section-header">
              <div className="section-title">Links & guest features</div>
            </div>
            <p className="page-subtitle" style={{ marginBottom: 16 }}>
              Add Instagram, YouTube, or website links for guests. Your template HTML supplies the icons; this screen only sets the URLs.
              Turn off RSVP or guest notes to hide those features on the live invite — templates should wrap RSVP and wish blocks with <strong>rsvp_enabled</strong> and <strong>guest_notes_enabled</strong> (see the template developer guide).
            </p>
            <div className="form-group">
              <label className="form-label">Instagram URL</label>
              <input
                className="form-input"
                type="url"
                placeholder="e.g. https://instagram.com/priya_rahul_2025"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">YouTube URL</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://youtube.com/@yourchannel"
                value={socialYoutubeUrl}
                onChange={(e) => setSocialYoutubeUrl(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://…"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={rsvpEnabled} onChange={(e) => setRsvpEnabled(e.target.checked)} />
                Show RSVP form on invitation
              </label>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={guestNotesEnabled} onChange={(e) => setGuestNotesEnabled(e.target.checked)} />
                Show guest notes / wishes on invitation
              </label>
            </div>
            <button className="btn btn-primary" disabled={savingGuestFeatures} onClick={saveGuestFeatures}>
              {savingGuestFeatures ? <span className="btn-spinner" /> : null}
              Save links & options
            </button>
          </div>
        )}

        {/* ── G. LANGUAGE ── */}
        {activeSection === 'language' && (
          <div className="card">
            <div className="card-title">Invitation Language</div>
            <p className="page-subtitle" style={{ marginBottom: 20 }}>
              {templateLanguages
                ? `This template supports ${templateLanguages.length} language${templateLanguages.length !== 1 ? 's' : ''}.`
                : 'Select the language for your invitation text.'}
            </p>
            <div className="language-grid">
              {LANGUAGES.filter(lang => !templateLanguages || templateLanguages.includes(lang.code)).map(lang => (
                <label key={lang.code} className={`language-option ${language === lang.code ? 'selected' : ''}`}>
                  <input type="radio" name="language" value={lang.code} checked={language === lang.code} onChange={() => setLanguage(lang.code)} />
                  <span>{lang.label}</span>
                </label>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={savingLang} onClick={saveLanguage}>
              {savingLang ? <span className="btn-spinner" /> : null}
              Save Language
            </button>
          </div>
        )}

        {/* ── H. PREVIEW & PUBLISH ── */}
        {activeSection === 'publish' && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">Preview & Publish</div>

              {/* Pre-flight checklist */}
              <div className="preflight-list">
                <PreflyItem ok={people.length > 0} label="At least one person added" />
                <PreflyItem ok={frozen} label="Names confirmed" />
                <PreflyItem ok={functions.length > 0} label="At least one ceremony added" />
                <PreflyItem ok={event.isPublished} label="Invitation published" />
              </div>

              <hr className="divider" />

              <div className="publish-columns">
                {/* Full invite column */}
                <div className="publish-column-card">
                  <div className="publish-column-title">Full Invite</div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`badge ${event.isPublished ? 'badge-published' : 'badge-draft'}`}>
                      {event.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Invite Slug</label>
                    <div className="slug-input-wrap">
                      <span className="slug-prefix">aamantran.co/i/</span>
                      <input
                        className="form-input slug-input"
                        value={slugFull}
                        disabled={event.isPublished}
                        onChange={e => setSlugFull(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      />
                    </div>
                    <div className="form-hint">All functions included.</div>
                  </div>

                  <div className="publish-link-line">
                    <span className="pub-link-label">Invite</span>
                    {event.isPublished ? (
                      <a href={inviteUrl} target="_blank" rel="noreferrer" className="pub-link">{inviteUrl}</a>
                    ) : (
                      <span className="item-meta">Will be available after publish</span>
                    )}
                  </div>

                  <div className="publish-qr-wrap">
                    <div className="qr-code-label">QR</div>
                    {event.isPublished ? (
                      <>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteUrl)}`}
                          alt="Full Invite QR Code"
                          className="qr-preview"
                        />
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          const a = document.createElement('a');
                          a.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(inviteUrl)}`;
                          a.download = `qr-${event.slug}.png`;
                          a.target = '_blank';
                          a.click();
                        }}>⬇ Download QR</button>
                      </>
                    ) : (
                      <div className="item-meta">QR will be generated after publish</div>
                    )}
                  </div>

                  <div className="publish-actions-column">
                    <button className="btn btn-secondary btn-sm" onClick={openPreview} disabled={loadingPreview}>
                      {loadingPreview ? 'Opening…' : '👁 Preview'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={refreshEvent}>🔄 Refresh</button>
                  </div>
                </div>

                {/* Partial invite column */}
                <div className="publish-column-card">
                  <div className="publish-column-title">Partial Invite</div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`badge ${event.isPublished && partialPreviewUrl ? 'badge-published' : 'badge-draft'}`}>
                      {event.isPublished && partialPreviewUrl ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {functions.length > 1 && !event.invitePairId && !event.isPublished && (
                    <div className="partial-toggle-row">
                      <label className="partial-toggle-label">
                        <input
                          type="checkbox"
                          checked={partialEnabled}
                          onChange={e => setPartialEnabled(e.target.checked)}
                        />
                        <span>Enable partial invite</span>
                      </label>
                    </div>
                  )}

                  {(partialEnabled || event.invitePairId) && functions.length > 1 ? (
                    <div className="form-group">
                      <label className="form-label">Invite Slug</label>
                      <div className="slug-input-wrap">
                        <span className="slug-prefix">aamantran.co/i/</span>
                        <input
                          className="form-input slug-input"
                          value={partialSlug}
                          disabled={event.isPublished}
                          placeholder={`${slugFull}-partial`}
                          onChange={e => setPartialSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        />
                      </div>
                      <div className="form-hint">
                        Only selected functions from Section B.
                        {partialFnIds.size > 0 && (
                          <> Selected: {functions.filter(f => partialFnIds.has(f.id)).map(f => f.name).join(', ')}</>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="item-meta" style={{ marginBottom: 12 }}>
                      Partial invite requires 2+ functions.
                    </div>
                  )}

                  <div className="publish-link-line">
                    <span className="pub-link-label">Invite</span>
                    {partialPreviewUrl && event.isPublished ? (
                      <a href={partialPreviewUrl} target="_blank" rel="noreferrer" className="pub-link">{partialPreviewUrl}</a>
                    ) : (
                      <span className="item-meta">Will be available after publish</span>
                    )}
                  </div>

                  <div className="publish-qr-wrap">
                    <div className="qr-code-label">QR</div>
                    {partialPreviewUrl && event.isPublished ? (
                      <>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(partialPreviewUrl)}`}
                          alt="Partial Invite QR Code"
                          className="qr-preview"
                        />
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          const a = document.createElement('a');
                          a.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(partialPreviewUrl)}`;
                          a.download = `qr-${partialInviteSlug || 'partial'}.png`;
                          a.target = '_blank';
                          a.click();
                        }}>⬇ Download QR</button>
                      </>
                    ) : (
                      <div className="item-meta">QR will be generated after publish</div>
                    )}
                  </div>

                  <div className="publish-actions-column">
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={loadingPreview || !pairedEvent?.id}
                      onClick={async () => {
                        if (!pairedEvent?.id) return;
                        setLoadingPreview(true);
                        try {
                          const r = await api.events.previewToken(pairedEvent.id);
                          window.open(r.previewUrl, '_blank', 'noopener,noreferrer');
                        } catch (err) {
                          toast(err.message || 'Could not open preview', 'error');
                        } finally {
                          setLoadingPreview(false);
                        }
                      }}
                    >
                      {loadingPreview ? 'Opening…' : '👁 Preview'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={refreshEvent}>🔄 Refresh</button>
                  </div>
                </div>
              </div>

              {!frozen && (
                <div className="publish-note">
                  ⚠️ Confirm your names (Section A) before publishing.
                </div>
              )}

              {/* Big publish / unpublish button — below invite columns, above WhatsApp */}
              <div style={{ marginTop: 24 }}>
                {!event.isPublished ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px 20px', fontSize: '1.1rem', fontWeight: 700, borderRadius: 10 }}
                    disabled={!frozen || publishing}
                    onClick={handlePublish}
                    title={!frozen ? 'Confirm your names first (Section A)' : ''}
                  >
                    {publishing ? <span className="btn-spinner" /> : '🚀'}
                    {publishing ? ' Publishing…' : ' Publish Invitation'}
                  </button>
                ) : (
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', padding: '14px 20px', fontSize: '1.1rem', fontWeight: 700, borderRadius: 10 }}
                    onClick={() => setConfirmUnpublish(true)}
                  >
                    🔕 Unpublish Invitation
                  </button>
                )}
              </div>
            </div>

            {/* WhatsApp Share — shown after publish */}
            {event.isPublished && (
              <WhatsAppShare
                event={event}
                people={people}
                functions={functions}
                venues={venues}
                partialUrl={partialUrl}
                eventId={id}
                schemaPeopleRoles={schemaPeopleRoles}
              />
            )}
          </div>
        )}
      </div>

      {/* Confirm modals */}
      {deletingPerson && (
        <ConfirmModal
          title="Remove Person"
          message={`Remove "${deletingPerson.name}" (${deletingPerson.role})?`}
          confirmText="Remove"
          onConfirm={() => removePerson(deletingPerson.id)}
          onCancel={() => setDeletingPerson(null)}
        />
      )}
      {deletingFn && (
        <ConfirmModal
          title="Remove Function"
          message={`Remove "${deletingFn.name || 'this function'}"?`}
          confirmText="Remove"
          onConfirm={() => removeFn(deletingFn)}
          onCancel={() => setDeletingFn(null)}
        />
      )}
      {deletingVenue && (
        <ConfirmModal
          title="Remove Venue"
          message={`Remove "${deletingVenue.name}"?`}
          confirmText="Remove"
          onConfirm={() => removeVenue(deletingVenue.id)}
          onCancel={() => setDeletingVenue(null)}
        />
      )}
      {deletingMedia && (
        <ConfirmModal
          title="Remove Media"
          message="Remove this media item?"
          confirmText="Remove"
          onConfirm={() => removeMedia(deletingMedia.id)}
          onCancel={() => setDeletingMedia(null)}
        />
      )}
      {confirmUnpublish && (
        <ConfirmModal
          title="Unpublish Invitation"
          message="This will hide your invitation from guests. You can re-publish at any time."
          confirmText="Unpublish"
          onConfirm={handleUnpublish}
          onCancel={() => setConfirmUnpublish(false)}
        />
      )}
    </div>
  );
}

function PreflyItem({ ok, label }) {
  return (
    <div className={`preflight-item ${ok ? 'ok' : 'nok'}`}>
      <span className="preflight-icon">{ok ? '✓' : '○'}</span>
      <span>{label}</span>
    </div>
  );
}

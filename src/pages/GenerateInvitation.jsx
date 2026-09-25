import { useState, useEffect, useMemo, useCallback, useRef, useId } from 'react';
import { useParams, useOutletContext, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { parseGoogleMapsUrl, slugify, whatsappShareUrl } from '../lib/utils';
import { toHtmlDateInputValue } from '../utils/dateNormalize';
import { getInviteBaseUrl } from '../lib/config';
import { NameConfirmBar, ConfirmNamesModal } from '../components/NameConfirmBar';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { PageSkeleton } from '../components/ui/Skeleton';
import { InfoTip } from '../components/ui/InfoTip';
import { eventTitle, eventMeta, eventTypeWord } from '../lib/event';
import {
  Eye, Check, Lock, ArrowLeft, ArrowRight, ChevronLeft, ChevronDown, Users, CalendarHeart, Image as ImageIcon, FileText,
  Sparkles as SparklesIcon, Link2, Plus, MapPin, Trash2, PencilLine, Copy, Share2, Radio, Music,
} from 'lucide-react';
import { LinkField } from './invite/LinkField';
import { QrCode } from './invite/QrCode';
import { EditOverview } from './invite/EditOverview';
import { toTimeInput, fromTimeInput } from './invite/time';
import './InvitationForm.css';

/**
 * The builder's steps, in order. Venues are added inside Ceremonies (a venue
 * only matters as "where a ceremony happens"). `must` marks the steps a couple
 * has to finish; `overview` is the home of a live invitation.
 */
const SECTIONS = [
  { id: 'overview',  label: 'Overview',          short: 'Overview' },
  { id: 'people',    label: 'Names',             short: 'Names',          must: true },
  { id: 'functions', label: 'Ceremonies',        short: 'Ceremonies',     must: true },
  { id: 'media',     label: 'Photos & music',    short: 'Photos & music' },
  { id: 'custom',    label: 'Special details',   short: 'Special details' },
  { id: 'social',    label: 'Guest features',    short: 'Guest features' },
  { id: 'language',  label: 'Language',          short: 'Language' },
  { id: 'publish',   label: 'Preview & go live', short: 'Go live' },
];

/** Common ceremony names, offered as one-tap suggestions. */
const CEREMONY_SUGGESTIONS = ['Haldi', 'Mehendi', 'Sangeet', 'Wedding', 'Reception', 'Engagement', 'Cocktail', 'Anand Karaj', 'Nikah', 'Roka'];

// Scroll offsets that collapse / restore the sticky tab header. Two separate
// values on purpose: the gap between them is a dead band, so no scroll position
// can toggle the header back and forth.

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
  const [busy, setBusy] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  // Single-file slots hide their pickers once filled and reveal them again
  // behind an explicit "Change" button — the server replaces the old row.
  const [replacing, setReplacing] = useState(false);

  const isSingle = !slot.multiple;
  const isFilled = slotItems.length >= slot.max;
  // A filled single-file slot can still be overwritten; a filled multi slot cannot.
  const locked = isFilled && !isSingle;
  const showPickers = !isFilled || replacing;

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
      toast(isFilled ? 'Music changed.' : 'Added.', 'success');
      setSelectedAssetId('');
      setReplacing(false);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slotKey', slot.key);
    fd.append('type', slot.type);
    await api.media.upload(eventId, fd);
  }

  async function onPickFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const toAdd = slot.multiple ? files : files.slice(0, 1);
    // Single-file slots always have room: the upload replaces what is there.
    const room = isSingle ? 1 : slot.max - slotItems.length;
    if (room <= 0) {
      toast('This section is full — remove an item first', 'error');
      return;
    }
    const batch = toAdd.slice(0, room);
    setBusy(true);
    try {
      for (const f of batch) {
        await uploadFile(f);
        await refreshMedia();
      }
      toast('Uploaded!', 'success');
      setReplacing(false);
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
        <div className={`items-list${slot.type === 'photo' ? ' media-grid' : ''}`} style={{ marginBottom: 12 }}>
          {slotItems.map((m) => (
            <div key={m.id} className="item-row">
              <div className="item-info">
                <span className="item-label">{m.type}{m.caption ? ` — ${m.caption}` : ''}</span>
                {m.type === 'photo' && <img src={m.url} alt={m.caption || 'Your photo'} className="media-thumb" loading="lazy" />}
                {m.type === 'music' && (
                  <div style={{ marginTop: 8, width: '100%', background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Music size={14} aria-hidden="true" /> Background music</div>
                    <audio
                      controls
                      src={m.url}
                      style={{ width: '100%', maxWidth: '100%', display: 'block', minWidth: 0, height: 40 }}
                      controlsList="nodownload"
                      preload="metadata"
                    />
                  </div>
                )}
                {m.type === 'video' && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--gold)', display: 'block', marginTop: 4 }}>▶ View Video</a>}
              </div>
              <div className="item-actions">
                <button type="button" className="btn btn-danger btn-sm" onClick={() => onRemoveRequest(m)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isFilled && isSingle && !replacing && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setReplacing(true)}
          disabled={busy}
        >
          Change {slot.type === 'music' ? 'music' : slot.type === 'video' ? 'video' : 'photo'}
        </button>
      )}

      {showPickers && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">{isFilled ? 'Upload a different file' : 'Upload from device'}</label>
          <input
            type="file"
            className="form-input"
            accept={slot.accept}
            multiple={slot.multiple}
            disabled={busy || locked}
            onChange={onPickFiles}
          />
        </div>
      )}

      {showPickers && slot.key === 'background_music' && globalAssets.filter(a => a.type === 'bg_music').length > 0 && (
        <div className="form-group" style={{ marginBottom: 12, marginTop: 12 }}>
          <label className="form-label">{isFilled ? 'Or choose a different track' : 'Or choose pre-added music'}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              className="form-select"
              style={{ flex: 1, minWidth: 0 }}
              value={selectedAssetId}
              onChange={e => setSelectedAssetId(e.target.value)}
              disabled={busy || locked}
            >
              <option value="">— Select a track —</option>
              {globalAssets.filter(a => a.type === 'bg_music').map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
            <button
              className="btn btn-secondary"
              onClick={selectGlobalAsset}
              disabled={!selectedAssetId || busy || locked}
            >
              {isFilled ? 'Replace' : 'Add'}
            </button>
          </div>
          {selectedAssetId && (() => {
            const selected = globalAssets.find(a => a.id === selectedAssetId);
            if (!selected) return null;
            return (
              <div style={{ marginTop: 8, background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Preview: {selected.name}</div>
                <audio controls src={selected.url} style={{ width: '100%', height: 40 }} preload="metadata" controlsList="nodownload" />
              </div>
            );
          })()}
        </div>
      )}

      {isFilled && isSingle && replacing && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setReplacing(false); setSelectedAssetId(''); }}
          disabled={busy}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/** Demo placeholder names keyed by common role values from template schemas */
const DEMO_NAMES = {
  person1: 'e.g. Rahul Verma',
  person2: 'e.g. Priya Sharma',
  person1_father: 'e.g. Suresh Verma',
  person1_mother: 'e.g. Kavita Verma',
  person2_father: 'e.g. Rajesh Sharma',
  person2_mother: 'e.g. Sunita Sharma',
};

/** "person1" → "Person 1", "birthday_person" → "Birthday person" — never show a raw role key. */
function humanizeRole(role) {
  const s = String(role || '').replace(/^person(\d+)/, 'person $1').replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

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
  person1_side_contact: ['e.g. +91 98765 43210'],
  person2_side_contact: ['e.g. +91 98765 43210'],
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
  const toast = useToast();
  const outletCtx = useOutletContext() || {};
  const [searchParams] = useSearchParams();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('people');
  // Wizard gating: index of the furthest tab the user may open. Tabs past it are locked.
  const [unlockedIdx, setUnlockedIdx] = useState(0);
  const [confirmingNames, setConfirmingNames] = useState(false);
  // Phone: the list of steps opens as a sheet from the step bar
  const [stepSheet, setStepSheet] = useState(false);
  // Why "Next" can't move on yet — shown at the top of the step
  const [flowHint, setFlowHint] = useState('');
  const flowHintRef = useRef(null);
  const navigate = useNavigate();

  // People
  const [people, setPeople] = useState([]);
  const [personForm, setPersonForm] = useState({ role: '', name: '' }); // fallback mode only
  const [savingPerson, setSavingPerson] = useState(false);
  const [peopleInputs, setPeopleInputs] = useState({});
  // role → the couple's pick from that name's roleOptions ("Groom", "Bride"…)
  const [peopleRoleChoices, setPeopleRoleChoices] = useState({});

  // Functions — always-editable inline cards (admin-panel style)
  const [functions, setFunctions] = useState([]);
  const [savingFnId, setSavingFnId] = useState(null); // id or _cid of fn being saved
  const [savingAllFns, setSavingAllFns] = useState(false);

  // Venues
  const [venues, setVenues] = useState([]);
  const [venueForm, setVenueForm] = useState({ name: '', address: '', mapUrl: '', city: '', state: '' });
  const [editingVenue, setEditingVenue] = useState(null);
  const [savingVenue, setSavingVenue] = useState(false);
  const [venueModal, setVenueModal] = useState(null); // { fnKey } while the venue dialog is open

  // Media
  const [media, setMedia] = useState([]);
  const [mediaForm, setMediaForm] = useState({ type: 'photo', url: '', file: null });
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
  const [instagramHashtag, setInstagramHashtag] = useState('');
  const [socialYoutubeUrl, setSocialYoutubeUrl] = useState('');
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

  // Celebration
  const [showCelebration, setShowCelebration] = useState(false);

  // Going live: link checks, "have you previewed?", and the personalise prompt
  const [mainLinkStatus, setMainLinkStatus] = useState({ state: 'idle' });
  const [partialLinkStatus, setPartialLinkStatus] = useState({ state: 'idle' });
  const [previewed, setPreviewed] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const mainLinkRef = useRef(null);
  const partialLinkRef = useRef(null);

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
      setInstagramHashtag(ev.instagramHashtag || '');
      setSocialYoutubeUrl(ev.socialYoutubeUrl || '');
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
      // Open a live invitation on its overview; a link like ?step=publish opens
      // that step when it is already reachable.
      const wanted = searchParams.get('step');
      const reachable = ev.isPublished || wanted === 'people'
        || (ev.namesAreFrozen && (wanted === 'functions' || (ev.functions || []).length > 0));
      if (wanted && reachable && SECTIONS.some((x) => x.id === wanted)) setActiveSection(wanted);
      else if (ev.isPublished) setActiveSection('overview');
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
      toast('We couldn’t open your invitation. Try again.', 'error');
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
        // Set by the admin per name ("Groom, Bride"); empty means no dropdown.
        roleOptions: Array.isArray(r.roleOptions) ? r.roleOptions.map(String).filter(Boolean) : [],
      }));
  }, [templateSchema]);

  // Steps this template's couples get. The template decides (fieldSchema.dashboard,
  // set in the admin): Photos & Music can be switched off, Guest Options shows
  // only the items switched on and disappears when none are. Language appears
  // only for a template offered in two or more languages. A template with no
  // setting keeps every step, exactly as before.
  const dashboardSteps = templateSchema?.dashboard && typeof templateSchema.dashboard === 'object'
    ? templateSchema.dashboard : {};
  const guestOptionKeys = Array.isArray(dashboardSteps.guestOptions) ? dashboardSteps.guestOptions : null;
  const showGuestOption = (key) => !guestOptionKeys || guestOptionKeys.includes(key);
  const isLive = Boolean(event?.isPublished);
  const sections = useMemo(() => SECTIONS.filter((s) => {
    if (s.id === 'overview') return isLive;
    if (s.id === 'media') return dashboardSteps.showMedia !== false;
    // Special details only when the design asks for any.
    if (s.id === 'custom') return fieldSchema.length > 0;
    if (s.id === 'social') return !guestOptionKeys || guestOptionKeys.length > 0;
    if (s.id === 'language') return !templateLanguages || templateLanguages.length > 1;
    return true;
  }), [isLive, dashboardSteps.showMedia, fieldSchema.length, guestOptionKeys, templateLanguages]);

  // Roles follow a prefix convention: "person1_father" hangs off "person1". That lets us
  // group parents under the person they belong to without hard-coding weddings —
  // principals first, then each principal's dependents, in that order.
  const peopleRoleGroups = useMemo(() => {
    const roles = schemaPeopleRoles;
    const ownerOf = (r) => roles.reduce((best, o) => (
      o.role !== r.role && r.role.startsWith(`${o.role}_`) && (!best || o.role.length > best.role.length)
        ? o : best
    ), null);

    // Walk up to the top-level person, so a chained role still lands in one group.
    const rootOf = (r) => {
      let cur = r;
      for (let hops = 0; hops < roles.length; hops++) {
        const owner = ownerOf(cur);
        if (!owner) return cur;
        cur = owner;
      }
      return cur;
    };

    const principals = roles.filter((r) => !ownerOf(r));
    const groups = principals.map((p) => ({
      principal: p,
      dependents: roles.filter((r) => r !== p && rootOf(r).role === p.role),
    }));
    const grouped = new Set(groups.flatMap((g) => [g.principal, ...g.dependents]));
    const orphans = roles.filter((r) => !grouped.has(r));

    return {
      groups,
      principals,
      // Render/save order: every principal, then their dependents, then anything
      // that did not fit the convention.
      ordered: [...principals, ...groups.flatMap((g) => g.dependents), ...orphans],
    };
  }, [schemaPeopleRoles]);

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
    const choices = {};
    for (const roleDef of schemaPeopleRoles) {
      next[roleDef.role] = peopleByRole[roleDef.role]?.name || '';
      if (roleDef.roleOptions.length) choices[roleDef.role] = peopleByRole[roleDef.role]?.extraData?.role_choice || '';
    }
    setPeopleInputs(next);
    setPeopleRoleChoices(choices);
  }, [hasSchemaPeopleRoles, schemaPeopleRoles, peopleByRole]);

  /**
   * A named person whose role the couple still has to pick. Required before a
   * new invitation moves on; a live one keeps working without it (the template
   * falls back to its neutral wording), so it is never forced there.
   */
  const missingRoleChoice = (event && !event.isPublished)
    ? schemaPeopleRoles.find((r) => r.roleOptions.length
        && String(peopleInputs[r.role] || '').trim()
        && !peopleRoleChoices[r.role])
    : null;

  // ── Wizard gating ────────────────────────────────────────
  // The furthest reachable tab is derived from what is already saved, so a
  // returning user picks up where they left off without any server state.
  const derivedUnlockedIdx = useMemo(() => {
    if (!event) return 0;
    if (event.isPublished) return sections.length - 1;

    // Tabs that refuse to hand over the baton until they are filled in.
    const blocked = {
      people: !(hasSchemaPeopleRoles
        ? schemaPeopleRoles.every(r => !r.required || String(peopleByRole[r.role]?.name || '').trim())
        : people.length > 0),
      functions: !(functions.length > 0 && functions.every(f => f.name && f.date && !f._isNew)),
    };
    let blockingLimit = 0;
    while (blockingLimit < sections.length - 1 && !blocked[sections[blockingLimit].id]) blockingLimit++;

    // Reveal one tab at a time: stop just past the last tab that holds data,
    // otherwise every optional tab would unlock at once.
    const hasContent = {
      people: !blocked.people,
      functions: !blocked.functions,
      media: media.length > 0,
      custom: customFields.some(f => String(f.fieldValue || '').trim()),
      social: !!(instagramUrl || instagramHashtag || socialYoutubeUrl),
      language: false,
      publish: false,
    };
    let lastFilled = -1;
    sections.forEach((s, i) => { if (hasContent[s.id]) lastFilled = i; });

    return Math.min(blockingLimit, lastFilled + 1);
  }, [event, sections, hasSchemaPeopleRoles, schemaPeopleRoles, peopleByRole, people, functions,
      media, customFields, instagramUrl, instagramHashtag, socialYoutubeUrl]);

  // Furthest step reached, stored by id: positions differ between templates now
  // that steps can be hidden. The old key held a position in the full list.
  const progressKey = id ? `aamantran:buildProgress:v2:${id}` : null;
  const legacyProgressKey = id ? `aamantran:buildProgress:${id}` : null;

  /** A step id → its position among this template's steps (a hidden step counts as the visible one before it). */
  const positionOf = useCallback((sectionId) => {
    const full = SECTIONS.findIndex((x) => x.id === sectionId);
    if (full < 0) return 0;
    let pos = 0;
    sections.forEach((x, i) => { if (SECTIONS.findIndex((y) => y.id === x.id) <= full) pos = i; });
    return pos;
  }, [sections]);

  // Raise the frontier only — never lower it, or adding a blank ceremony card
  // would re-lock the tabs behind the user mid-edit.
  useEffect(() => {
    let stored = 0;
    try {
      const savedId = progressKey && localStorage.getItem(progressKey);
      if (savedId) stored = positionOf(savedId);
      else {
        const legacy = legacyProgressKey && Number(localStorage.getItem(legacyProgressKey));
        if (legacy > 0 && SECTIONS[legacy]) stored = positionOf(SECTIONS[legacy].id);
      }
    } catch { /* private mode */ }
    setUnlockedIdx(prev => Math.min(Math.max(prev, derivedUnlockedIdx, stored), sections.length - 1));
  }, [derivedUnlockedIdx, progressKey, legacyProgressKey, positionOf, sections.length]);

  useEffect(() => {
    if (!progressKey || unlockedIdx <= 0 || !sections[unlockedIdx]) return;
    try { localStorage.setItem(progressKey, sections[unlockedIdx].id); } catch { /* private mode */ }
  }, [progressKey, unlockedIdx, sections]);

  // A step hidden for this template can't stay open.
  useEffect(() => {
    if (!sections.some((x) => x.id === activeSection)) setActiveSection(sections[positionOf(activeSection)]?.id || 'people');
  }, [sections, activeSection, positionOf]);

  if (loading) return <div className="page-fade" style={{ paddingTop: 8 }}><PageSkeleton stats={0} cards={3} /></div>;
  if (!event) return <div className="page-fade"><p>Event not found.</p></div>;

  const frozen = event.namesAreFrozen;

  // ── PEOPLE FORM LAYOUT ──────────────────────────────────
  const firstNameOf = (full) => String(full || '').trim().split(/\s+/)[0] || '';

  const principalRoles = new Set(peopleRoleGroups.principals.map(r => r.role));
  const principalsNamed = peopleRoleGroups.principals.length > 0
    && peopleRoleGroups.principals.every(r => String(peopleInputs[r.role] || '').trim());
  // Parents stay out of the way until the couple is named — but never hide
  // names that already exist.
  const showDependents = principalsNamed
    || peopleRoleGroups.ordered.some(r => !principalRoles.has(r.role) && String(peopleInputs[r.role] || '').trim());

  const roleRank = (role) => {
    const i = peopleRoleGroups.ordered.findIndex(r => r.role === role);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const orderedPeople = [...people].sort((a, b) => roleRank(a.role) - roleRank(b.role));

  /**
   * Label for a saved person — always the template's own "Form label".
   * Labels are never generated from the entered names: whatever the template
   * author typed in admin is what the couple sees, here and in the form below.
   */
  function savedRoleLabel(role) {
    return schemaPeopleRoles.find(r => r.role === role)?.label || role.replace(/_/g, ' ');
  }

  // ── WIZARD NAVIGATION ───────────────────────────────────
  const activeIdx = sections.findIndex(s => s.id === activeSection);
  const nextSection = sections[activeIdx + 1];

  // Names the user is about to confirm — drafts, since nothing is saved yet.
  // `locked` mirrors the freeze rule the rest of the page already uses
  // (`frozen && roleDef.required`): only required roles lock, the rest stay
  // editable afterwards. Without a schema we can't tell them apart, and the
  // backend blocks every edit in that case, so treat them all as locked.
  const draftNameRows = hasSchemaPeopleRoles
    ? peopleRoleGroups.ordered
        .filter(r => String(peopleInputs[r.role] || '').trim())
        .map(r => ({
          key: r.role,
          role: peopleRoleChoices[r.role] ? `${r.label} · ${peopleRoleChoices[r.role]}` : r.label,
          name: String(peopleInputs[r.role]).trim(),
          locked: r.required,
        }))
    : orderedPeople.map(p => ({ key: p.id, role: humanizeRole(p.role), name: p.name, locked: true }));

  // Only People and Ceremonies hold the user back; the rest are optional.
  const nextDisabled =
    activeSection === 'people'
      ? (hasSchemaPeopleRoles
          ? schemaPeopleRoles.some(r => r.required && !String(peopleInputs[r.role] || '').trim()) || Boolean(missingRoleChoice)
          : people.length === 0)
      : activeSection === 'functions'
        ? functions.length === 0 || functions.some(f => !f.name || !f.date)
        : false;

  const savingActive = savingPerson || savingAllFns || savingVenue || savingFields
    || savingGuestFeatures || savingLang;

  /**
   * Save whatever is on the current step. Moving anywhere — a tab, Back, Next —
   * goes through this first, so nothing typed is ever silently lost.
   * @returns {Promise<boolean>} false when it could not be saved (stay put)
   */
  async function saveActive() {
    switch (activeSection) {
      case 'people':    return savePeopleBySchema();
      case 'functions': return functions.length ? saveAllFunctions() : true;
      case 'custom':    return saveCustomFields();
      case 'social':    return saveGuestFeatures();
      case 'language':  return saveLanguage();
      default:          return true; // photos save as they upload; overview/publish hold no drafts
    }
  }

  async function goToSection(sectionId) {
    setStepSheet(false);
    if (sectionId === activeSection) return;
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0 || idx > unlockedIdx) return;
    if (!(await saveActive())) return;
    setActiveSection(sectionId);
    setFlowHint('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function advanceTo(sectionId) {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    setUnlockedIdx(prev => Math.max(prev, idx));
    setActiveSection(sectionId);
    setFlowHint('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * The step's main button. Building: "Save & continue" — save, then open the
   * next step. Live invitation: "Save changes" — save, then back to the overview.
   */
  async function handleNext() {
    if (nextDisabled) { showFlowHint(nextHint); return; }
    setFlowHint('');
    // People is gated by the permanent name freeze — confirm before moving on.
    if (activeSection === 'people' && !frozen) { setConfirmingNames(true); return; }
    if (!(await saveActive())) return;
    if (isLive) toast('Saved — your live invitation is updated.', 'success');
    if (nextSection) advanceTo(nextSection.id);
  }

  /** "Save": keep what's on this step and stay here. */
  async function handleSave() {
    if (nextDisabled) { showFlowHint(nextHint); return; }
    setFlowHint('');
    // Names are confirmed (and locked) the first time they are saved.
    if (activeSection === 'people' && !frozen) { setConfirmingNames(true); return; }
    if (!(await saveActive())) return;
    toast(isLive ? 'Saved — your live invitation is updated.' : 'Saved.', 'success');
  }

  async function confirmNamesAndAdvance() {
    if (!(await savePeopleBySchema())) return;
    setSavingPerson(true);
    try {
      await api.events.confirmNames(event.id);
      setEvent(e => ({ ...e, namesAreFrozen: true }));
      toast('Names confirmed.', 'success');
      setConfirmingNames(false);
      advanceTo('functions');
    } catch (err) {
      toast(err.message || 'We couldn’t save the names. Try again.', 'error');
    } finally {
      setSavingPerson(false);
    }
  }

  // ── PEOPLE ──────────────────────────────────────────────
  /** @returns {Promise<boolean>} true when everything persisted */
  async function savePeopleBySchema() {
    if (!hasSchemaPeopleRoles) return true;
    const missingRequired = schemaPeopleRoles.find((r) => r.required && !String(peopleInputs[r.role] || '').trim());
    if (missingRequired) {
      toast(`"${missingRequired.label}" is required`, 'error');
      return false;
    }
    if (missingRoleChoice) {
      toast(`Choose ${missingRoleChoice.roleOptions.join(' or ')} for "${missingRoleChoice.label}"`, 'error');
      return false;
    }
    setSavingPerson(true);
    try {
      let nextPeople = [...people];
      let wrote = false;
      // sortOrder follows the grouped order, so the saved list and the rendered
      // invitation both read couple-first, then parents.
      for (const [sortOrder, roleDef] of peopleRoleGroups.ordered.entries()) {
        const role = roleDef.role;
        const nextName = String(peopleInputs[role] || '').trim();
        const existing = nextPeople.find((p) => p.role === role);
        // Only names with role options carry a choice; the rest of extraData
        // is kept exactly as it was.
        const nextChoice = roleDef.roleOptions.length ? (peopleRoleChoices[role] || '') : null;
        const choiceChanged = nextChoice !== null && nextChoice !== (existing?.extraData?.role_choice || '');
        const mergedExtra = () => {
          const extra = { ...(existing?.extraData || {}) };
          if (nextChoice) extra.role_choice = nextChoice;
          else delete extra.role_choice;
          return Object.keys(extra).length ? extra : null;
        };

        if (existing && !nextName && !roleDef.required) {
          await api.people.remove(id, existing.id);
          nextPeople = nextPeople.filter((p) => p.id !== existing.id);
          wrote = true;
          continue;
        }
        if (!nextName) continue;

        if (existing) {
          // A frozen required name is rejected outright by the backend, so don't
          // even reorder it — older events have every sortOrder sitting at 0.
          // Its role choice is the one thing that may still change.
          const editable = !(frozen && roleDef.required);
          const changed = String(existing.name || '').trim() !== nextName || existing.sortOrder !== sortOrder;
          if (editable && (changed || choiceChanged)) {
            // The server decides from the template which roles are locked; the
            // client never has to vouch for it.
            const r = await api.people.update(id, existing.id, {
              role, name: nextName, sortOrder, ...(choiceChanged && { extraData: mergedExtra() }),
            });
            nextPeople = nextPeople.map((p) => (p.id === existing.id ? r.person : p));
            wrote = true;
          } else if (!editable && choiceChanged) {
            const r = await api.people.update(id, existing.id, { extraData: mergedExtra() });
            nextPeople = nextPeople.map((p) => (p.id === existing.id ? r.person : p));
            wrote = true;
          }
        } else {
          const r = await api.people.add(id, {
            role, name: nextName, sortOrder, ...(nextChoice && { extraData: { role_choice: nextChoice } }),
          });
          nextPeople = [...nextPeople, r.person];
          wrote = true;
        }
      }
      setPeople(nextPeople);
      if (wrote) toast('People saved!', 'success');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
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
  // No date filled in for them: a ceremony dated "today" by default looks real
  // and easily goes live wrong.
  const BLANK_FN = () => ({ _cid: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, _isNew: true, name: '', date: '', startTime: '', venueName: '', venueAddress: '', venueMapUrl: '', dressCode: '', notes: '' });

  function updateFnField(fnKey, field, value) {
    setFunctions(prev => prev.map(f => (f._cid === fnKey || f.id === fnKey) ? { ...f, [field]: value } : f));
  }

  /** @returns {Promise<boolean>} true when every ceremony persisted */
  async function saveAllFunctions() {
    // Validate all functions first
    const invalid = functions.filter(fn => !fn.name || !fn.date);
    if (invalid.length > 0) {
      toast('Give every ceremony a name and a date.', 'error');
      return false;
    }
    setSavingAllFns(true);
    const errors = [];
    const savedIdFor = {}; // new ceremony's temporary key → its saved id
    for (let idx = 0; idx < functions.length; idx++) {
      const fn = functions[idx];
      const key = fn._cid || fn.id;
      setSavingFnId(key);
      try {
        const payload = { name: fn.name, date: fn.date, startTime: fn.startTime || undefined, venueId: fn.venueId || undefined, venueName: fn.venueName || undefined, venueAddress: fn.venueAddress || undefined, venueMapUrl: fn.venueMapUrl || undefined, dressCode: fn.dressCode || undefined, notes: fn.notes || undefined, sortOrder: idx };
        if (fn._isNew) {
          const r = await api.functions.add(id, payload);
          savedIdFor[fn._cid] = r.function.id;
          setFunctions(prev => prev.map(f => f._cid === fn._cid ? r.function : f));
          // Carry the partial-invite tick over from the client-side _cid to the real id
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
      } catch {
        errors.push(fn.name || 'Untitled');
      } finally {
        setSavingFnId(null);
      }
    }
    // A second link that already exists follows the ticks straight away.
    if (!errors.length && event.invitePairId && partialEnabled) {
      const selectedIds = [...partialFnIds].map(k => savedIdFor[k] || k).filter(k => k && !String(k).startsWith('new-'));
      if (selectedIds.length) {
        try { await api.events.updatePartial(id, { partialFunctionIds: selectedIds }); }
        catch { errors.push('the second link'); }
      }
    }
    setSavingAllFns(false);
    if (errors.length > 0) {
      toast(`We couldn’t save ${errors.join(', ')}. Please try again.`, 'error');
      return false;
    }
    return true;
  }

  async function removeFn(fn) {
    try {
      if (!fn._isNew) await api.functions.remove(id, fn.id);

      // A function is identified by `_cid` until it is saved and by `id`
      // afterwards -- never both at once. The previous filter compared the two
      // fields independently and kept a row only if BOTH differed, so for every
      // sibling the absent field compared `undefined !== undefined` -> false and
      // the whole row was dropped. Deleting one ceremony wiped every other one
      // in the same state.
      //
      // Comparing a single resolved key is the idiom already used for saving
      // and for React keys further down this file.
      const key = fn._cid || fn.id;
      setFunctions(f => f.filter(x => (x._cid || x.id) !== key));

      // The partial-invite tick is keyed by whichever id the row had when it was
      // ticked, so clear both: an unsaved row ticked under its `_cid` would
      // otherwise linger in the set, leaving a phantom selection behind.
      setPartialFnIds(prev => {
        const next = new Set(prev);
        next.delete(fn.id);
        next.delete(fn._cid);
        return next;
      });
      setDeletingFn(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ── VENUES ──────────────────────────────────────────────
  /** Open the venue dialog — to add one for a ceremony (fnKey), or to edit an existing venue. */
  function openVenueModal(fnKey, venue = null) {
    setEditingVenue(venue ? { ...venue } : null);
    setVenueForm({ name: '', address: '', mapUrl: '', city: '', state: '' });
    setVenueModal({ fnKey });
  }

  /** @returns {Promise<object|null>} the saved venue */
  async function saveVenue() {
    if (editingVenue ? !String(editingVenue.name || '').trim() : !venueForm.name.trim()) {
      toast('Give the venue a name.', 'error');
      return null;
    }
    setSavingVenue(true);
    try {
      let saved;
      if (editingVenue) {
        const r = await api.venues.update(id, editingVenue.id, editingVenue);
        saved = r.venue;
        setVenues(v => v.map(x => x.id === editingVenue.id ? r.venue : x));
        // Ceremonies at this venue show its new details.
        setFunctions(prev => prev.map(f => f.venueId === saved.id
          ? { ...f, venueName: saved.name, venueAddress: saved.address || '', venueMapUrl: saved.mapUrl || '' } : f));
        setEditingVenue(null);
      } else {
        const r = await api.venues.add(id, venueForm);
        saved = r.venue;
        setVenues(v => [...v, r.venue]);
      }
      setVenueForm({ name: '', address: '', mapUrl: '', city: '', state: '' });
      toast('Venue saved.', 'success');
      return saved;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    } finally {
      setSavingVenue(false);
    }
  }

  async function saveVenueFromModal() {
    const fnKey = venueModal?.fnKey;
    const saved = await saveVenue();
    if (!saved) return;
    if (fnKey) {
      setFunctions(prev => prev.map(f => (f._cid === fnKey || f.id === fnKey)
        ? { ...f, venueId: saved.id, venueName: saved.name, venueAddress: saved.address || '', venueMapUrl: saved.mapUrl || '' } : f));
    }
    setVenueModal(null);
  }

  async function removeVenue(vId) {
    try {
      await api.venues.remove(id, vId);
      setVenues(v => v.filter(x => x.id !== vId));
      setFunctions(prev => prev.map(f => f.venueId === vId ? { ...f, venueId: '', venueName: '', venueAddress: '', venueMapUrl: '' } : f));
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
        const r = await api.media.upload(id, fd);
        setMedia((m) => [...m, r.media]);
        setMediaForm({ type: 'photo', url: '', file: null });
        toast('Added.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setSavingMedia(false);
      }
      return;
    }
    if (!mediaForm.url?.trim()) {
      toast('Choose a file, or paste a link to one.', 'error');
      return;
    }
    setSavingMedia(true);
    try {
      const r = await api.media.upload(id, {
        type: mediaForm.type,
        url: mediaForm.url.trim(),
      });
      setMedia((m) => [...m, r.media]);
      setMediaForm({ type: 'photo', url: '', file: null });
      toast('Added.', 'success');
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

  /** @returns {Promise<boolean>} true when the fields persisted */
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
      if (!rows.length) return true;
      const r = await api.customFields.upsert(id, { fields: rows });
      if (Array.isArray(r.fields)) {
        setCustomFields(r.fields.map((f) => ({
          fieldKey: f.fieldKey,
          fieldValue: String(f.fieldValue ?? ''),
          fieldType: f.fieldType || 'text',
        })));
      }
      toast('Custom fields saved!', 'success');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
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
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    } finally {
      setSavingLang(false);
    }
  }

  async function saveGuestFeatures() {
    setSavingGuestFeatures(true);
    try {
      await api.events.update(id, {
        instagramUrl: instagramUrl.trim() || null,
        instagramHashtag: instagramHashtag.trim().replace(/^#+/, '') || null,
        socialYoutubeUrl: socialYoutubeUrl.trim() || null,
        rsvpEnabled,
        guestNotesEnabled,
      });
      setEvent((e) => ({
        ...e,
        instagramUrl: instagramUrl.trim() || null,
        instagramHashtag: instagramHashtag.trim().replace(/^#+/, '') || null,
        socialYoutubeUrl: socialYoutubeUrl.trim() || null,
        rsvpEnabled,
        guestNotesEnabled,
      }));
      toast('Links and guest options saved!', 'success');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    } finally {
      setSavingGuestFeatures(false);
    }
  }

  // ── PUBLISH ──────────────────────────────────────────────
  async function handlePublish() {
    setShowLinkPrompt(false);
    if (partialEnabled && partialFnIds.size === 0) {
      toast('Tick at least one ceremony for your second link — or switch the second link off in Ceremonies.', 'error');
      return;
    }
    // Only while the second link is still being created — once it exists its
    // name is fixed.
    if (partialEnabled && !event.invitePairId) {
      const mainSlug = slugify(slugFull || event.slug);
      const pSlug = slugify(partialLinkValue);
      if (!pSlug) {
        toast('Choose a name for your second link.', 'error');
        return;
      }
      if (pSlug === mainSlug) {
        toast('Your two links need different names.', 'error');
        return;
      }
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
        partialSlug: partialEnabled ? partialLinkValue : undefined,
        partialFunctionIds: partialEnabled ? [...partialFnIds].filter(k => !String(k).startsWith('new-')) : undefined,
      };
      await api.events.publish(id, body);
      // Reload event to get updated slug, inviteScope, pairedEvent
      const r = await api.events.get(id);
      setEvent(r.event);
      if (r.event.pairedEvent) {
        setPartialEnabled(true);
        setPartialSlug(r.event.pairedEvent.slug);
        setPartialFnIds(new Set(r.event.pairedEvent.pairedFunctionIds || []));
      }
      setShowCelebration(true);
      outletCtx.refreshEvents?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPublishing(false);
    }
  }

  async function openPreview() {
    setPreviewed(true);
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
      setActiveSection('publish');
      toast('Your invitation is offline. Guests can’t open it until you go live again.', 'info');
      outletCtx.refreshEvents?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const inviteBase = getInviteBaseUrl();
  const inviteUrl = `${inviteBase}/i/${event.slug}`;
  const pairedEvent = event.pairedEvent;
  const partialInviteSlug = pairedEvent?.slug || partialSlug;
  const partialPreviewUrl = partialInviteSlug ? `${inviteBase}/i/${partialInviteSlug}` : null;
  const isEditMode = event.isPublished;
  // The second link's name as the couple sees it — its default is shown as the
  // value (so it can be personalised), exactly what publishing would use.
  const partialLinkValue = partialSlug || `${event.slug}-partial`;
  const needsSecondLink = partialEnabled && functions.length > 1;
  const creatingSecondLink = needsSecondLink && !event.invitePairId;
  const badLink = (st) => ['taken', 'short', 'empty'].includes(st?.state);
  const linkBlocked = !isEditMode && (badLink(mainLinkStatus) || (creatingSecondLink && badLink(partialLinkStatus)));
  const selectedCeremonyNames = functions.filter(f => partialFnIds.has(f.id || f._cid)).map(f => f.name).filter(Boolean);
  const nameExample = (eventTitle({ ...event, people }).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'priya-rahul';
  const shownBase = inviteBase.replace(/^https?:\/\//, '');

  function copyLink(url) {
    navigator.clipboard?.writeText(url)
      .then(() => toast('Link copied.', 'success'))
      .catch(() => toast('Couldn’t copy — press and hold the link to copy it.', 'error'));
  }

  /** Go live — but first offer to personalise a link that is still a made-up one. */
  function startGoLive() {
    const mainIsDefault = mainLinkStatus.isDefault;
    const secondIsDefault = creatingSecondLink && (partialLinkStatus.isDefault || /partial/.test(partialLinkValue));
    if (mainIsDefault || secondIsDefault) { setShowLinkPrompt(true); return; }
    handlePublish();
  }

  // Progress that reflects real work: a step counts only once something is in it.
  const ceremoniesReady = functions.length > 0 && functions.every(f => f.name && f.date && !f._isNew);
  const sectionComplete = {
    overview:  false,
    people:    frozen,
    functions: ceremoniesReady,
    media:     media.length > 0,
    custom:    customFields.some(f => String(f.fieldValue || '').trim()),
    social:    Boolean(instagramUrl || instagramHashtag || socialYoutubeUrl),
    language:  false,
    publish:   event.isPublished,
  };
  const stepSections = sections.filter(sec => sec.id !== 'overview');
  const pct = Math.round((stepSections.filter(sec => sectionComplete[sec.id]).length / stepSections.length) * 100);
  const mustDoneCount = [frozen, ceremoniesReady, event.isPublished].filter(Boolean).length;
  const lockedReason = !frozen ? 'Add and confirm your names first' : 'Add your ceremonies first';

  // Why the main button is greyed out, said under it.
  const nextHint = !nextDisabled ? '' : activeSection === 'people'
    ? (missingRoleChoice
        ? `Choose ${missingRoleChoice.roleOptions.join(' or ')} for ${missingRoleChoice.label}.`
        : 'Fill in the names marked “Must do” to continue.')
    : activeSection === 'functions' ? 'Give every ceremony a name and a date to continue.' : '';

  // ── Phone step bar ──
  const stepNo = Math.max(1, stepSections.findIndex(sec => sec.id === activeSection) + 1);
  // Short names so the step always fits the bar ("Go live", not "Preview & go live")
  const activeShort = sections.find(sec => sec.id === activeSection)?.short || '';
  const prevSection = sections[activeIdx - 1];
  const backLabel = isLive
    ? (activeSection === 'overview' ? 'Back to Home' : 'Back to overview (saves first)')
    : (prevSection && prevSection.id !== 'overview' ? `Back to ${prevSection.label} (saves first)` : 'Back to Home');

  async function handleBack() {
    if (isLive && activeSection !== 'overview') { goToSection('overview'); return; }
    if (!isLive && prevSection && prevSection.id !== 'overview') { goToSection(prevSection.id); return; }
    if (!(await saveActive())) return;
    navigate('/dashboard');
  }

  function showFlowHint(text) {
    if (!text) return;
    setFlowHint(text);
    // Take the couple to the first empty field that isn't marked "(optional)"
    // and say why; with no such field, show the reason at the top of the step.
    requestAnimationFrame(() => {
      const empty = [...document.querySelectorAll('.invite-form-body input.form-input, .invite-form-body input[type="date"]')]
        .find((el) => !el.disabled && !el.value && el.offsetParent !== null
          && !el.closest('.form-group, .person-row')?.querySelector('.form-optional'));
      if (empty) {
        empty.focus({ preventScroll: true });
        empty.scrollIntoView({ block: 'center', behavior: 'smooth' });
        toast(text, 'info');
      } else {
        flowHintRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  // Live invitation home: what is filled in, per area.
  const firstDate = eventMeta({ ...event, functions }).split(' · ').pop();
  const filledDetails = fieldSchema.filter(f => String(customFields.find(c => c.fieldKey === f.key)?.fieldValue || '').trim()).length;
  const overviewCards = [
    { id: 'people', title: 'Names', icon: Users, summary: eventTitle({ ...event, people }) },
    { id: 'functions', title: 'Ceremonies', icon: CalendarHeart,
      summary: functions.length ? `${functions.length} ceremon${functions.length === 1 ? 'y' : 'ies'}${firstDate && /\d/.test(firstDate) ? ` · first on ${firstDate}` : ''}` : 'No ceremonies yet',
      empty: !functions.length },
    { id: 'media', title: 'Photos & music', icon: ImageIcon,
      summary: media.length ? `${media.length} file${media.length === 1 ? '' : 's'} added` : 'Nothing added yet', empty: !media.length },
    { id: 'custom', title: 'Special details', icon: FileText,
      summary: `${filledDetails} of ${fieldSchema.length} filled in`, empty: !filledDetails },
    { id: 'social', title: 'Guest features', icon: SparklesIcon,
      summary: [showGuestOption('rsvp') && `Replies ${rsvpEnabled ? 'on' : 'off'}`, showGuestOption('wishes') && `Wishes ${guestNotesEnabled ? 'on' : 'off'}`,
        (instagramUrl || instagramHashtag || socialYoutubeUrl) && 'Links added'].filter(Boolean).join(' · ') || 'Nothing set' },
    { id: 'publish', title: 'Your link & QR code', icon: Link2, summary: `…/i/${event.slug}` },
  ].filter(card => sections.some(sec => sec.id === card.id));

  return (
    <div className="invite-form-page page-fade">
      {/* Phone: one slim step bar — back, where you are, preview and the next action */}
      <div className="invite-stepbar">
        <div className="stepbar-row">
          <button type="button" className="stepbar-icon" onClick={handleBack} aria-label={backLabel} title={backLabel} disabled={savingActive}>
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="stepbar-title"
            onClick={() => setStepSheet(true)}
            aria-haspopup="dialog"
            aria-label={activeSection === 'overview' ? 'Overview. See all steps' : `Step ${stepNo} of ${stepSections.length}: ${activeShort}. See all steps`}
          >
            {activeSection !== 'overview' && <span className="stepbar-count">Step {stepNo} of {stepSections.length}</span>}
            <span className="stepbar-name-row">
              <span className="stepbar-name">{activeShort}</span>
              <ChevronDown size={16} aria-hidden="true" className="stepbar-chev" />
            </span>
          </button>
          <button type="button" className="stepbar-preview" onClick={openPreview} disabled={loadingPreview}>
            {loadingPreview ? <span className="btn-spinner" aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            Preview
          </button>
        </div>
        {!isEditMode && (
          <div className="stepbar-segments" role="progressbar" aria-label={`${mustDoneCount} of 3 must-do steps done`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            {stepSections.map((sec) => (
              <span key={sec.id} className={sectionComplete[sec.id] ? 'is-done' : sec.id === activeSection ? 'is-current' : ''} />
            ))}
          </div>
        )}
      </div>

      <div className="builder-head">
        <div className="builder-head-text">
          <div className={`builder-status${isEditMode ? ' is-live' : ''}`}>
            <span className={`event-dot${isEditMode ? ' is-live' : ''}`} aria-hidden="true" />
            {isEditMode ? 'Live invitation' : 'Not live yet'}
          </div>
          <h1 className="ph-title">{isEditMode ? 'Edit your invitation' : 'Build your invitation'}</h1>
          <p className="ph-subtitle">{[eventTitle({ ...event, people }), eventMeta({ ...event, functions })].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={openPreview} disabled={loadingPreview}>
          <Eye size={18} aria-hidden="true" />
          {loadingPreview ? 'Opening…' : 'Preview'}
        </button>
      </div>

      {isEditMode && (
        <div className="live-banner" role="status">
          <Radio size={18} aria-hidden="true" />
          <span>Your invitation is live. Changes you save show to guests right away.</span>
        </div>
      )}

      {/* The outer box holds the sticky position and a frozen height; only the
          inner chrome shrinks, so the document never changes length. */}
      <div className="invite-sticky">
       <div className="invite-sticky-inner">
        {!isEditMode && (
          <div className="invite-progress-wrap">
            <div className="invite-progress-header">
              <span className="invite-progress-label">{mustDoneCount} of 3 must-do steps done</span>
              <span className="invite-progress-sub">
                {mustDoneCount === 2 ? 'Last step: preview and go live' : 'You can come back and change anything later'}
              </span>
            </div>
            <div className="invite-progress-bar" role="progressbar" aria-label="Invitation progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="invite-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Steps */}
        <nav className="section-tabs" aria-label="Steps">
          {sections.map((s, i) => {
            const locked = i > unlockedIdx;
            const done = sectionComplete[s.id];
            const active = activeSection === s.id;
            const number = sections.filter(x => x.id !== 'overview').findIndex(x => x.id === s.id) + 1;
            return (
              <button
                type="button"
                key={s.id}
                className={`section-tab ${active ? 'active' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''}`}
                aria-current={active ? 'step' : undefined}
                aria-disabled={locked || undefined}
                title={locked ? lockedReason : undefined}
                onClick={() => {
                  if (locked) { toast(lockedReason, 'info'); return; }
                  goToSection(s.id);
                }}
              >
                <span className="step-num" aria-hidden="true">
                  {s.id === 'overview' ? <Eye size={13} /> : done ? <Check size={14} /> : locked ? <Lock size={12} /> : number}
                </span>
                <span className="step-label">{s.label}</span>
                {!locked && !done && s.must && !isEditMode && <span className="tab-required">Must do</span>}
              </button>
            );
          })}
        </nav>
       </div>
      </div>

      <div className="invite-form-body">
        {flowHint && (
          <p className="flow-hint" role="alert" ref={flowHintRef} tabIndex={-1}>{flowHint}</p>
        )}

        {/* ── OVERVIEW (live invitation) ── */}
        {activeSection === 'overview' && (
          <div className="card">
            <div className="step-head">
              <h2 className="step-title">What would you like to change?</h2>
            </div>
            <p className="step-intro">Pick an area. Changes you save go live straight away.</p>
            <EditOverview cards={overviewCards} onEdit={goToSection} />
          </div>
        )}

        {/* ── NAMES ── */}
        {activeSection === 'people' && (
          <div className="card">
            <NameConfirmBar event={event} people={people} />

            <div className="step-head">
              <h2 className="step-title">Names</h2>
              <InfoTip label="About names" learnMore="/guide#names">
                These names appear on your invitation exactly as you type them — check the spelling and capital letters.
              </InfoTip>
            </div>
            <p className="step-intro">Type each name exactly as it should appear on your invitation.</p>

            {!frozen && !hasSchemaPeopleRoles && (
              <div className="inline-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="fallback-role">Who is this?</label>
                    <input
                      id="fallback-role"
                      className="form-input"
                      placeholder="e.g. Host, Birthday person"
                      value={personForm.role}
                      onChange={e => setPersonForm(f => ({ ...f, role: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="fallback-name">Full name</label>
                    <input
                      id="fallback-name"
                      className="form-input"
                      placeholder="e.g. Priya Sharma"
                      value={personForm.name}
                      onChange={e => setPersonForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="inline-form-actions">
                  <button type="button" className="btn btn-primary" disabled={savingPerson} onClick={async () => {
                    if (!personForm.role || !personForm.name) { toast('Fill in who this is and their name.', 'error'); return; }
                    setSavingPerson(true);
                    try {
                      const r = await api.people.add(id, personForm);
                      setPeople(p => [...p, r.person]);
                      setPersonForm({ role: '', name: '' });
                      toast('Name added.', 'success');
                    } catch (err) {
                      toast(err.message, 'error');
                    } finally {
                      setSavingPerson(false);
                    }
                  }}>
                    {savingPerson ? <span className="btn-spinner" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                    Add person
                  </button>
                </div>
              </div>
            )}

            {hasSchemaPeopleRoles && (
              <div className="people-form">
                {peopleRoleGroups.principals.map((roleDef) => (
                  <PersonNameRow
                    key={roleDef.role}
                    roleDef={roleDef}
                    label={roleDef.label}
                    locked={frozen && roleDef.required}
                    value={peopleInputs[roleDef.role] || ''}
                    onChange={(v) => setPeopleInputs((prev) => ({ ...prev, [roleDef.role]: v }))}
                    roleChoice={peopleRoleChoices[roleDef.role] || ''}
                    onRoleChoiceChange={(v) => setPeopleRoleChoices((prev) => ({ ...prev, [roleDef.role]: v }))}
                    roleChoiceRequired={!event.isPublished}
                  />
                ))}

                {!frozen && peopleRoleGroups.principals.some(r => r.required) && (
                  <div className="lock-note">
                    <Lock size={16} aria-hidden="true" />
                    <span>These names can’t be changed once you continue — please check the spelling now.</span>
                  </div>
                )}

                {/* Family names appear once the couple is named. */}
                {showDependents
                  ? peopleRoleGroups.groups.filter(g => g.dependents.length > 0).map((g) => (
                      <div className="people-group" key={g.principal.role}>
                        <div className="people-group-title">
                          {firstNameOf(peopleInputs[g.principal.role]) || g.principal.label}’s family
                        </div>
                        {g.dependents.map((roleDef) => (
                          <PersonNameRow
                            key={roleDef.role}
                            roleDef={roleDef}
                            label={roleDef.label}
                            locked={frozen && roleDef.required}
                            value={peopleInputs[roleDef.role] || ''}
                            onChange={(v) => setPeopleInputs((prev) => ({ ...prev, [roleDef.role]: v }))}
                            roleChoice={peopleRoleChoices[roleDef.role] || ''}
                            onRoleChoiceChange={(v) => setPeopleRoleChoices((prev) => ({ ...prev, [roleDef.role]: v }))}
                            roleChoiceRequired={!event.isPublished}
                          />
                        ))}
                      </div>
                    ))
                  : peopleRoleGroups.ordered.length > peopleRoleGroups.principals.length && (
                      <div className="form-hint people-next-hint">
                        Fill in {peopleRoleGroups.principals.map(r => r.label).join(' and ')} to add family names.
                      </div>
                    )}
              </div>
            )}

            {!hasSchemaPeopleRoles && (people.length > 0 ? (
              <div className="items-list" style={{ marginTop: 8 }}>
                {orderedPeople.map(p => (
                  <div key={p.id} className="item-row">
                    <div className="item-info">
                      <span className="item-label">{savedRoleLabel(p.role)}</span>
                      <span className="item-name">{p.name}</span>
                    </div>
                    {!frozen && (
                      <div className="item-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeletingPerson(p)}>
                          <Trash2 size={16} aria-hidden="true" /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon"><Users size={30} aria-hidden="true" /></div>
                <div className="empty-title">No names yet</div>
                <div className="empty-desc">Add the people your invitation is from.</div>
              </div>
            ))}
            <SectionNav sections={sections} activeSection={activeSection} onBack={goToSection} onNext={handleNext} onSave={handleSave} saving={savingActive} />
          </div>
        )}

        {/* ── CEREMONIES (venues are added from here) ── */}
        {activeSection === 'functions' && (
          <div className="card">
            <div className="step-head">
              <h2 className="step-title">Ceremonies</h2>
              <InfoTip label="About ceremonies" learnMore="/guide#ceremonies">
                Add every event guests are invited to — like Haldi, Mehendi, Sangeet or the wedding. Guests see them in this order.
              </InfoTip>
            </div>
            <p className="step-intro">Add each ceremony with its date, time and place.</p>

            {functions.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon"><CalendarHeart size={30} aria-hidden="true" /></div>
                <div className="empty-title">No ceremonies yet</div>
                <div className="empty-desc">Start with your first one — you can add more after.</div>
                <button type="button" className="btn btn-primary" onClick={() => setFunctions([BLANK_FN()])}>
                  <Plus size={18} aria-hidden="true" /> Add a ceremony
                </button>
              </div>
            ) : (
              <div className="fn-cards">
                {functions.map((fn) => {
                  const key = fn._cid || fn.id;
                  const isSaving = savingFnId === key;
                  const timeValue = toTimeInput(fn.startTime);
                  return (
                    <div key={key} className={`fn-card${isSaving ? ' fn-card-saving' : ''}`}>
                      <div className="fn-card-header">
                        <span className="fn-card-title">{String(fn.name || '').trim() || 'New ceremony'}</span>
                        <div className="fn-card-meta">
                          {fn._isNew && <span className="fn-badge-new">Not saved yet</span>}
                          {isSaving && <span className="btn-spinner" aria-hidden="true" />}
                          {functions.length > 1 && (
                            <button type="button" className="btn btn-ghost btn-sm fn-remove" onClick={() => setDeletingFn(fn)}>
                              <Trash2 size={16} aria-hidden="true" /> Delete
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor={`fn-name-${key}`}>Ceremony name</label>
                          <input
                            id={`fn-name-${key}`}
                            className="form-input"
                            placeholder="e.g. Mehendi"
                            value={fn.name}
                            onChange={e => updateFnField(key, 'name', e.target.value)}
                          />
                          {!String(fn.name || '').trim() && (
                            <div className="chip-row" aria-label="Suggestions">
                              {CEREMONY_SUGGESTIONS.slice(0, 6).map(name => (
                                <button type="button" key={name} className="chip" onClick={() => updateFnField(key, 'name', name)}>{name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor={`fn-date-${key}`}>Date</label>
                          <input
                            id={`fn-date-${key}`}
                            className="form-input"
                            type="date"
                            value={fn.date ? String(fn.date).slice(0, 10) : ''}
                            onChange={e => updateFnField(key, 'date', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor={`fn-time-${key}`}>
                            Start time <span className="form-optional">(optional)</span>
                          </label>
                          <input
                            id={`fn-time-${key}`}
                            className="form-input"
                            type="time"
                            value={timeValue}
                            onChange={e => updateFnField(key, 'startTime', fromTimeInput(e.target.value))}
                          />
                          {fn.startTime && !timeValue && (
                            <div className="form-hint">Currently “{fn.startTime}” — pick a time to replace it.</div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor={`fn-venue-${key}`}>Venue</label>
                          <Select
                            id={`fn-venue-${key}`}
                            className="form-select"
                            value={fn.venueId || ''}
                            onChange={e => {
                              if (e.target.value === '__new__') { openVenueModal(key); return; }
                              const v = venues.find(v => v.id === e.target.value);
                              setFunctions(prev => prev.map(f =>
                                (f._cid === key || f.id === key)
                                  ? (v
                                    ? { ...f, venueId: v.id, venueName: v.name, venueAddress: v.address || '', venueMapUrl: v.mapUrl || '' }
                                    : { ...f, venueId: '', venueName: '', venueAddress: '', venueMapUrl: '' })
                                  : f
                              ));
                            }}
                          >
                            <option value="">No venue yet</option>
                            {venues.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name}{v.city ? ` · ${v.city}` : ''}
                              </option>
                            ))}
                            <option value="__new__">+ Add a new venue</option>
                          </Select>
                          {fn.venueId && fn.venueName && (fn.venueAddress || fn.venueMapUrl) && (
                            <div className="fn-venue-preview">
                              {fn.venueAddress && <span>{fn.venueAddress}</span>}
                              {fn.venueMapUrl && <a href={fn.venueMapUrl} target="_blank" rel="noreferrer" className="fn-venue-map-link"><MapPin size={14} aria-hidden="true" /> Map</a>}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor={`fn-dress-${key}`}>
                          Dress code <span className="form-optional">(optional)</span>
                        </label>
                        <input
                          id={`fn-dress-${key}`}
                          className="form-input"
                          placeholder="e.g. Traditional, pastel colours"
                          value={fn.dressCode || ''}
                          onChange={e => updateFnField(key, 'dressCode', e.target.value)}
                        />
                      </div>

                      {partialEnabled && functions.length > 1 && (
                        <label className="fn-partial-label">
                          <input
                            type="checkbox"
                            checked={partialFnIds.has(fn.id || fn._cid)}
                            onChange={e => setPartialFnIds(prev => {
                              const next = new Set(prev);
                              const k = fn.id || fn._cid;
                              if (e.target.checked) next.add(k); else next.delete(k);
                              return next;
                            })}
                          />
                          Include in the second link
                        </label>
                      )}
                    </div>
                  );
                })}
                <button type="button" className="btn btn-secondary add-ceremony-btn" onClick={() => setFunctions(prev => [...prev, BLANK_FN()])}>
                  <Plus size={18} aria-hidden="true" /> Add another ceremony
                </button>
              </div>
            )}

            {venues.length > 0 && (
              <details className="venues-manage">
                <summary><MapPin size={16} aria-hidden="true" /> Your venues ({venues.length})</summary>
                <div className="items-list">
                  {venues.map(v => (
                    <div key={v.id} className="item-row">
                      <div className="item-info">
                        <span className="item-name">{v.name}</span>
                        <span className="item-meta">{[v.address, v.city].filter(Boolean).join(', ') || 'No address added'}</span>
                      </div>
                      <div className="item-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openVenueModal(null, v)}>
                          <PencilLine size={16} aria-hidden="true" /> Edit
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeletingVenue(v)}>
                          <Trash2 size={16} aria-hidden="true" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {functions.length > 1 && (
              <div className="partial-box">
                <label className="partial-switch">
                  <input
                    type="checkbox"
                    checked={partialEnabled}
                    disabled={Boolean(event.invitePairId)}
                    onChange={e => setPartialEnabled(e.target.checked)}
                  />
                  <span className="partial-switch-text">
                    <strong>Some guests are only invited to a few ceremonies</strong>
                    <span className="form-hint">
                      {event.invitePairId
                        ? 'You have a second link — tick below which ceremonies it shows.'
                        : 'You’ll get a second link that shows only the ceremonies you tick.'}
                    </span>
                  </span>
                </label>
                <InfoTip label="About the second link" align="end" learnMore="/guide#selected-ceremonies">
                  For example: family gets your main link with every ceremony, and friends get a second link with only the Sangeet and Reception. You choose a name for each link before going live.
                </InfoTip>
              </div>
            )}

            <SectionNav sections={sections} activeSection={activeSection} onBack={goToSection} onNext={handleNext} onSave={handleSave} saving={savingActive} />
          </div>
        )}

        {/* ── D. MEDIA ── */}
        {activeSection === 'media' && (
          <div className="card">
            <div className="step-head">
              <h2 className="step-title">Photos & music</h2>
              <InfoTip label="About photos and music" learnMore="/guide#photos-music">
                Each box matches a part of your design. Photos save as soon as they upload — there’s nothing else to press.
              </InfoTip>
            </div>
            <p className="step-intro">
              {mediaSlotsNorm
                ? 'Add photos and music for each part of your design, from your phone or computer.'
                : 'Add photos, music or short videos from your phone or computer.'}
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
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>Other uploads (not shown in this design)</div>
                    {media
                      .filter((m) => !m.slotKey)
                      .map((m) => (
                        <div key={m.id} className="item-row">
                          <div className="item-info">
                            <span className="item-label">{({ photo: 'Photo', music: 'Music', video: 'Video' })[m.type] || 'File'}</span>
                            {m.type === 'photo' && <img src={m.url} alt={m.caption || 'Your photo'} className="media-thumb" loading="lazy" />}
                            {m.type === 'music' && <audio controls src={m.url} style={{ width: '100%', marginTop: 6 }} />}
                            {m.type === 'video' && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--gold)', display: 'block', marginTop: 4 }}>▶ View Video</a>}
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
                      <label className="form-label">What are you adding?</label>
                      <Select className="form-select" value={mediaForm.type} onChange={(e) => setMediaForm((f) => ({ ...f, type: e.target.value }))}>
                        <option value="photo">Photo</option>
                        <option value="music">Music</option>
                        <option value="video">Video</option>
                      </Select>
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
                  <div className="inline-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={savingMedia} onClick={addMedia}>
                      {savingMedia ? <span className="btn-spinner" /> : null}
                      Add
                    </button>
                  </div>
                </div>
                {media.length > 0 ? (
                  <div className="items-list">
                    {media.map((m) => (
                      <div key={m.id} className="item-row">
                        <div className="item-info">
                          <span className="item-label">{({ photo: 'Photo', music: 'Music', video: 'Video' })[m.type] || 'File'}</span>
                          {m.type === 'photo' && <img src={m.url} alt={m.caption || 'Your photo'} className="media-thumb" loading="lazy" />}
                          {m.type === 'music' && <audio controls src={m.url} style={{ width: '100%', marginTop: 6 }} />}
                          {m.type === 'video' && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--gold)', display: 'block', marginTop: 4 }}>▶ View Video</a>}
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
                    <div className="empty-icon"><ImageIcon size={30} strokeWidth={1.75} aria-hidden="true" /></div>
                    <div className="empty-title">Nothing added yet</div>
                    <div className="empty-desc">Photos and music make your invitation feel personal.</div>
                  </div>
                )}
              </>
            )}
            <SectionNav sections={sections} activeSection={activeSection} onBack={goToSection} onNext={handleNext} onSave={handleSave} saving={savingActive} />
          </div>
        )}

        {/* ── E. CUSTOM FIELDS ── */}
        {activeSection === 'custom' && (
          <div className="card">
            <div className="step-head">
              <h2 className="step-title">Special details</h2>
              <InfoTip label="About special details" learnMore="/guide#photos-music">
                Extra lines your design has room for. Leave any of them empty and that part simply won’t show.
              </InfoTip>
            </div>
            <p className="step-intro">Fill in what you’d like on your invitation — every field here is optional.</p>
            {fieldSchema.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon"><FileText size={30} aria-hidden="true" /></div>
                <div className="empty-title">Nothing extra needed</div>
                <div className="empty-desc">This design has no special details to fill in.</div>
              </div>
            ) : (
              <>
                {fieldSchema.map(field => {
                  const saved = customFields.find(f => f.fieldKey === field.key);
                  const inputId = `cf-${field.key}`;
                  const long = field.type === 'textarea' || field.type === 'html';

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
                      <label className="form-label" htmlFor={inputId}>
                        {field.label || humanizeRole(field.key)}
                        <span className="form-optional">(optional)</span>
                      </label>
                      {long ? (
                        <textarea className="form-textarea" id={inputId}
                          placeholder={finalPlaceholder}
                          value={saved?.fieldValue || ''}
                          onChange={e => setFieldValue(field.key, e.target.value)}
                        />
                      ) : field.type === 'date' ? (
                        <input
                          id={inputId}
                          className="form-input"
                          type="date"
                          value={toHtmlDateInputValue(saved?.fieldValue || '')}
                          onChange={(e) => setFieldValue(field.key, e.target.value)}
                        />
                      ) : (
                        <input
                          id={inputId}
                          className="form-input"
                          type={field.type === 'number' ? 'number' : 'text'}
                          placeholder={finalPlaceholder}
                          value={saved?.fieldValue || ''}
                          onChange={e => setFieldValue(field.key, e.target.value)}
                        />
                      )}
                      {field.hint && <div className="form-hint">{field.hint}</div>}
                    </div>
                  );
                })}
              </>
            )}
            <SectionNav sections={sections} activeSection={activeSection} onBack={goToSection} onNext={handleNext} onSave={handleSave} saving={savingActive} />
          </div>
        )}

        {/* ── F. LINKS & GUEST FEATURES ── */}
        {activeSection === 'social' && (
          <div className="card">
            <div className="step-head">
              <h2 className="step-title">Guest features</h2>
              <InfoTip label="About guest features" learnMore="/guide#guest-features">
                What guests can do on your invitation. You can change these any time, even after it’s live.
              </InfoTip>
            </div>
            <p className="page-subtitle" style={{ marginBottom: 16 }}>
              {(showGuestOption('instagram') || showGuestOption('hashtag') || showGuestOption('youtube'))
                ? 'Add the links you want guests to see on your invitation. '
                : ''}
              {(showGuestOption('rsvp') || showGuestOption('wishes'))
                ? 'Switch off anything you do not want guests to use on your live invitation.'
                : ''}
            </p>
            {showGuestOption('instagram') && (
            <div className="form-group">
              <label className="form-label" htmlFor="gf-instagram">Instagram link <span className="form-optional">(optional)</span></label>
              <input
                className="form-input"
                id="gf-instagram"
                type="url"
                placeholder="e.g. https://instagram.com/priya_rahul_2025"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
              />
            </div>
            )}
            {showGuestOption('hashtag') && (
            <div className="form-group">
              <label className="form-label" htmlFor="gf-hashtag">Wedding hashtag <span className="form-optional">(optional)</span></label>
              <input
                className="form-input"
                id="gf-hashtag"
                placeholder="e.g. PriyaWedsRahul"
                value={instagramHashtag}
                onChange={(e) => setInstagramHashtag(e.target.value)}
              />
              <div className="form-hint">
                Shown on the invite as <strong>#{instagramHashtag.trim().replace(/^#+/, '') || 'PriyaWedsRahul'}</strong> — type it without the #.
              </div>
            </div>
            )}
            {showGuestOption('youtube') && (
            <div className="form-group">
              <label className="form-label" htmlFor="gf-youtube">YouTube link <span className="form-optional">(optional)</span></label>
              <input
                className="form-input"
                id="gf-youtube"
                type="url"
                placeholder="e.g. https://youtube.com/@yourchannel"
                value={socialYoutubeUrl}
                onChange={(e) => setSocialYoutubeUrl(e.target.value)}
              />
            </div>
            )}
            {showGuestOption('rsvp') && (
            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={rsvpEnabled} onChange={(e) => setRsvpEnabled(e.target.checked)} />
                Guests can tell you if they’re coming
                <InfoTip label="About replies">Adds a short reply form (RSVP) to your invitation. Replies appear on your Guests page.</InfoTip>
              </label>
            </div>
            )}
            {showGuestOption('wishes') && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={guestNotesEnabled} onChange={(e) => setGuestNotesEnabled(e.target.checked)} />
                Guests can leave you a wish
                <InfoTip label="About wishes">Guests can write you a message on the invitation. You choose which ones show on your Wishes page.</InfoTip>
              </label>
            </div>
            )}
            <SectionNav sections={sections} activeSection={activeSection} onBack={goToSection} onNext={handleNext} onSave={handleSave} saving={savingActive} />
          </div>
        )}

        {/* ── G. LANGUAGE ── */}
        {activeSection === 'language' && (
          <div className="card">
            <div className="step-head"><h2 className="step-title">Language</h2></div>
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
            <SectionNav sections={sections} activeSection={activeSection} onBack={goToSection} onNext={handleNext} onSave={handleSave} saving={savingActive} />
          </div>
        )}

        {/* ── PREVIEW & GO LIVE ── */}
        {activeSection === 'publish' && (
          <div className="card">
            <div className="step-head">
              <h2 className="step-title">{isEditMode ? 'Your link & QR code' : 'Preview & go live'}</h2>
              <InfoTip label="About going live" learnMore="/guide#go-live">
                Going live puts your invitation online at your link, so guests can open it. You can keep editing afterwards — changes show straight away.
              </InfoTip>
            </div>
            <p className="step-intro">
              {isEditMode
                ? 'Share your link or QR code with guests. Your invitation is online.'
                : 'Check everything, choose your link, then put your invitation online.'}
            </p>

            {!isEditMode && (
              <ul className="preflight-list">
                <PreflyItem ok={frozen} label="Names added and checked" onClick={!frozen ? () => goToSection('people') : null} actionLabel="Add names" />
                <PreflyItem ok={ceremoniesReady} label="At least one ceremony with a date" onClick={!ceremoniesReady ? () => goToSection('functions') : null} actionLabel="Add ceremony" />
                <PreflyItem
                  ok={functions.length > 0 && functions.every(f => f.venueId || f.venueName)}
                  optional
                  label="Every ceremony has a venue"
                  onClick={() => goToSection('functions')}
                  actionLabel="Add venues"
                />
                <PreflyItem ok={previewed} optional label="You’ve previewed your invitation" onClick={openPreview} actionLabel="Preview" />
              </ul>
            )}

            {/* Main link */}
            <section className="link-card" aria-labelledby="main-link-title">
              <div className="link-card-head">
                <Link2 size={18} aria-hidden="true" />
                <h3 id="main-link-title">Your invitation link</h3>
              </div>
              {isEditMode ? (
                <>
                  <div className="live-link">
                    <a href={inviteUrl} target="_blank" rel="noreferrer" className="pub-link">{inviteUrl}</a>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyLink(inviteUrl)}>
                      <Copy size={16} aria-hidden="true" /> Copy link
                    </button>
                  </div>
                  <QrCode url={inviteUrl} fileName={`qr-${event.slug}.png`} />
                </>
              ) : (
                <LinkField
                  eventId={id}
                  base={inviteBase}
                  value={slugFull}
                  onChange={setSlugFull}
                  onStatus={setMainLinkStatus}
                  inputRef={mainLinkRef}
                  label="Personalise your link"
                  hint={<>This is what guests see. Use your names — for example <strong>{nameExample}</strong>.</>}
                />
              )}
            </section>

            {/* Second link (only for some ceremonies) */}
            {needsSecondLink && (
              <section className="link-card" aria-labelledby="second-link-title">
                <div className="link-card-head">
                  <Link2 size={18} aria-hidden="true" />
                  <h3 id="second-link-title">Link for selected ceremonies</h3>
                </div>
                <p className="form-hint link-card-note">
                  Shows only: {selectedCeremonyNames.length ? selectedCeremonyNames.join(', ') : 'no ceremonies ticked yet'}.{' '}
                  <button type="button" className="btn-link" onClick={() => goToSection('functions')}>Change</button>
                </p>
                {isEditMode && partialPreviewUrl ? (
                  <>
                    <div className="live-link">
                      <a href={partialPreviewUrl} target="_blank" rel="noreferrer" className="pub-link">{partialPreviewUrl}</a>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyLink(partialPreviewUrl)}>
                        <Copy size={16} aria-hidden="true" /> Copy link
                      </button>
                    </div>
                    <QrCode url={partialPreviewUrl} fileName={`qr-${partialInviteSlug || 'second-link'}.png`} />
                  </>
                ) : event.invitePairId ? (
                  <p className="live-link-static">{shownBase}/i/{partialInviteSlug}</p>
                ) : (
                  <LinkField
                    eventId={id}
                    base={inviteBase}
                    value={partialLinkValue}
                    onChange={setPartialSlug}
                    onStatus={setPartialLinkStatus}
                    inputRef={partialLinkRef}
                    label="Personalise this link"
                    hint={<>Guests who get this link see only the ceremonies you picked. For example <strong>{nameExample}-{(selectedCeremonyNames[0] || 'sangeet').toLowerCase().replace(/[^a-z0-9]+/g, '-')}</strong>.</>}
                  />
                )}
              </section>
            )}

            {!isEditMode ? (
              <div className="golive">
                {!frozen && (
                  <p className="publish-note">
                    Confirm your names in <button type="button" className="btn-link" onClick={() => goToSection('people')}>Names</button> before going live.
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-golive"
                  disabled={!frozen || !ceremoniesReady || publishing || linkBlocked}
                  onClick={startGoLive}
                >
                  {publishing ? <span className="btn-spinner" aria-hidden="true" /> : <Radio size={20} aria-hidden="true" />}
                  {publishing ? 'Going live…' : 'Go live'}
                </button>
                {linkBlocked && <p className="section-nav-hint">Choose a link that’s free to go live.</p>}
                <p className="form-hint golive-note">You can keep editing after going live.</p>
              </div>
            ) : (
              <div className="live-actions">
                <Link to={`/events/${id}/share`} className="btn btn-primary">
                  <Share2 size={18} aria-hidden="true" /> Share your invitation
                </Link>
                <button type="button" className="btn btn-secondary" onClick={openPreview} disabled={loadingPreview}>
                  <Eye size={18} aria-hidden="true" /> {loadingPreview ? 'Opening…' : 'Preview'}
                </button>
                <div className="offline-row">
                  <button type="button" className="btn-link btn-link-danger" onClick={() => setConfirmUnpublish(true)}>
                    Take invitation offline
                  </button>
                </div>
              </div>
            )}
            <SectionNav sections={sections} activeSection={activeSection} onBack={goToSection} onNext={handleNext} onSave={handleSave} saving={savingActive} />
          </div>
        )}
      </div>

      {stepSheet && (
        <Modal title={<>Steps <span className="steps-pct">{pct}% complete</span></>} onClose={() => setStepSheet(false)}>
          {!isEditMode && (
            <p className="steps-sheet-progress">
              <strong>{mustDoneCount} of 3 must-do steps done.</strong>{' '}
              {mustDoneCount === 2 ? 'Last step: preview and go live.' : 'You can come back and change anything later.'}
            </p>
          )}
          <ul className="steps-sheet-list">
            {sections.map((sec) => {
              const locked = sections.indexOf(sec) > unlockedIdx;
              const done = sectionComplete[sec.id];
              const active = activeSection === sec.id;
              const num = stepSections.findIndex(x => x.id === sec.id) + 1;
              return (
                <li key={sec.id}>
                  <button
                    type="button"
                    className={`steps-sheet-row${active ? ' is-current' : ''}${locked ? ' is-locked' : ''}`}
                    aria-current={active ? 'step' : undefined}
                    aria-disabled={locked || undefined}
                    onClick={() => (locked ? toast(lockedReason, 'info') : goToSection(sec.id))}
                  >
                    <span className={`step-num${done ? ' is-done' : ''}`} aria-hidden="true">
                      {sec.id === 'overview' ? <Eye size={13} /> : done ? <Check size={14} /> : locked ? <Lock size={12} /> : num}
                    </span>
                    <span className="steps-sheet-text">
                      <span className="steps-sheet-name">{sec.label}</span>
                      {locked
                        ? <span className="steps-sheet-sub">{lockedReason}</span>
                        : (sec.must && !done && !isEditMode) ? <span className="steps-sheet-sub is-must">Must do</span> : null}
                    </span>
                    {active && <Check size={18} className="steps-sheet-here" aria-label="You are here" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}

      {/* Confirm modals */}
      {venueModal && (
        <Modal
          title={editingVenue ? 'Edit venue' : 'Add a venue'}
          size="full"
          onClose={() => { setVenueModal(null); setEditingVenue(null); }}
          primaryAction={{ label: 'Save venue', onClick: saveVenueFromModal, loading: savingVenue }}
        >
          {(() => {
            const v = editingVenue || venueForm;
            const set = (patch) => (editingVenue ? setEditingVenue(x => ({ ...x, ...patch })) : setVenueForm(x => ({ ...x, ...patch })));
            return (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="venue-name">Venue name</label>
                  <input id="venue-name" className="form-input" placeholder="e.g. Raj Palace Banquet Hall"
                    value={v.name || ''} onChange={e => set({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="venue-address">Address <span className="form-optional">(optional)</span></label>
                  <input id="venue-address" className="form-input" placeholder="e.g. 14 MG Road, Bandra West"
                    value={v.address || ''} onChange={e => set({ address: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="venue-city">City <span className="form-optional">(optional)</span></label>
                  <input id="venue-city" className="form-input" placeholder="e.g. Mumbai"
                    value={v.city || ''} onChange={e => set({ city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="venue-map">Google Maps link <span className="form-optional">(optional)</span></label>
                  <input id="venue-map" className="form-input" placeholder="Paste the share link from Google Maps"
                    value={v.mapUrl || ''}
                    onChange={e => {
                      const coords = parseGoogleMapsUrl(e.target.value);
                      set({ mapUrl: e.target.value, ...(coords || {}) });
                    }} />
                  <div className="form-hint">Guests can tap it to get directions.</div>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
      {confirmingNames && (
        <ConfirmNamesModal
          rows={draftNameRows}
          loading={savingPerson}
          onCancel={() => setConfirmingNames(false)}
          onConfirm={confirmNamesAndAdvance}
        />
      )}
      {deletingPerson && (
        <ConfirmModal
          title={`Remove ${deletingPerson.name}?`}
          message="They’ll be taken off your invitation."
          confirmText="Remove"
          onConfirm={() => removePerson(deletingPerson.id)}
          onCancel={() => setDeletingPerson(null)}
        />
      )}
      {deletingFn && (
        <ConfirmModal
          title="Delete this ceremony?"
          message={`“${deletingFn.name || 'This ceremony'}” will be removed from your invitation.`}
          confirmText="Delete ceremony"
          onConfirm={() => removeFn(deletingFn)}
          onCancel={() => setDeletingFn(null)}
        />
      )}
      {deletingVenue && (
        <ConfirmModal
          title="Delete this venue?"
          message={`Ceremonies at “${deletingVenue.name}” will show no venue until you pick another.`}
          confirmText="Delete venue"
          onConfirm={() => removeVenue(deletingVenue.id)}
          onCancel={() => setDeletingVenue(null)}
        />
      )}
      {deletingMedia && (
        <ConfirmModal
          title="Remove this file?"
          message="It will no longer appear on your invitation."
          confirmText="Remove"
          onConfirm={() => removeMedia(deletingMedia.id)}
          onCancel={() => setDeletingMedia(null)}
        />
      )}
      {confirmUnpublish && (
        <ConfirmModal
          title="Take your invitation offline?"
          message="Guests who open your link will see a “not available” page. You can put it back online any time."
          confirmText="Take offline"
          onConfirm={handleUnpublish}
          onCancel={() => setConfirmUnpublish(false)}
        />
      )}

      {/* Before going live with a made-up link */}
      {showLinkPrompt && (
        <Modal
          title="Personalise your link before you share it?"
          onClose={() => setShowLinkPrompt(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={handlePublish}>Go live with this link</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowLinkPrompt(false);
                  const target = mainLinkStatus.isDefault ? mainLinkRef.current : partialLinkRef.current;
                  setTimeout(() => { target?.focus(); target?.select?.(); }, 50);
                }}
              >
                Personalise link
              </button>
            </>
          }
        >
          <p className="prompt-text">Guests will see {mainLinkStatus.isDefault && creatingSecondLink && (partialLinkStatus.isDefault || /partial/.test(partialLinkValue)) ? 'these links' : 'this link'}:</p>
          {mainLinkStatus.isDefault && <p className="prompt-link">{shownBase}/i/{slugFull}</p>}
          {creatingSecondLink && (partialLinkStatus.isDefault || /partial/.test(partialLinkValue)) && <p className="prompt-link">{shownBase}/i/{partialLinkValue}</p>}
          <p className="prompt-text">A link with your names looks more personal, like <strong>{shownBase}/i/{nameExample}</strong>. You can’t change it once guests have it.</p>
        </Modal>
      )}

      {/* Celebration */}
      {showCelebration && (
        <div className="celebration-overlay" onClick={() => setShowCelebration(false)}>
          <div className="celebration-modal" role="dialog" aria-modal="true" aria-labelledby="celebration-title" onClick={e => e.stopPropagation()}>
            <div className="celebration-icon" aria-hidden="true">🎉</div>
            <h2 className="celebration-title" id="celebration-title">Your invitation is live!</h2>
            <p className="celebration-sub">Send your link to guests — on WhatsApp or anywhere.</p>
            <div className="celebration-link">
              <span className="celebration-link-text">{inviteUrl}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyLink(inviteUrl)}>
                <Copy size={16} aria-hidden="true" /> Copy
              </button>
            </div>
            <div className="celebration-actions">
              <a
                className="btn btn-primary"
                href={whatsappShareUrl(`You're invited to our ${eventTypeWord(event)}! View the invitation: ${inviteUrl}`)}
                target="_blank"
                rel="noreferrer"
              >
                <Share2 size={18} aria-hidden="true" /> Share on WhatsApp
              </a>
              <Link to={`/events/${id}/share`} className="btn btn-secondary">More ways to share</Link>
            </div>
            <QrCode url={inviteUrl} fileName={`qr-${event.slug}.png`} size={132} />
            <button type="button" className="btn btn-ghost" onClick={() => setShowCelebration(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One name. When the template gives this name role options ("Groom, Bride"),
 * a dropdown sits beside it — never locked, even after the name is: confirming
 * fixes how the name is spelt, not which role it is.
 */
function PersonNameRow({ roleDef, label, locked, value, onChange, roleChoice = '', onRoleChoiceChange, roleChoiceRequired = false }) {
  const id = useId();
  const options = roleDef.roleOptions || [];
  const showChoice = options.length > 0 && onRoleChoiceChange;
  const needsChoice = showChoice && roleChoiceRequired && String(value || '').trim() && !roleChoice;
  return (
    <div className="person-row">
      <label className="form-label" htmlFor={id}>
        {label}
        {!roleDef.required && <span className="form-optional">(optional)</span>}
        {locked && <span className="lock-chip"><Lock size={12} aria-hidden="true" /> Locked</span>}
      </label>
      <div className="person-row-controls">
        <input
          id={id}
          className="form-input"
          placeholder={DEMO_NAMES[roleDef.role] || 'Full name'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          autoComplete="off"
        />
        {showChoice && (
          <div className="role-choice">
            <select
              className="form-select"
              value={roleChoice}
              onChange={(e) => onRoleChoiceChange(e.target.value)}
              aria-label={`Is ${label} the ${options.join(' or ')}?`}
              aria-invalid={needsChoice || undefined}
            >
              <option value="">{options.join(' / ')}…</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <InfoTip label={`Why we ask ${options.join(' or ')}`} align="end">
              Used for wording on your invitation, like “Son of” and “Daughter of”.
            </InfoTip>
          </div>
        )}
      </div>
      {needsChoice && <div className="form-error">Choose {options.join(' or ')}.</div>}
    </div>
  );
}

/** A checklist line. Unfinished lines offer the fix; optional ones are a gentle nudge, never a blocker. */
function PreflyItem({ ok, label, onClick, actionLabel = 'Fix', optional = false }) {
  return (
    <li className={`preflight-item ${ok ? 'ok' : optional ? 'soft' : 'nok'}`}>
      <span className="preflight-icon" aria-hidden="true">{ok ? <Check size={15} /> : optional ? '•' : '!'}</span>
      <span className="preflight-label">
        {label}
        {!ok && optional && <span className="preflight-optional"> — optional</span>}
        <span className="sr-only">{ok ? ' (done)' : ' (not done yet)'}</span>
      </span>
      {!ok && onClick && (
        <button type="button" className="btn btn-ghost btn-sm preflight-action" onClick={onClick}>{actionLabel}</button>
      )}
    </li>
  );
}

/**
 * Step footer (pinned to the bottom on phones). Building: "Back" and
 * "Save & continue". Live invitation: "Back to overview" and "Save changes".
 * Every move saves first. When the main button is greyed out, `hint` says why.
 */
function SectionNav({ sections, activeSection, onBack, onNext, onSave, saving, extra }) {
  if (activeSection === 'overview') return null;
  const idx = sections.findIndex(s => s.id === activeSection);
  const prev = sections[idx - 1];
  const next = sections[idx + 1];
  // "Preview & go live" has its own Go live button and nothing to save
  const canSave = activeSection !== 'publish';
  return (
    <div className="section-nav-footer">
      <div className="section-nav-row section-nav-three">
        {prev ? (
          <button type="button" className="btn btn-ghost section-nav-prev" onClick={() => onBack(prev.id)} disabled={saving} title={`Back to ${prev.label} (saves first)`}>
            <ArrowLeft size={18} aria-hidden="true" />
            {prev.id === 'overview' ? 'Overview' : 'Previous'}
          </button>
        ) : <span />}
        {canSave ? (
          <button type="button" className="btn btn-secondary section-nav-save" onClick={onSave} disabled={saving}>
            {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Save'}
          </button>
        ) : <span />}
        {next ? (
          <button type="button" className="btn btn-primary section-nav-next" onClick={onNext} disabled={saving} title={`Save and go to ${next.label}`}>
            Next
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ) : <span />}
      </div>
      {extra}
    </div>
  );
}

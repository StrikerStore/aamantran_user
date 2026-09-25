import {
  Home, Sparkles, PencilLine, Send, Users, MessageCircleHeart, ListChecks, Clock3, Briefcase,
  Wallet, Package, Gift, Palette, Camera, BookOpen, LifeBuoy, Settings as SettingsIcon, Star,
} from 'lucide-react';

/**
 * Every place in the dashboard, grouped the way the Menu page and the desktop
 * "More" list show them. `main` items are also in the tab bar / rail.
 */
export function buildNav(activeEvent) {
  const eid = activeEvent?.id;
  const live = Boolean(activeEvent?.isPublished);
  const ePath = (sub) => (eid ? `/events/${eid}/${sub}` : '#');
  const buildPath = ePath(live ? 'edit' : 'generate');

  return [
    {
      section: 'Invitation',
      items: [
        { key: 'home', label: 'Home', to: '/dashboard', icon: Home, main: true },
        { key: 'invite', label: live ? 'Edit invitation' : 'Build invitation', short: 'Invite', icon: live ? PencilLine : Sparkles, to: buildPath, needsEvent: true, main: true },
        { key: 'share', label: 'Share', icon: Send, to: ePath('share'), needsEvent: true, needsLive: true, main: true },
        { key: 'guests', label: 'Guests', icon: Users, to: ePath('guests'), needsEvent: true, main: true },
        { key: 'wishes', label: 'Wishes', icon: MessageCircleHeart, to: ePath('wishes'), needsEvent: true, rail: true },
      ],
    },
    {
      section: 'Planning',
      items: [
        { key: 'tasks', label: 'Tasks', icon: ListChecks, to: ePath('tasks'), needsEvent: true },
        { key: 'timeline', label: 'Day-of timeline', icon: Clock3, to: ePath('timeline'), needsEvent: true },
        { key: 'vendors', label: 'Vendors', icon: Briefcase, to: ePath('vendors'), needsEvent: true },
      ],
    },
    {
      section: 'Money & items',
      items: [
        { key: 'budget', label: 'Budget', icon: Wallet, to: ePath('budget'), needsEvent: true },
        { key: 'inventory', label: 'Inventory', icon: Package, to: ePath('inventory'), needsEvent: true },
        { key: 'gifts', label: 'Gifts', icon: Gift, to: ePath('gifts'), needsEvent: true },
      ],
    },
    {
      section: 'Memories',
      items: [
        { key: 'moodboard', label: 'Mood board', icon: Palette, to: ePath('moodboard'), needsEvent: true },
        { key: 'photos', label: 'Photo wall', icon: Camera, to: ePath('photos'), needsEvent: true },
      ],
    },
    {
      section: 'Help & account',
      items: [
        { key: 'guide', label: 'Help guide', to: '/guide', icon: BookOpen },
        { key: 'support', label: 'Support', to: '/support', icon: LifeBuoy },
        { key: 'settings', label: 'Settings', to: '/settings', icon: SettingsIcon },
        { key: 'review', label: 'Leave a review', to: '/review', icon: Star },
      ],
    },
  ];
}

/** Why a place can't be opened yet, or null if it can. */
export function blockedReason(item, activeEvent) {
  if (item.needsEvent && !activeEvent?.id) return 'You don’t have an invitation yet';
  if (item.needsLive && !activeEvent?.isPublished) return 'Go live first — then you can share your invitation';
  return null;
}

/** Page names for the browser tab and the phone top bar. */
const PAGE_TITLES = [
  [/^\/dashboard/, 'Home'],
  [/^\/menu/, 'Menu'],
  [/\/generate$/, 'Build your invitation'],
  [/\/edit$/, 'Edit your invitation'],
  [/\/share$/, 'Share'],
  [/\/guests$/, 'Guests'],
  [/\/wishes$/, 'Wishes'],
  [/\/tasks$/, 'Tasks'],
  [/\/timeline$/, 'Day-of timeline'],
  [/\/vendors$/, 'Vendors'],
  [/\/budget$/, 'Budget'],
  [/\/inventory$/, 'Inventory'],
  [/\/gifts$/, 'Gifts'],
  [/\/moodboard$/, 'Mood board'],
  [/\/photos$/, 'Photo wall'],
  [/^\/guide/, 'Help guide'],
  [/^\/support/, 'Support'],
  [/^\/settings/, 'Settings'],
  [/^\/review/, 'Leave a review'],
];

export function titleFor(path) {
  return PAGE_TITLES.find(([re]) => re.test(path))?.[1] || '';
}

/** Pages the phone tab bar opens directly (they show the invitation switcher on top). */
export function isMainTab(path) {
  return path === '/dashboard' || path === '/menu' || /\/(guests|share)$/.test(path);
}

/** The builder runs full-screen on phones, with its own bar. */
export function isFlowPage(path) {
  return /\/(generate|edit)$/.test(path);
}

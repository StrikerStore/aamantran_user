/**
 * Every icon in the couple dashboard comes from here — Hugeicons, free
 * "Stroke Rounded" set (MIT). Pages import icons by these names, so changing an
 * icon for the whole app is a one-line change in this file.
 *
 * Each icon takes the usual props: size (default 24), strokeWidth, className,
 * aria-*, and fill (e.g. a filled star).
 */
import { forwardRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertCircleIcon, Alert02Icon, ArrowLeft02Icon, ArrowRight02Icon, Notification03Icon, BookOpen01Icon,
  Briefcase01Icon, Calendar03Icon, CalendarLove01Icon, Camera01Icon, Tick02Icon, CheckmarkCircle02Icon,
  ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, Task01Icon, Clock01Icon, CloudOffIcon, Copy01Icon,
  Download01Icon, LinkSquare02Icon, ViewIcon, ViewOffIcon, File01Icon, FilterIcon, Flower01Icon,
  Diamond02Icon, GiftIcon, Agreement01Icon, FavouriteIcon, Home01Icon, Image01Icon, ImageAdd01Icon,
  InformationCircleIcon, CustomerSupportIcon, Link01Icon, TaskDone01Icon, Loading03Icon, LockIcon,
  Logout03Icon, Mail01Icon, Location01Icon, Menu01Icon, BubbleChatIcon, MessageFavourite01Icon,
  MoreHorizontalIcon, MusicNote01Icon, Package01Icon, PaintBoardIcon, PartyIcon, PencilEdit02Icon,
  PencilEdit01Icon, CallIcon, PlayIcon, Add01Icon, QrCodeIcon, LiveStreaming02Icon, Rocket01Icon,
  RotateLeft01Icon, Search01Icon, SearchRemoveIcon, Settings02Icon, Share08Icon, TShirtIcon,
  ShoppingBag01Icon, SparklesIcon, StarIcon, Delete02Icon, UserIcon, UserSettings01Icon, UserAdd01Icon,
  UserMultipleIcon, Restaurant01Icon, Wallet01Icon, Cancel01Icon, CancelCircleIcon,
} from '@hugeicons/core-free-icons';

function makeIcon(icon, name) {
  const Icon = forwardRef(function Icon({ size = 24, className = '', ...rest }, ref) {
    return <HugeiconsIcon ref={ref} icon={icon} size={size} className={`hgi${className ? ` ${className}` : ''}`} {...rest} />;
  });
  Icon.displayName = name;
  return Icon;
}

// Status and feedback
export const AlertCircle = makeIcon(AlertCircleIcon, 'AlertCircle');
export const AlertTriangle = makeIcon(Alert02Icon, 'AlertTriangle');
export const Info = makeIcon(InformationCircleIcon, 'Info');
export const Check = makeIcon(Tick02Icon, 'Check');
export const CheckCircle2 = makeIcon(CheckmarkCircle02Icon, 'CheckCircle2');
export const X = makeIcon(Cancel01Icon, 'X');
export const XCircle = makeIcon(CancelCircleIcon, 'XCircle');
export const Loader2 = makeIcon(Loading03Icon, 'Loader2');
export const Lock = makeIcon(LockIcon, 'Lock');
export const CloudOff = makeIcon(CloudOffIcon, 'CloudOff');
export const Radio = makeIcon(LiveStreaming02Icon, 'Radio');
export const BellRing = makeIcon(Notification03Icon, 'BellRing');

// Arrows and chevrons
export const ArrowLeft = makeIcon(ArrowLeft02Icon, 'ArrowLeft');
export const ArrowRight = makeIcon(ArrowRight02Icon, 'ArrowRight');
export const ChevronLeft = makeIcon(ArrowLeft01Icon, 'ChevronLeft');
export const ChevronRight = makeIcon(ArrowRight01Icon, 'ChevronRight');
export const ChevronDown = makeIcon(ArrowDown01Icon, 'ChevronDown');
export const RotateCcw = makeIcon(RotateLeft01Icon, 'RotateCcw');
export const ExternalLink = makeIcon(LinkSquare02Icon, 'ExternalLink');

// Actions
export const Plus = makeIcon(Add01Icon, 'Plus');
export const Pencil = makeIcon(PencilEdit02Icon, 'Pencil');
export const PencilLine = makeIcon(PencilEdit01Icon, 'PencilLine');
export const Trash2 = makeIcon(Delete02Icon, 'Trash2');
export const Copy = makeIcon(Copy01Icon, 'Copy');
export const Download = makeIcon(Download01Icon, 'Download');
export const Share2 = makeIcon(Share08Icon, 'Share2');
export const Search = makeIcon(Search01Icon, 'Search');
export const SearchX = makeIcon(SearchRemoveIcon, 'SearchX');
export const Filter = makeIcon(FilterIcon, 'Filter');
export const Eye = makeIcon(ViewIcon, 'Eye');
export const EyeOff = makeIcon(ViewOffIcon, 'EyeOff');
export const Play = makeIcon(PlayIcon, 'Play');
export const LogOut = makeIcon(Logout03Icon, 'LogOut');
export const Menu = makeIcon(Menu01Icon, 'Menu');
export const MoreHorizontal = makeIcon(MoreHorizontalIcon, 'MoreHorizontal');
export const Link2 = makeIcon(Link01Icon, 'Link2');
export const QrCode = makeIcon(QrCodeIcon, 'QrCode');

// Places in the dashboard
export const Home = makeIcon(Home01Icon, 'Home');
export const Sparkles = makeIcon(SparklesIcon, 'Sparkles');
export const Users = makeIcon(UserMultipleIcon, 'Users');
export const User = makeIcon(UserIcon, 'User');
export const UserPlus = makeIcon(UserAdd01Icon, 'UserPlus');
export const UserCog = makeIcon(UserSettings01Icon, 'UserCog');
export const MessageCircle = makeIcon(BubbleChatIcon, 'MessageCircle');
export const MessageCircleHeart = makeIcon(MessageFavourite01Icon, 'MessageCircleHeart');
export const ListChecks = makeIcon(TaskDone01Icon, 'ListChecks');
export const ClipboardList = makeIcon(Task01Icon, 'ClipboardList');
export const Clock = makeIcon(Clock01Icon, 'Clock');
export const Clock3 = makeIcon(Clock01Icon, 'Clock3');
export const Briefcase = makeIcon(Briefcase01Icon, 'Briefcase');
export const Wallet = makeIcon(Wallet01Icon, 'Wallet');
export const Package = makeIcon(Package01Icon, 'Package');
export const Gift = makeIcon(GiftIcon, 'Gift');
export const Palette = makeIcon(PaintBoardIcon, 'Palette');
export const Camera = makeIcon(Camera01Icon, 'Camera');
export const BookOpen = makeIcon(BookOpen01Icon, 'BookOpen');
export const LifeBuoy = makeIcon(CustomerSupportIcon, 'LifeBuoy');
export const Settings = makeIcon(Settings02Icon, 'Settings');
export const Star = makeIcon(StarIcon, 'Star');
export const ShoppingBag = makeIcon(ShoppingBag01Icon, 'ShoppingBag');

// Invitation content
export const CalendarDays = makeIcon(Calendar03Icon, 'CalendarDays');
export const CalendarHeart = makeIcon(CalendarLove01Icon, 'CalendarHeart');
export const Image = makeIcon(Image01Icon, 'Image');
export const ImagePlus = makeIcon(ImageAdd01Icon, 'ImagePlus');
export const Music = makeIcon(MusicNote01Icon, 'Music');
export const FileText = makeIcon(File01Icon, 'FileText');
export const MapPin = makeIcon(Location01Icon, 'MapPin');
export const Mail = makeIcon(Mail01Icon, 'Mail');
export const Phone = makeIcon(CallIcon, 'Phone');
export const Heart = makeIcon(FavouriteIcon, 'Heart');
export const PartyPopper = makeIcon(PartyIcon, 'PartyPopper');
export const Rocket = makeIcon(Rocket01Icon, 'Rocket');
export const Handshake = makeIcon(Agreement01Icon, 'Handshake');

// Inventory categories
export const Shirt = makeIcon(TShirtIcon, 'Shirt');
export const Gem = makeIcon(Diamond02Icon, 'Gem');
export const Flower2 = makeIcon(Flower01Icon, 'Flower2');
export const UtensilsCrossed = makeIcon(Restaurant01Icon, 'UtensilsCrossed');

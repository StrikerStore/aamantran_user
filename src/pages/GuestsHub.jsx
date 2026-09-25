import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Users, MessageCircleHeart } from '../components/ui/icons';
import GuestManager from './GuestManager';
import WishManager from './WishManager';

const TABS = [
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'wishes', label: 'Wishes', icon: MessageCircleHeart },
];

/**
 * Guests and the wishes they leave, in one place: two tabs at the top.
 * The open tab lives in the address (?tab=wishes) so links and Back work.
 */
export default function GuestsHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'wishes' ? 'wishes' : 'guests';

  return (
    <div>
      <div className="seg-tabs" role="tablist" aria-label="Guests and wishes">
        {TABS.map((t) => {
          const { id, label } = t;
          const Icon = t.icon;
          return (
          <button
            type="button"
            role="tab"
            key={id}
            aria-selected={tab === id}
            className={`seg-tab${tab === id ? ' active' : ''}`}
            onClick={() => setParams(id === 'guests' ? {} : { tab: id }, { replace: true })}
          >
            <Icon size={18} aria-hidden="true" /> {label}
          </button>
          );
        })}
      </div>
      <div role="tabpanel">
        {tab === 'wishes' ? <WishManager /> : <GuestManager />}
      </div>
    </div>
  );
}

/** The old Wishes address opens the Wishes tab. */
export function WishesRedirect() {
  const { id } = useParams();
  return <Navigate to={`/events/${id}/guests?tab=wishes`} replace />;
}

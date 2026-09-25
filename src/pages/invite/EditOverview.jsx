import { ChevronRight } from '../../components/ui/icons';

/**
 * Home of a live invitation: one card per area with what is filled in and an
 * Edit button, so a couple coming back to change one thing goes straight to it
 * instead of walking the whole builder again.
 *
 * cards: [{ id, title, icon: LucideIcon, summary: string, empty?: boolean }]
 */
export function EditOverview({ cards, onEdit }) {
  return (
    <div className="overview-grid">
      {cards.map((card) => {
        const { id, title, summary, empty } = card;
        const Icon = card.icon;
        return (
        <button type="button" key={id} className="overview-card" onClick={() => onEdit(id)}>
          <span className="overview-icon" aria-hidden="true"><Icon size={20} /></span>
          <span className="overview-text">
            <span className="overview-title">{title}</span>
            <span className={`overview-summary${empty ? ' is-empty' : ''}`}>{summary}</span>
          </span>
          <span className="overview-edit">Edit <ChevronRight size={16} aria-hidden="true" /></span>
        </button>
        );
      })}
    </div>
  );
}

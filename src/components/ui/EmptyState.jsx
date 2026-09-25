/**
 * What an empty area is for, and the one thing to do next.
 * `icon` is a lucide-react component. `tone` is accepted for older call sites.
 */
export function EmptyState({ icon: Icon, title, children, action, tone = 'rose' }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className={`empty-icon${tone !== 'rose' ? ` empty-icon--${tone}` : ''}`}>
          <Icon size={32} strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      <div className="empty-title">{title}</div>
      {children && <div className="empty-desc">{children}</div>}
      {action}
    </div>
  );
}

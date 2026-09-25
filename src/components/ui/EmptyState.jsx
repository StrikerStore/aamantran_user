/**
 * What an empty area is for, and the one thing to do next.
 * `icon` is an icon from components/ui/icons; `tone` picks the pastel circle.
 */
export function EmptyState({ icon: Icon, title, children, action, tone = 'rose' }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className={`empty-icon${tone !== 'rose' ? ` empty-icon--${tone}` : ''}`}>
          <Icon size={30} strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
      <div className="empty-title">{title}</div>
      {children && <div className="empty-desc">{children}</div>}
      {action}
    </div>
  );
}

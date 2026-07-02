/**
 * Clay skeleton loading primitives (shimmer classes live in index.css).
 * Use instead of a bare spinner on content-heavy pages so the layout
 * doesn't jump when data arrives.
 */
export function Skeleton({ variant = 'line', width, height, style, className = '' }) {
  return (
    <div
      className={`skeleton skeleton-${variant} ${className}`}
      style={{ width, height, ...style }}
    />
  );
}

/** A generic page loading state: title + a row of stat tiles + a few cards. */
export function PageSkeleton({ stats = 3, cards = 2 }) {
  return (
    <div className="skeleton-stack" style={{ gap: 20 }}>
      <Skeleton variant="title" />
      {stats > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: stats }).map((_, i) => (
            <Skeleton key={i} variant="card" style={{ flex: 1, minWidth: 120, minHeight: 78 }} />
          ))}
        </div>
      )}
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  );
}

/** A responsive grid of skeleton cards (mood board, galleries). */
export function GridSkeleton({ count = 8, minWidth = 160, height = 160 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
        gap: 14,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="card" style={{ height, minHeight: 0 }} />
      ))}
    </div>
  );
}

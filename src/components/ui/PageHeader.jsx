import { InfoTip } from './InfoTip';

/**
 * The one header every page uses: a sentence-case title, a short line saying
 * what the page is for, an optional "i" help, and the page's actions (right on
 * desktop, full width under the text on phones).
 */
export function PageHeader({ title, subtitle, help, helpLabel, helpMore, actions, eyebrow }) {
  return (
    <header className="ph">
      <div className="ph-text">
        {eyebrow && <div className="ph-eyebrow">{eyebrow}</div>}
        <div className="ph-title-row">
          <h1 className="ph-title">{title}</h1>
          {help && <InfoTip label={helpLabel || `About ${String(title).toLowerCase()}`} learnMore={helpMore}>{help}</InfoTip>}
        </div>
        {subtitle && <p className="ph-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </header>
  );
}

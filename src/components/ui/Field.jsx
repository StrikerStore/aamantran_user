import { cloneElement, isValidElement, useId } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { InfoTip } from './InfoTip';

/**
 * A form field with its label tied to the input (so tapping the label focuses
 * it and screen readers read it), a hint that stays visible while typing
 * (placeholders disappear), and an error or success line under it.
 * Optional fields say "(optional)" — clearer than starring the required ones.
 *
 *   <Field label="Ceremony name" hint="…" optional><input className="form-input" … /></Field>
 */
export function Field({ label, hint, error, success, optional, help, helpLabel, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const msgId = error || success ? `${id}-msg` : undefined;
  const describedBy = [hintId, msgId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className={`form-group ${className}`}>
      <label className="form-label" htmlFor={isValidElement(children) ? (children.props.id || id) : undefined}>
        {label}
        {optional && <span className="form-optional">(optional)</span>}
        {help && <InfoTip label={helpLabel || `About ${String(label).toLowerCase()}`}>{help}</InfoTip>}
      </label>
      {control}
      {hint && <div className="form-hint" id={hintId}>{hint}</div>}
      {error && <div className="form-error" id={msgId}><AlertCircle size={15} aria-hidden="true" />{error}</div>}
      {!error && success && <div className="form-success" id={msgId}><CheckCircle2 size={15} aria-hidden="true" />{success}</div>}
    </div>
  );
}

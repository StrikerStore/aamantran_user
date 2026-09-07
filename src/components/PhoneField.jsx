import { COUNTRIES, POPULAR_ISO, DIAL_CODES_BY_LENGTH } from '../lib/dialCodes';

/**
 * Country code picker plus a number input.
 *
 * A NATIVE <select>, deliberately, on two counts.
 *
 * Not a free-text code box: this number is write-once on the account (the
 * backend refuses to change it once filled and sends the couple to a support
 * ticket), so `19` typed for `91` would be a permanent unroutable number. A
 * select makes an invalid code structurally impossible.
 *
 * Not the app's own ui/Select either: that component flattens its children and
 * ignores <optgroup>, which would leave 210 countries in one ungrouped scroll.
 * Native brings the mobile OS picker, keyboard type-ahead and the popular-first
 * grouping for free -- and most of this traffic is mobile. It inherits
 * .form-input so it still reads as part of the form.
 *
 * No emoji flags: Windows renders country-flag emoji as bare letters.
 */

const DEFAULT_DIAL = '+91';

const POPULAR = POPULAR_ISO
  .map(iso => COUNTRIES.find(c => c[1] === iso))
  .filter(Boolean);

const ALL = [...COUNTRIES].sort((a, b) => a[2].localeCompare(b[2]));

/**
 * Split typed input into a dial code and a national number.
 *
 * MIRRORS aamantran_backend/src/utils/phone.js, which re-runs this on save and
 * is the authority. This copy exists so the field corrects itself as you type.
 *
 * The rule that keeps it unambiguous: a dial code is only ever stripped off the
 * number when the user explicitly wrote `+` or `00`. Without that marker the
 * picker is trusted and only a leading trunk zero is dropped -- because with a
 * `+1` picker and `1234567890` typed, a stray country code and a real leading
 * `1` are indistinguishable, and guessing would delete a digit from a valid
 * number.
 */
export function splitTyped(rawCode, rawNumber) {
  const code = rawCode || DEFAULT_DIAL;
  const s = String(rawNumber == null ? '' : rawNumber).trim().replace(/^00/, '+');
  const explicit = s.startsWith('+');
  const digits = s.replace(/\D/g, '');

  if (explicit && digits) {
    const matched = DIAL_CODES_BY_LENGTH.find(c => digits.startsWith(c.slice(1)));
    if (matched) {
      // Someone who took the trouble to type +1 into a +91 form meant +1.
      return { code: matched, national: digits.slice(matched.length - 1) };
    }
    return { code, national: digits };
  }
  return { code, national: digits.replace(/^0/, '') };
}

export default function PhoneField({
  countryCode,
  number,
  onChange,
  disabled,
  placeholder = 'Contact number',
  id,
}) {
  const code = countryCode || DEFAULT_DIAL;

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        aria-label="Country code"
        className="form-input"
        value={code}
        disabled={disabled}
        onChange={e => onChange({ countryCode: e.target.value, number })}
        style={{ flex: '0 0 auto', maxWidth: '9.5rem' }}
      >
        <optgroup label="Popular">
          {POPULAR.map(([dial, iso, name]) => (
            <option key={`pop-${iso}`} value={dial}>{dial}  {name}</option>
          ))}
        </optgroup>
        <optgroup label="All countries">
          {ALL.map(([dial, iso, name]) => (
            <option key={iso} value={dial}>{dial}  {name}</option>
          ))}
        </optgroup>
      </select>

      <input
        id={id}
        className="form-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={number}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => {
          // Re-split on every keystroke so pasting a full +1… number moves the
          // picker instead of leaving it disagreeing with what is on screen.
          const next = splitTyped(code, e.target.value);
          onChange({ countryCode: next.code, number: next.national });
        }}
        style={{ flex: '1 1 auto', minWidth: 0 }}
      />
    </div>
  );
}

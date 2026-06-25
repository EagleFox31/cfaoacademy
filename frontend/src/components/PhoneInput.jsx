import ComboFlag from './ComboFlag.jsx'

export default function PhoneInput({
  id,
  label,
  dialCode,
  flag,
  value,
  onChange,
  disabled,
  invalid,
  errorId,
  describedBy,
  placeholder,
}) {
  return (
    <div className="login-field contact-phone-field">
      <label className="login-label" htmlFor={id}>{label}</label>
      <div className={`contact-phone-row${invalid ? ' is-invalid' : ''}`}>
        <span className="contact-phone-dial" aria-hidden="true">
          {flag?.src && (
            <ComboFlag
              src={flag.src}
              srcSet={flag.srcSet}
              className="contact-phone-flag combo-flag"
            />
          )}
          <span className="contact-phone-dial-code">{dialCode || '—'}</span>
        </span>
        <input
          id={id}
          type="tel"
          className={`login-input contact-phone-input${invalid ? ' is-invalid' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="tel-national"
          inputMode="tel"
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={['contact-country-hint', describedBy, errorId].filter(Boolean).join(' ') || undefined}
          disabled={disabled || !dialCode}
        />
      </div>
    </div>
  )
}

import { useId } from 'react'
import { classNames } from '../../utils/format'

/**
 * Input - labeled text field with helper / error / icons.
 */
export default function Input({
  id,
  name,
  label,
  type = 'text',
  value,
  defaultValue,
  placeholder,
  helper,
  error,
  required = false,
  disabled = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  onChange,
  ...rest
}) {
  const generatedId = useId()
  const inputId = id || `input-${name || generatedId}`

  return (
    <div className={classNames('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[13px] font-medium text-neutral-900"
        >
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {LeftIcon && (
          <LeftIcon
            className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-400"
            aria-hidden="true"
          />
        )}
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          onChange={onChange}
          className={classNames(
            'h-10 w-full rounded-md border bg-white text-sm text-neutral-700',
            'placeholder:text-neutral-400 transition',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-danger-500 focus:ring-danger-500/20'
              : 'border-neutral-200 hover:border-neutral-300 focus:border-brand-600 focus:ring-brand-600/20',
            disabled && 'bg-neutral-50 cursor-not-allowed',
            LeftIcon ? 'pl-9' : 'pl-3',
            RightIcon ? 'pr-9' : 'pr-3',
          )}
          {...rest}
        />
        {RightIcon && (
          <RightIcon
            className="pointer-events-none absolute right-3 h-4 w-4 text-neutral-400"
            aria-hidden="true"
          />
        )}
      </div>

      {error ? (
        <p className="text-xs text-danger-600">{error}</p>
      ) : helper ? (
        <p className="text-xs text-neutral-500">{helper}</p>
      ) : null}
    </div>
  )
}
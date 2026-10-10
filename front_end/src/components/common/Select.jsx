import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

import { classNames } from '../../utils/format'

/**
 * Select - native <select> wrapped with the same look as Input.
 *
 * Props:
 * - label, helper, error, required, disabled
 * - options: Array<{ value, label }> | Array<string>
 * - leftIcon, placeholder
 */
export default function Select({
  id,
  name,
  label,
  value,
  defaultValue,
  options = [],
  placeholder,
  helper,
  error,
  required = false,
  disabled = false,
  leftIcon: LeftIcon,
  className = '',
  onChange,
  ...rest
}) {
  const generatedId = useId()
  const selectId = id || `select-${name || generatedId}`
  const stringOptions = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )

  return (
    <div className={classNames('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium text-neutral-900">
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
        <select
          id={selectId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          required={required}
          onChange={onChange}
          className={classNames(
            'h-10 w-full appearance-none rounded-md border bg-white text-sm text-neutral-700 transition',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-danger-500 focus:ring-danger-500/20'
              : 'border-neutral-200 hover:border-neutral-300 focus:border-brand-600 focus:ring-brand-600/20',
            disabled && 'bg-neutral-50 cursor-not-allowed',
            LeftIcon ? 'pl-9 pr-9' : 'pl-3 pr-9',
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {stringOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 h-4 w-4 text-neutral-400"
          aria-hidden="true"
        />
      </div>

      {error ? (
        <p className="text-xs text-danger-600">{error}</p>
      ) : helper ? (
        <p className="text-xs text-neutral-500">{helper}</p>
      ) : null}
    </div>
  )
}
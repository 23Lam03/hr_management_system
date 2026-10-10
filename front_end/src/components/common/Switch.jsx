import { classNames } from '../../utils/format'

/**
 * Switch - toggle on/off kích thước vừa. Có label + mô tả phụ.
 *
 * Props:
 * - checked, onChange(checked)
 * - label, description
 * - disabled
 */
export default function Switch({
  id,
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}) {
  const handleClick = () => {
    if (disabled) return
    onChange?.(!checked)
  }

  return (
    <label
      htmlFor={id}
      className={classNames(
        'flex items-start justify-between gap-4 cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      {(label || description) && (
        <span className="flex min-w-0 flex-col gap-0.5">
          {label && (
            <span className="text-sm font-medium text-neutral-900">{label}</span>
          )}
          {description && (
            <span className="text-[13px] text-neutral-500">{description}</span>
          )}
        </span>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={classNames(
          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-neutral-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40',
        )}
      >
        <span
          aria-hidden="true"
          className={classNames(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  )
}
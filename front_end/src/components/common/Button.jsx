import { classNames } from '../../utils/format'

const VARIANT = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-700',
  secondary:
    'bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300',
  outline:
    'bg-transparent text-brand-700 border border-brand-200 hover:bg-brand-50 hover:border-brand-300',
  ghost:
    'bg-transparent text-neutral-700 hover:bg-neutral-100',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600',
}

const SIZE = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

const ICON_SIZE = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4 w-4',
}

/**
 * Button - variants × sizes × icon support × loading/fullWidth.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled = false,
  loading = false,
  className = '',
  onClick,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={classNames(
        'inline-flex items-center justify-center rounded-md font-medium leading-none',
        'whitespace-nowrap select-none transition',
        'disabled:opacity-55 disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        VARIANT[variant] ?? VARIANT.primary,
        SIZE[size] ?? SIZE.md,
        fullWidth && 'w-full',
        loading && 'cursor-wait',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className={ICON_SIZE[size] ?? ICON_SIZE.md} aria-hidden="true" />
      )}
      {children && <span className="inline-flex items-center">{children}</span>}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={ICON_SIZE[size] ?? ICON_SIZE.md} aria-hidden="true" />
      )}
    </button>
  )
}
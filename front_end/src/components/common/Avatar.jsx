import { classNames } from '../../utils/format'

const SIZE = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-[13px]',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return ((first + last).toUpperCase() || '?')
}

/**
 * Avatar - shows image src, otherwise renders initials on gradient.
 */
export default function Avatar({
  src,
  alt,
  name = '',
  size = 'md',
  className = '',
}) {
  const dimension = SIZE[size] ?? SIZE.md

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'avatar'}
        className={classNames(
          'inline-block flex-shrink-0 rounded-full object-cover bg-neutral-200',
          dimension,
          className,
        )}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={alt || name}
      className={classNames(
        'inline-flex items-center justify-center rounded-full font-semibold uppercase select-none flex-shrink-0',
        'bg-gradient-to-br from-brand-500 to-brand-700 text-white leading-none',
        dimension,
        className,
      )}
    >
      {getInitials(name)}
    </span>
  )
}
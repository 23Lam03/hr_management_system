import { classNames } from '../../utils/format'

/**
 * Card - elevated container with optional header/footer.
 */
export default function Card({
  title,
  subtitle,
  actions,
  children,
  footer,
  padding = true,
  className = '',
}) {
  return (
    <section
      className={classNames(
        'flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card',
        className,
      )}
    >
      {(title || subtitle || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && (
              <h3 className="text-base font-semibold text-neutral-900 leading-tight">
                {title}
              </h3>
            )}
            {subtitle && <p className="text-[13px] text-neutral-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}

      <div className={classNames('flex-1', padding ? 'p-5' : '')}>{children}</div>

      {footer && (
        <footer className="border-t border-neutral-200 bg-neutral-50 px-5 py-3 text-[13px] text-neutral-500">
          {footer}
        </footer>
      )}
    </section>
  )
}
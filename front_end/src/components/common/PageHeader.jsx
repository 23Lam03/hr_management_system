/**
 * PageHeader - title + subtitle + icon + actions + breadcrumb.
 */
export default function PageHeader({ title, subtitle, icon: Icon, actions, breadcrumb }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {breadcrumb && (
              <div className="mb-1 text-xs text-neutral-500">{breadcrumb}</div>
            )}
            <h1 className="text-[28px] font-bold text-neutral-900 leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  )
}
import { classNames } from '../../utils/format'

/**
 * DashboardSection - tiêu đề khu vực có thể kèm hành động (link, button).
 * Dùng để định nghĩa các khu vực trên dashboard (Stat, Biểu đồ, Bảng...).
 */
export default function DashboardSection({ title, description, actions, className = '', children }) {
  return (
    <section className={classNames('flex flex-col gap-3', className)}>
      {(title || description || actions) && (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-[13px] text-neutral-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
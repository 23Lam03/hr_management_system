import { Link, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import Button from '../common/Button'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const WIDTH = {
  expanded: 'w-64',
  collapsed: 'w-[72px]',
}

/**
 * Sidebar - shared by AdminLayout & EmployeeLayout.
 *
 * Props:
 * - brand: { title, subtitle }
 * - navigation: [{ title, items: [{ to, label, icon, exact? }] }]
 * - isMobileOpen: boolean
 * - onMobileClose: () => void
 * - collapsed: boolean (desktop only)
 * - onToggleCollapsed: () => void
 * - footerText: optional string
 */
export default function Sidebar({
  brand = { title: 'HRM System', subtitle: 'sidebar.brandSubtitle' },
  navigation = [],
  isMobileOpen = false,
  onMobileClose,
  collapsed = false,
  onToggleCollapsed,
  footerText,
}) {
  const { t } = useI18n()
  const defaultSubtitle = t('sidebar.brandSubtitle')
  return (
    <>
      {/* Mobile scrim */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-neutral-900/45 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label={t('sidebar.mainNav')}
        className={classNames(
          'flex flex-col bg-white border-r border-neutral-200 flex-shrink-0 transition-[width,transform] duration-200',
          // Desktop: collapsible
          'hidden lg:flex lg:sticky lg:top-0 lg:h-screen',
          collapsed ? WIDTH.collapsed : WIDTH.expanded,
          // Mobile: drawer
          'fixed inset-y-0 left-0 z-40 w-64',
          isMobileOpen ? 'translate-x-0 shadow-modal' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <SidebarHeader brand={brand} collapsed={collapsed} defaultSubtitle={defaultSubtitle} />

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navigation.map((group) => (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t(group.title)}
                </p>
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavItem
                      item={item}
                      onNavigate={onMobileClose}
                      collapsed={collapsed}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <SidebarFooter
          footerText={footerText}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
        />
      </aside>
    </>
  )
}

function SidebarHeader({ brand, collapsed, defaultSubtitle }) {
  return (
    <Link
      to="/admin"
      className={classNames(
        'flex items-center gap-3 border-b border-neutral-200 text-neutral-900 hover:bg-neutral-50',
        collapsed ? 'justify-center px-3 py-5' : 'px-5 py-5',
      )}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white text-sm font-bold tracking-wide">
        HR
      </span>
      {!collapsed && (
        <span className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">{brand.title}</span>
          <span className="text-xs text-neutral-500">{defaultSubtitle}</span>
        </span>
      )}
    </Link>
  )
}

function SidebarFooter({ footerText, collapsed, onToggleCollapsed }) {
  const { t } = useI18n()
  return (
    <div className="border-t border-neutral-200 px-3 py-3">
      {onToggleCollapsed && (
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          onClick={onToggleCollapsed}
          className={collapsed ? 'justify-center' : 'justify-start'}
          aria-label={collapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
        >
          {!collapsed && t('sidebar.collapseSidebar')}
        </Button>
      )}
      {footerText && !collapsed && (
        <p className="mt-2 px-2 text-xs text-neutral-500">{footerText}</p>
      )}
    </div>
  )
}

function NavItem({ item, onNavigate, collapsed }) {
  const { pathname } = useLocation()
  const isActive = item.exact ? pathname === item.to : pathname.startsWith(item.to)

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={classNames(
        'group flex items-center gap-3 rounded-md text-sm transition mb-0.5',
        collapsed ? 'justify-center h-10 w-12' : 'px-3 py-2',
        isActive
          ? 'bg-brand-50 text-brand-700 font-medium'
          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      <item.icon
        className={classNames(
          'h-[18px] w-[18px] flex-shrink-0',
          isActive ? 'text-brand-700' : 'text-neutral-500 group-hover:text-neutral-700',
        )}
        aria-hidden="true"
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}
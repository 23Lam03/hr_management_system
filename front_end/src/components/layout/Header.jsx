import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu,
  Bell,
  Search,
  LogOut,
  User as UserIcon,
  Settings as SettingsIcon,
  ChevronDown,
  Check,
} from 'lucide-react'

import Avatar from '../common/Avatar'
import Dropdown, {
  DropdownItem,
  DropdownDivider,
  DropdownLabel,
} from '../common/Dropdown'
import LanguageSwitcher from '../common/LanguageSwitcher'
import { classNames } from '../../utils/format'
import { useAuth } from '../../contexts/useAuth'
import { ROLES } from '../../contexts/roles'
import useNotifications from '../../contexts/useNotifications'
import { useI18n } from '../../i18n/useI18n'

const PROFILE_PATH = {
  [ROLES.ADMIN]: '/admin/settings',
  [ROLES.EMPLOYEE]: '/employee/profile',
}

const NOTIFICATIONS_PATH = {
  [ROLES.ADMIN]: '/admin/notifications',
  [ROLES.EMPLOYEE]: '/employee/notifications',
}

function notificationsPathForRole(role) {
  return NOTIFICATIONS_PATH[role] ?? '/'
}

/**
 * Header - sticky top bar. Lấy user/logout từ AuthContext.
 *
 * Props:
 * - onToggleSidebar (mobile drawer)
 * - breadcrumb: ReactNode
 * - notifications: Array<{ id, title, description?, read? }>
 * - onMarkRead / onMarkAllRead
 */
export default function Header({
  onToggleSidebar,
  breadcrumb,
  notifications: notificationsProp,
  onMarkRead: onMarkReadProp,
  onMarkAllRead: onMarkAllReadProp,
}) {
  const navigate = useNavigate()
  const { user, logout, role } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const ctx = useNotifications()
  const { t } = useI18n()

  const notifications = notificationsProp ?? ctx?.notifications ?? []
  const onMarkRead = onMarkReadProp ?? ctx?.markAsRead
  const onMarkAllRead = onMarkAllReadProp ?? ctx?.markAllAsRead

  const displayName = user?.name ?? ''
  const roleText = role === ROLES.ADMIN ? t('roles.adminRole') : role === ROLES.EMPLOYEE ? t('roles.employeeRole') : role ?? ''
  const unreadCount = notifications.filter((n) => !n.isRead).length
  const profilePath = PROFILE_PATH[role] ?? '/'

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header
      className={classNames(
        'sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 sm:px-6',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={t('header.openMenuLabel')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {breadcrumb && <div className="hidden min-w-0 truncate md:block">{breadcrumb}</div>}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <SearchField open={searchOpen} setOpen={setSearchOpen} />

        <LanguageSwitcher />

        <Dropdown
          align="right"
          panelClassName="w-80 p-0"
          trigger={(open, toggle) => (
            <button
              type="button"
              aria-label={t('header.notifications')}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={toggle}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
        >
          {({ close }) => (
              <div className="flex max-h-[420px] flex-col">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold text-neutral-900">{t('header.notifications')}</p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    {t('header.markAllRead')}
                  </button>
                )}
              </div>
              <div className="border-t border-neutral-200">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-neutral-500">
                    {t('header.noNotifications')}
                  </p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onMarkRead?.(n.id)
                            close()
                          }}
                          className={classNames(
                            'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-neutral-50',
                            !n.isRead && 'bg-brand-50/50',
                          )}
                        >
                          <span
                            className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-brand-600"
                            aria-hidden="true"
                            style={{ visibility: n.isRead ? 'hidden' : 'visible' }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-900">
                              {n.title}
                            </p>
                            {n.message && (
                              <p className="line-clamp-2 text-[13px] text-neutral-500">
                                {n.message}
                              </p>
                            )}
                          </div>
                          {n.isRead && (
                            <Check className="mt-1 h-4 w-4 flex-shrink-0 text-success-600" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-neutral-200 px-4 py-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate(notificationsPathForRole(role))
                    close()
                  }}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  {t('header.viewAllNotifications')}
                </button>
              </div>
            </div>
          )}
        </Dropdown>

        <Dropdown
          align="right"
          panelClassName="w-60 p-0"
          trigger={(open, toggle) => (
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={toggle}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-neutral-100"
            >
              <Avatar
                src={user?.avatarUrl}
                name={displayName}
                size="sm"
              />
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-[13px] font-medium text-neutral-900">{displayName}</span>
                <span className="text-xs text-neutral-500">{roleText}</span>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-neutral-400 sm:inline" aria-hidden="true" />
            </button>
          )}
        >
          {({ close }) => (
            <div className="py-1">
              <DropdownLabel>{t('header.accountLabel')}</DropdownLabel>
              <div className="px-3 pt-1 pb-2 text-[13px] text-neutral-700">
                <p className="truncate font-medium text-neutral-900">{displayName}</p>
                <p className="truncate text-neutral-500">{user?.email}</p>
              </div>
              <DropdownDivider />
              <DropdownItem
                icon={UserIcon}
                onClick={() => {
                  navigate(profilePath)
                  close()
                }}
              >
                {t('header.profile')}
              </DropdownItem>
              {role === ROLES.EMPLOYEE && (
                <DropdownItem
                  icon={SettingsIcon}
                  onClick={() => {
                    navigate('/employee/account')
                    close()
                  }}
                >
                  {t('header.account')}
                </DropdownItem>
              )}
              <DropdownDivider />
              <DropdownItem icon={LogOut} danger onClick={handleLogout}>
                {t('header.logout')}
              </DropdownItem>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  )
}

function SearchField({ open, setOpen }) {
  const { t } = useI18n()
  return (
    <div className="hidden sm:block">
      {open ? (
        <div className="flex items-center gap-2">
          <input
            type="search"
            autoFocus
            placeholder={t('header.searchPlaceholder')}
            onBlur={() => setSearchOpen(false)}
            className="h-10 w-56 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 lg:w-72"
          />
        </div>
      ) : (
        <button
          type="button"
          aria-label={t('common.search')}
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  )
}
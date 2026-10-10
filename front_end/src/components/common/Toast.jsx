import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info as InfoIcon, X } from 'lucide-react'

import { useEscapeKey } from '../../hooks/useEscapeKey'
import { classNames } from '../../utils/format'
import { ToastContext } from './toastContext'
import { useI18n } from '../../i18n/useI18n'

const TONE = {
  success: 'border-success-500/40 bg-white',
  error:   'border-danger-500/40 bg-white',
  warning: 'border-warning-500/40 bg-white',
  info:    'border-info-500/40 bg-white',
}

const ICON = {
  success: { Icon: CheckCircle2, color: 'text-success-600' },
  error:   { Icon: XCircle,      color: 'text-danger-600' },
  warning: { Icon: AlertTriangle, color: 'text-warning-600' },
  info:    { Icon: InfoIcon,     color: 'text-info-600' },
}

let idCounter = 0

export function ToastProvider({ children, defaultDuration = 4000 }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    ({ title, description, tone = 'info', duration = defaultDuration }) => {
      idCounter += 1
      const id = idCounter
      setToasts((prev) => [...prev, { id, title, description, tone, duration }])
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss, defaultDuration],
  )

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, opts = {}) => push({ ...opts, title, tone: 'success' }),
      error:   (title, opts = {}) => push({ ...opts, title, tone: 'error' }),
      warning: (title, opts = {}) => push({ ...opts, title, tone: 'warning' }),
      info:    (title, opts = {}) => push({ ...opts, title, tone: 'info' }),
    }),
    [push, dismiss],
  )

  // Dismiss all when Escape is pressed
  useEscapeKey(() => setToasts([]), toasts.length > 0)

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 top-4 z-[1000] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }) {
  const { t } = useI18n()
  const { Icon, color } = ICON[toast.tone] ?? ICON.info
  return (
    <div
      role="status"
      className={classNames(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-modal',
        TONE[toast.tone] ?? TONE.info,
      )}
    >
      <Icon className={classNames('mt-0.5 h-5 w-5 flex-shrink-0', color)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-[13px] text-neutral-600">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label={t('common.component.closeToast')}
        onClick={onDismiss}
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useI18n } from '../../i18n/useI18n'
import { classNames } from '../../utils/format'

/**
 * Modal - controlled dialog with overlay, Escape close, body scroll lock.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - title, description: optional header texts
 * - children, footer
 * - size: 'sm' | 'md' | 'lg' | 'xl'
 */
const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  className = '',
}) {
  const { t } = useI18n()
  useEscapeKey(onClose, open)

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-[900] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[1px]"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className={classNames(
          'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-modal',
          SIZE[size] ?? SIZE.md,
          className,
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id="modal-title" className="text-base font-semibold text-neutral-900">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-[13px] text-neutral-500">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
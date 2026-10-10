import { useState } from 'react'
import { Send } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Avatar from '../common/Avatar'
import Button from '../common/Button'
import { classNames } from '../../utils/format'
import { formatDateTime } from '../../utils/format'

/**
 * SupportConversation - hiển thị thread tin nhắn + form gửi phản hồi.
 *
 * Props:
 * - messages: array
 * - currentRole: 'employee' | 'admin'
 * - currentUserId
 * - canReply: bool
 * - onReply(message): Promise<{ok}>
 * - employeeName(id)
 * - adminName(id)
 */
export default function SupportConversation({
  messages = [],
  currentRole,
  currentUserId,
  canReply = false,
  onReply,
  employeeName,
  adminName,
}) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const trimmed = text.trim()
    if (!trimmed) {
      setError(t('support.component.pleaseEnterReply'))
      return
    }
    setError(null)
    setSubmitting(true)
    const result = await onReply?.(trimmed)
    setSubmitting(false)
    if (result?.ok === false) {
      setError(result.errors?.message ?? t('support.component.cannotSendReply'))
      return
    }
    setText('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-4">
        {messages.length === 0 ? (
          <p className="text-center text-[13px] text-neutral-500">{t('support.component.noMessages')}</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId
            const role = msg.senderRole
            const name =
              role === 'admin'
                ? adminName?.(msg.senderId) ?? 'Admin'
                : employeeName?.(msg.senderId) ?? t('support.component.employee')
            return (
              <div
                key={msg.id}
                className={classNames(
                  'flex items-start gap-3',
                  isMine ? 'flex-row-reverse text-right' : 'flex-row text-left',
                )}
              >
                <Avatar
                  src={null}
                  name={name}
                  size="sm"
                  className={role === 'admin' ? 'bg-brand-50 text-brand-600' : ''}
                />
                <div
                  className={classNames(
                    'flex max-w-[80%] flex-col gap-1 rounded-lg border px-3 py-2 shadow-sm',
                    isMine
                      ? 'border-brand-200 bg-brand-50'
                      : 'border-neutral-200 bg-white',
                    role === 'admin' && !isMine ? 'border-l-4 border-l-brand-500' : '',
                  )}
                >
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="font-medium text-neutral-700">{name}</span>
                    <span
                      className={classNames(
                        'inline-flex h-[18px] items-center rounded-full px-1.5 text-[10px] font-medium',
                        role === 'admin'
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-neutral-100 text-neutral-600',
                      )}
                    >
                      {role === 'admin' ? t('support.component.admin') : t('support.component.employee')}
                    </span>
                    <span>· {formatDateTime(msg.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">{msg.message}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {canReply && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="support-reply" className="text-[13px] font-medium text-neutral-900">
            {currentRole === 'admin' ? t('support.component.sendReply') : t('support.component.replyLabel')}
          </label>
          <textarea
            id="support-reply"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('support.component.enterReply')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            disabled={submitting}
            aria-invalid={Boolean(error)}
          />
          {error && <p className="text-xs text-danger-600">{error}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Send}
              loading={submitting}
              disabled={submitting}
            >
              {currentRole === 'admin' ? t('support.component.sendReply') : t('support.component.send')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
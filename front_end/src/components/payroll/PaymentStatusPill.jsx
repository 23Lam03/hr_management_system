import { forwardRef } from 'react'
import { Check, Clock, FileEdit } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META = {
  draft:  { labelKey: 'status_draft',  tone: 'inactive', Icon: FileEdit },
  unpaid: { labelKey: 'status_unpaid', tone: 'pending',  Icon: Clock },
  paid:   { labelKey: 'status_paid',  tone: 'success',  Icon: Check },
}

const TONE_CLASS = {
  pending:  'bg-warning-50 text-warning-700 border-warning-200',
  success:  'bg-success-50 text-success-700 border-success-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const PaymentStatusPill = forwardRef(function PaymentStatusPill(
  { status = 'unpaid', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META[status] ?? META.unpaid
  const { Icon } = meta
  return (
    <span
      ref={ref}
      className={classNames(
        'inline-flex items-center gap-1.5 h-[24px] px-2 rounded-full text-xs font-medium whitespace-nowrap border',
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t(`payrollComponent.${meta.labelKey}`)}</span>
    </span>
  )
})

export default PaymentStatusPill

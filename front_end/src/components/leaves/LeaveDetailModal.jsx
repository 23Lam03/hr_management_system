import { useMemo } from 'react'
import {
  CalendarDays,
  FileText,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import Avatar from '../common/Avatar'
import LeaveStatusPill from './LeaveStatusPill'
import LeaveHistoryTimeline from './LeaveHistoryTimeline'
import { useI18n } from '../../i18n/useI18n'
import { getLeaveHistory } from '../../services/leaveService'

import { LEAVE_TYPE_LABEL } from '../../data/leaveMockData'
import { getEmployeeById } from '../../services/employeeService'
import { formatDate } from '../../utils/format'

/**
 * LeaveDetailModal - xem chi tiết đơn.
 */
export default function LeaveDetailModal({
  open,
  onClose,
  record,
  onApprove,
  onReject,
  showReviewActions = false,
}) {
  const { t } = useI18n()
  const employee = useMemo(() => (record ? getEmployeeById(record.employeeId) : null), [record])
  const history = useMemo(() => (record ? getLeaveHistory(record.id) : []), [record])

  if (!record) {
    return (
      <Modal open={open} onClose={onClose} title={t('leaves.component.notFoundTitle')} size="md">
        <p className="text-sm text-neutral-600">{t('leaves.component.notFoundDesc')}</p>
      </Modal>
    )
  }

  const reviewable = showReviewActions && record.status === 'pending'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('leaves.component.leaveDetailTitle')}
      description={t('leaves.component.leaveDetailCode', { code: record.requestCode })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('leaves.component.close')}
          </Button>
          {reviewable && (
            <>
              <Button
                variant="danger"
                onClick={() => onReject(record.id)}
              >
                {t('leaves.component.reject')}
              </Button>
              <Button onClick={() => onApprove(record.id)}>
                {t('leaves.component.approve')}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar name={employee?.fullName ?? record.employeeName} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-neutral-900">
              {employee?.fullName ?? record.employeeName}
            </h3>
            <p className="text-[13px] text-neutral-500">
              {employee?.employeeCode ?? record.employeeCode} · {record.departmentName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <LeaveStatusPill status={record.status} />
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {t('leaves.component.totalDays', { n: record.totalDays })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info icon={FileText} label={t('leaves.component.leaveType')} value={LEAVE_TYPE_LABEL[record.leaveType] ?? record.leaveType} />
          <Info icon={CalendarDays} label={t('leaves.component.startDate')} value={`${formatDate(record.startDate)} (${sessionLabel(record.startSession, t)})`} />
          <Info icon={CalendarDays} label={t('leaves.component.endDate')} value={`${formatDate(record.endDate)} (${sessionLabel(record.endSession, t)})`} />
          <Info icon={User} label={t('leaves.component.totalDays')} value={`${record.totalDays} ${t('leaves.component.daysUnit')}`} />
          <div className="sm:col-span-2">
            <Info icon={FileText} label={t('leaves.component.reason')} value={record.reason || '—'} />
          </div>
          <Info icon={Clock} label={t('leaves.component.submittedDate')} value={formatDate(record.createdAt)} />
          <Info icon={Building2} label={t('leaves.component.leaveCode')} value={record.requestCode} />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{t('leaves.component.processingHistory')}</h4>
          {record.status === 'approved' && (
            <div className="mt-2 flex items-center gap-2 text-sm text-success-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>
                {t('leaves.component.approvedBy', { name: record.approverName || '—', date: formatDate(record.reviewedAt) })}
              </span>
            </div>
          )}
          {record.status === 'rejected' && (
            <div className="mt-2 space-y-2 text-sm text-danger-700">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                <span>
                  {t('leaves.component.rejectedBy', { name: record.approverName || '—', date: formatDate(record.reviewedAt) })}
                </span>
              </div>
              {record.rejectionReason && (
                <p className="rounded-md border border-danger-200 bg-white px-3 py-2 text-[13px] text-danger-700">
                  <b>{t('leaves.component.reason')}:</b> {record.rejectionReason}
                </p>
              )}
            </div>
          )}
          {record.status === 'pending' && (
            <p className="mt-2 text-sm text-warning-700">{t('leaves.component.pendingProcessing')}</p>
          )}
          {record.status === 'cancelled' && (
            <p className="mt-2 text-sm text-neutral-500">{t('leaves.component.cancelledByUser')}</p>
          )}
        </div>

        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('leaves.component.processingHistory')}
          </h4>
          <LeaveHistoryTimeline history={history} />
        </section>
      </div>
    </Modal>
  )
}

function Info({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-neutral-900">
        {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />}
        <span className="break-words">{value}</span>
      </p>
    </div>
  )
}

function sessionLabel(s, t) {
  const labels = {
    full: t('leaves.component.fullDay'),
    morning: t('leaves.component.morning'),
    afternoon: t('leaves.component.afternoon'),
  }
  return labels[s] ?? s
}
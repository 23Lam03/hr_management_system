import Badge from '../common/Badge'
import {
  ATTENDANCE_STATUSES,
} from '../../data/attendanceMockData'
import {
  EMPLOYMENT_STATUSES,
} from '../../data/employeeMockData'
import {
  PAYMENT_STATUSES,
} from '../../data/payrollMockData'
import {
  LEAVE_STATUSES,
} from '../../data/leaveMockData'
import {
  EVALUATION_STATUSES,
} from '../../data/evaluationMockData'
import {
  TRAINING_STATUSES,
} from '../../data/trainingMockData'
import {
  BENEFIT_STATUSES,
} from '../../data/benefitMockData'
import {
  CONTRACT_STATUSES,
} from '../../data/contractMockData'

const KIND_TO_STATUSES = {
  employee:   EMPLOYMENT_STATUSES,
  attendance: ATTENDANCE_STATUSES,
  payroll:    PAYMENT_STATUSES,
  leave:      LEAVE_STATUSES,
  evaluation: EVALUATION_STATUSES,
  training:   TRAINING_STATUSES,
  benefit:    BENEFIT_STATUSES,
  contract:   CONTRACT_STATUSES,
}

export default function ReportStatusBadge({ kind, value, className = '' }) {
  const list = KIND_TO_STATUSES[kind] ?? []
  const found = list.find((s) => s.value === value)
  if (!found) return <Badge tone="neutral" className={className}>{value ?? '—'}</Badge>
  return (
    <Badge tone={found.tone} className={className}>
      {found.label}
    </Badge>
  )
}
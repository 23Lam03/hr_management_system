import { useNavigate } from 'react-router-dom'
import {
  UserPlus,
  CalendarCheck2,
  FilePlus2,
  Megaphone,
  Download,
} from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Button from '../common/Button'

/**
 * QuickActions - nhóm nút thao tác nhanh dành cho admin.
 * Mỗi nút dẫn tới route thật (không giả lập).
 */
export default function QuickActions() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="primary"
        icon={UserPlus}
        onClick={() => navigate('/admin/employees')}
      >
        {t('dashboard.component.addEmployee')}
      </Button>
      <Button
        variant="secondary"
        icon={CalendarCheck2}
        onClick={() => navigate('/admin/attendance')}
      >
        {t('dashboard.component.attendanceToday')}
      </Button>
      <Button
        variant="secondary"
        icon={FilePlus2}
        onClick={() => navigate('/admin/leave')}
      >
        {t('dashboard.component.approveLeave')}
      </Button>
      <Button
        variant="outline"
        icon={Megaphone}
        onClick={() => navigate('/admin/settings')}
      >
        {t('dashboard.component.sendNotification')}
      </Button>
      <Button
        variant="ghost"
        icon={Download}
        onClick={() => navigate('/admin/payroll')}
      >
        {t('dashboard.component.exportPayroll')}
      </Button>
    </div>
  )
}
import PageHeader from '../../components/common/PageHeader'
import PlaceholderPanel from '../../components/common/PlaceholderPanel'
import { useI18n } from '../../i18n/useI18n'
import {
  Briefcase,
  CalendarDays,
  FileText,
  Wallet,
  GraduationCap,
  Settings,
  Star,
} from 'lucide-react'

const CONFIG = {
  departments: { titleKey: 'departments', icon: Briefcase },
  attendance: { titleKey: 'attendance', icon: CalendarDays },
  leave: { titleKey: 'leaves', icon: FileText },
  payroll: { titleKey: 'payroll', icon: Wallet },
  evaluation: { titleKey: 'evaluations', icon: Star },
  training: { titleKey: 'trainings', icon: GraduationCap },
  settings: { titleKey: 'settings', icon: Settings },
}

export default function AdminPlaceholderPage({ kind }) {
  const { t } = useI18n()
  const config = CONFIG[kind] ?? { titleKey: 'placeholderPageTitle', icon: Settings }
  const title = t(`admin.${config.titleKey}`) || t('admin.placeholderPageTitle')
  const { icon: Icon } = config
  return (
    <>
      <PageHeader title={title} icon={Icon} />
      <PlaceholderPanel
        title={title}
        description={t('admin.placeholderDesc', { title })}
        icon={Icon}
      />
    </>
  )
}

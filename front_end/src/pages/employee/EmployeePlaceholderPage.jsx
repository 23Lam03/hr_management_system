import PageHeader from '../../components/common/PageHeader'
import PlaceholderPanel from '../../components/common/PlaceholderPanel'
import { User, CalendarDays, FileText, Wallet, BookOpen } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

const CONFIG = {
  profile: { titleKey: 'placeholder.profile', icon: User },
  attendance: { titleKey: 'placeholder.attendance', icon: CalendarDays },
  leave: { titleKey: 'placeholder.leave', icon: FileText },
  payroll: { titleKey: 'placeholder.payroll', icon: Wallet },
  training: { titleKey: 'placeholder.training', icon: BookOpen },
}

export default function EmployeePlaceholderPage({ kind }) {
  const { t } = useI18n()
  const { titleKey, icon } = CONFIG[kind] ?? { titleKey: 'employeePlaceholder.pageTitle', icon: User }
  const title = t(titleKey)
  return (
    <>
      <PageHeader title={title} icon={icon} />
      <PlaceholderPanel
        title={title}
        description={t('employeePlaceholder.pageDesc', { n: title })}
        icon={icon}
      />
    </>
  )
}

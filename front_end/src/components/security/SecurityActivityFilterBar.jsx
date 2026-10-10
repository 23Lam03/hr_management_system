import { Search, X } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'

const TYPE_OPTIONS = [
  { value: '',                         label: 'Tất cả hoạt động' },
  { value: 'login',                    label: 'Đăng nhập' },
  { value: 'logout',                   label: 'Đăng xuất' },
  { value: 'password_change',          label: 'Thay đổi mật khẩu' },
  { value: 'security_setting_update',  label: 'Thay đổi thiết lập bảo mật' },
  { value: 'account_lock',             label: 'Khóa tài khoản' },
  { value: 'account_unlock',           label: 'Mở khóa tài khoản' },
]

const STATUS_OPTIONS = [
  { value: '',        label: 'Tất cả trạng thái' },
  { value: 'success', label: 'Thành công' },
  { value: 'failed',  label: 'Thất bại' },
]

/**
 * SecurityActivityFilterBar - search + filter cho activity log.
 */
export default function SecurityActivityFilterBar({
  search = '',
  type = '',
  status = '',
  onChange,
  onReset,
  className = '',
}) {
  const { t } = useI18n()
  const handleFilter = (field) => (value) => onChange?.({ [field]: value })

  const hasFilter = Boolean(search) || Boolean(type) || Boolean(status)

  return (
    <div
      className={classNames(
        'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-7">
          <Input
            placeholder={t('security.component.searchActivity')}
            value={search}
            onChange={(e) => handleFilter('search')(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="md:col-span-3">
          <Select
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => handleFilter('type')(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => handleFilter('status')(e.target.value)}
          />
        </div>
      </div>

      {hasFilter && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" icon={X} onClick={onReset}>
            {t('security.component.resetFilters')}
          </Button>
        </div>
      )}
    </div>
  )
}

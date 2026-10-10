import { Search, X } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'

const STATUS_OPTIONS = [
  { value: '',                      label: 'Tất cả trạng thái' },
  { value: 'open',                  label: 'Mới' },
  { value: 'in_progress',           label: 'Đang xử lý' },
  { value: 'waiting_for_employee',   label: 'Chờ nhân viên phản hồi' },
  { value: 'resolved',              label: 'Đã giải quyết' },
  { value: 'closed',               label: 'Đã đóng' },
  { value: 'cancelled',           label: 'Đã hủy' },
]

const CATEGORY_OPTIONS = [
  { value: '',           label: 'Tất cả loại' },
  { value: 'account',    label: 'Tài khoản' },
  { value: 'attendance', label: 'Chấm công' },
  { value: 'leave',      label: 'Nghỉ phép' },
  { value: 'payroll',   label: 'Bảng lương' },
  { value: 'benefit',   label: 'Phúc lợi' },
  { value: 'contract',   label: 'Hợp đồng' },
  { value: 'training',   label: 'Đào tạo' },
  { value: 'evaluation', label: 'Đánh giá' },
  { value: 'technical',  label: 'Kỹ thuật' },
  { value: 'other',      label: 'Khác' },
]

const PRIORITY_OPTIONS = [
  { value: '',       label: 'Tất cả mức độ' },
  { value: 'low',   label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high',   label: 'Cao' },
]

/**
 * SupportFilterBar - bộ lọc cho Admin / Employee Support.
 */
export default function SupportFilterBar({
  search = '',
  status = '',
  category = '',
  priority = '',
  showPriority = false,
  onChange,
  onReset,
  className = '',
}) {
  const { t } = useI18n()
  const handleFilter = (field) => (value) => onChange?.({ [field]: value })

  const hasFilter =
    Boolean(search) ||
    Boolean(status) ||
    Boolean(category) ||
    Boolean(priority)

  return (
    <div
      className={classNames(
        'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-5">
          <Input
            placeholder={t('support.component.searchRequest')}
            value={search}
            onChange={(e) => handleFilter('search')(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className={classNames(showPriority ? 'md:col-span-3' : 'md:col-span-4')}>
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => handleFilter('status')(e.target.value)}
          />
        </div>
        <div className={classNames(showPriority ? 'md:col-span-2' : 'md:col-span-3')}>
          <Select
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => handleFilter('category')(e.target.value)}
          />
        </div>
        {showPriority && (
          <div className="md:col-span-2">
            <Select
              options={PRIORITY_OPTIONS}
              value={priority}
              onChange={(e) => handleFilter('priority')(e.target.value)}
            />
          </div>
        )}
      </div>

      {hasFilter && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" icon={X} onClick={onReset}>
            {t('support.component.resetFilters')}
          </Button>
        </div>
      )}
    </div>
  )
}
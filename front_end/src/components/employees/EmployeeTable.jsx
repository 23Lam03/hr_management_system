import {
  ChevronDown,
  Eye,
  Pencil,
} from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Avatar from '../common/Avatar'
import Button from '../common/Button'
import Dropdown, { DropdownItem, DropdownDivider, DropdownLabel } from '../common/Dropdown'

import SortableTh from './SortableTh'
import StatusPill from './StatusPill'
import { formatDate } from '../../utils/format'

/**
 * EmployeeTable - bảng nhân viên với sort + actions.
 */
export default function EmployeeTable({
  rows,
  loading,
  sortBy,
  sortDir,
  onSort,
  onView,
  onEdit,
  onChangeStatus,
  currentUserId,
}) {
  const { t } = useI18n()
  const columns = [
    {
      key: 'fullName',
      header: t('employees.component.name'),
      render: (row) => (
        <div className="flex min-w-[200px] items-center gap-3">
          <Avatar name={row.fullName} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-neutral-900">{row.fullName}</div>
            <div className="truncate text-xs text-neutral-500">{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'employeeCode', header: t('employees.component.employeeId') },
    { key: '_dept', header: t('employees.component.department'),
      render: (row) => row.departmentName,
    },
    { key: 'position', header: t('employees.component.position'),
      render: (row) => (
        <span className="text-sm text-neutral-700">{row.position}</span>
      ),
    },
    { key: 'employmentTypeLabel', header: t('employees.component.employmentType') },
    {
      key: 'hireDate',
      header: t('employees.component.hireDateCol'),
      align: 'right',
      render: (row) => formatDate(row.hireDate),
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'center',
      render: (row) => <StatusPill status={row.status} />,
    },
  ]

  const sortableKeys = {
    fullName: t('employees.component.name'),
    employeeCode: t('employees.component.employeeId'),
    departmentName: t('employees.component.department'),
    hireDate: t('employees.component.hireDateCol'),
  }

  // Tạo header riêng cho SortableTh nằm ngoài Table. Table chỉ nhận columns
  // thẳng; ta sẽ inject một `header` node cho 4 cột đầu sort được.
  const sortableColumns = ['fullName', 'employeeCode', 'departmentName', 'hireDate']
  const columnsWithSort = columns.map((c) => {
    if (!sortableColumns.includes(c.key)) return c
    return {
      ...c,
      header: (
        <SortableTh
          field={c.key}
          currentField={sortBy}
          currentDir={sortDir}
          onSort={onSort}
          align={c.align || 'left'}
        >
          {sortableKeys[c.key]}
        </SortableTh>
      ),
    }
  })

  // Bỏ header bị ghi đè kiểu string, giữ nguyên phần render nội dung
  // vì SortableTh render một <th> ngoài rồi - nên ta không dùng Table, mà
  // build bảng thủ công dưới đây.
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            {columnsWithSort.map((col, idx) => (
              col.key === 'fullName' || col.key === 'employeeCode' || col.key === 'departmentName' || col.key === 'hireDate' ? (
                <SortableTh
                  key={col.key}
                  field={col.key}
                  currentField={sortBy}
                  currentDir={sortDir}
                  onSort={onSort}
                  align={col.align || 'left'}
                >
                  {sortableKeys[col.key]}
                </SortableTh>
              ) : (
                <th
                  key={col.key || idx}
                  style={{ textAlign: col.align || 'left' }}
                  className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap"
                >
                  {col.header}
                </th>
              )
            ))}
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">
              {t('employees.component.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columnsWithSort.length + 1} className="px-4 py-10 text-center text-sm text-neutral-500">
                {t('common.component.loading')}
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columnsWithSort.length + 1} className="px-4 py-10 text-center text-sm text-neutral-500">
                {t('employees.component.noMatchingEmployees')}
              </td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              {columnsWithSort.map((col) => (
                <td
                  key={col.key}
                  style={{ textAlign: col.align || 'left' }}
                  className="border-b border-neutral-200 px-4 py-3 align-middle last:border-b group-hover:bg-neutral-50"
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              <td className="border-b border-neutral-200 px-4 py-2 text-right">
                  <Dropdown
                      align="right"
                      trigger={
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={ChevronDown}
                          iconPosition="right"
                        >
                          {t('employees.component.actions')}
                        </Button>
                      }
                    >
                      <DropdownItem icon={Eye} onClick={() => onView(row.id)}>
                        {t('employees.component.viewDetail')}
                      </DropdownItem>
                      <DropdownItem icon={Pencil} onClick={() => onEdit(row.id)}>
                        {t('employees.component.edit')}
                      </DropdownItem>
                      <DropdownDivider />
                      <DropdownLabel>{t('employees.component.changeStatus')}</DropdownLabel>
                      <DropdownItem
                        onClick={() => onChangeStatus(row.id, 'active')}
                        disabled={row.status === 'active'}
                        className={row.status === 'active' ? 'opacity-50 pointer-events-none' : ''}
                      >
                        {t('employees.component.working')}
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => onChangeStatus(row.id, 'on_leave')}
                        disabled={row.status === 'on_leave'}
                        className={row.status === 'on_leave' ? 'opacity-50 pointer-events-none' : ''}
                      >
                        {t('employees.component.onLeave')}
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => onChangeStatus(row.id, 'inactive')}
                        disabled={row.status === 'inactive' || row.id === currentUserId}
                        className={(row.status === 'inactive' || row.id === currentUserId) ? 'opacity-50 pointer-events-none text-neutral-400' : 'text-danger-600'}
                      >
                        {t('employees.component.inactive')}
                      </DropdownItem>
                  </Dropdown>
                </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
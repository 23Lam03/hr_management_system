import { useState } from 'react'
import {
  Mail,
  Lock,
  User,
  MoreHorizontal,
  Edit3,
  Trash2,
  Plus,
  Download,
  Save,
  Send,
} from 'lucide-react'

import { useI18n } from '../../i18n/useI18n'
import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Badge from '../../components/common/Badge'
import Avatar from '../../components/common/Avatar'
import Dropdown, {
  DropdownItem,
  DropdownDivider,
  DropdownLabel,
  DropdownTrigger,
} from '../../components/common/Dropdown'
import Modal from '../../components/common/Modal'
import Table from '../../components/common/Table'
import Loading from '../../components/common/Loading'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'

const SAMPLE = [
  { id: 1, name: 'Nguyễn Minh Anh', email: 'minhanh@company.vn', dept: 'Kỹ thuật', status: 'active' },
  { id: 2, name: 'Trần Quốc Bảo',     email: 'quocbao@company.vn', dept: 'Nhân sự',  status: 'pending' },
  { id: 3, name: 'Lê Hoàng Phương',   email: 'hoangphuong@company.vn', dept: 'Marketing', status: 'inactive' },
  { id: 4, name: 'Phan Thanh Tùng',   email: 'thanhtung@company.vn', dept: 'Tài chính', status: 'active' },
  { id: 5, name: 'Đỗ Khánh Linh',     email: 'khanhlinh@company.vn', dept: 'Kỹ thuật',  status: 'approved' },
  { id: 6, name: 'Ngô Hải Đăng',      email: 'haidang@company.vn',   dept: 'Kinh doanh', status: 'rejected' },
  { id: 7, name: 'Vũ Kim Anh',        email: 'kimanh@company.vn',    dept: 'CSKH',       status: 'active' },
  { id: 8, name: 'Bùi Đức Thành',     email: 'ducthanh@company.vn',  dept: 'Kỹ thuật',   status: 'warning' },
]

const STATUS_TONE = {
  active: 'active',
  inactive: 'inactive',
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  warning: 'warning',
}

const STATUS_LABEL_KEYS = {
  active:   'shared.uiDemo.active',
  inactive: 'shared.uiDemo.inactive',
  pending:  'shared.uiDemo.pending',
  approved: 'shared.uiDemo.approved',
  rejected: 'shared.uiDemo.rejected',
  warning:  'shared.uiDemo.warning',
}

export default function UIDemoPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [page2, setPage2] = useState(1)
  const [tableLoading, setTableLoading] = useState(false)

  const columns = [
    {
      key: 'name',
      header: t('common.component.employee'),
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-neutral-900">{row.name}</div>
            <div className="truncate text-xs text-neutral-500">{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'dept', header: t('common.component.department') },
    {
      key: 'status',
      header: t('common.component.status'),
      align: 'center',
      render: (row) => <Badge tone={STATUS_TONE[row.status]}>{t(STATUS_LABEL_KEYS[row.status])}</Badge>,
    },
  ]

  const triggerLoading = () => {
    setTableLoading(true)
    window.setTimeout(() => setTableLoading(false), 1200)
  }

  return (
    <>
      <PageHeader
        title={t('shared.uiDemo.pageTitle')}
        description={t('shared.uiDemo.pageSubtitle')}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Buttons */}
        <Card title={t('shared.uiDemo.button')} subtitle={t('shared.uiDemo.buttonSubtitle')}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={Plus}>{t('shared.uiDemo.addNew')}</Button>
            <Button variant="secondary" icon={Download}>{t('shared.uiDemo.download')}</Button>
            <Button variant="outline" icon={Edit3}>{t('shared.uiDemo.edit')}</Button>
            <Button variant="ghost">{t('shared.uiDemo.ghost')}</Button>
            <Button variant="danger" icon={Trash2}>{t('shared.uiDemo.delete')}</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm">{t('shared.uiDemo.small')}</Button>
            <Button size="md">{t('shared.uiDemo.medium')}</Button>
            <Button size="lg">{t('shared.uiDemo.large')}</Button>
            <Button loading>{t('shared.uiDemo.saving')}</Button>
            <Button disabled>{t('shared.uiDemo.disabled')}</Button>
          </div>
        </Card>

        {/* Input + Select */}
        <Card title={t('shared.uiDemo.inputSelect')} subtitle={t('shared.uiDemo.inputSelectSubtitle')}>
          <form
            className="grid grid-cols-1 gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              toast.success(t('shared.uiDemo.savedSuccess'), { description: t('shared.uiDemo.recordUpdated') })
            }}
          >
            <Input
              label={t('shared.uiDemo.fullNameLabel')}
              placeholder={t('shared.uiDemo.fullNamePlaceholder')}
              leftIcon={User}
              required
            />
            <Input
              label={t('shared.uiDemo.emailLabel')}
              type="email"
              placeholder={t('shared.uiDemo.emailPlaceholder')}
              leftIcon={Mail}
              helper={t('shared.uiDemo.emailHelper')}
            />
            <Input
              label={t('shared.uiDemo.passwordLabel')}
              type="password"
              placeholder={t('shared.uiDemo.passwordPlaceholder')}
              leftIcon={Lock}
              error={t('shared.uiDemo.passwordError')}
            />
            <Select
              label={t('shared.uiDemo.departmentLabel')}
              placeholder={t('shared.uiDemo.departmentPlaceholder')}
              options={[
                t('shared.uiDemo.deptKythuat'),
                t('shared.uiDemo.deptNhansu'),
                t('shared.uiDemo.deptMarketing'),
                t('shared.uiDemo.deptTaichinh'),
              ]}
              required
            />
            <div>
              <Button type="submit" icon={Save}>{t('shared.uiDemo.saveForm')}</Button>
            </div>
          </form>
        </Card>

        {/* Badge */}
        <Card title={t('shared.uiDemo.badge')} subtitle={t('shared.uiDemo.badgeSubtitle')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="active">{t('shared.uiDemo.active')}</Badge>
            <Badge tone="inactive">{t('shared.uiDemo.inactive')}</Badge>
            <Badge tone="pending">{t('shared.uiDemo.pending')}</Badge>
            <Badge tone="approved">{t('shared.uiDemo.approved')}</Badge>
            <Badge tone="rejected">{t('shared.uiDemo.rejected')}</Badge>
            <Badge tone="warning">{t('shared.uiDemo.warning')}</Badge>
            <Badge tone="neutral">{t('shared.uiDemo.neutral')}</Badge>
            <Badge tone="primary">{t('shared.uiDemo.primary')}</Badge>
            <Badge tone="info">{t('shared.uiDemo.info')}</Badge>
          </div>
        </Card>

        {/* Avatar */}
        <Card title={t('shared.uiDemo.avatar')} subtitle={t('shared.uiDemo.avatarSubtitle')}>
          <div className="flex flex-wrap items-end gap-4">
            <Avatar name="Nguyễn Minh Anh" size="xs" />
            <Avatar name="Trần Quốc Bảo" size="sm" />
            <Avatar name="Lê Hoàng Phương" size="md" />
            <Avatar name="Phan Thanh Tùng" size="lg" />
            <Avatar name="Đỗ Khánh Linh" size="xl" />
            <Avatar
              src="https://i.pravatar.cc/120?img=11"
              alt={t('shared.uiDemo.avatarFromUrl')}
              size="lg"
            />
          </div>
        </Card>

        {/* Dropdown */}
        <Card title={t('shared.uiDemo.dropdown')} subtitle={t('shared.uiDemo.dropdownSubtitle')}>
          <div className="flex flex-wrap gap-2">
            <Dropdown
              align="left"
              trigger={(open, toggle) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  {t('shared.uiDemo.action')}
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              )}
            >
              <DropdownItem icon={Edit3}>{t('shared.uiDemo.edit')}</DropdownItem>
              <DropdownItem icon={Download}>{t('shared.uiDemo.download')}</DropdownItem>
              <DropdownDivider />
              <DropdownItem icon={Trash2} danger>{t('shared.uiDemo.delete')}</DropdownItem>
            </Dropdown>

            <Dropdown
              align="left"
              trigger={<DropdownTrigger icon={User} label={t('shared.uiDemo.account')} />}
            >
              {({ close }) => (
                <>
                  <DropdownLabel>{t('shared.uiDemo.options')}</DropdownLabel>
                  <DropdownItem icon={Edit3} onClick={close}>{t('shared.uiDemo.edit2')}</DropdownItem>
                  <DropdownItem icon={User} onClick={close}>{t('shared.uiDemo.viewDetail')}</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem icon={Trash2} danger onClick={close}>{t('shared.uiDemo.deleteItem')}</DropdownItem>
                </>
              )}
            </Dropdown>
          </div>
        </Card>

        {/* Modal */}
        <Card title={t('shared.uiDemo.modal')} subtitle={t('shared.uiDemo.modalSubtitle')}>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setModalOpen(true)}>{t('shared.uiDemo.openModal')}</Button>
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              {t('shared.uiDemo.confirmModal')}
            </Button>
          </div>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={t('shared.uiDemo.createEmployee')}
            description={t('shared.uiDemo.createEmployeeDesc')}
            size="lg"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('shared.uiDemo.cancel')}</Button>
                <Button
                  icon={Send}
                  onClick={() => {
                    setModalOpen(false)
                    toast.success(t('shared.uiDemo.sendRequest'))
                  }}
                >
                  {t('shared.uiDemo.send')}
                </Button>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={t('shared.uiDemo.fullNameLabel')} placeholder={t('shared.uiDemo.fullNamePlaceholder')} required />
              <Input label={t('shared.uiDemo.emailLabel')} type="email" placeholder={t('shared.uiDemo.emailPlaceholder')} leftIcon={Mail} />
              <Select
                label={t('shared.uiDemo.departmentLabel')}
                options={[
                  t('shared.uiDemo.deptKythuat'),
                  t('shared.uiDemo.deptNhansu'),
                  t('shared.uiDemo.deptMarketing'),
                  t('shared.uiDemo.deptTaichinh'),
                ]}
                placeholder={t('shared.uiDemo.departmentPlaceholder')}
              />
              <Select
                label={t('shared.uiDemo.roleLabel')}
                options={[
                  { value: 'admin', label: t('shared.uiDemo.adminRole') },
                  { value: 'manager', label: t('shared.uiDemo.managerRole') },
                  { value: 'staff', label: t('shared.uiDemo.staffRole') },
                ]}
              />
            </div>
          </Modal>

          <Modal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={t('shared.uiDemo.confirmDelete')}
            description={t('shared.uiDemo.confirmDeleteDesc')}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmOpen(false)}>{t('shared.uiDemo.cancel')}</Button>
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => {
                    setConfirmOpen(false)
                    toast.warning(t('shared.uiDemo.deleteRecord'))
                  }}
                >
                  {t('shared.uiDemo.deleteConfirm')}
                </Button>
              </>
            }
          >
            <p className="text-sm text-neutral-700">
              {t('shared.uiDemo.deleteConfirmDesc')}
            </p>
          </Modal>
        </Card>

        {/* Toast */}
        <Card title={t('shared.uiDemo.toast')} subtitle={t('shared.uiDemo.toastSubtitle')}>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => toast.success(t('shared.uiDemo.savedSuccess'), { description: t('shared.uiDemo.recordUpdated') })}
            >
              Success
            </Button>
            <Button
              variant="danger"
              onClick={() => toast.error(t('shared.uiDemo.errorOccurred'), { description: t('shared.uiDemo.tryAgain') })}
            >
              Error
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.warning(t('shared.uiDemo.warning'), { description: t('shared.uiDemo.contractExpiring') })}
            >
              Warning
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.info(t('shared.uiDemo.infoTitle'), { description: t('shared.uiDemo.newUpdateAvailable') })}
            >
              Info
            </Button>
          </div>
        </Card>

        {/* Loading */}
        <Card title={t('shared.uiDemo.loading')} subtitle={t('shared.uiDemo.loadingSubtitle')}>
          <div className="flex items-center gap-6">
            <Loading size="sm" />
            <Loading size="md" label={t('common.loading')} />
            <Loading size="lg" label={t('shared.uiDemo.processing')} />
          </div>
        </Card>

        {/* EmptyState */}
        <Card title={t('shared.uiDemo.emptyState')} subtitle={t('shared.uiDemo.emptyStateSubtitle')}>
          <EmptyState
            title={t('shared.uiDemo.noEmployees')}
            description={t('shared.uiDemo.firstEmployee')}
            actionLabel={t('shared.uiDemo.addEmployee')}
            onAction={() => toast.info(t('shared.uiDemo.openFormDemo'))}
          />
        </Card>

        {/* Table */}
        <Card
          title={t('shared.uiDemo.table')}
          subtitle={t('shared.uiDemo.tableSubtitle')}
          className="xl:col-span-2"
          padding={false}
        >
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={triggerLoading}>{t('shared.uiDemo.testLoading')}</Button>
              <span className="text-xs text-neutral-500">
                {t('shared.uiDemo.total')} <b className="text-neutral-900">{SAMPLE.length}</b> {t('shared.uiDemo.records')} · {t('shared.uiDemo.page')}{' '}
                <b className="text-neutral-900">{page2}</b> {t('shared.uiDemo.of')} 2
              </span>
            </div>

            <Table
              columns={columns}
              data={SAMPLE}
              rowKey="id"
              loading={tableLoading}
              pagination={{
                page: page2,
                pageSize: 5,
                total: SAMPLE.length,
                onChange: setPage2,
              }}
              actions={() => (
                <Dropdown
                  align="right"
                  trigger={(open, toggle) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                >
                  <DropdownItem icon={Edit3}>{t('shared.uiDemo.editItem')}</DropdownItem>
                  <DropdownItem icon={Download}>{t('shared.uiDemo.exportItem')}</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem icon={Trash2} danger>{t('shared.uiDemo.deleteItem')}</DropdownItem>
                </Dropdown>
              )}
            />
          </div>
        </Card>
      </div>
    </>
  )
}

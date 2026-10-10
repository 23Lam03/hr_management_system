/* eslint-disable react-hooks/exhaustive-deps, react/preserve-manual-memoization */
import { useEffect, useMemo, useState } from 'react'
import { Edit3, RotateCcw, Save, ShieldAlert, X } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Avatar from '../../components/common/Avatar'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import Loading from '../../components/common/Loading'
import { useToast } from '../../components/common/useToast'

import { useAuth } from '../../contexts/useAuth'

import {
  EMPLOYMENT_STATUS_LABEL,
  EMPLOYMENT_TYPE_LABEL,
} from '../../data/employeeMockData'

import {
  getEmployeeById,
  updateEmployeeProfile,
  subscribeEmployees,
  getDepartments,
  getGenders,
} from '../../services/employeeService'

import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * EmployeeProfilePage - Employee xem + sửa hồ sơ cá nhân.
 *
 * Không tự ý thêm business rule.
 * Chỉ cho phép chỉnh sửa các trường personal/contact.
 */
export default function EmployeeProfilePage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user, updateUser } = useAuth()

  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [bumpedProfile, setBumpedProfile] = useState(null) // for forcing re-derive after edit

  const currentEmployeeId = useMemo(() => {
    if (!user) return null
    return user.employeeId ?? user.id
  }, [user])

  useEffect(() => {
    const unsub = subscribeEmployees(() => setVersion((v) => v + 1))
    return () => unsub()
  }, [])

  const loadedProfile = useMemo(() => {
    if (bumpedProfile) return bumpedProfile
    if (!currentEmployeeId) return null
    return getEmployeeById(currentEmployeeId) ?? null
  }, [currentEmployeeId, version, bumpedProfile])

  const notFound = !loadedProfile

  // bắt đầu edit
  const enterEdit = () => {
    if (!loadedProfile) return
    setForm({
      fullName: loadedProfile.fullName ?? '',
      phone: loadedProfile.phone ?? '',
      address: loadedProfile.address ?? '',
      gender: loadedProfile.gender ?? '',
      dateOfBirth: loadedProfile.dateOfBirth ?? '',
      avatar: loadedProfile.avatar ?? null,
    })
    setErrors({})
    setEditing(true)
  }

  const handleCancelClick = () => {
    if (!isDirty) {
      cancelEdit()
      return
    }
    setConfirmDiscard(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm(null)
    setErrors({})
    setConfirmDiscard(false)
  }

  const isDirty = useMemo(() => {
    if (!editing || !form || !loadedProfile) return false
    return (
      form.fullName !== (loadedProfile.fullName ?? '') ||
      form.phone !== (loadedProfile.phone ?? '') ||
      form.address !== (loadedProfile.address ?? '') ||
      form.gender !== (loadedProfile.gender ?? '') ||
      form.dateOfBirth !== (loadedProfile.dateOfBirth ?? '') ||
      form.avatar !== (loadedProfile.avatar ?? null)
    )
  }, [editing, form, loadedProfile])

  const updateFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form || !currentEmployeeId) return
    const result = await updateEmployeeProfile(currentEmployeeId, form)
    if (result.ok) {
      setBumpedProfile(result.employee)
      setEditing(false)
      setForm(null)
      // đồng bộ currentUser (name, phone, avatar) cho Header/Dashboard
      updateUser?.({
        name: result.employee.fullName,
        avatarUrl: result.employee.avatar ?? null,
      })
      toast.success(t('employeeProfile.profileUpdated'))
    } else {
      if (result.errors?._form) {
        toast.error(result.errors._form)
      } else {
        toast.error(t('employeeProfile.cannotUpdateProfile'))
      }
      setErrors(result.errors ?? {})
    }
  }

  const handleSaveLoading = async () => {
    setSaving(true)
    try {
      await handleSave()
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('employeeProfile.loading')} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t('employeeProfile.myProfile')}
          subtitle={t('employeeProfile.profileDesc')}
          icon={Edit3}
        />
        <EmptyState
          icon={ShieldAlert}
          title={t('employeeProfile.profileNotFound')}
          description={t('employeeProfile.profileNotFoundDesc')}
          actionLabel={t('employeeProfile.tryAgain')}
          onAction={() => setVersion((v) => v + 1)}
        />
      </div>
    )
  }

  if (!loadedProfile) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('employeeProfile.loadingProfile')} />
      </div>
    )
  }

  // bind sau khi đã check null/loaded → dùng const local
  const profile = loadedProfile
  const departments = getDepartments()
  const departmentName = departments.find((d) => d.id === profile.departmentId)?.name ?? '—'
  const statusLabel = EMPLOYMENT_STATUS_LABEL[profile.status] ?? profile.status
  const employmentLabel = EMPLOYMENT_TYPE_LABEL[profile.employmentType] ?? profile.employmentType

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('employeeProfile.myProfile')}
        subtitle={t('employeeProfile.profileDesc')}
        icon={Edit3}
        actions={
          editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="md"
                icon={X}
                onClick={handleCancelClick}
                disabled={saving}
              >
                {t('employeeProfile.cancel')}
              </Button>
              <Button
                variant="ghost"
                size="md"
                icon={RotateCcw}
                onClick={() => setForm({
                  fullName: profile.fullName ?? '',
                  phone: profile.phone ?? '',
                  address: profile.address ?? '',
                  gender: profile.gender ?? '',
                  dateOfBirth: profile.dateOfBirth ?? '',
                  avatar: profile.avatar ?? null,
                })}
                disabled={saving}
              >
                {t('employeeProfile.reset')}
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={Save}
                onClick={handleSaveLoading}
                loading={saving}
                disabled={!isDirty}
              >
                {t('employeeProfile.saveChanges')}
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="md"
              icon={Edit3}
              onClick={enterEdit}
            >
              {t('employeeProfile.editProfile')}
            </Button>
          )
        }
      />

      {editing && isDirty && (
        <div
          className="flex items-center gap-2 rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-[13px] text-warning-700"
          role="status"
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <span>{t('employeeProfile.unsavedChanges')}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <Avatar
            src={editing ? (form?.avatar ?? null) : (profile.avatar ?? null)}
            alt={profile.fullName}
            name={editing ? (form?.fullName ?? profile.fullName) : profile.fullName}
            size="xl"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold text-neutral-900">{profile.fullName}</h2>
            <p className="text-[13px] text-neutral-500">
              {profile.employeeCode ? `${profile.employeeCode} · ` : ''}{profile.id}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[13px] sm:justify-start">
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700">
                {profile.position}
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700">
                {departmentName}
              </span>
              <span className="rounded-md bg-success-50 px-2 py-0.5 text-success-700">
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Personal Information */}
      <Card title={t('employeeProfile.personalInfo')} subtitle={t('employeeProfile.personalInfoDesc')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {editing ? (
            <Input
              label={t('employeeProfile.fullName')}
              required
              value={form?.fullName ?? ''}
              onChange={(e) => updateFormField('fullName', e.target.value)}
              error={errors.fullName}
            />
          ) : (
            <ReadonlyField label={t('employeeProfile.fullName')} value={profile.fullName} />
          )}

          {editing ? (
            <Input
              label={t('employeeProfile.dateOfBirth')}
              type="date"
              value={form?.dateOfBirth ?? ''}
              onChange={(e) => updateFormField('dateOfBirth', e.target.value)}
            />
          ) : (
            <ReadonlyField label={t('employeeProfile.dateOfBirth')} value={profile.dateOfBirth ? formatDate(profile.dateOfBirth) : t('employeeProfile.notProvided')} />
          )}

          {editing ? (
            <Select
              label={t('employeeProfile.gender')}
              options={getGenders()}
              value={form?.gender ?? ''}
              onChange={(e) => updateFormField('gender', e.target.value)}
            />
          ) : (
            <ReadonlyField
              label={t('employeeProfile.gender')}
              value={profile.gender
                ? (getGenders().find((g) => g.value === profile.gender)?.label ?? profile.gender)
                : t('employeeProfile.notProvided')}
            />
          )}
        </div>
      </Card>

      {/* Contact Information */}
      <Card title={t('employeeProfile.contactInfo')} subtitle={t('employeeProfile.contactInfoDesc')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ReadonlyField
            label="Email"
            value={profile.email}
            note={t('employeeProfile.emailIsAccount')}
          />
          {editing ? (
            <Input
              label={t('employeeProfile.phone')}
              value={form?.phone ?? ''}
              onChange={(e) => updateFormField('phone', e.target.value)}
              error={errors.phone}
              placeholder="VD: 0901 234 567"
            />
          ) : (
            <ReadonlyField label={t('employeeProfile.phone')} value={profile.phone || t('employeeProfile.notProvided')} />
          )}
          {editing ? (
            <div className="md:col-span-2">
              <Input
                label={t('employeeProfile.address')}
                value={form?.address ?? ''}
                onChange={(e) => updateFormField('address', e.target.value)}
                placeholder={t('employeeProfile.addressPlaceholder')}
              />
            </div>
          ) : (
            <ReadonlyField
              className="md:col-span-2"
              label={t('employeeProfile.address')}
              value={profile.address || t('employeeProfile.notProvided')}
            />
          )}
        </div>
      </Card>

      {/* Work Information */}
      <Card title={t('employeeProfile.workInfo')} subtitle={t('employeeProfile.workInfoDesc')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ReadonlyField label={t('employeeProfile.employeeId')} value={profile.employeeCode ?? profile.id} />
          <ReadonlyField label={t('employeeProfile.department')} value={departmentName} />
          <ReadonlyField label={t('employeeProfile.position')} value={profile.position || '—'} />
          <ReadonlyField label={t('employeeProfile.employmentType')} value={employmentLabel} />
          <ReadonlyField label={t('employeeProfile.hireDate')} value={profile.hireDate ? formatDate(profile.hireDate) : '—'} />
          <ReadonlyField label={t('employeeProfile.status')} value={statusLabel} />
          <ReadonlyField label={t('employeeProfile.manager')} value={profile.managerName ?? '—'} />
        </div>
      </Card>

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t('employeeProfile.discardChangesTitle')}
        description={t('employeeProfile.discardChangesDesc')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              {t('employeeProfile.continueEditing')}
            </Button>
            <Button variant="danger" onClick={cancelEdit}>
              {t('employeeProfile.discardChangesAction')}
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  )
}

function ReadonlyField({ label, value, note, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-neutral-900">{label}</span>
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
        {value || '—'}
      </div>
      {note && <p className="text-xs text-neutral-500">{note}</p>}
    </div>
  )
}
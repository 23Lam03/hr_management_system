import { useMemo, useState } from 'react'
import { Users, Plus, Minus } from 'lucide-react'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import Avatar from '../common/Avatar'
import { useI18n } from '../../i18n/useI18n'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function AssignBenefitModal({
  open,
  onClose,
  benefit,
  candidates = [],
  existingAssigneeIds = [],
  onSubmit,
  submitting = false,
}) {
  const { t } = useI18n()
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [startDate, setStartDate] = useState(() => todayIso())
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')

  const filtered = useMemo(() => {
    let rows = candidates.filter((c) => !existingAssigneeIds.includes(c.id))
    if (departmentId) rows = rows.filter((c) => c.departmentId === departmentId)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      rows = rows.filter(
        (c) =>
          (c.fullName || '').toLowerCase().includes(s) ||
          (c.employeeCode || '').toLowerCase().includes(s),
      )
    }
    return rows
  }, [candidates, departmentId, search, existingAssigneeIds])

  const departments = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const c of candidates) {
      if (!seen.has(c.departmentId)) {
        seen.add(c.departmentId)
        out.push({ id: c.departmentId, name: c.departmentName })
      }
    }
    return out
  }, [candidates])

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (selected.length === 0) return
    onSubmit({
      employeeIds: selected,
      startDate,
      endDate: endDate || null,
      note,
    })
  }

  if (!benefit) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('benefitsComponent.assignBenefit')}
      description={benefit.name}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label={t('benefitsComponent.startDateLabel')}
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label={t('benefitsComponent.endDateLabel')}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            helper={t('benefitsComponent.endDateHelper')}
          />
          <Input
            label={t('benefitsComponent.noteLabel')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('benefitsComponent.notePlaceholder')}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex-1 min-w-0">
              <Input
                label={t('benefitsComponent.searchEmployee')}
                placeholder={t('benefitsComponent.searchEmployeePlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              label={t('benefitsComponent.department')}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              options={[
                { value: '', label: t('benefitsComponent.allDepartments') },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
          <p className="text-xs text-neutral-500">
            {t('benefitsComponent.selectedCount', { n: selected.length, m: filtered.length })}
          </p>
          <div className="max-h-72 overflow-y-auto rounded border border-neutral-200 bg-white">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-neutral-500">
                {t('benefitsComponent.noCandidates')}
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {filtered.map((c) => (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-neutral-50 ${selected.includes(c.id) ? 'bg-brand-50' : ''}`}
                    onClick={() => toggle(c.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={c.fullName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">{c.fullName}</p>
                        <p className="text-[12px] text-neutral-500">{c.employeeCode} · {c.departmentName}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${selected.includes(c.id) ? 'bg-brand-600 text-white' : 'border border-neutral-200 text-neutral-600'}`}
                      aria-label={selected.includes(c.id) ? t('benefitsComponent.deselect') : t('benefitsComponent.select')}
                    >
                      {selected.includes(c.id) ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('benefitsComponent.close')}</Button>
          <Button type="submit" icon={Users} loading={submitting} disabled={selected.length === 0}>
            {t('benefitsComponent.assignCount', { n: selected.length })}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

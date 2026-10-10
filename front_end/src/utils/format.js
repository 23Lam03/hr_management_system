/**
 * Small utility helpers.
 */

export function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

export function formatCurrencyVnd(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const formatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  })
  return formatter.format(Number(value))
}

export function formatDate(input, locale = 'vi-VN') {
  if (!input) return '—'
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('vi-VN').format(Number(value))
}

export function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return '—'
  return `${formatDate(startDate)} → ${formatDate(endDate)}`
}

export function formatDateTime(input, locale = 'vi-VN') {
  if (!input) return '—'
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
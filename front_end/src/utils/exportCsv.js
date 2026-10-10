/**
 * exportCsv - generate and trigger download a CSV file from rows.
 *
 * - Tự thêm BOM UTF-8 để Excel hiển thị tiếng Việt đúng.
 * - Escape dấu phẩy, dấu nháy kép và xuống dòng đúng chuẩn RFC 4180.
 * - Trả về promise resolve khi đã trigger download (success/failure phụ
 *   thuộc vào trình duyệt).
 *
 * KHÔNG export password, token, secret, API key.
 */

const BOM = '\uFEFF'

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  let s
  if (typeof value === 'string') s = value
  else if (value instanceof Date) s = value.toISOString()
  else if (typeof value === 'object') s = JSON.stringify(value)
  else s = String(value)
  // Escape ký tự đặc biệt
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * rows: Array<Array<any>> đã có header ở phần tử đầu tiên.
 *   - Hoặc Array<object> kèm headers.
 */
function normalizeRows(rows, headers) {
  if (!rows || rows.length === 0) return [headers ?? []]
  if (Array.isArray(rows[0])) {
    return rows.map((r) => r.map((c) => escapeCell(c)))
  }
  if (!headers) return [['empty']]
  return rows.map((r) => headers.map((h) => escapeCell(r[h])))
}

export function buildCsv(rows, headers) {
  const matrix = normalizeRows(rows, headers)
  return BOM + matrix.map((line) => line.join(',')).join('\r\n')
}

/**
 * Trigger download. filename sẽ tự nối .csv nếu chưa có.
 */
export function downloadCsv(filename, csvContent) {
  const name = /\.csv$/i.test(filename) ? filename : `${filename}.csv`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // delay revoke to let Safari finish
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/**
 * Tiện ích gọi nhanh: truyền rows (Array<object>) + headers.
 */
export function exportToCsv(filename, rows, headers) {
  const csv = buildCsv(rows, headers)
  downloadCsv(filename, csv)
}

/**
 * Loại bỏ field nhạy cảm khỏi rows trước khi export.
 * - Mặc định block các tên field thuộc nhóm password/token/secret/key/otp.
 */
const SENSITIVE_FIELD_RE = /(password|passwd|pwd|token|secret|apikey|api_key|otp|refresh|access)/i

export function sanitizeForExport(rows, customBlock = []) {
  if (!Array.isArray(rows)) return []
  const block = [...customBlock].map((s) => s.toLowerCase())
  return rows.map((r) => {
    const next = {}
    for (const [k, v] of Object.entries(r)) {
      const low = k.toLowerCase()
      if (SENSITIVE_FIELD_RE.test(k) || block.includes(low)) continue
      next[k] = v
    }
    return next
  })
}
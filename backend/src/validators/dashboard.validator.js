// Validators cho Dashboard & Reports (Phase 9).
//
// Chuẩn: pure functions, return { error: { status, code, message, field? } } hoặc
// { value }. KHÔNG throw raw Error.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATE_RANGE_DAYS = 366; // chống quét toàn bộ DB

const PERIOD_MONTH_MIN = 1;
const PERIOD_MONTH_MAX = 12;
const PERIOD_YEAR_MIN = 2000;
const PERIOD_YEAR_MAX = 2100;

function toError(code, message, field, value, status = 400) {
  return { status, code, message, field, value };
}

function parseDateString(value, fieldName) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be a valid date in YYYY-MM-DD format`,
        fieldName,
        value,
      ),
    };
  }
  const [y, m, d] = value.split('-').map((s) => Number(s));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return {
      error: toError('VALIDATION_ERROR', `${fieldName} is not a valid date`, fieldName, value),
    };
  }
  return { value: dt };
}

function validateDateRange(query) {
  let startDate = null;
  let endDate = null;
  if (query.startDate !== undefined && query.startDate !== '') {
    const r = parseDateString(query.startDate, 'startDate');
    if (r.error) return r;
    startDate = r.value;
  }
  if (query.endDate !== undefined && query.endDate !== '') {
    const r = parseDateString(query.endDate, 'endDate');
    if (r.error) return r;
    endDate = r.value;
  }
  if (startDate && endDate) {
    if (startDate.getTime() > endDate.getTime()) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          'startDate must be less than or equal to endDate',
          'startDate',
        ),
      };
    }
    // Inclusive range: endDate - startDate + 1 ngày.
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1;
    if (days > MAX_DATE_RANGE_DAYS) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          `Date range must be at most ${MAX_DATE_RANGE_DAYS} days`,
          'endDate',
        ),
      };
    }
  }
  return { value: { startDate, endDate } };
}

// Validate common query cho các summary có date range.
function validateDateRangeQuery(query = {}) {
  const r = validateDateRange(query);
  if (r.error) return r;
  return { value: r.value };
}

// Validate period query cho payroll summary.
export function validatePayrollPeriodQuery(query = {}) {
  if (query.periodMonth !== undefined) {
    const n = Number(query.periodMonth);
    if (!Number.isInteger(n) || n < PERIOD_MONTH_MIN || n > PERIOD_MONTH_MAX) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          `periodMonth must be an integer between ${PERIOD_MONTH_MIN} and ${PERIOD_MONTH_MAX}`,
          'periodMonth',
          query.periodMonth,
        ),
      };
    }
  }
  if (query.periodYear !== undefined) {
    const n = Number(query.periodYear);
    if (!Number.isInteger(n) || n < PERIOD_YEAR_MIN || n > PERIOD_YEAR_MAX) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          `periodYear must be an integer between ${PERIOD_YEAR_MIN} and ${PERIOD_YEAR_MAX}`,
          'periodYear',
          query.periodYear,
        ),
      };
    }
  }
  if (
    (query.periodMonth !== undefined && query.periodYear === undefined) ||
    (query.periodYear !== undefined && query.periodMonth === undefined)
  ) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        'periodMonth and periodYear must be provided together',
        'periodMonth',
      ),
    };
  }
  return {
    value: {
      periodMonth: query.periodMonth !== undefined ? Number(query.periodMonth) : null,
      periodYear: query.periodYear !== undefined ? Number(query.periodYear) : null,
    },
  };
}

// Validate dashboard attendance summary query.
export function validateAttendanceSummaryQuery(query = {}) {
  return validateDateRangeQuery(query);
}

// Validate dashboard leave summary query.
// `by` chọn lọc theo `startDate` (default) hoặc `createdAt`.
export function validateLeaveSummaryQuery(query = {}) {
  const r = validateDateRangeQuery(query);
  if (r.error) return r;
  let by = 'startDate';
  if (query.by !== undefined && query.by !== '') {
    if (query.by !== 'startDate' && query.by !== 'createdAt') {
      return {
        error: toError(
          'VALIDATION_ERROR',
          'by must be one of: startDate, createdAt',
          'by',
          query.by,
        ),
      };
    }
    by = query.by;
  }
  return { value: { ...r.value, by } };
}

// Validate dashboard payroll summary query.
export function validateDashboardPayrollQuery(query = {}) {
  return validatePayrollPeriodQuery(query);
}

// Validate reports employees query. Hiện không có filter; giữ API cho
// tương lai.
export function validateEmployeesReportQuery(query = {}) {
  return { value: {} };
}

// Validate reports attendance query.
export function validateAttendanceReportQuery(query = {}) {
  return validateDateRangeQuery(query);
}

// Validate reports leave-requests query.
export function validateLeaveRequestsReportQuery(query = {}) {
  return validateDateRangeQuery(query);
}

// Validate reports payroll query.
export function validatePayrollReportQuery(query = {}) {
  return validatePayrollPeriodQuery(query);
}

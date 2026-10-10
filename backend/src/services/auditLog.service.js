// auditLog.service.js — Phase 10 + Phase 15 + Phase 16.
//
// Quyết định Phase 15:
// - `recordEvent()` giữ nguyên signature gốc + bổ sung optional
//   `requestId`, `ip`, `userAgent`.
// - KHÔNG BAO GIỜ ghi các giá trị cấm vào log (password, token, ...).
// - Best-effort: nếu ghi log thất bại, nuốt lỗi + `console.error`
//   server-side. KHÔNG throw ra controller.
// - Phase 15: thêm `cleanupExpiredLogs({ batchSize, olderThanDays })`
//   idempotent; thêm `recordEventSafe(...)` convenience wrapper.
//
// Quyết định Phase 16:
// - Sau khi ghi DB thành công, gọi `forwardEvent()` để chuyển tiếp
//   sang alert sink nếu hành động thuộc nhóm cần theo dõi (xem
//   `src/lib/alertSink.js`). Nếu không có sink, đây là no-op.
// - Việc forwardEvent() chạy bất đồng bộ, không bao giờ chặn
//   request hoặc làm tăng độ trễ của audit.

import AuditLog, {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  METADATA_FORBIDDEN_KEYS,
} from '../models/auditLog.model.js';
import { forwardEvent } from '../lib/alertSink.js';
import { recordAuditEvent } from '../lib/metrics.js';

const MAX_DESCRIPTION = 500;
const MAX_METADATA_KEYS = 32;
const MAX_METADATA_STRING = 500;
const MAX_LIMIT = 100;
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

// Cleanup defaults / caps.
const DEFAULT_CLEANUP_BATCH_SIZE = 1000;
const MIN_CLEANUP_BATCH_SIZE = 1;
const MAX_CLEANUP_BATCH_SIZE = 10_000;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650; // 10 years — purely a safety cap.

// Length caps for the optional context fields. We cap to the
// schema maxlength values, but validate client-side so the
// service refuses bad input before hitting Mongoose validators.
const MAX_REQUEST_ID = 64;
const MAX_IP = 64;
const MAX_USER_AGENT = 512;

// Allowed actor roles. Phase 15: 'system' added for cleanup
// events. (The schema enum already mirrors this list.)
const ALLOWED_ACTOR_ROLES = Object.freeze(['admin', 'employee', 'system']);

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

function sanitizeMetadata(input) {
  if (input === null || input === undefined) return {};
  if (typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  let keyCount = 0;
  for (const [k, v] of Object.entries(input)) {
    if (keyCount >= MAX_METADATA_KEYS) break;
    if (METADATA_FORBIDDEN_KEYS.includes(k)) continue;
    if (typeof k !== 'string' || k.length === 0 || k.length > 64) continue;
    if (typeof v === 'function' || typeof v === 'symbol') continue;
    if (v === undefined) continue;
    if (typeof v === 'string' && v.length > MAX_METADATA_STRING) {
      out[k] = v.slice(0, MAX_METADATA_STRING) + '…';
    } else {
      out[k] = v;
    }
    keyCount += 1;
  }
  return out;
}

function truncateDescription(s) {
  if (typeof s !== 'string') return '';
  return s.length > MAX_DESCRIPTION ? s.slice(0, MAX_DESCRIPTION) : s;
}

function sanitizeShortString(value, maxLen) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

// ---------------------------------------------------------------------------
// Write (best-effort)
// ---------------------------------------------------------------------------

/**
 * Ghi 1 audit event. Best-effort: nuốt lỗi + log ra stderr.
 *
 * Phase 15 fields:
 *   - requestId (optional) — string, max 64 chars.
 *   - ip (optional) — string, max 64 chars.
 *   - userAgent (optional) — string, max 512 chars.
 *   - actorRole can now be 'admin' | 'employee' | 'system'.
 *
 * The `actor` parameter is the server-side context (`req.user` after
 * `protect`, or `{ role: 'system' }` for system events). The service
 * NEVER reads `actor` from the request body.
 *
 * @param {object} args
 * @param {object|null} args.actor
 * @param {string}      args.action
 * @param {string}      args.resourceType
 * @param {string|null} [args.resourceId]
 * @param {string}      [args.description]
 * @param {object}      [args.metadata]
 * @param {string}      [args.status] - 'success' | 'failure'
 * @param {string}      [args.requestId]
 * @param {string}      [args.ip]
 * @param {string}      [args.userAgent]
 */
export async function recordEvent(args) {
  if (!args || typeof args !== 'object') return null;
  const {
    actor,
    action,
    resourceType,
    resourceId = null,
    description = '',
    metadata = {},
    status = 'success',
    requestId = null,
    ip = null,
    userAgent = null,
  } = args;

  if (!AUDIT_ACTIONS.includes(action)) {
    // eslint-disable-next-line no-console
    console.error(`[audit] rejected: action "${action}" not in allowlist`);
    return null;
  }
  if (!AUDIT_RESOURCE_TYPES.includes(resourceType)) {
    // eslint-disable-next-line no-console
    console.error(
      `[audit] rejected: resourceType "${resourceType}" not in allowlist`,
    );
    return null;
  }

  // Derive actor fields purely from the server-side `actor`
  // parameter. NEVER trust fields embedded in metadata or in the
  // request payload.
  const actorUserId = actor && actor._id ? actor._id : null;
  const actorRole =
    actor && ALLOWED_ACTOR_ROLES.includes(actor.role) ? actor.role : null;

  const cleanMetadata = sanitizeMetadata(metadata || {});
  const cleanDescription = truncateDescription(description || '');

  let rid = null;
  if (resourceId) {
    rid = typeof resourceId === 'string' ? resourceId : resourceId.toString();
    if (!OBJECT_ID_RE.test(rid)) {
      // eslint-disable-next-line no-console
      console.error(
        `[audit] rejected: resourceId "${rid}" is not a valid ObjectId`,
      );
      return null;
    }
  }

  const cleanRequestId = sanitizeShortString(requestId, MAX_REQUEST_ID);
  const cleanIp = sanitizeShortString(ip, MAX_IP);
  const cleanUserAgent = sanitizeShortString(userAgent, MAX_USER_AGENT);

  try {
    const doc = await AuditLog.create({
      actorUserId,
      actorRole,
      action,
      resourceType,
      resourceId: rid,
      description: cleanDescription,
      metadata: cleanMetadata,
      status: status === 'failure' ? 'failure' : 'success',
      requestId: cleanRequestId,
      ip: cleanIp,
      userAgent: cleanUserAgent,
    });
    const json = doc.toJSON();
    // Phase 16: counter + alert forwarding. Both are best-effort and
    // never throw. Forwarding is async and runs on the microtask
    // queue, so it does not block this code path.
    try {
      recordAuditEvent({ action, status: json.status });
    } catch (_) {
      // ignore — metrics must never affect the request path
    }
    forwardEvent(json);
    return json;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[audit] failed to record event (action=${action}, resourceType=${resourceType}):`,
      err && err.message,
    );
    return null;
  }
}

/**
 * Convenience wrapper around recordEvent. The provided `actor` is
 * spread into a plain object so callers cannot accidentally mutate
 * the original `req.user` reference.
 */
export async function recordEventSafe({
  actor = null,
  action,
  resourceType,
  resourceId = null,
  description = '',
  metadata = {},
  status = 'success',
  requestId = null,
  ip = null,
  userAgent = null,
}) {
  // Defensive copy — strip any potential credential-shaped fields.
  const safeActor =
    actor && typeof actor === 'object'
      ? { _id: actor._id, role: actor.role }
      : null;
  return recordEvent({
    actor: safeActor,
    action,
    resourceType,
    resourceId,
    description,
    metadata,
    status,
    requestId,
    ip,
    userAgent,
  });
}

// ---------------------------------------------------------------------------
// Read helpers (used by controller)
// ---------------------------------------------------------------------------

function buildSort(sortStr) {
  const allowedSortFields = ['createdAt', 'action', 'resourceType', 'actorRole'];
  const descending = typeof sortStr === 'string' && sortStr.startsWith('-');
  const field =
    typeof sortStr === 'string'
      ? sortStr.replace(/^[-+]/, '')
      : 'createdAt';
  if (!allowedSortFields.includes(field)) {
    return { createdAt: -1 };
  }
  return { [field]: descending ? -1 : 1 };
}

function buildListFilter(filters = {}) {
  const and = [];
  if (filters.actorUserId) and.push({ actorUserId: filters.actorUserId });
  if (filters.action) and.push({ action: filters.action });
  if (filters.resourceType) and.push({ resourceType: filters.resourceType });
  if (filters.resourceId) and.push({ resourceId: filters.resourceId });
  if (filters.status) and.push({ status: filters.status });
  if (filters.startDate || filters.endDate) {
    const dateFilter = {};
    if (filters.startDate) dateFilter.$gte = filters.startDate;
    if (filters.endDate) {
      const endExclusive = new Date(
        filters.endDate.getTime() + 24 * 60 * 60 * 1000,
      );
      dateFilter.$lt = endExclusive;
    }
    and.push({ createdAt: dateFilter });
  }
  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

function serialize(doc) {
  if (!doc) return doc;
  const { __v, ...rest } = doc;
  return rest;
}

export async function listAuditLogs(query = {}) {
  const { page = 1, limit = 20, filters = {}, sort = '-createdAt' } = query;
  const p = Math.max(1, Math.min(1_000_000, Number(page) || 1));
  const l = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || 20));

  const filter = buildListFilter(filters);
  const sortObj = buildSort(sort);
  const skip = (p - 1) * l;

  const [total, docs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(l)
      .lean({ virtuals: true }),
  ]);

  return {
    data: docs.map(serialize),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / l),
    },
  };
}

export async function getAuditLogById(id) {
  if (!id || typeof id !== 'string' || !OBJECT_ID_RE.test(id)) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'id must be a valid ObjectId',
        field: 'id',
      },
    };
  }
  const doc = await AuditLog.findById(id).lean({ virtuals: true });
  if (!doc) {
    return {
      error: {
        status: 404,
        code: 'AUDIT_LOG_NOT_FOUND',
        message: 'Audit log not found',
        field: 'id',
      },
    };
  }
  return { data: serialize(doc) };
}

// ---------------------------------------------------------------------------
// Retention / cleanup (Phase 15)
// ---------------------------------------------------------------------------

/**
 * Validate retention / batch parameters and return normalized values
 * or a `{ error }` object describing why they are unsafe.
 *
 * This function is INTENTIONALLY strict: the cleanup routine is
 * destructive, so we refuse to run with missing or nonsense values
 * rather than falling back to a default that might delete too
 * much.
 */
export function validateCleanupParams({
  retentionDays,
  batchSize,
} = {}) {
  const r = Number(retentionDays);
  if (
    retentionDays === undefined ||
    retentionDays === null ||
    !Number.isFinite(r) ||
    !Number.isInteger(r) ||
    r < MIN_RETENTION_DAYS ||
    r > MAX_RETENTION_DAYS
  ) {
    return {
      error: `retentionDays must be an integer between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`,
    };
  }

  let b = DEFAULT_CLEANUP_BATCH_SIZE;
  if (batchSize !== undefined && batchSize !== null) {
    const bn = Number(batchSize);
    if (
      !Number.isFinite(bn) ||
      !Number.isInteger(bn) ||
      bn < MIN_CLEANUP_BATCH_SIZE ||
      bn > MAX_CLEANUP_BATCH_SIZE
    ) {
      return {
        error: `batchSize must be an integer between ${MIN_CLEANUP_BATCH_SIZE} and ${MAX_CLEANUP_BATCH_SIZE}`,
      };
    }
    b = bn;
  }

  return { retentionDays: r, batchSize: b };
}

/**
 * Delete audit logs whose `createdAt` is older than
 * `retentionDays` days. Bounded by `batchSize` so the operation
 * never scans the entire collection in a single call — the
 * operator runs it repeatedly until it returns 0.
 *
 * Idempotent: running it twice in a row with the same params
 * deletes 0 records the second time.
 *
 * Returns:
 *   { deletedCount, hasMore, retentionDays, batchSize, cutoff }
 * or
 *   { error: string } if params are invalid.
 */
export async function cleanupExpiredLogs({ retentionDays, batchSize } = {}) {
  const v = validateCleanupParams({ retentionDays, batchSize });
  if (v.error) return { error: v.error };

  const cutoff = new Date(Date.now() - v.retentionDays * 24 * 60 * 60 * 1000);

  // We use `_id` to find oldest first, then delete by `_id` only —
  // this keeps the operation bounded and deterministic even if
  // `createdAt` has duplicate values.
  const oldest = await AuditLog.find({ createdAt: { $lt: cutoff } })
    .sort({ createdAt: 1 })
    .limit(v.batchSize)
    .select({ _id: 1 })
    .lean();

  if (oldest.length === 0) {
    return {
      deletedCount: 0,
      hasMore: false,
      retentionDays: v.retentionDays,
      batchSize: v.batchSize,
      cutoff,
    };
  }

  const ids = oldest.map((d) => d._id);
  const result = await AuditLog.deleteMany({ _id: { $in: ids } });

  return {
    deletedCount: result.deletedCount || 0,
    hasMore: oldest.length === v.batchSize,
    retentionDays: v.retentionDays,
    batchSize: v.batchSize,
    cutoff,
  };
}

/**
 * systemConfigService - đọc/ghi cấu hình hệ thống (frontend demo).
 *
 * Nguyên tắc:
 * - Mock persistence bằng localStorage (key: hrm_system_config).
 * - KHÔNG lưu thông tin nhạy cảm (password/token/secret/apiKey).
 * - Khi tích hợp backend, chỉ cần thay các hàm bên dưới bằng httpClient.
 */

import { DEFAULT_SYSTEM_CONFIG } from '../data/systemConfigData'

const STORAGE_KEY = 'hrm_system_config'

const listeners = new Set()
function emitChange() {
  for (const cb of listeners) {
    try { cb() } catch (_e) { void _e }
  }
}

export function subscribeSystemConfig(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function readFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (_e) {
    void _e
    return null
  }
}

function writeToStorage(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (_e) {
    void _e
  }
}

/**
 * Mô phỏng một request async. Trả về clone để component không mutate store.
 */
export function getSystemConfig() {
  return new Promise((resolve) => {
    // small delay giúp UI render được loading state
    setTimeout(() => {
      const fromStorage = readFromStorage()
      const cfg = fromStorage ?? DEFAULT_SYSTEM_CONFIG
      resolve(deepClone(cfg))
    }, 80)
  })
}

/**
 * Update toàn bộ config. Service tự điền metadata updatedAt.
 * Payload phải là object shape giống DEFAULT_SYSTEM_CONFIG.
 */
export function updateSystemConfig(payload, actor = 'admin') {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const next = {
          ...DEFAULT_SYSTEM_CONFIG,
          ...payload,
          general: { ...DEFAULT_SYSTEM_CONFIG.general, ...(payload.general ?? {}) },
          localization: { ...DEFAULT_SYSTEM_CONFIG.localization, ...(payload.localization ?? {}) },
          appearance: { ...DEFAULT_SYSTEM_CONFIG.appearance, ...(payload.appearance ?? {}) },
          notifications: { ...DEFAULT_SYSTEM_CONFIG.notifications, ...(payload.notifications ?? {}) },
          system: { ...DEFAULT_SYSTEM_CONFIG.system, ...(payload.system ?? {}) },
          updatedAt: new Date().toISOString(),
          updatedBy: actor,
        }
        writeToStorage(next)
        emitChange()
        resolve(deepClone(next))
      } catch (_e) {
        void _e
        reject(_e)
      }
    }, 80)
  })
}

/**
 * Update một section cụ thể.
 */
export function updateConfigSection(section, data, actor = 'admin') {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const current = readFromStorage() ?? DEFAULT_SYSTEM_CONFIG
        if (!(section in current)) {
          reject(new Error(`Unknown section: ${section}`))
          return
        }
        const next = {
          ...current,
          [section]: { ...current[section], ...data },
          updatedAt: new Date().toISOString(),
          updatedBy: actor,
        }
        writeToStorage(next)
        emitChange()
        resolve(deepClone(next))
      } catch (_e) {
        void _e
        reject(_e)
      }
    }, 80)
  })
}

/**
 * Reset về default.
 */
export function resetSystemConfig() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const fresh = deepClone(DEFAULT_SYSTEM_CONFIG)
      fresh.updatedAt = new Date().toISOString()
      fresh.updatedBy = 'admin'
      writeToStorage(fresh)
      emitChange()
      resolve(fresh)
    }, 80)
  })
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
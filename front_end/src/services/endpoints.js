/**
 * Centralized API endpoints. Keep base URL configurable via env when integrating
 * with an Express + MongoDB backend (e.g. import.meta.env.VITE_API_BASE_URL).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export const endpoints = {
  auth: {
    login: `${API_BASE}/auth/login`,
    refresh: `${API_BASE}/auth/refresh`,
    logout: `${API_BASE}/auth/logout`,
    me: `${API_BASE}/auth/me`,
    sessions: `${API_BASE}/auth/sessions`,
  },
  employees: {
    list: `${API_BASE}/employees`,
    detail: (id) => `${API_BASE}/employees/${id}`,
  },
  departments: {
    list: `${API_BASE}/departments`,
  },
  attendance: {
    list: `${API_BASE}/attendance`,
  },
  leave: {
    list: `${API_BASE}/leave-requests`,
  },
  payroll: {
    list: `${API_BASE}/payroll`,
  },
}

export default endpoints

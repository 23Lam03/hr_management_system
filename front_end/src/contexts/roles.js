/**
 * Roles supported by the demo auth. Use these for `allowedRoles` checks and
 * comparisons against `useAuth().role`.
 */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
})

export const ROLE_VALUES = Object.freeze([ROLES.ADMIN, ROLES.EMPLOYEE])

/**
 * Centralized role helpers. Use these instead of writing
 * `user.role === 'admin'` in many places.
 *
 * Phase 31: simple utilities, no RBAC engine. Service-layer ownership
 * remains the source of truth for data isolation.
 */
export function isAdmin(user) {
  return Boolean(user) && user.role === ROLES.ADMIN
}
export function isEmployee(user) {
  return Boolean(user) && user.role === ROLES.EMPLOYEE
}
export function hasRole(user, role) {
  return Boolean(user) && user.role === role
}
export function canAccess(user, allowedRoles) {
  if (!user) return false
  if (!allowedRoles || allowedRoles.length === 0) return true
  return allowedRoles.includes(user.role)
}
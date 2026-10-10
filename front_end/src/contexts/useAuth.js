import { useContext } from 'react'

import { AuthContext } from './authContext'

export { AuthContext }

/**
 * useAuth - truy cập context auth hiện tại.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
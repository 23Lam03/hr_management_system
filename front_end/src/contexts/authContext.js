import { createContext } from 'react'

/**
 * AuthContext tách ra đây để oxlint Fast-Refresh rule không cảnh báo khi file
 * `AuthContext.jsx` vừa export component vừa export context.
 */
export const AuthContext = createContext(null)
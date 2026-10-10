import { useContext } from 'react'

import { SecurityContext } from './securityContext'

/**
 * useSecurity - truy cập SecurityContext.
 */
export default function useSecurity() {
  return useContext(SecurityContext)
}
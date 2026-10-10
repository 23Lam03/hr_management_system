import { useContext } from 'react'

import { SupportContext } from './supportContext'

/**
 * useSupport - truy cập SupportContext.
 */
export default function useSupport() {
  return useContext(SupportContext)
}
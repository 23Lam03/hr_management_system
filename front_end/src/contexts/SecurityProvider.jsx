import { useCallback, useEffect, useMemo, useState } from 'react'

import { SecurityContext } from './securityContext'
import {
  getSecuritySettings,
  getSecurityActivities,
  updateSecuritySettings as svcUpdateSettings,
  subscribeSecurity,
} from '../services/securityService'

/**
 * SecurityProvider - mount 1 lần trong App.
 *
 * - Subscribe pub-sub từ securityService.
 * - Lưu snapshot trong useState; bump `tick` mỗi lần update để các useMemo
 *   downstream có dependency ổn định.
 *
 * LƯU Ý: KHÔNG dùng useSyncExternalStore ở đây vì snapshot object
 *        được tạo mới liên tục sẽ gây infinite loop.
 */
export function SecurityProvider({ children }) {
  const [settings, setSettings] = useState(() => getSecuritySettings())
  const [activities, setActivities] = useState(() => getSecurityActivities())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const refresh = () => {
      setSettings(getSecuritySettings())
      setActivities(getSecurityActivities())
      // eslint-disable-next-line react/set-state-in-effect
      setTick((t) => t + 1)
    }
    const unsub = subscribeSecurity(refresh)
    return () => unsub()
  }, [])

  const updateSettings = useCallback(async (payload, actor) => {
    return svcUpdateSettings(payload, actor)
  }, [])

  const reload = useCallback(() => {
    setSettings(getSecuritySettings())
    setActivities(getSecurityActivities())
    setTick((t) => t + 1)
  }, [])

  const value = useMemo(
    () => ({
      settings,
      activities,
      tick,
      loading: false,
      error: null,
      updateSettings,
      loadSecuritySettings: reload,
      loadSecurityActivities: reload,
    }),
    [settings, activities, tick, updateSettings, reload],
  )

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>
}
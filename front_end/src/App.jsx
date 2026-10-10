import AppRouter from './routes/AppRouter'
import { I18nProvider } from './i18n/I18nProvider'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { NotificationProvider } from './contexts/NotificationProvider.jsx'
import { SupportProvider } from './contexts/SupportProvider.jsx'
import { SecurityProvider } from './contexts/SecurityProvider.jsx'
import { ToastProvider } from './components/common/Toast'

/**
 * App - top-level component. Hosts global providers (i18n, auth, toast, ...)
 * and the AppRouter. Avoid putting layout or page logic here.
 */
export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <SupportProvider>
              <SecurityProvider>
                <AppRouter />
              </SecurityProvider>
            </SupportProvider>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { consumeSessionHandoff } from './lib/auth'

// Start hash parse + server verify before render. App waits on the promise
// so RequireAuth/RequireGuest do not redirect with a stale session.
consumeSessionHandoff()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

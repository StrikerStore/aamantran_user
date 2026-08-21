import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { consumeSessionHandoff } from './lib/auth'

// Must run before render: RequireAuth/RequireGuest read the token during the
// first paint, so adopting the handed-over session later would redirect first.
consumeSessionHandoff()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

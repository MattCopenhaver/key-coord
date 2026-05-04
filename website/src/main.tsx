import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Callback from './components/Callback'
import CharacterSelect from './components/CharacterSelect'
import { AuthProvider, useAuth } from './context/AuthContext'

const isCallback = window.location.pathname === '/callback'

function Router (): JSX.Element {
  const { user, selectedCharacter, pendingKey } = useAuth()
  if (isCallback) return <Callback />
  if (user !== null && selectedCharacter === null && pendingKey === null) return <CharacterSelect />
  return <App />
}

const root = document.getElementById('root')
if (root === null) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <Router />
    </AuthProvider>
  </StrictMode>,
)

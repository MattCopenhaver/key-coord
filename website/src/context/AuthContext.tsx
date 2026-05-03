import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { type Region } from '../data/realms'

export interface AuthUser {
  battletag: string
  accessToken: string
}

export interface SelectedCharacter {
  name: string
  realm: string
  region: Region
  guild: string
  guildRealm: string
  avatar: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  selectedCharacter: SelectedCharacter | null
  login: () => void
  logout: () => void
  completeLogin: (user: AuthUser) => void
  selectCharacter: (char: SelectedCharacter) => void
  clearCharacter: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const CLIENT_ID = import.meta.env.VITE_BLIZZARD_CLIENT_ID as string | undefined
const AUTH_KEY = 'key-coord-auth'
const CHAR_KEY = 'key-coord-character'

function buildAuthUrl (): string {
  const redirectUri = `${window.location.origin}/callback`
  const state = crypto.randomUUID()
  sessionStorage.setItem('oauth_state', state)
  const params = new URLSearchParams({
    client_id: CLIENT_ID ?? '',
    scope: 'wow.profile',
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })
  return `https://oauth.battle.net/authorize?${params.toString()}`
}

function loadJson<T> (key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

export function AuthProvider ({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => loadJson<AuthUser>(AUTH_KEY))
  const [selectedCharacter, setSelectedCharacter] = useState<SelectedCharacter | null>(() => {
    const char = loadJson<SelectedCharacter>(CHAR_KEY)
    if (char?.guildRealm === undefined) return null
    return char
  })

  const login = (): void => {
    window.location.href = buildAuthUrl()
  }

  const logout = (): void => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(CHAR_KEY)
    setUser(null)
    setSelectedCharacter(null)
  }

  const completeLogin = useCallback((authUser: AuthUser): void => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }, [])

  const selectCharacter = useCallback((char: SelectedCharacter): void => {
    localStorage.setItem(CHAR_KEY, JSON.stringify(char))
    setSelectedCharacter(char)
  }, [])

  const clearCharacter = useCallback((): void => {
    localStorage.removeItem(CHAR_KEY)
    setSelectedCharacter(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, selectedCharacter, login, logout, completeLogin, selectCharacter, clearCharacter }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth (): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

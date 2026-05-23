import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Region } from '../data/realms'

export interface AuthUser {
  battletag: string
  accessToken: string
  expiresAt: number
}

export interface SelectedCharacter {
  name: string
  realm: string
  realmSlug: string
  region: Region
  guild: string
  guildRealm: string
  guildRealmName: string
  avatar: string | null
  className: string | null
}

export interface PendingKey {
  characterName: string
  region: string
  realm: string
  guildRealm: string
  guild: string
  dungeonId: number
  keyLevel: number
}

interface AuthContextValue {
  user: AuthUser | null
  selectedCharacter: SelectedCharacter | null
  pendingKey: PendingKey | null
  sessionExpired: boolean
  login: () => void
  logout: () => void
  expireSession: () => void
  completeLogin: (user: AuthUser) => void
  selectCharacter: (char: SelectedCharacter) => void
  clearCharacter: () => void
  clearPendingKey: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const CLIENT_ID = import.meta.env.VITE_BLIZZARD_CLIENT_ID as string | undefined
const AUTH_KEY = 'key-coord-auth'
const CHAR_KEY = 'key-coord-character'
const PENDING_KEY_KEY = 'key-coord-pending-key'

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

function loadJson<T> (key: string, storage: Storage = localStorage): T | null {
  try {
    const raw = storage.getItem(key)
    return raw !== null ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function loadAndValidateAuth (): { user: AuthUser | null, sessionExpired: boolean } {
  const stored = loadJson<AuthUser>(AUTH_KEY)
  if (stored === null) return { user: null, sessionExpired: false }
  if (stored.expiresAt < Date.now()) {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(CHAR_KEY)
    return { user: null, sessionExpired: true }
  }
  return { user: stored, sessionExpired: false }
}

export function AuthProvider ({ children }: { children: ReactNode }): JSX.Element {
  const [{ user: initialUser, sessionExpired: initialSessionExpired }] = useState(loadAndValidateAuth)
  const [user, setUser] = useState<AuthUser | null>(initialUser)
  const [selectedCharacter, setSelectedCharacter] = useState<SelectedCharacter | null>(() => {
    const char = loadJson<SelectedCharacter>(CHAR_KEY)
    if (char?.guildRealm === undefined || char.guildRealmName === undefined) return null
    return char
  })
  const [pendingKey, setPendingKey] = useState<PendingKey | null>(() => loadJson<PendingKey>(PENDING_KEY_KEY, sessionStorage))
  const [sessionExpired, setSessionExpired] = useState(initialSessionExpired)

  useEffect(() => {
    if (window.location.pathname === '/callback') return
    const params = new URLSearchParams(window.location.search)
    const characterName = params.get('characterName')
    if (characterName === null) return
    const dungeonId = Number(params.get('dungeonId'))
    const keyLevel = Number(params.get('keyLevel'))
    const region = params.get('region') ?? ''
    const realm = params.get('realm') ?? ''
    const guildRealm = params.get('guildRealm') ?? ''
    const guild = params.get('guild') ?? ''
    if (region === '' || realm === '' || guild === '' || isNaN(dungeonId) || isNaN(keyLevel)) return
    const pending: PendingKey = { characterName, region, realm, guildRealm, guild, dungeonId, keyLevel }
    sessionStorage.setItem(PENDING_KEY_KEY, JSON.stringify(pending))
    setPendingKey(pending)
  }, [])

  const login = (): void => {
    window.location.href = buildAuthUrl()
  }

  const logout = (): void => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(CHAR_KEY)
    sessionStorage.removeItem(PENDING_KEY_KEY)
    setUser(null)
    setSelectedCharacter(null)
    setPendingKey(null)
  }

  const expireSession = useCallback((): void => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(CHAR_KEY)
    setUser(null)
    setSelectedCharacter(null)
    setSessionExpired(true)
    // pendingKey intentionally preserved so it auto-submits after re-login
  }, [])

  const completeLogin = useCallback((authUser: AuthUser): void => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setSessionExpired(false)
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

  const clearPendingKey = useCallback((): void => {
    sessionStorage.removeItem(PENDING_KEY_KEY)
    setPendingKey(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, selectedCharacter, pendingKey, sessionExpired, login, logout, expireSession, completeLogin, selectCharacter, clearCharacter, clearPendingKey }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth (): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

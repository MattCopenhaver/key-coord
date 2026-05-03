import { useEffect, useRef, useState } from 'react'
import { useAuth, type AuthUser } from '../context/AuthContext'

export default function Callback (): JSX.Element {
  const { completeLogin } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const expectedState = sessionStorage.getItem('oauth_state')
    sessionStorage.removeItem('oauth_state')

    if (code === null) {
      setError('No authorization code in callback URL.')
      return
    }

    if (state !== expectedState) {
      setError('Invalid state parameter. Please try logging in again.')
      return
    }

    const redirectUri = `${window.location.origin}/callback`
    const url = `/api/auth/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`

    fetch(url)
      .then(async res => {
        if (!res.ok) throw new Error('Login failed')
        return await res.json() as AuthUser
      })
      .then(user => {
        completeLogin(user)
        window.location.replace('/')
      })
      .catch(() => { setError('Login failed. Please try again.') })
  }, [completeLogin])

  if (error !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-8 py-6 text-center">
          <p className="text-red-400">{error}</p>
          <a href="/" className="mt-4 inline-block text-sm text-slate-400 hover:text-white">
            Back to home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
        <p className="text-sm text-slate-400">Completing login…</p>
      </div>
    </div>
  )
}

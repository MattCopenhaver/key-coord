import { useState, useMemo, useCallback, useEffect } from 'react'
import { getDungeonName } from './data/dungeons'
import { useAuth } from './context/AuthContext'

interface Key {
  characterName: string
  dungeonId: number
  keyLevel: number
  updatedAt: string
}

interface BlizzardMythicDungeon {
  dungeon?: { id: number }
}

interface BlizzardJournalMedia {
  assets: Array<{ key: string, value: string }>
}

type SortField = 'characterName' | 'dungeonId' | 'keyLevel' | 'updatedAt'
type SortDir = 'asc' | 'desc'

function keyLevelColor (level: number): string {
  if (level >= 15) return 'text-orange-400 font-bold'
  if (level >= 13) return 'text-purple-400 font-semibold'
  if (level >= 10) return 'text-blue-400 font-semibold'
  if (level >= 7) return 'text-green-400'
  return 'text-slate-300'
}

function SortIcon ({ field, sortField, sortDir }: { field: SortField, sortField: SortField, sortDir: SortDir }): JSX.Element {
  if (field !== sortField) {
    return <span className="ml-1 text-slate-700">↕</span>
  }
  return <span className="ml-1 text-amber-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export default function App (): JSX.Element {
  const { user, login, logout, selectedCharacter, clearCharacter } = useAuth()
  const [keys, setKeys] = useState<Key[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('keyLevel')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [dungeonMedia, setDungeonMedia] = useState<Map<number, string>>(new Map())

  const fetchKeys = useCallback(async (): Promise<void> => {
    if (selectedCharacter === null) return
    setLoading(true)
    setError(null)
    try {
      const { region, guildRealm, guild } = selectedCharacter
      const guildId = `${region}-${guildRealm}-${guild}`
      const res = await fetch(`/api/keys/${encodeURIComponent(guildId)}`)
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data = await res.json() as { keys: Key[] }
      setKeys(data.keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [selectedCharacter])

  useEffect(() => {
    void fetchKeys()
  }, [fetchKeys])

  useEffect(() => {
    if (keys.length === 0 || user === null || selectedCharacter === null) return
    const region = selectedCharacter.region.toLowerCase()
    const base = `https://${region}.api.blizzard.com`
    const headers = { Authorization: `Bearer ${user.accessToken}` }
    const uniqueIds = [...new Set(keys.map(k => k.dungeonId))]

    void Promise.all(
      uniqueIds.map(async (id): Promise<[number, string] | null> => {
        try {
          const dungeonRes = await fetch(
            `${base}/data/wow/mythic-keystone/dungeon/${id}?namespace=dynamic-${region}`,
            { headers },
          )
          if (!dungeonRes.ok) return null
          const dungeonData = await dungeonRes.json() as BlizzardMythicDungeon
          const journalId = dungeonData.dungeon?.id
          if (journalId === undefined) return null

          const mediaRes = await fetch(
            `${base}/data/wow/media/journal-instance/${journalId}?namespace=static-${region}`,
            { headers },
          )
          if (!mediaRes.ok) return null
          const mediaData = await mediaRes.json() as BlizzardJournalMedia
          const url = mediaData.assets.find(a => a.key === 'tile')?.value
          return url !== undefined ? [id, url] : null
        } catch {
          return null
        }
      }),
    ).then(results => {
      setDungeonMedia(prev => {
        const next = new Map(prev)
        for (const r of results) {
          if (r !== null) next.set(r[0], r[1])
        }
        return next
      })
    })
  }, [keys, user, selectedCharacter])

  const onSort = (field: SortField): void => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'keyLevel' ? 'desc' : 'asc')
    }
  }

  const sortedKeys = useMemo(() => {
    return [...keys].sort((a, b) => {
      let cmp = 0
      if (sortField === 'characterName') {
        cmp = a.characterName.localeCompare(b.characterName)
      } else if (sortField === 'dungeonId') {
        cmp = getDungeonName(a.dungeonId).localeCompare(getDungeonName(b.dungeonId))
      } else if (sortField === 'keyLevel') {
        cmp = a.keyLevel - b.keyLevel
      } else {
        cmp = a.updatedAt.localeCompare(b.updatedAt)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [keys, sortField, sortDir])

  const thClass = 'px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:text-slate-300 transition-colors'

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-400">Key Coord</h1>
              <p className="mt-0.5 text-sm text-slate-400">Track Mythic+ keys across your guild</p>
            </div>
            {user !== null
              ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  {selectedCharacter !== null && (
                    <div className="flex items-center gap-2 sm:gap-3">
                      {selectedCharacter.avatar !== null && (
                        <img src={selectedCharacter.avatar} alt={selectedCharacter.name} className="h-9 w-9 rounded-lg object-cover" />
                      )}
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{selectedCharacter.name}</p>
                        <button
                          onClick={clearCharacter}
                          className="text-xs text-slate-500 transition hover:text-amber-400"
                        >
                          Change character
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-white"
                  >
                    Log out
                  </button>
                </div>
                )
              : (
                <button
                  onClick={login}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Login with Battle.net
                </button>
                )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {user === null && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 py-20 text-center">
            <p className="mb-1 text-xl font-semibold text-white">Sign in to get started</p>
            <p className="mb-6 text-base text-slate-400">Log in with Battle.net to see your guild&apos;s Mythic+ keys.</p>
            <button
              onClick={login}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Login with Battle.net
            </button>
          </div>
        )}

        {error !== null && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border border-slate-600 border-t-amber-400" />
            Loading keys…
          </div>
        )}

        {!loading && selectedCharacter !== null && keys.length === 0 && error === null && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center">
            <p className="text-slate-500">No keys found for <span className="text-slate-300">{selectedCharacter.guild}</span>.</p>
          </div>
        )}

        {keys.length > 0 && selectedCharacter !== null && (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-4">
              <div>
                <p className="text-base font-semibold text-white">{selectedCharacter.guild}</p>
                <p className="text-sm text-slate-500">{selectedCharacter.guildRealm} · {selectedCharacter.region}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-sm font-medium text-slate-300">
                  {keys.length} {keys.length === 1 ? 'key' : 'keys'}
                </span>
                <button
                  onClick={() => { void fetchKeys() }}
                  className="text-sm text-slate-500 transition hover:text-amber-400"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className={thClass} onClick={() => { onSort('characterName') }}>
                      Character<SortIcon field="characterName" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className={thClass} onClick={() => { onSort('dungeonId') }}>
                      Dungeon<SortIcon field="dungeonId" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className={thClass} onClick={() => { onSort('keyLevel') }}>
                      Level<SortIcon field="keyLevel" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className={`${thClass} hidden sm:table-cell`} onClick={() => { onSort('updatedAt') }}>
                      Updated<SortIcon field="updatedAt" sortField={sortField} sortDir={sortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedKeys.map(key => (
                    <tr key={key.characterName} className="transition-colors hover:bg-slate-800/40">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-white">{key.characterName}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2.5">
                          {dungeonMedia.get(key.dungeonId) !== undefined && (
                            <img
                              src={dungeonMedia.get(key.dungeonId)}
                              alt=""
                              className="h-8 w-8 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <span className="text-slate-400">{getDungeonName(key.dungeonId)}</span>
                        </div>
                      </td>
                      <td className={`px-4 sm:px-6 py-3 sm:py-4 ${keyLevelColor(key.keyLevel)}`}>+{key.keyLevel}</td>
                      <td className="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4 text-slate-500">{new Date(key.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

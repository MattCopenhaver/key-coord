import { useState, useMemo } from 'react'
import { regions, realmsByRegion, type Region } from './data/realms'
import { getDungeonName } from './data/dungeons'
import Combobox from './components/Combobox'

interface Key {
  characterName: string
  dungeonId: number
  keyLevel: number
  updatedAt: string
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

const inputClass = 'rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 transition focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

function SortIcon ({ field, sortField, sortDir }: { field: SortField, sortField: SortField, sortDir: SortDir }): JSX.Element {
  if (field !== sortField) {
    return <span className="ml-1 text-slate-700">↕</span>
  }
  return <span className="ml-1 text-amber-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export default function App (): JSX.Element {
  const [region, setRegion] = useState<Region | ''>('')
  const [realm, setRealm] = useState('')
  const [guild, setGuild] = useState('')
  const [keys, setKeys] = useState<Key[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [sortField, setSortField] = useState<SortField>('keyLevel')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const canSearch = region !== '' && realm !== '' && guild !== ''

  const onRegionChange = (value: string): void => {
    setRegion(value as Region | '')
    setRealm('')
  }

  const fetchKeys = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const guildId = `${region}-${realm}-${guild}`
      const res = await fetch(`/api/keys/${encodeURIComponent(guildId)}`)
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data = await res.json() as { keys: Key[] }
      setKeys(data.keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && canSearch) void fetchKeys()
  }

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

  const realms = region !== '' ? realmsByRegion[region] : []

  const thClass = 'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:text-slate-300 transition-colors'

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-amber-400">Key Coord</h1>
          <p className="mt-0.5 text-sm text-slate-400">Track Mythic+ keys across your guild</p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Find Your Guild</p>
          <div className="flex gap-2">
            <Combobox
              value={region}
              onChange={onRegionChange}
              options={regions as unknown as string[]}
              placeholder="Region"
              className="w-24"
            />
            <Combobox
              value={realm}
              onChange={setRealm}
              options={realms}
              placeholder="Realm"
              disabled={region === ''}
              className="flex-1"
            />
            <input
              type="text"
              value={guild}
              placeholder="Guild"
              onChange={e => { setGuild(e.target.value) }}
              onKeyDown={onKeyDown}
              className={`${inputClass} flex-1`}
            />
            <button
              onClick={() => { void fetchKeys() }}
              disabled={loading || !canSearch}
              className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {error !== null && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {hasSearched && !loading && keys.length === 0 && error === null && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 py-16 text-center">
            <p className="text-slate-500">No keys found for this guild.</p>
          </div>
        )}

        {keys.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Guild Keys</p>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                {keys.length} {keys.length === 1 ? 'key' : 'keys'}
              </span>
            </div>
            <table className="w-full text-sm">
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
                  <th className={thClass} onClick={() => { onSort('updatedAt') }}>
                    Updated<SortIcon field="updatedAt" sortField={sortField} sortDir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedKeys.map(key => (
                  <tr key={key.characterName} className="transition-colors hover:bg-slate-800/40">
                    <td className="px-6 py-4 font-medium text-white">{key.characterName}</td>
                    <td className="px-6 py-4 text-slate-400">{getDungeonName(key.dungeonId)}</td>
                    <td className={`px-6 py-4 ${keyLevelColor(key.keyLevel)}`}>+{key.keyLevel}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(key.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

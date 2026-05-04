import { useEffect, useState } from 'react'
import { regions, type Region } from '../data/realms'
import { useAuth, type SelectedCharacter } from '../context/AuthContext'
import { getClassColor } from '../data/classes'
import Combobox from './Combobox'

interface BlizzardCharacter {
  name: string
  realm: { slug: string, name: string }
  level: number
}

interface BlizzardProfile {
  wow_accounts: Array<{ characters: BlizzardCharacter[] }>
}

interface BlizzardCharacterProfile {
  guild?: { name: string, realm: { slug: string, name: string } }
  character_class?: { name: string }
}

interface BlizzardCharacterMedia {
  assets: Array<{ key: string, value: string }>
}

interface FetchedCharacter {
  name: string
  realm: string
  realmSlug: string
  level: number
  guild: string | null
  guildRealm: string | null
  guildRealmName: string | null
  avatar: string | null
  className: string | null
}

async function fetchCharacters (region: Region, accessToken: string): Promise<FetchedCharacter[]> {
  const base = `https://${region.toLowerCase()}.api.blizzard.com`
  const headers = { Authorization: `Bearer ${accessToken}` }
  const ns = `profile-${region.toLowerCase()}`

  const profileRes = await fetch(`${base}/profile/user/wow?namespace=${ns}&locale=en_US`, { headers })
  if (!profileRes.ok) throw new Error('Failed to fetch WoW profile')

  const profile = await profileRes.json() as BlizzardProfile
  const allChars = profile.wow_accounts.flatMap(a => a.characters)

  const characters = await Promise.all(
    allChars.map(async (char): Promise<FetchedCharacter> => {
      const base2: FetchedCharacter = {
        name: char.name,
        realm: char.realm.name,
        realmSlug: char.realm.slug,
        level: char.level,
        guild: null,
        guildRealm: null,
        guildRealmName: null,
        avatar: null,
        className: null,
      }
      if (char.level < 70) return base2
      const charPath = `${base}/profile/wow/character/${char.realm.slug}/${char.name.toLowerCase()}`
      try {
        const [profileRes, mediaRes] = await Promise.all([
          fetch(`${charPath}?namespace=${ns}&locale=en_US`, { headers }),
          fetch(`${charPath}/character-media?namespace=${ns}&locale=en_US`, { headers }),
        ])
        const charProfile = profileRes.ok ? await profileRes.json() as BlizzardCharacterProfile : null
        const media = mediaRes.ok ? await mediaRes.json() as BlizzardCharacterMedia : null
        return {
          ...base2,
          guild: charProfile?.guild?.name ?? null,
          guildRealm: charProfile?.guild?.realm.slug ?? null,
          guildRealmName: charProfile?.guild?.realm.name ?? null,
          avatar: media?.assets.find(a => a.key === 'avatar')?.value ?? null,
          className: charProfile?.character_class?.name ?? null,
        }
      } catch {
        return base2
      }
    }),
  )

  return characters.sort((a, b) => b.level - a.level)
}

export default function CharacterSelect (): JSX.Element {
  const { user, selectCharacter, logout } = useAuth()
  const [region, setRegion] = useState<Region | ''>('')
  const [characters, setCharacters] = useState<FetchedCharacter[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (region === '' || user === null) return
    setLoading(true)
    setError(null)
    setCharacters([])

    fetchCharacters(region, user.accessToken)
      .then(chars => { setCharacters(chars) })
      .catch(() => { setError('Could not load characters. Check your region or try again.') })
      .finally(() => { setLoading(false) })
  }, [region, user])

  const onSelect = (char: FetchedCharacter): void => {
    if (char.guild === null || char.guildRealm === null || region === '') return
    const selected: SelectedCharacter = {
      name: char.name,
      realm: char.realm,
      realmSlug: char.realmSlug,
      region,
      guild: char.guild,
      guildRealm: char.guildRealm,
      guildRealmName: char.guildRealmName ?? char.guildRealm,
      avatar: char.avatar,
      className: char.className,
    }
    selectCharacter(selected)
  }

  const guildChars = characters.filter(c => c.guild !== null)
  const noGuildChars = characters.filter(c => c.guild === null && c.level >= 70)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-400">Key Coord</h1>
              <p className="mt-0.5 text-sm text-slate-400">Track Mythic+ keys across your guild</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="mb-1 text-xl sm:text-2xl font-semibold text-white">Select a character</h2>
        <p className="mb-6 text-sm sm:text-base text-slate-400">Choose the character whose guild keys you want to track.</p>

        <div className="mb-6">
          <Combobox
            value={region}
            onChange={v => { setRegion(v as Region | '') }}
            options={regions as unknown as string[]}
            placeholder="Select region"
            className="w-40"
          />
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border border-slate-600 border-t-amber-400" />
            Loading characters…
          </div>
        )}

        {error !== null && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {guildChars.length > 0 && (
          <div className="space-y-2">
            {guildChars.map(char => (
              <button
                key={`${char.realmSlug}-${char.name}`}
                onClick={() => { onSelect(char) }}
                className="flex w-full items-center gap-3 sm:gap-4 rounded-xl border border-slate-800 bg-slate-900 px-4 sm:px-5 py-3 sm:py-4 text-left transition hover:border-slate-700 hover:bg-slate-800"
              >
                {char.avatar !== null
                  ? <img src={char.avatar} alt={char.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                  : <div className="h-12 w-12 rounded-lg bg-slate-800 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-base font-semibold truncate"
                    style={{ color: char.className !== null ? getClassColor(char.className) : 'white' }}
                  >
                    {char.name}
                  </p>
                  <p className="text-sm text-slate-400">{char.className ?? ''} · {char.realm}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm sm:text-base font-medium text-amber-400">{char.guild}</p>
                  <p className="text-xs sm:text-sm text-slate-500">Level {char.level}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {noGuildChars.length > 0 && !loading && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">No guild</p>
            <div className="space-y-1">
              {noGuildChars.map(char => (
                <div
                  key={`${char.realmSlug}-${char.name}`}
                  className="flex items-center justify-between rounded-lg px-4 py-2.5 text-slate-600"
                >
                  <span className="text-sm">{char.name} — {char.realm}</span>
                  <span className="text-xs">Level {char.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

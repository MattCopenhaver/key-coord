export const dungeonNames: Record<number, string> = {
  // The War Within Season 2
  500: 'Priory of the Sacred Flame',
  501: 'The Rookery',
  502: 'Operation: Floodgate',
  503: 'Darkflame Cleft',
  504: 'The Stonevault',
  505: 'City of Threads',
  506: 'Ara-Kara, City of Echoes',
  507: 'Cinderbrew Meadery',
  // The War Within Season 1
  353: 'Ara-Kara, City of Echoes',
  369: 'City of Threads',
  375: 'The Stonevault',
  376: 'The Dawnbreaker',
  377: 'Mists of Tirna Scithe',
  378: 'The Necrotic Wake',
  379: 'Siege of Boralus',
  400: 'Grim Batol',
}

export function getDungeonName (id: number): string {
  return dungeonNames[id] ?? `Dungeon #${id}`
}

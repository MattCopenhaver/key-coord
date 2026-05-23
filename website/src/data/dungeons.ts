export const dungeonNames: Record<number, string> = {
  // The War Within Season 3
  558: "Magisters' Terrace",
  560: 'Maisara Caverns',
  559: 'Nexus-Point Xenas',
  557: 'Windrunner Spire',
  402: "Algeth'ar Academy",
  239: 'Seat of the Triumvirate',
  161: 'Skyreach',
  556: 'Pit of Saron',
}

export function getDungeonName (id: number): string {
  return dungeonNames[id] ?? `Dungeon #${id}`
}

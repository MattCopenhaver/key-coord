export const classColors: Record<string, string> = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  Druid: '#FF7C0A',
  Evoker: '#33937F',
  Hunter: '#AAD372',
  Mage: '#3FC7EB',
  Monk: '#00FF98',
  Paladin: '#F48CBA',
  Priest: '#FFFFFF',
  Rogue: '#FFF468',
  Shaman: '#0070DD',
  Warlock: '#8788EE',
  Warrior: '#C69B3A',
}

// Blizzard playable_class IDs are stable
export const classColorById: Record<number, string> = {
  1: '#C69B3A', // Warrior
  2: '#F48CBA', // Paladin
  3: '#AAD372', // Hunter
  4: '#FFF468', // Rogue
  5: '#FFFFFF', // Priest
  6: '#C41E3A', // Death Knight
  7: '#0070DD', // Shaman
  8: '#3FC7EB', // Mage
  9: '#8788EE', // Warlock
  10: '#00FF98', // Monk
  11: '#FF7C0A', // Druid
  12: '#A330C9', // Demon Hunter
  13: '#33937F', // Evoker
}

export function getClassColor (className: string): string {
  return classColors[className] ?? '#FFFFFF'
}

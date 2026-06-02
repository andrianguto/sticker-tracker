import { Group, Team } from './types';

export const GROUPS: Group[] = [
  { id: "A", teams: [
    { code: "MEX", name: "Mexico",          flag: "🇲🇽" },
    { code: "RSA", name: "South Africa",    flag: "🇿🇦" },
    { code: "KOR", name: "Korea Republic",  flag: "🇰🇷" },
    { code: "CZE", name: "Czechia",         flag: "🇨🇿" },
  ]},
  { id: "B", teams: [
    { code: "CAN", name: "Canada",            flag: "🇨🇦" },
    { code: "BIH", name: "Bosnia-Herzegovina", flag: "🇧🇦" },
    { code: "QAT", name: "Qatar",             flag: "🇶🇦" },
    { code: "SUI", name: "Switzerland",       flag: "🇨🇭" },
  ]},
  { id: "C", teams: [
    { code: "BRA", name: "Brazil",   flag: "🇧🇷" },
    { code: "MAR", name: "Morocco",  flag: "🇲🇦" },
    { code: "HAI", name: "Haiti",    flag: "🇭🇹" },
    { code: "SCO", name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  ]},
  { id: "D", teams: [
    { code: "USA", name: "USA",      flag: "🇺🇸" },
    { code: "PAR", name: "Paraguay", flag: "🇵🇾" },
    { code: "AUS", name: "Australia",flag: "🇦🇺" },
    { code: "TUR", name: "Türkiye",  flag: "🇹🇷" },
  ]},
  { id: "E", teams: [
    { code: "GER", name: "Germany",      flag: "🇩🇪" },
    { code: "CUW", name: "Curaçao",      flag: "🇨🇼" },
    { code: "CIV", name: "Côte d'Ivoire",flag: "🇨🇮" },
    { code: "ECU", name: "Ecuador",      flag: "🇪🇨" },
  ]},
  { id: "F", teams: [
    { code: "NED", name: "Netherlands", flag: "🇳🇱" },
    { code: "JPN", name: "Japan",       flag: "🇯🇵" },
    { code: "SWE", name: "Sweden",      flag: "🇸🇪" },
    { code: "TUN", name: "Tunisia",     flag: "🇹🇳" },
  ]},
  { id: "G", teams: [
    { code: "BEL", name: "Belgium",    flag: "🇧🇪" },
    { code: "EGY", name: "Egypt",      flag: "🇪🇬" },
    { code: "IRN", name: "IR Iran",    flag: "🇮🇷" },
    { code: "NZL", name: "New Zealand",flag: "🇳🇿" },
  ]},
  { id: "H", teams: [
    { code: "ESP", name: "Spain",       flag: "🇪🇸" },
    { code: "CPV", name: "Cabo Verde",  flag: "🇨🇻" },
    { code: "KSA", name: "Saudi Arabia",flag: "🇸🇦" },
    { code: "URU", name: "Uruguay",     flag: "🇺🇾" },
  ]},
  { id: "I", teams: [
    { code: "FRA", name: "France",  flag: "🇫🇷" },
    { code: "SEN", name: "Senegal", flag: "🇸🇳" },
    { code: "IRQ", name: "Iraq",    flag: "🇮🇶" },
    { code: "NOR", name: "Norway",  flag: "🇳🇴" },
  ]},
  { id: "J", teams: [
    { code: "ARG", name: "Argentina",flag: "🇦🇷" },
    { code: "ALG", name: "Algeria",  flag: "🇩🇿" },
    { code: "AUT", name: "Austria",  flag: "🇦🇹" },
    { code: "JOR", name: "Jordan",   flag: "🇯🇴" },
  ]},
  { id: "K", teams: [
    { code: "POR", name: "Portugal",  flag: "🇵🇹" },
    { code: "COD", name: "Congo DR",  flag: "🇨🇩" },
    { code: "UZB", name: "Uzbekistan",flag: "🇺🇿" },
    { code: "COL", name: "Colombia",  flag: "🇨🇴" },
  ]},
  { id: "L", teams: [
    { code: "ENG", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    { code: "CRO", name: "Croatia", flag: "🇭🇷" },
    { code: "GHA", name: "Ghana",   flag: "🇬🇭" },
    { code: "PAN", name: "Panama",  flag: "🇵🇦" },
  ]},
];

export const TEAM_STICKERS_PER_TEAM = 20;
export const FWC_COUNT = 19;
export const FWC_FRONT_END = 8;

export const FWC_FRONT: string[] = Array.from({ length: FWC_FRONT_END }, (_, i) => `FWC-${i + 1}`);
export const FWC_BACK: string[] = Array.from({ length: FWC_COUNT - FWC_FRONT_END }, (_, i) => `FWC-${i + 1 + FWC_FRONT_END}`);

export const ALL_TEAMS: Team[] = GROUPS.flatMap(g => g.teams.map(t => ({ ...t, group: g.id })));

export const GROUP_COLORS: Record<string, string> = {
  A: "#3fa463", B: "#d23a3a", C: "#e7c93b", D: "#3a7fd2",
  E: "#e07b2a", F: "#1f9ea0", G: "#9b6dd1", H: "#56b8d4",
  I: "#7a4ed1", J: "#e8a3b1", K: "#d0397e", L: "#5fb3a4",
};

export const allStickerIds = (): string[] => {
  const ids: string[] = [];
  for (const t of ALL_TEAMS) {
    for (let i = 1; i <= TEAM_STICKERS_PER_TEAM; i++) ids.push(`${t.code}-${i}`);
  }
  for (let i = 1; i <= FWC_COUNT; i++) ids.push(`FWC-${i}`);
  return ids;
};

export const TOTAL_STICKERS = GROUPS.reduce((s, g) => s + g.teams.length, 0) * TEAM_STICKERS_PER_TEAM + FWC_COUNT;

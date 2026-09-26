/**
 * Spanish glossary: the one list of how recurring game terms are said in
 * Spanish (Spain), so every item, quest, bark and menu uses the same word.
 * Simple, natural game Spanish — the words a player would use — not
 * literary or archaic. Fictional proper names stay as they are (Wildkeep,
 * Rattles, Grukk, Nargle…); descriptive place names are translated
 * (Bosque Susurrante).
 *
 * Adding a term: put it here first, then use it everywhere. In dev, the
 * dictionaries are scanned for the `avoid` spellings (see checkGlossary).
 */
export const GLOSSARY_ES: { en: string; es: string; avoid?: string[] }[] = [
  // Creatures
  { en: "Goblin", es: "goblin (pl. goblins)", avoid: ["trasgo"] },
  { en: "Orc", es: "orco" },
  { en: "Skeleton", es: "esqueleto" },
  { en: "Slime", es: "slime", avoid: ["babosín"] },
  { en: "Wolf", es: "lobo" },
  { en: "Rat", es: "rata" },
  { en: "Spider", es: "araña" },
  { en: "Bat", es: "murciélago" },
  { en: "Ghost", es: "fantasma" },
  { en: "Wraith", es: "espectro" },
  { en: "Cultist", es: "cultista", avoid: ["sectario"] },
  { en: "Bandit", es: "bandido", avoid: ["bandolero"] },
  { en: "Treant", es: "treant" },
  { en: "Dragon", es: "dragón" },
  // People and places
  { en: "Blacksmith", es: "herrero / herrera" },
  { en: "Forge", es: "fragua" },
  { en: "Merchant", es: "mercader" },
  { en: "Shop", es: "tienda" },
  { en: "Farmer", es: "granjero / granjera" },
  { en: "Wizard", es: "mago / maga" },
  { en: "Hunter", es: "cazador / cazadora" },
  { en: "Tavern", es: "taberna" },
  { en: "Dungeon", es: "mazmorra" },
  { en: "Garden", es: "huerto" },
  // Systems
  { en: "HP", es: "PV" },
  { en: "XP", es: "EXP" },
  { en: "Stamina", es: "aguante" },
  { en: "Mana", es: "maná" },
  { en: "Gold", es: "oro (g)" },
  { en: "Quest (story)", es: "misión" },
  { en: "Job (notice board)", es: "encargo" },
  { en: "Honor", es: "honor" },
  { en: "Reputation", es: "reputación" },
  { en: "Bounty", es: "recompensa por tu cabeza" },
  { en: "Parry", es: "desviar / desvío" },
  { en: "Dodge", es: "esquivar" },
  { en: "Heavy blow", es: "golpe cargado" },
  { en: "Bag", es: "mochila" },
  { en: "Talent", es: "talento" },
  { en: "Skill", es: "habilidad" },
];

/** Dev only: warns about any `avoid` spelling left in the Spanish texts. */
export function checkGlossary(dicts: unknown[]): void {
  const text = JSON.stringify(dicts).toLowerCase();
  for (const g of GLOSSARY_ES)
    for (const bad of g.avoid ?? []) if (text.includes(bad)) console.warn(`[i18n] glossary: "${bad}" found — use "${g.es}" (${g.en})`);
}

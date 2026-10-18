// Data item, harga toko, dan tabel loot Shardfall.
export const ITEMS = {
  health_potion: { name: 'Health Potion', icon: '🧪', kind: 'potion', heal: 40, buy: 20, sell: 8, glow: 0xff5a5a, desc: 'Restores 40 HP.' },
  greater_potion: { name: 'Greater Health Potion', icon: '⚗️', kind: 'potion', heal: 90, buy: 55, sell: 22, glow: 0xff8ad8, desc: 'Restores 90 HP.' },
  speed_elixir: { name: 'Swiftness Elixir', icon: '⚡', kind: 'potion', buff: 'speed', dur: 25, buy: 30, sell: 12, glow: 0x5ad4ff, desc: '+40% movement speed for 25 seconds.' },
  power_elixir: { name: 'Might Elixir', icon: '🔥', kind: 'potion', buff: 'power', dur: 25, buy: 35, sell: 14, glow: 0xff9a3a, desc: '+50% damage for 25 seconds.' },
  bone_fragment: { name: 'Bone Fragment', icon: '🦴', kind: 'material', sell: 4, glow: 0xffffff, desc: 'A brittle shard of bone. The merchant buys these.' },
  root_fiber: { name: 'Root Fiber', icon: '🌿', kind: 'material', sell: 15, glow: 0x7dff7a, desc: "Tough fiber torn from the Root Warden's roots. Sells well." },
  root_shard: { name: 'Crystal Shards', icon: '💎', kind: 'key', glow: 0x6bff9a, desc: 'Shards of the Core Crystal taken from the wardens. Key items, they cannot be sold.' },
  ember_ore: { name: 'Ember Ore', icon: '🪨', kind: 'material', sell: 12, glow: 0xff7a2a, desc: 'Glowing ore from the Ember Mines. The Elder wants it.' },
  frost_crystal: { name: 'Frost Crystal', icon: '❄️', kind: 'material', sell: 18, glow: 0x9fe8ff, desc: 'A sliver of eternal ice. Sells well.' },
  void_shard: { name: 'Void Shard', icon: '🔮', kind: 'material', sell: 26, glow: 0xb07aff, desc: 'A fragment of the broken Core. It hums faintly.' },
};

// Alat bantu berburu
Object.assign(ITEMS, {
  bomb: { name: 'Fire Bomb', icon: '💣', kind: 'tool', use: 'bomb', buy: 45, sell: 15, glow: 0xff7a2a, desc: 'Explodes around you for heavy area damage. Hotkey 5.' },
  return_scroll: { name: 'Return Scroll', icon: '📜', kind: 'tool', use: 'return', buy: 40, sell: 14, glow: 0xffe08a, desc: 'Instantly teleports you back to the village.' },
});

// Equipment. Slot: weapon, armor, helm, boots, ring.
// atk = bonus damage (0.3 = +30%), def = defense, hp = max HP, spd = move speed (0.1 = +10%), crit = crit chance
export const SLOTS = ['weapon', 'armor', 'helm', 'boots', 'ring'];
export const SLOT_ICON = { weapon: '⚔️', armor: '🛡️', helm: '🪖', boots: '👢', ring: '💍' };
const gear = (name, icon, slot, lvl, stats, buy, extra = {}) => ({
  name, icon, kind: 'gear', slot, lvl, ...stats, buy, sell: Math.round(buy * 0.35), glow: extra.glow || 0xbfd0ff, ...extra,
});
Object.assign(ITEMS, {
  // Senjata
  rusty_sword: gear("Traveler's Sword", '🗡️', 'weapon', 1, { atk: 0 }, 10, { desc: 'A plain sword. Reliable, if unremarkable.', sell: 3 }),
  iron_sword: gear('Iron Sword', '🗡️', 'weapon', 2, { atk: 0.3 }, 90, { desc: 'Solid iron. +30% damage.', tint: 0x8899aa, scale: 1.1 }),
  steel_blade: gear('Steel Blade', '⚔️', 'weapon', 5, { atk: 0.7 }, 260, { desc: 'Sharp, balanced steel. +70% damage.', tint: 0x4aa8ff, scale: 1.2 }),
  knight_longsword: gear("Knight's Longsword", '⚔️', 'weapon', 8, { atk: 1.2, crit: 0.05 }, 600, { desc: '+120% damage, +5% crit chance.', tint: 0xffd36b, scale: 1.35 }),
  root_blade: gear('Rootbound Blade', '🌿', 'weapon', 3, { atk: 0.9, crit: 0.05 }, 300, { desc: "Forged from the Root Warden's heartwood. +90% damage, +5% crit.", tint: 0x4dff7a, scale: 1.25, glow: 0x6bff9a }),
  // Boss region 2-4
  ember_blade: gear('Emberforged Blade', '🔥', 'weapon', 6, { atk: 1.1, crit: 0.06 }, 520, { desc: 'Still hot to the touch. +110% damage, +6% crit.', tint: 0xff6a2a, scale: 1.3, glow: 0xff7a2a }),
  ember_plate: gear('Emberforged Plate', '🔥', 'armor', 6, { def: 11, hp: 25 }, 480, { desc: '+11 defense, +25 max HP.', glow: 0xff7a2a }),
  frost_edge: gear('Frostbrand', '❄️', 'weapon', 9, { atk: 1.6, crit: 0.06 }, 800, { desc: 'Rimed with eternal frost. +160% damage, +6% crit.', tint: 0x7fdcff, scale: 1.35, glow: 0x9fe8ff }),
  frost_mail: gear('Frostwoven Mail', '❄️', 'armor', 9, { def: 16, hp: 35 }, 760, { desc: '+16 defense, +35 max HP.', glow: 0x9fe8ff }),
  hollow_blade: gear('Hollow Blade', '🔮', 'weapon', 12, { atk: 2.3, crit: 0.1 }, 1200, { desc: 'It cuts more than flesh. +230% damage, +10% crit.', tint: 0xb07aff, scale: 1.45, glow: 0xb07aff }),
  hollow_plate: gear('Hollow Plate', '🔮', 'armor', 12, { def: 22, hp: 50 }, 1100, { desc: '+22 defense, +50 max HP.', glow: 0xb07aff }),
  // Armor
  leather_armor: gear('Leather Armor', '🥋', 'armor', 1, { def: 3 }, 70, { desc: 'Light and flexible. +3 defense.' }),
  chain_mail: gear('Chain Mail', '🛡️', 'armor', 4, { def: 7, hp: 10 }, 220, { desc: '+7 defense, +10 max HP.' }),
  plate_armor: gear('Plate Armor', '🛡️', 'armor', 8, { def: 13, hp: 25 }, 560, { desc: 'Heavy plate. +13 defense, +25 max HP.' }),
  root_mail: gear('Rootweave Mail', '🌿', 'armor', 3, { def: 9, hp: 20 }, 280, { desc: 'Living bark woven into mail. +9 defense, +20 max HP.', glow: 0x6bff9a }),
  // Helm
  leather_cap: gear('Leather Cap', '🧢', 'helm', 1, { def: 1, hp: 5 }, 40, { desc: '+1 defense, +5 max HP.' }),
  iron_helm: gear('Iron Helm', '🪖', 'helm', 3, { def: 3, hp: 10 }, 130, { desc: '+3 defense, +10 max HP.' }),
  knight_helm: gear("Knight's Helm", '🪖', 'helm', 7, { def: 6, hp: 20 }, 380, { desc: '+6 defense, +20 max HP.' }),
  // Sepatu
  worn_boots: gear('Worn Boots', '👢', 'boots', 1, { def: 1, spd: 0.05 }, 50, { desc: '+1 defense, +5% move speed.' }),
  swift_boots: gear('Swift Boots', '👢', 'boots', 4, { def: 2, spd: 0.12 }, 200, { desc: '+2 defense, +12% move speed.' }),
  // Cincin
  ring_power: gear('Ring of Fury', '💍', 'ring', 3, { crit: 0.08 }, 180, { desc: '+8% crit chance.', glow: 0xff7a5a }),
  ring_life: gear('Ring of Vitality', '💍', 'ring', 3, { hp: 30 }, 180, { desc: '+30 max HP.', glow: 0x7aff8a }),
  ring_guard: gear('Ring of Warding', '💍', 'ring', 3, { def: 4 }, 180, { desc: '+4 defense.', glow: 0x7ab8ff }),
});

export const SHOP = ['health_potion', 'greater_potion', 'speed_elixir', 'power_elixir', 'bomb', 'return_scroll'];
export const SHOP_GEAR = [
  'iron_sword', 'steel_blade', 'knight_longsword',
  'leather_armor', 'chain_mail', 'plate_armor',
  'leather_cap', 'iron_helm', 'knight_helm',
  'worn_boots', 'swift_boots',
  'ring_power', 'ring_life', 'ring_guard',
];

// XP yang didapat per musuh
export const XP = { minion: 8, warrior: 16, boss: 150 };

// Setiap entri: peluang jatuh; min/max jumlah (default 1)
export const LOOT = {
  minion: [
    { id: 'gold', chance: 0.6, min: 2, max: 6 },
    { id: 'health_potion', chance: 0.12 },
    { id: 'bone_fragment', chance: 0.4 },
    { id: 'bomb', chance: 0.04 },
    { id: 'return_scroll', chance: 0.02 },
    { id: 'leather_cap', chance: 0.015 },
  ],
  warrior: [
    { id: 'gold', chance: 0.85, min: 6, max: 14 },
    { id: 'health_potion', chance: 0.2 },
    { id: 'greater_potion', chance: 0.05 },
    { id: 'speed_elixir', chance: 0.05 },
    { id: 'power_elixir', chance: 0.05 },
    { id: 'bone_fragment', chance: 0.6 },
    { id: 'bomb', chance: 0.08 },
    { id: 'iron_sword', chance: 0.03 },
    { id: 'leather_armor', chance: 0.03 },
    { id: 'worn_boots', chance: 0.04 },
    { id: 'iron_helm', chance: 0.03 },
  ],
  boss: [
    { id: 'gold', chance: 1, min: 120, max: 180 },
    { id: 'greater_potion', chance: 1, min: 2, max: 2 },
    { id: 'health_potion', chance: 1, min: 2, max: 2 },
    { id: 'power_elixir', chance: 1 },
    { id: 'root_fiber', chance: 1, min: 3, max: 3 },
  ],
};

// Model 3D dari dungeon pack untuk barang yang jatuh (selain itu pakai bentuk sederhana)
export const LOOT_MODELS = {
  health_potion: 'bottle_A_labeled_green',
  greater_potion: 'bottle_C_green',
  speed_elixir: 'bottle_B_green',
  power_elixir: 'bottle_A_labeled_brown',
  gold: 'coin',
};
export const LOOT_FILES = [...new Set(Object.values(LOOT_MODELS))];

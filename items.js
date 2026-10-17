// Data item, harga toko, dan tabel loot Shardfall.
export const ITEMS = {
  health_potion: { name: 'Health Potion', icon: '🧪', kind: 'potion', heal: 40, buy: 20, sell: 8, glow: 0xff5a5a, desc: 'Restores 40 HP.' },
  greater_potion: { name: 'Greater Health Potion', icon: '⚗️', kind: 'potion', heal: 90, buy: 55, sell: 22, glow: 0xff8ad8, desc: 'Restores 90 HP.' },
  speed_elixir: { name: 'Swiftness Elixir', icon: '⚡', kind: 'potion', buff: 'speed', dur: 25, buy: 30, sell: 12, glow: 0x5ad4ff, desc: '+40% movement speed for 25 seconds.' },
  power_elixir: { name: 'Might Elixir', icon: '🔥', kind: 'potion', buff: 'power', dur: 25, buy: 35, sell: 14, glow: 0xff9a3a, desc: '+50% damage for 25 seconds.' },
  bone_fragment: { name: 'Bone Fragment', icon: '🦴', kind: 'material', sell: 4, glow: 0xffffff, desc: 'A brittle shard of bone. The merchant buys these.' },
  root_fiber: { name: 'Root Fiber', icon: '🌿', kind: 'material', sell: 15, glow: 0x7dff7a, desc: "Tough fiber torn from the Root Warden's roots. Sells well." },
  root_shard: { name: 'Root Shard', icon: '💎', kind: 'key', glow: 0x6bff9a, desc: 'A crystal shard from the Root Warden. A key item, it cannot be sold.' },
};

export const SHOP = ['health_potion', 'greater_potion', 'speed_elixir', 'power_elixir'];

// Setiap entri: peluang jatuh; min/max jumlah (default 1)
export const LOOT = {
  minion: [
    { id: 'gold', chance: 0.6, min: 2, max: 6 },
    { id: 'health_potion', chance: 0.12 },
    { id: 'bone_fragment', chance: 0.4 },
  ],
  warrior: [
    { id: 'gold', chance: 0.85, min: 6, max: 14 },
    { id: 'health_potion', chance: 0.2 },
    { id: 'greater_potion', chance: 0.05 },
    { id: 'speed_elixir', chance: 0.05 },
    { id: 'power_elixir', chance: 0.05 },
    { id: 'bone_fragment', chance: 0.6 },
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

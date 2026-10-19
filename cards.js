// Kartu 3D (Quaternius 3D Card Kit - Fantasy, CC0): kartu pilihan saat naik level + piala boss.
// Bonus: atk/crit/spd/gold/xp = pecahan (0.1 = +10%), def/hp/mp = angka tetap.
export const CARDS = {
  fireball: { file: '1_Fireball', name: 'Fireball', desc: '+10% damage', atk: 0.1 },
  block: { file: '29_Block', name: 'Block', desc: '+3 defense', def: 3 },
  rebirth: { file: '17_Rebirth', name: 'Rebirth', desc: '+20 max HP', hp: 20 },
  air: { file: '22_Element_Air', name: 'Gale', desc: '+5% move speed', spd: 0.05 },
  lightning: { file: '21_Element_Lightning', name: 'Lightning', desc: '+4% crit chance', crit: 0.04 },
  water: { file: '23_Element_Water', name: 'Tide', desc: '+12 max MP', mp: 12 },
  earth: { file: '25_Element_Earth', name: 'Bedrock', desc: '+2 defense, +10 max HP', def: 2, hp: 10 },
  dark: { file: '24_Element_Dark', name: 'Shadow', desc: '+6% damage, +2% crit', atk: 0.06, crit: 0.02 },
  coin: { file: '14_Coin', name: 'Fortune', desc: '+15% gold from drops', gold: 0.15 },
  book: { file: '27_Book', name: 'Tome', desc: '+12% XP gained', xp: 0.12 },
};
export const MAX_CARD_STACK = 5;

// Piala boss: didapat sekali saat boss wilayah pertama kali dikalahkan
export const TROPHIES = {
  root: { file: '2_TrenchcoatMushrooms', name: 'Root Warden Trophy', desc: '+5% damage, +10 max HP', atk: 0.05, hp: 10 },
  ember: { file: '26_BloodRing', name: 'Ashen Smith Trophy', desc: '+5% damage, +2% crit', atk: 0.05, crit: 0.02 },
  frost: { file: '18_WaterDragon', name: 'Frost Sentinel Trophy', desc: '+3 defense, +10 max MP', def: 3, mp: 10 },
  core: { file: '15_Cult', name: 'Hollow King Trophy', desc: '+8% damage, +15 max HP', atk: 0.08, hp: 15 },
};

export const CARD_FILES = [...new Set([...Object.values(CARDS), ...Object.values(TROPHIES)].map((c) => c.file))];
export const CARD_FRAME_FILES = ['0_Card_Front', '0_Card_Mask'];
export const CARD_ALL_FILES = [...CARD_FRAME_FILES, ...CARD_FILES];

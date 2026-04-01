const DEFAULT_STAR_ASSET = "g_star1.png";
const DEFAULT_STAR_PATH = `./src/assets/${DEFAULT_STAR_ASSET}`;

const STAR_DISPLAY_NAMES = [
  "Scarlett Blaze",
  "Ruby Vane",
  "Luna Hart",
  "Carmen Vale",
  "Jade Monroe",
  "Ivy Noir",
  "Stella Cruz",
  "Nina Velvet",
  "Aurora Kane",
  "Sasha Bloom",
  "Bella Storm",
  "Violet Rae",
  "Naomi Lace",
  "Zara Quinn",
  "Mila Rose",
  "Serena Fox",
  "Kiara Lux",
  "Vanessa Moon",
  "Bianca Flame",
  "Selena Dove",
  "Adriana Skye",
  "Nicole Hart",
  "Amber Knight",
  "Victoria Blaze",
  "Elena Frost",
  "Isabella Voss",
];

function makeGirlStar(index) {
  const file = `g_star${index}.png`;
  const energyGain = Math.min(36, 8 + Math.floor((index - 1) / 2) * 2);
  const coinValue = 16 + index * 3;

  return {
    id: index,
    code: `g_star${index}`,
    name: STAR_DISPLAY_NAMES[index - 1] || `Star ${index}`,
    gender: "female",
    rarity: index >= 21 ? "legendary" : index >= 13 ? "epic" : index >= 7 ? "rare" : "common",
    coinValue,
    energyGain,
    twinId: null,
    assetName: file,
    assetPath: `./src/assets/${file}`,
    image: `./src/assets/${file}`,
    fallbackImage: DEFAULT_STAR_PATH,
  };
}

export const stars = [
  ...Array.from({ length: 26 }, (_, i) => makeGirlStar(i + 1)),
  {
    id: 27,
    code: "twins1",
    name: "Velvet Twins",
    gender: "female",
    rarity: "legendary",
    coinValue: 110,
    energyGain: 34,
    twinId: null,
    assetName: "twins1.png",
    assetPath: "./src/assets/twins1.png",
    image: "./src/assets/twins1.png",
    fallbackImage: DEFAULT_STAR_PATH,
  },
].map((star, index, list) => ({
  ...star,
  order: index,
  fallbackImage:
    star.fallbackImage ||
    list[index - 1]?.assetPath ||
    list[0]?.assetPath ||
    DEFAULT_STAR_PATH,
}));

export const starAssetMap = Object.fromEntries(
  stars.map((star) => [star.code, star.assetPath])
);

export function getStarById(id) {
  return stars.find((star) => Number(star.id) === Number(id)) || null;
}

export function getStarByCode(code) {
  return stars.find((star) => String(star.code) === String(code)) || null;
}

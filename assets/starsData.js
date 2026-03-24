function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mk(id, name, gender, extra = {}) {
  const coinValue = rnd(6, 18);
  const energyGain = rnd(2, 6);
  const image = gender === "male" ? "star_m" : "star_f"; // Assets KEY
  return { id, name, gender, coinValue, energyGain, image, ...extra };
}

export const stars = (() => {
  const arr = [];
  let id = 1;

  // 5 ikiz çift = 10 kişi
  const twinPairs = [
    ["tw1", "Nova Twin", "Vega Twin"],
    ["tw2", "Silk Twin", "Storm Twin"],
    ["tw3", "Blaze Twin", "Velvet Twin"],
    ["tw4", "Rouge Twin", "Skye Twin"],
    ["tw5", "Diamond Twin", "Moon Twin"],
  ];

  for (const [twinId, a, b] of twinPairs) {
    arr.push(mk(id++, a, "female", { twinId }));
    arr.push(mk(id++, b, "female", { twinId }));
  }

  // Erkek 15
  const maleNames = [
    "Alex Steel","Victor Stone","Leo Rush","Max Power","Tony Blaze",
    "Rico Vega","Marco Storm","Dante Cruz","Ivan Blade","Niko Night",
    "Kane Wolf","Adrian Fox","Rafael Noir","Luca Shade","Mason Viper",
  ];
  for (const n of maleNames) arr.push(mk(id++, n, "male"));

  // Kalanlar kadın (50’ye tamamla)
  const femaleNames = [
    "Luna Vega","Sasha Velvet","Nina Blaze","Kira Moon","Lola Vixen",
    "Bella Storm","Roxy Heat","Jade Sin","Candy Rouge","Alexa Noir",
    "Mila Desire","Nora Bliss","Eva Diamond","Lily Skye","Ruby Flame",
    "Tina Rush","Katy Nova","Lana Bliss","Vera Silk","Maya Gold",
    "Ivy Storm","Nadia Kiss","Daisy Rouge","Elena Blaze","Zoe Night",
    "Aria Frost","Violet Ray","Selena Tide","Jenna Spark","Mira Lux",
  ];

  for (const n of femaleNames) {
    if (arr.length >= 50) break;
    arr.push(mk(id++, n, "female"));
  }

  return arr.slice(0, 50);
})();
export const STARS_CURRENCY = "XTR";

export const STARS_PRODUCTS = [
  { id: "game_star_100", titleTr: "100 Oyun Star", titleEn: "100 Game Stars", priceStars: 100, grant: { gameStars: 100, withdrawable: false } },
  { id: "game_star_250", titleTr: "250 Oyun Star", titleEn: "250 Game Stars", priceStars: 250, grant: { gameStars: 250, withdrawable: false } },
  { id: "game_star_500", titleTr: "500 Oyun Star", titleEn: "500 Game Stars", priceStars: 500, grant: { gameStars: 500, withdrawable: false } },
  { id: "game_star_1000", titleTr: "1000 Oyun Star", titleEn: "1000 Game Stars", priceStars: 1000, grant: { gameStars: 1000, withdrawable: false } },
  { id: "game_star_2500", titleTr: "2500 Oyun Star", titleEn: "2500 Game Stars", priceStars: 2500, grant: { gameStars: 2500, withdrawable: false } },
  { id: "game_star_5000", titleTr: "5000 Oyun Star", titleEn: "5000 Game Stars", priceStars: 5000, grant: { gameStars: 5000, withdrawable: false } },
  { id: "game_star_10000", titleTr: "10000 Oyun Star", titleEn: "10000 Game Stars", priceStars: 10000, grant: { gameStars: 10000, withdrawable: false } },
];

export function getStarsProduct(productId) {
  const key = String(productId || "").trim();
  return STARS_PRODUCTS.find((product) => product.id === key) || null;
}

export function getStarsProductTitle(product, lang = "tr") {
  if (!product) return "";
  return lang === "en" ? product.titleEn : product.titleTr;
}

export function getStarsProductDescription(product, lang = "tr") {
  if (!product) return "";
  return lang === "en"
    ? "Non-withdrawable in-game Star balance bought with Telegram Stars."
    : "Telegram Stars ile alinan, cekilemeyen oyun ici Star bakiyesi.";
}

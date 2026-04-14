import { fetchBackendJson } from "./supabase.js?v=20260408-3";

export const WALLET_APP_URL = "https://toncrime-wallet.vercel.app";

function appendWalletParams(url, params = {}) {
  for (const [key, value] of Object.entries(params || {})) {
    const cleanKey = String(key || "").trim();
    const cleanValue = String(value ?? "").trim();
    if (cleanKey && cleanValue) url.searchParams.set(cleanKey, cleanValue);
  }
  return url;
}

export function getWalletAppUrl(params = {}) {
  const url = new URL(WALLET_APP_URL);
  appendWalletParams(url, params);
  return url.toString();
}

function openUrlExternal(url) {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url, { try_instant_view: false });
      return true;
    }
  } catch (_) {}

  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  } catch (_) {
    try {
      window.location.href = url;
      return true;
    } catch (_) {
      return false;
    }
  }
}

export async function createWalletHandoff(params = {}) {
  const payload = {
    intent: String(params.intent || "").trim(),
    business_type: String(params.businessType || params.business_type || "").trim(),
  };

  const json = await fetchBackendJson("/public/wallet/handoff", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    signed: true,
    token: String(json?.token || "").trim(),
    url: String(json?.wallet_url || "").trim() || getWalletAppUrl(params),
    expiresIn: Number(json?.expires_in || 0),
  };
}

export async function openExternalWallet(params = {}) {
  try {
    const handoff = await createWalletHandoff(params);
    const opened = openUrlExternal(handoff.url);
    return { ...handoff, opened };
  } catch (err) {
    const fallbackUrl = getWalletAppUrl({
      intent: params.intent,
      business_type: params.businessType || params.business_type,
      source: params.source || "game",
    });
    const opened = openUrlExternal(fallbackUrl);
    return {
      signed: false,
      opened,
      url: fallbackUrl,
      error: err?.message || String(err || "wallet handoff failed"),
    };
  }
}

try {
  window.tcOpenExternalWallet = openExternalWallet;
  window.tcGetWalletAppUrl = getWalletAppUrl;
} catch (_) {}

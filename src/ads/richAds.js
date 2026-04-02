const SUPPORTED_RICH_AD_METHODS = [
  "triggerInterstitialVideo",
  "triggerRewardedVideo",
  "showRewardedVideo",
  "showRewarded",
  "showVideo",
];

function getCallableRichAdsMethod(controller) {
  if (!controller || typeof controller !== "object") return null;
  for (const methodName of SUPPORTED_RICH_AD_METHODS) {
    if (typeof controller[methodName] === "function") {
      return controller[methodName].bind(controller);
    }
  }
  return null;
}

export function hasRichAdsController(controller) {
  return !!getCallableRichAdsMethod(controller);
}

export function isCompletedAdResult(result) {
  if (result == null) return true;
  if (typeof result === "boolean") return result;

  if (typeof result === "object") {
    if (typeof result.rewarded === "boolean") return result.rewarded;
    if (typeof result.completed === "boolean") return result.completed;
    if (typeof result.success === "boolean") return result.success;
    if (typeof result.done === "boolean") return result.done;

    const status = String(result.status || result.state || result.result || "").toLowerCase();
    if (status && /(close|closed|cancel|skip|error|fail|reject)/.test(status)) return false;
  }

  return true;
}

export async function waitForRichAdsController(timeoutMs = 1800) {
  const direct = window.tcRichAdsController || window.TelegramAdsController;
  if (hasRichAdsController(direct)) return direct;

  const pending = window.tcRichAdsReady;
  if (!pending || typeof pending.then !== "function") return null;

  try {
    const controller = await Promise.race([
      pending,
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return hasRichAdsController(controller) ? controller : null;
  } catch (_) {
    return null;
  }
}

export async function playRichRewardedAd(timeoutMs = 1800) {
  const controller = await waitForRichAdsController(timeoutMs);
  if (!controller) {
    return { ok: false, reason: "controller_missing", controller: null, result: null };
  }

  const run = getCallableRichAdsMethod(controller);
  if (!run) {
    return { ok: false, reason: "method_missing", controller, result: null };
  }

  try {
    const result = await run();
    if (!isCompletedAdResult(result)) {
      return { ok: false, reason: "not_completed", controller, result };
    }
    return { ok: true, reason: "completed", controller, result };
  } catch (error) {
    return { ok: false, reason: "error", controller, result: null, error };
  }
}

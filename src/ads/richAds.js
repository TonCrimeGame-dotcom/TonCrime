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

function collectFailureBits(value, out = [], depth = 0) {
  if (value == null || depth > 2) return out;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return out;
  }
  if (value instanceof Error) {
    if (value.name) out.push(value.name);
    if (value.message) out.push(value.message);
    return out;
  }
  if (typeof value === "object") {
    [
      value.message,
      value.reason,
      value.error,
      value.description,
      value.details,
      value.detail,
      value.status,
      value.state,
      value.result,
      value.code,
      value.type,
    ].forEach((entry) => collectFailureBits(entry, out, depth + 1));
    return out;
  }
  return out;
}

function normalizeFailureText(value, fallback = "") {
  const bits = collectFailureBits(value, []);
  const unique = [];
  for (const bit of bits) {
    const normalized = String(bit || "").replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    if (!unique.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
      unique.push(normalized);
    }
  }
  const text = unique.join(" | ").slice(0, 160);
  return text || fallback;
}

function rememberRichAdsFailure(reason, payload) {
  try {
    window.tcLastRichAdsFailure = {
      at: Date.now(),
      reason: String(reason || ""),
      detail: normalizeFailureText(payload, String(reason || "")),
      payload,
    };
  } catch (_) {}
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

export function describeRichAdFailure(playResult, fallback = "") {
  if (!playResult) return fallback || "unknown";

  const reason = String(playResult.reason || "").trim();
  const source = playResult.error ?? playResult.result ?? playResult;
  const detail = normalizeFailureText(source, "");

  if (detail) return detail;
  if (reason) return reason;
  return fallback || "unknown";
}

async function createRichAdsControllerOnDemand() {
  if (typeof window.tcCreateRichAdsController === "function") {
    try {
      const controller = await window.tcCreateRichAdsController();
      if (hasRichAdsController(controller)) return controller;
    } catch (_) {}
  }

  const ControllerCtor = window.TelegramAdsController;
  const config = window.tcRichAdsConfig;
  if (typeof ControllerCtor !== "function" || !config) return null;

  try {
    const controller = new ControllerCtor();
    const initResult = controller.initialize?.(config);
    if (initResult && typeof initResult.then === "function") {
      await initResult;
    }
    window.tcRichAdsController = controller;
    return hasRichAdsController(controller) ? controller : null;
  } catch (_) {
    return null;
  }
}

export async function waitForRichAdsController(timeoutMs = 1800) {
  const direct = window.tcRichAdsController;
  if (hasRichAdsController(direct)) return direct;

  const pending = window.tcRichAdsReady;
  if (pending && typeof pending.then === "function") {
    try {
      const controller = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (hasRichAdsController(controller)) return controller;
    } catch (_) {}
  }

  try {
    const controller = await Promise.race([
      createRichAdsControllerOnDemand(),
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return hasRichAdsController(controller) ? controller : null;
  } catch (_) {
    return null;
  }
}

export async function playRichRewardedAd(timeoutMs = 4000) {
  const controller = await waitForRichAdsController(timeoutMs);
  if (!controller) {
    const failure = { ok: false, reason: "controller_missing", controller: null, result: null };
    rememberRichAdsFailure(failure.reason, failure);
    return failure;
  }

  const run = getCallableRichAdsMethod(controller);
  if (!run) {
    const failure = { ok: false, reason: "method_missing", controller, result: null };
    rememberRichAdsFailure(failure.reason, failure);
    return failure;
  }

  try {
    const result = await run();
    if (!isCompletedAdResult(result)) {
      const failure = { ok: false, reason: "not_completed", controller, result };
      rememberRichAdsFailure(failure.reason, result);
      return failure;
    }
    try { window.tcLastRichAdsFailure = null; } catch (_) {}
    return { ok: true, reason: "completed", controller, result };
  } catch (error) {
    const failure = { ok: false, reason: "error", controller, result: null, error };
    rememberRichAdsFailure(failure.reason, error);
    return failure;
  }
}

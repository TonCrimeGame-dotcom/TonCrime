const SUPPORTED_RICH_AD_METHODS = [
  "triggerInterstitialVideo",
  "triggerRewardedVideo",
  "showRewardedVideo",
  "showRewarded",
  "showVideo",
];
const NULL_OBJECT_ERROR_RE =
  /(null is not an object|undefined is not an object|cannot read properties of null|cannot read properties of undefined)/i;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTelegramMiniAppSnapshot() {
  const tg = window.Telegram?.WebApp || null;
  const user = tg?.initDataUnsafe?.user || null;
  return {
    tg,
    user,
    userId: user?.id != null ? String(user.id) : "",
    initData: String(tg?.initData || ""),
  };
}

function getRichAdsControllerMeta() {
  try {
    return window.tcRichAdsControllerMeta || null;
  } catch (_) {
    return null;
  }
}

function resetRichAdsControllerCache() {
  try {
    window.tcRichAdsController = null;
    window.tcRichAdsControllerMeta = null;
    window.tcRichAdsReady = Promise.resolve(null);
  } catch (_) {}
}

function shouldReplaceCachedController(controller, forceFresh = false) {
  if (forceFresh) return true;
  if (!hasRichAdsController(controller)) return true;

  const snapshot = getTelegramMiniAppSnapshot();
  const meta = getRichAdsControllerMeta();
  if (!meta) return false;

  if (snapshot.userId && meta.userId && snapshot.userId !== meta.userId) return true;
  if (snapshot.initData && !Number(meta.initDataLength || 0)) return true;
  return false;
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

function isNullObjectFailure(error) {
  const detail = normalizeFailureText(error, "");
  return NULL_OBJECT_ERROR_RE.test(detail);
}

async function waitForTelegramMiniAppReady(timeoutMs = 4000) {
  if (typeof window.tcWaitForTelegramMiniAppReady === "function") {
    try {
      return await window.tcWaitForTelegramMiniAppReady(timeoutMs);
    } catch (_) {}
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = getTelegramMiniAppSnapshot();
    try {
      snapshot.tg?.ready?.();
    } catch (_) {}
    if (snapshot.user && snapshot.initData) return snapshot;
    await sleep(120);
  }

  return getTelegramMiniAppSnapshot();
}

async function waitForRichAdsSdk(timeoutMs = 4000) {
  if (typeof window.tcWaitForRichAdsSdk === "function") {
    try {
      return await window.tcWaitForRichAdsSdk(timeoutMs);
    } catch (_) {}
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (typeof window.TelegramAdsController === "function") return window.TelegramAdsController;
    await sleep(120);
  }
  return typeof window.TelegramAdsController === "function" ? window.TelegramAdsController : null;
}

async function reloadRichAdsSdk(timeoutMs = 5000) {
  if (typeof window.tcReloadRichAdsSdk === "function") {
    try {
      return await window.tcReloadRichAdsSdk(timeoutMs);
    } catch (_) {
      return null;
    }
  }
  return null;
}

async function createRichAdsControllerOnDemand(options = {}) {
  const forceFresh = !!options.forceFresh;

  if (!forceFresh) {
    const cached = window.tcRichAdsController;
    if (!shouldReplaceCachedController(cached, false)) {
      if (hasRichAdsController(cached)) return cached;
    }
  }

  if (typeof window.tcCreateRichAdsController === "function") {
    try {
      const controller = await window.tcCreateRichAdsController({ forceFresh });
      if (hasRichAdsController(controller)) return controller;
    } catch (_) {}
  }

  await waitForTelegramMiniAppReady(4200);
  const ControllerCtor = await waitForRichAdsSdk(4200);
  const config = window.tcRichAdsConfig;
  if (typeof ControllerCtor !== "function" || !config) return null;

  try {
    if (forceFresh) resetRichAdsControllerCache();
    const controller = new ControllerCtor();
    const initResult = controller.initialize?.(config);
    if (initResult && typeof initResult.then === "function") {
      await initResult;
    }
    const snapshot = getTelegramMiniAppSnapshot();
    window.tcRichAdsController = controller;
    window.tcRichAdsControllerMeta = {
      createdAt: Date.now(),
      userId: snapshot.userId,
      initDataLength: snapshot.initData.length,
    };
    return hasRichAdsController(controller) ? controller : null;
  } catch (_) {
    return null;
  }
}

export async function waitForRichAdsController(timeoutMs = 1800, options = {}) {
  const forceFresh = !!options.forceFresh;
  const direct = window.tcRichAdsController;
  if (!shouldReplaceCachedController(direct, forceFresh) && hasRichAdsController(direct)) return direct;

  const pending = forceFresh ? null : window.tcRichAdsReady;
  if (!forceFresh && pending && typeof pending.then === "function") {
    try {
      const controller = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (!shouldReplaceCachedController(controller, false) && hasRichAdsController(controller)) return controller;
    } catch (_) {}
  }

  try {
    const controller = await Promise.race([
      createRichAdsControllerOnDemand({ forceFresh }),
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return hasRichAdsController(controller) ? controller : null;
  } catch (_) {
    return null;
  }
}

async function runRichAdsAdOnce(controller) {
  const run = getCallableRichAdsMethod(controller);
  if (!run) {
    return { ok: false, reason: "method_missing", controller, result: null };
  }

  try {
    const result = await run();
    if (!isCompletedAdResult(result)) {
      return { ok: false, reason: "not_completed", controller, result };
    }
    try {
      window.tcLastRichAdsFailure = null;
    } catch (_) {}
    return { ok: true, reason: "completed", controller, result };
  } catch (error) {
    return { ok: false, reason: "error", controller, result: null, error };
  }
}

export async function playRichRewardedAd(timeoutMs = 5200) {
  await waitForTelegramMiniAppReady(Math.max(timeoutMs, 4200));

  const controller = await waitForRichAdsController(timeoutMs);
  if (!controller) {
    const failure = { ok: false, reason: "controller_missing", controller: null, result: null };
    rememberRichAdsFailure(failure.reason, failure);
    return failure;
  }

  let played = await runRichAdsAdOnce(controller);
  if (!played.ok && played.reason === "error" && isNullObjectFailure(played.error)) {
    resetRichAdsControllerCache();
    const retriedController = await waitForRichAdsController(timeoutMs, { forceFresh: true });
    if (retriedController) {
      played = await runRichAdsAdOnce(retriedController);
    }

    if (!played.ok && played.reason === "error" && isNullObjectFailure(played.error)) {
      await reloadRichAdsSdk(Math.max(timeoutMs, 4800));
      resetRichAdsControllerCache();
      const reloadedController = await waitForRichAdsController(Math.max(timeoutMs, 4800), { forceFresh: true });
      if (reloadedController) {
        played = await runRichAdsAdOnce(reloadedController);
      }
    }
  }

  if (!played.ok) {
    rememberRichAdsFailure(played.reason, played.error ?? played.result ?? played);
  }
  return played;
}

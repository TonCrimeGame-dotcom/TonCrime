const SUPPORTED_RICH_AD_METHODS = [
  "triggerInterstitialVideo",
  "triggerRewardedVideo",
  "showRewardedVideo",
  "showRewarded",
  "showVideo",
];
const RICH_ADS_SDK_URL = "https://richinfo.co/richpartners/telegram/js/tg-ob.js";
const RICH_ADS_INIT_SETTLE_MS = 1600;
const NULL_OBJECT_ERROR_RE =
  /(null is not an object|undefined is not an object|cannot read properties of null|cannot read properties of undefined)/i;

function getCallableRichAdsMethods(controller) {
  if (!controller || typeof controller !== "object") return null;
  for (const methodName of SUPPORTED_RICH_AD_METHODS) {
    if (typeof controller[methodName] === "function") {
      return [
        {
        methodName,
        run: controller[methodName].bind(controller),
        },
      ];
    }
  }
  return null;
}

function getCallableRichAdsMethod(controller) {
  return getCallableRichAdsMethods(controller)?.[0]?.run || null;
}

export function hasRichAdsController(controller) {
  return !!getCallableRichAdsMethod(controller);
}

function getDefaultRichAdsConfig() {
  return {
    pubId: "1006898",
    appId: "6869",
    debug: false,
  };
}

function getRichAdsConfig() {
  const config = window.tcRichAdsConfig;
  if (config && typeof config === "object" && config.pubId && config.appId) return config;
  return getDefaultRichAdsConfig();
}

function getGlobalRichAdsControllerCandidate() {
  const candidates = [
    window.tcRichAdsController,
    window.TelegramAdsControllerInstance,
    window.TelegramAdsController,
    window.richadsController,
  ];
  for (const candidate of candidates) {
    if (hasRichAdsController(candidate)) return candidate;
  }
  return null;
}

function getRichAdsConstructorCandidate() {
  if (typeof window.tcRichAdsControllerCtor === "function") return window.tcRichAdsControllerCtor;
  return typeof window.TelegramAdsController === "function" ? window.TelegramAdsController : null;
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

function isTelegramMiniAppSnapshotReady(snapshot) {
  return !!snapshot?.user && !!snapshot?.initData;
}

function getRichAdsControllerMeta() {
  try {
    return window.tcRichAdsControllerMeta || null;
  } catch (_) {
    return null;
  }
}

function rememberRichAdsController(controller, snapshot = getTelegramMiniAppSnapshot()) {
  if (!hasRichAdsController(controller)) return null;

  const createdAt = Date.now();
  window.tcRichAdsController = controller;
  window.TelegramAdsControllerInstance = controller;
  window.richadsController = controller;
  window.tcRichAdsControllerMeta = {
    createdAt,
    readyAt: createdAt + RICH_ADS_INIT_SETTLE_MS,
    userId: snapshot?.userId || "",
    initDataLength: String(snapshot?.initData || "").length,
  };
  window.tcRichAdsReady = Promise.resolve(controller);
  return controller;
}

function isRichAdsControllerSettled(controller, now = Date.now()) {
  if (!hasRichAdsController(controller)) return false;
  const meta = getRichAdsControllerMeta();
  if (!meta) return true;
  const readyAt = Number(meta.readyAt || 0);
  return !readyAt || now >= readyAt;
}

function resetRichAdsControllerCache() {
  try {
    window.tcRichAdsController = null;
    window.tcRichAdsControllerMeta = null;
    window.TelegramAdsControllerInstance = null;
    window.richadsController = null;
    window.tcRichAdsReady = Promise.resolve(null);
  } catch (_) {}
}

function shouldReplaceCachedController(controller, forceFresh = false) {
  if (forceFresh) return true;
  if (!hasRichAdsController(controller)) return true;

  const snapshot = getTelegramMiniAppSnapshot();
  if (snapshot.userId && !snapshot.initData) return true;
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

export function getRichAdsDiagnosticLabel(playResult = null) {
  const snapshot = getTelegramMiniAppSnapshot();
  const meta = getRichAdsControllerMeta() || {};
  const build = String(window.tcBuildStamp || "").trim() || "na";
  const methodName = String(playResult?.methodName || "").trim();
  const parts = [
    `b=${build}`,
    `tg=${snapshot.user ? 1 : 0}${snapshot.initData ? 1 : 0}`,
    `uid=${snapshot.userId ? 1 : 0}`,
    `i=${String(snapshot.initData || "").length}`,
    `c=${hasRichAdsController(getGlobalRichAdsControllerCandidate()) ? 1 : 0}`,
    `m=${Number(meta.initDataLength || 0)}`,
    `r=${Math.max(0, Number(meta.readyAt || 0) - Date.now()) > 0 ? 0 : 1}`,
  ];
  if (methodName) parts.push(`fn=${methodName}`);
  return parts.join(" ").slice(0, 120);
}

export function isCompletedAdResult(result) {
  if (result == null) return false;
  if (typeof result === "boolean") return result;
  if (typeof result === "string") {
    const status = result.trim().toLowerCase();
    if (!status) return false;
    if (/(close|closed|cancel|skip|error|fail|reject)/.test(status)) return false;
    return /(reward|complete|completed|success|done|finish)/.test(status);
  }

  if (typeof result === "object") {
    if (typeof result.rewarded === "boolean") return result.rewarded;
    if (typeof result.completed === "boolean") return result.completed;
    if (typeof result.success === "boolean") return result.success;
    if (typeof result.done === "boolean") return result.done;

    const status = String(result.status || result.state || result.result || "").toLowerCase();
    if (status && /(close|closed|cancel|skip|error|fail|reject)/.test(status)) return false;
    if (status) return /(reward|complete|completed|success|done|finish)/.test(status);
  }

  return false;
}

export function describeRichAdFailure(playResult, fallback = "") {
  if (!playResult) return fallback || "unknown";

  const reason = String(playResult.reason || "").trim();
  const methodName = String(playResult.methodName || "").trim();
  const source = playResult.error ?? playResult.result ?? playResult;
  const detail = normalizeFailureText(source, "");

  if (detail) return methodName ? `${methodName}: ${detail}` : detail;
  if (methodName && reason) return `${methodName}: ${reason}`;
  if (methodName) return methodName;
  if (reason) return reason;
  return fallback || "unknown";
}

export function isRecoverableRichAdsSdkFailure(playResult) {
  const detail = describeRichAdFailure(playResult, "").toLowerCase();
  if (!detail) return false;

  return (
    detail.includes("triggerinterstitialvideo") &&
    detail.includes("cannot read properties of null") &&
    detail.includes("length")
  );
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
      const result = await window.tcWaitForRichAdsSdk(timeoutMs);
      if (result || getGlobalRichAdsControllerCandidate()) return result || getGlobalRichAdsControllerCandidate();
    } catch (_) {}
  }

  const existingController = getGlobalRichAdsControllerCandidate();
  if (existingController) return existingController;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const controller = getGlobalRichAdsControllerCandidate();
    if (controller) return controller;
    const ctor = getRichAdsConstructorCandidate();
    if (ctor) return ctor;
    await sleep(120);
  }
  return getGlobalRichAdsControllerCandidate() || getRichAdsConstructorCandidate() || null;
}

async function reloadRichAdsSdk(timeoutMs = 5000) {
  if (typeof window.tcReloadRichAdsSdk === "function") {
    try {
      const result = await window.tcReloadRichAdsSdk(timeoutMs);
      if (result || getGlobalRichAdsControllerCandidate()) return result || getGlobalRichAdsControllerCandidate();
    } catch (_) {
      return getGlobalRichAdsControllerCandidate() || null;
    }
  }

  try {
    const current = document.getElementById("tc-richads-sdk");
    if (current?.parentNode) current.parentNode.removeChild(current);
  } catch (_) {}

  const script = document.createElement("script");
  script.id = "tc-richads-sdk";
  script.src = `${RICH_ADS_SDK_URL}?v=${Date.now()}`;
  script.async = true;

  const loaded = new Promise((resolve) => {
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
  });

  document.head.appendChild(script);
  const ok = await Promise.race([
    loaded,
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);

  if (!ok) return getGlobalRichAdsControllerCandidate() || null;
  return waitForRichAdsSdk(timeoutMs);
}

async function createRichAdsControllerOnDemand(options = {}) {
  const forceFresh = !!options.forceFresh;
  const globalController = getGlobalRichAdsControllerCandidate();

  if (!forceFresh && globalController) {
    if (!shouldReplaceCachedController(globalController, false)) {
      return globalController;
    }
  }

  if (typeof window.tcCreateRichAdsController === "function") {
    try {
      const controller = await window.tcCreateRichAdsController({ forceFresh });
      if (hasRichAdsController(controller) && !shouldReplaceCachedController(controller, forceFresh)) {
        return controller;
      }
    } catch (_) {}
  }

  const readySnapshot = await waitForTelegramMiniAppReady(4200);
  if (!isTelegramMiniAppSnapshotReady(readySnapshot)) return null;
  const ctorOrController = await waitForRichAdsSdk(4200);
  if (hasRichAdsController(ctorOrController)) return ctorOrController;

  const ControllerCtor = getRichAdsConstructorCandidate();
  const config = getRichAdsConfig();
  if (typeof ControllerCtor !== "function" || !config) return null;

  try {
    if (forceFresh) resetRichAdsControllerCache();
    const controller = new ControllerCtor();
    const initResult = controller.initialize?.(config);
    if (initResult && typeof initResult.then === "function") {
      await initResult;
    }
    const remembered = rememberRichAdsController(controller, readySnapshot);
    return hasRichAdsController(remembered) && !shouldReplaceCachedController(remembered, forceFresh)
      ? remembered
      : null;
  } catch (_) {
    return null;
  }
}

export async function waitForRichAdsController(timeoutMs = 1800, options = {}) {
  const forceFresh = !!options.forceFresh;
  const direct = getGlobalRichAdsControllerCandidate();
  if (
    !shouldReplaceCachedController(direct, forceFresh) &&
    hasRichAdsController(direct) &&
    isRichAdsControllerSettled(direct)
  ) {
    return direct;
  }

  const pending = forceFresh ? null : window.tcRichAdsReady;
  if (!forceFresh && pending && typeof pending.then === "function") {
    try {
      const controller = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (
        !shouldReplaceCachedController(controller, false) &&
        hasRichAdsController(controller) &&
        isRichAdsControllerSettled(controller)
      ) {
        return controller;
      }
    } catch (_) {}
  }

  try {
    const controller = await Promise.race([
      createRichAdsControllerOnDemand({ forceFresh }),
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (hasRichAdsController(controller) && !shouldReplaceCachedController(controller, forceFresh)) {
      const meta = getRichAdsControllerMeta();
      const waitMs = Math.max(0, Number(meta?.readyAt || 0) - Date.now());
      if (waitMs > 0 && waitMs < timeoutMs) {
        await sleep(waitMs);
      }
    }
    return hasRichAdsController(controller) && !shouldReplaceCachedController(controller, forceFresh) && isRichAdsControllerSettled(controller)
      ? controller
      : null;
  } catch (_) {
    return null;
  }
}

export async function warmRichAdsController(timeoutMs = 4200, options = {}) {
  const forceFresh = !!options.forceFresh;
  await waitForTelegramMiniAppReady(Math.max(timeoutMs, 4200));

  let controller = await waitForRichAdsController(timeoutMs, { forceFresh: false });
  if (controller) return controller;

  if (forceFresh) {
    resetRichAdsControllerCache();
    controller = await createRichAdsControllerOnDemand({ forceFresh: true }).catch(() => null);
    if (controller) return controller;
  }

  controller = await createRichAdsControllerOnDemand({ forceFresh: false }).catch(() => null);
  return controller || null;
}

export function tryPlayRichRewardedAdImmediately() {
  const controller = getGlobalRichAdsControllerCandidate();
  if (!controller || shouldReplaceCachedController(controller, false) || !hasRichAdsController(controller)) {
    return null;
  }

  return (async () => {
    const played = await runRichAdsAdOnce(controller);
    if (!played?.ok) {
      rememberRichAdsFailure(played?.reason || "error", played?.error ?? played?.result ?? played);
    }
    return played;
  })();
}

async function runRichAdsAdOnce(controller) {
  const methods = getCallableRichAdsMethods(controller);
  if (!methods?.length) {
    return { ok: false, reason: "method_missing", controller, result: null };
  }

  const candidate = methods[0];
  try {
    const result = await candidate.run();
    if (!isCompletedAdResult(result)) {
      return {
        ok: false,
        reason: "not_completed",
        controller,
        result,
        methodName: candidate.methodName,
      };
    }
    try {
      window.tcLastRichAdsFailure = null;
    } catch (_) {}
    return { ok: true, reason: "completed", controller, result, methodName: candidate.methodName };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      controller,
      result: null,
      error,
      methodName: candidate.methodName,
    };
  }
}

export async function playRichRewardedAd(timeoutMs = 5200) {
  await waitForTelegramMiniAppReady(Math.max(timeoutMs, 4200));

  const controller = await warmRichAdsController(timeoutMs, { forceFresh: false });
  if (!controller) {
    const debug = {
      hasGlobalController: !!getGlobalRichAdsControllerCandidate(),
      hasCtor: !!getRichAdsConstructorCandidate(),
      hasConfig: !!getRichAdsConfig(),
      hasTelegramApp: !!window.Telegram?.WebApp,
    };
    const failure = {
      ok: false,
      reason: "controller_missing",
      controller: null,
      result: null,
      detail: `controller=${debug.hasGlobalController ? 1 : 0} ctor=${debug.hasCtor ? 1 : 0} cfg=${debug.hasConfig ? 1 : 0} tg=${debug.hasTelegramApp ? 1 : 0}`,
      debug,
    };
    rememberRichAdsFailure(failure.reason, failure);
    return failure;
  }

  let played = await runRichAdsAdOnce(controller);
  if (!played.ok && played.reason === "error" && isNullObjectFailure(played.error)) {
    const retriedController = await warmRichAdsController(Math.max(timeoutMs, 4800), { forceFresh: true });
    if (retriedController && retriedController !== controller) {
      played = await runRichAdsAdOnce(retriedController);
    }
  }

  if (!played.ok) {
    rememberRichAdsFailure(played.reason, played.error ?? played.result ?? played);
  }
  return played;
}

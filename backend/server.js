import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { TonClient, WalletContractV4, internal, toNano, SendMode } from '@ton/ton';
import { beginCell, Address } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* =========================
   ENV
========================= */
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_API_KEY',
];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env var: ${key}`);
  }
}

const PORT = Number(process.env.PORT || 8787);
const ADMIN_API_KEY = String(process.env.ADMIN_API_KEY);
const ADMIN_RATE_LIMIT_WINDOW_MS = Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || 60_000);
const ADMIN_RATE_LIMIT_MAX = Number(process.env.ADMIN_RATE_LIMIT_MAX || 120);
const PUBLIC_RATE_LIMIT_WINDOW_MS = Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS || 60_000);
const PUBLIC_RATE_LIMIT_MAX = Number(process.env.PUBLIC_RATE_LIMIT_MAX || 90);
const CHAT_SEND_WINDOW_MS = Number(process.env.CHAT_SEND_WINDOW_MS || 10_000);
const CHAT_SEND_MAX = Number(process.env.CHAT_SEND_MAX || 5);
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const DEFAULT_TELEGRAM_INIT_DATA_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const TELEGRAM_INIT_DATA_MAX_AGE_SEC = Math.max(
  60,
  Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SEC || DEFAULT_TELEGRAM_INIT_DATA_MAX_AGE_SEC)
);
const ALLOW_INSECURE_PUBLIC_IDENTITY = String(process.env.ALLOW_INSECURE_PUBLIC_IDENTITY || '').trim() === '1';
const ALLOW_GUEST_PUBLIC_IDENTITY = String(process.env.ALLOW_GUEST_PUBLIC_IDENTITY || '').trim() === '1';
const IDENTITY_AUTH_SECRET = String(
  process.env.IDENTITY_AUTH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.ADMIN_API_KEY ||
  ''
).trim();
const SINGLE_DEVICE_SESSION_TTL_MS = Math.max(
  30_000,
  Number(process.env.SINGLE_DEVICE_SESSION_TTL_MS || 60_000)
);
const SINGLE_DEVICE_SESSION_ID_MAX = 96;
const SINGLE_DEVICE_LABEL_MAX = 48;
const MAX_ADMIN_NOTE_LEN = 500;
const PAYOUT_MEMO = String(process.env.TON_PAYOUT_MEMO || 'TonCrime payout');
const CHAT_DEMO_PATTERNS = [
  'deneme%',
  'demo%',
  'test%',
  'sample%',
  'ornek%',
];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* =========================
   SIMPLE RATE LIMIT
========================= */
const rateBuckets = new Map();
const publicRateBuckets = new Map();
const chatSendBuckets = new Map();

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function adminRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + ADMIN_RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  rateBuckets.set(ip, bucket);

  res.setHeader('X-RateLimit-Limit', String(ADMIN_RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, ADMIN_RATE_LIMIT_MAX - bucket.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > ADMIN_RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  next();
}

function takeRateLimitBucket(bucketMap, key, windowMs, max) {
  const now = Date.now();
  const bucket = bucketMap.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  bucketMap.set(key, bucket);

  return {
    limited: bucket.count > max,
    remaining: Math.max(0, max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function makePublicRateLimit(prefix, windowMs = PUBLIC_RATE_LIMIT_WINDOW_MS, max = PUBLIC_RATE_LIMIT_MAX) {
  return (req, res, next) => {
    const bucketKey = `${prefix}:${getClientIp(req)}`;
    const rate = takeRateLimitBucket(publicRateBuckets, bucketKey, windowMs, max);

    res.setHeader('X-Public-RateLimit-Limit', String(max));
    res.setHeader('X-Public-RateLimit-Remaining', String(rate.remaining));
    res.setHeader('X-Public-RateLimit-Reset', String(Math.ceil(rate.resetAt / 1000)));

    if (rate.limited) {
      return res.status(429).json({ ok: false, error: 'Too many requests' });
    }

    next();
  };
}

/* =========================
   HELPERS
========================= */
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-key'];
  if (!token || token !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function getAdminIdentity(req) {
  const raw = String(req.headers['x-admin-user'] || 'admin').trim();
  return raw.slice(0, 120) || 'admin';
}

function sanitizeNote(input, fallback = '') {
  const value = String(input ?? fallback).trim();
  return value.slice(0, MAX_ADMIN_NOTE_LEN);
}

function sanitizeUsername(value, fallback = 'Player') {
  const safe = String(value ?? fallback).trim().replace(/\s+/g, ' ').slice(0, 24);
  return safe || fallback;
}

function asNumber(value, defaultValue = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function asInteger(value, defaultValue = 0) {
  return Math.max(0, Math.floor(asNumber(value, defaultValue)));
}

function toIsoTimestampOrNull(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function isUuidLike(value) {
  return /^[0-9a-fA-F-]{8,}$/.test(String(value || ''));
}

async function logAdminAction({
  req,
  action,
  targetId = null,
  note = '',
  meta = null,
}) {
  try {
    await supabase.from('admin_logs').insert({
      action: String(action || '').slice(0, 80),
      admin_id: getAdminIdentity(req),
      target_id: targetId && isUuidLike(targetId) ? targetId : null,
      note: sanitizeNote(note),
      meta: meta ? JSON.stringify(meta).slice(0, 5000) : null,
      ip_address: getClientIp(req),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin_logs insert failed]', err?.message || err);
  }
}

async function getWithdrawLimits() {
  const { data, error } = await supabase
    .from('withdraw_limits')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    throw new Error(`withdraw_limits read failed: ${error.message}`);
  }

  return {
    min_amount: asNumber(data?.min_amount, 1),
    max_amount: asNumber(data?.max_amount, 100),
    daily_limit: asNumber(data?.daily_limit, 500),
  };
}

async function getTodayPaidTotalForProfile(profileId) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('withdraw_requests')
    .select('ton_amount')
    .eq('profile_id', profileId)
    .eq('status', 'paid')
    .gte('paid_at', start.toISOString());

  if (error) {
    throw new Error(`daily paid total read failed: ${error.message}`);
  }

  return (data || []).reduce((sum, row) => sum + asNumber(row.ton_amount, 0), 0);
}

function validateTonAddressOrThrow(addressText) {
  const raw = String(addressText || '').trim();

  if (!raw) {
    throw new Error('Wallet address is required');
  }

  let parsed;
  try {
    parsed = Address.parse(raw);
  } catch {
    throw new Error('Invalid TON wallet address');
  }

  const normalizedBounceable = parsed.toString({ urlSafe: true, bounceable: true });
  const normalizedNonBounceable = parsed.toString({ urlSafe: true, bounceable: false });

  return {
    raw,
    normalized: normalizedNonBounceable,
    bounceable: normalizedBounceable,
    nonBounceable: normalizedNonBounceable,
  };
}

async function sendTon({ toAddress, tonAmount }) {
  if (!process.env.TON_RPC_ENDPOINT) throw new Error('Missing TON_RPC_ENDPOINT');
  if (!process.env.TON_WALLET_MNEMONIC) throw new Error('Missing TON_WALLET_MNEMONIC');

  const client = new TonClient({ endpoint: process.env.TON_RPC_ENDPOINT });
  const keyPair = await mnemonicToPrivateKey(
    String(process.env.TON_WALLET_MNEMONIC).trim().split(/\s+/)
  );

  const wallet = WalletContractV4.create({
    workchain: Number(process.env.TON_WALLET_WORKCHAIN || 0),
    publicKey: keyPair.publicKey,
  });

  const openedWallet = client.open(wallet);
  const seqnoBefore = await openedWallet.getSeqno();

  await openedWallet.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno: seqnoBefore,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: Address.parse(toAddress),
        value: toNano(String(tonAmount)),
        bounce: false,
        body: beginCell()
          .storeUint(0, 32)
          .storeStringTail(PAYOUT_MEMO)
          .endCell(),
      }),
    ],
  });

  let seqnoAfter = seqnoBefore;
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    try {
      seqnoAfter = await openedWallet.getSeqno();
      if (seqnoAfter > seqnoBefore) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return {
    tx_hash: `wallet:${wallet.address.toString()}|seqno:${seqnoBefore}`,
    seqno_before: seqnoBefore,
    seqno_after: seqnoAfter,
    admin_wallet: wallet.address.toString(),
  };
}


function sanitizeIdentityKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 48);
}

function isGuestIdentityKey(value) {
  return /^guest_[a-z0-9._-]{4,48}$/.test(String(value || ''));
}

function isTelegramProfileKey(value) {
  return /^\d{4,20}$/.test(String(value || '').trim());
}

function isTelegramAuthIdentityKey(value) {
  return /^tg_\d{4,20}$/.test(String(value || '').trim());
}

function sanitizeSessionToken(value, maxLen = SINGLE_DEVICE_SESSION_ID_MAX) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, Math.max(8, maxLen));
}

function sanitizeDeviceLabel(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, SINGLE_DEVICE_LABEL_MAX);
}

function isSingleSessionColumnError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('active_session_') || (msg.includes('column') && msg.includes('profiles'));
}

function isMissingProfileColumnError(err, columnName = '') {
  const msg = String(err?.message || '').toLowerCase();
  const column = String(columnName || '').trim().toLowerCase();
  if (!msg.includes('profiles') || !msg.includes('column')) return false;
  return column ? msg.includes(column) : true;
}

function safeEqualHex(left, right) {
  const a = Buffer.from(String(left || '').trim().toLowerCase(), 'hex');
  const b = Buffer.from(String(right || '').trim().toLowerCase(), 'hex');
  if (!a.length || !b.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readTelegramInitData(req) {
  return String(
    req.headers['x-telegram-init-data'] ||
    req.body?.tg_init_data ||
    req.query?.tg_init_data ||
    ''
  ).trim();
}

function buildTelegramDataCheckString(params) {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function verifyTelegramInitData(rawInitData) {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, reason: 'telegram_bot_token_missing' };
  }

  const initData = String(rawInitData || '').trim();
  if (!initData) {
    return { ok: false, reason: 'missing_init_data' };
  }

  const params = new URLSearchParams(initData);
  const providedHash = String(params.get('hash') || '').trim().toLowerCase();
  if (!providedHash) {
    return { ok: false, reason: 'missing_hash' };
  }

  const dataCheckString = buildTelegramDataCheckString(params);
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!safeEqualHex(providedHash, expectedHash)) {
    return { ok: false, reason: 'invalid_hash' };
  }

  const authDate = asNumber(params.get('auth_date'), 0);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > nowSec + 60 || nowSec - authDate > TELEGRAM_INIT_DATA_MAX_AGE_SEC) {
    return { ok: false, reason: 'stale_auth_date' };
  }

  let user = null;
  try {
    const rawUser = params.get('user');
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return { ok: false, reason: 'invalid_user_payload' };
  }

  if (!user?.id) {
    return { ok: false, reason: 'missing_user' };
  }

  return {
    ok: true,
    authDate,
    user,
  };
}

function resolveIdentityContext(req, { allowGuest = false } = {}) {
  const requestedIdentityKey = sanitizeIdentityKey(
    req.body?.identity_key ||
    req.query?.identity_key ||
    ''
  );
  const requestedProfileKey = sanitizeIdentityKey(
    req.body?.profile_key ||
    req.query?.profile_key ||
    req.body?.telegram_id ||
    req.query?.telegram_id ||
    requestedIdentityKey
  );
  const requestedUsername = sanitizeUsername(
    req.body?.username || req.query?.username || 'Player'
  );
  const telegram = verifyTelegramInitData(readTelegramInitData(req));

  if (telegram.ok) {
    const tgUser = telegram.user || {};
    const profileKey = String(tgUser.id || '').trim();
    const authIdentityKey = `tg_${profileKey}`;
    const telegramName = sanitizeUsername(
      tgUser.username ||
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') ||
      requestedUsername
    );

    return {
      ok: true,
      verified: true,
      isGuest: false,
      profileKey,
      authIdentityKey,
      username: telegramName,
      telegramUser: tgUser,
    };
  }

  if (ALLOW_INSECURE_PUBLIC_IDENTITY) {
    const fallbackKey = requestedProfileKey || requestedIdentityKey;
    if (fallbackKey) {
      const fallbackIsGuest = isGuestIdentityKey(fallbackKey);
      if (fallbackIsGuest && !ALLOW_GUEST_PUBLIC_IDENTITY) {
        return {
          ok: false,
          status: 401,
          error: 'Guest identity is disabled for public routes',
        };
      }
      const normalizedProfileKey = isTelegramAuthIdentityKey(fallbackKey)
        ? fallbackKey.replace(/^tg_/, '')
        : fallbackKey;
      return {
        ok: true,
        verified: false,
        isGuest: isGuestIdentityKey(fallbackKey),
        profileKey: normalizedProfileKey,
        authIdentityKey: isTelegramAuthIdentityKey(fallbackKey)
          ? fallbackKey
          : isTelegramProfileKey(normalizedProfileKey)
            ? `tg_${normalizedProfileKey}`
            : fallbackKey,
        username: requestedUsername,
        telegramUser: null,
        insecureFallback: true,
      };
    }
  }

  if (allowGuest && ALLOW_GUEST_PUBLIC_IDENTITY && isGuestIdentityKey(requestedProfileKey || requestedIdentityKey)) {
    const guestKey = requestedProfileKey || requestedIdentityKey;
    return {
      ok: true,
      verified: false,
      isGuest: true,
      profileKey: guestKey,
      authIdentityKey: guestKey,
      username: requestedUsername,
      telegramUser: null,
    };
  }

  if (isTelegramAuthIdentityKey(requestedIdentityKey) || isTelegramProfileKey(requestedProfileKey)) {
    return {
      ok: false,
      status: 401,
      error: TELEGRAM_BOT_TOKEN
        ? `Verified Telegram session required${telegram?.reason ? `: ${telegram.reason}` : ''}`
        : 'TELEGRAM_BOT_TOKEN is required for Telegram verification',
    };
  }

  return {
    ok: false,
    status: 401,
    error: allowGuest
      ? 'Valid Telegram session is required'
      : 'Valid Telegram session is required',
  };
}

function buildIdentityEmail(identityKey) {
  return `${sanitizeIdentityKey(identityKey) || 'guest_unknown'}@toncrime.local`;
}

function buildIdentityPassword(identityKey) {
  const safe = sanitizeIdentityKey(identityKey) || 'guest_unknown';
  const digest = crypto
    .createHmac('sha256', IDENTITY_AUTH_SECRET || 'toncrime_identity_secret')
    .update(safe)
    .digest('hex')
    .slice(0, 40);
  return `TonCrime_${digest}_Auth!`;
}

async function findAuthUserByEmail(email) {
  let page = 1;
  const target = String(email || '').trim().toLowerCase();

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find((item) => String(item?.email || '').trim().toLowerCase() === target);
    if (found) return found;
    if (users.length < 200) break;
    page += 1;
  }

  return null;
}

function isManagedTonCrimeAuthUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email.endsWith('@toncrime.local')) return false;

  const identityKey = sanitizeIdentityKey(
    user?.user_metadata?.identity_key ||
    user?.app_metadata?.identity_key ||
    ''
  );

  if (!identityKey) return true;
  return isGuestIdentityKey(identityKey) || isTelegramAuthIdentityKey(identityKey) || isTelegramProfileKey(identityKey);
}

function summarizeManagedAuthUsers(users = []) {
  const summary = {
    auth_users: 0,
    auth_guest_users: 0,
    auth_telegram_users: 0,
  };

  for (const user of users) {
    if (!isManagedTonCrimeAuthUser(user)) continue;
    summary.auth_users += 1;

    const identityKey = sanitizeIdentityKey(
      user?.user_metadata?.identity_key ||
      user?.app_metadata?.identity_key ||
      ''
    );

    if (isGuestIdentityKey(identityKey)) {
      summary.auth_guest_users += 1;
    } else {
      summary.auth_telegram_users += 1;
    }
  }

  return summary;
}

function disableResponseCache(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    'Vary': 'X-Telegram-Init-Data',
  });
}

async function listManagedTonCrimeAuthUsers() {
  const rows = [];
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = Array.isArray(data?.users) ? data.users : [];
    rows.push(...users.filter((user) => isManagedTonCrimeAuthUser(user)));

    if (users.length < perPage) break;
    page += 1;
  }

  return rows;
}

async function deleteManagedAuthUsers(users = []) {
  const uniqueIds = [...new Set((users || []).map((user) => String(user?.id || '').trim()).filter(Boolean))];
  let deleted = 0;

  for (const chunk of chunkList(uniqueIds, 10)) {
    await Promise.all(
      chunk.map(async (userId) => {
        const { error } = await supabase.auth.admin.deleteUser(userId, false);
        if (error) throw error;
        deleted += 1;
      })
    );
  }

  return deleted;
}

async function ensureIdentityAuthUser(identityKey, username = 'Player') {
  const email = buildIdentityEmail(identityKey);
  const password = buildIdentityPassword(identityKey);
  const safeUsername = sanitizeUsername(username);
  const identityMeta = {
    identity_key: sanitizeIdentityKey(identityKey),
    username: safeUsername,
  };
  let userId = null;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: identityMeta,
  });
  userId = data?.user?.id || null;

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    const duplicate = msg.includes('already') || msg.includes('exists') || msg.includes('registered') || msg.includes('duplicate');
    if (!duplicate) throw error;

    const existingUser = await findAuthUserByEmail(email);
    if (!existingUser?.id) {
      throw new Error('Existing auth user could not be resolved');
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        ...identityMeta,
      },
    });
    if (updateError) throw updateError;
    userId = existingUser.id;
  }

  return { email, password, userId };
}

async function signInIdentityAuthUser(identityKey, username = 'Player') {
  const { email, password, userId } = await ensureIdentityAuthUser(identityKey, username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return {
    userId,
    user: data?.user || data?.session?.user || null,
    session: data?.session || null,
  };
}

async function getProfileByKey(profileKey) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', profileKey)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureProfileRecordForIdentity(profileKey, username = 'Player') {
  const payload = {
    telegram_id: profileKey,
    username: sanitizeUsername(username || 'Player'),
    level: 0,
    coins: 100,
    energy: 100,
    energy_max: 100,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'telegram_id' })
    .select('telegram_id, username')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function readSingleSessionProfile(profileKey) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_id, username, active_session_id, active_session_device_id, active_session_device_label, active_session_claimed_at, active_session_seen_at')
      .eq('telegram_id', profileKey)
      .maybeSingle();

    if (error) throw error;
    return { supported: true, row: data || null };
  } catch (err) {
    if (isSingleSessionColumnError(err)) {
      return { supported: false, row: null };
    }
    throw err;
  }
}

function isSingleSessionRowStale(row) {
  const lastSeenAt = new Date(
    row?.active_session_seen_at ||
    row?.active_session_claimed_at ||
    0
  ).getTime();
  if (!Number.isFinite(lastSeenAt) || lastSeenAt <= 0) return true;
  return (Date.now() - lastSeenAt) > SINGLE_DEVICE_SESSION_TTL_MS;
}

async function updateSingleSessionClaim(profileKey, claimPayload, mode = 'empty', matchValue = null) {
  try {
    let query = supabase
      .from('profiles')
      .update(claimPayload)
      .eq('telegram_id', profileKey)
      .select('telegram_id, username, active_session_id, active_session_device_id, active_session_device_label, active_session_claimed_at, active_session_seen_at')
      .maybeSingle();

    if (mode === 'empty') {
      query = query.is('active_session_id', null);
    } else if (mode === 'session' && matchValue) {
      query = query.eq('active_session_id', matchValue);
    } else if (mode === 'device' && matchValue) {
      query = query.eq('active_session_device_id', matchValue);
    } else if (mode === 'stale' && matchValue) {
      query = query.lte('active_session_seen_at', matchValue);
    } else if (mode === 'stale-null-seen') {
      query = query.is('active_session_seen_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { supported: true, row: data || null };
  } catch (err) {
    if (isSingleSessionColumnError(err)) {
      return { supported: false, row: null };
    }
    throw err;
  }
}

function buildSingleSessionSummary(row = null) {
  if (!row || typeof row !== 'object') return null;
  return {
    device_label: sanitizeDeviceLabel(row.active_session_device_label || ''),
    claimed_at: toIsoTimestampOrNull(row.active_session_claimed_at),
    seen_at: toIsoTimestampOrNull(row.active_session_seen_at),
  };
}

async function claimSingleDeviceSession({
  profileKey,
  username = 'Player',
  deviceId,
  sessionId,
  deviceLabel = '',
}) {
  const safeProfileKey = sanitizeIdentityKey(profileKey);
  const safeSessionId = sanitizeSessionToken(sessionId);
  const safeDeviceId = sanitizeSessionToken(deviceId);
  const safeDeviceLabel = sanitizeDeviceLabel(deviceLabel);

  if (!safeProfileKey || !safeSessionId || !safeDeviceId) {
    const err = new Error('session identifiers required');
    err.status = 400;
    throw err;
  }

  await ensureProfileRecordForIdentity(safeProfileKey, username);
  const state = await readSingleSessionProfile(safeProfileKey);
  if (!state.supported) {
    return { ok: true, supported: false, row: null };
  }

  const current = state.row || null;
  const nowIso = new Date().toISOString();
  let mode = 'empty';
  let matchValue = null;

  if (current?.active_session_id) {
    const currentSessionId = sanitizeSessionToken(current.active_session_id);
    const currentDeviceId = sanitizeSessionToken(current.active_session_device_id);

    if (currentSessionId === safeSessionId) {
      mode = 'session';
      matchValue = safeSessionId;
    } else if (currentDeviceId && currentDeviceId === safeDeviceId) {
      mode = 'device';
      matchValue = safeDeviceId;
    } else if (isSingleSessionRowStale(current)) {
      mode = current?.active_session_seen_at ? 'stale' : 'stale-null-seen';
      matchValue = new Date(Date.now() - SINGLE_DEVICE_SESSION_TTL_MS).toISOString();
    } else {
      return {
        ok: false,
        supported: true,
        status: 409,
        error: 'session_active_elsewhere',
        row: current,
      };
    }
  }

  const claimPayload = {
    active_session_id: safeSessionId,
    active_session_device_id: safeDeviceId,
    active_session_device_label: safeDeviceLabel || null,
    active_session_claimed_at:
      current?.active_session_id === safeSessionId || sanitizeSessionToken(current?.active_session_device_id) === safeDeviceId
        ? toIsoTimestampOrNull(current?.active_session_claimed_at) || nowIso
        : nowIso,
    active_session_seen_at: nowIso,
    updated_at: nowIso,
  };

  const claimed = await updateSingleSessionClaim(safeProfileKey, claimPayload, mode, matchValue);
  if (!claimed.supported) {
    return { ok: true, supported: false, row: null };
  }
  if (claimed.row) {
    return { ok: true, supported: true, row: claimed.row };
  }

  const refreshed = await readSingleSessionProfile(safeProfileKey);
  if (!refreshed.supported) {
    return { ok: true, supported: false, row: null };
  }
  if (
    refreshed.row?.active_session_id &&
    sanitizeSessionToken(refreshed.row.active_session_id) !== safeSessionId &&
    sanitizeSessionToken(refreshed.row.active_session_device_id) !== safeDeviceId &&
    !isSingleSessionRowStale(refreshed.row)
  ) {
    return {
      ok: false,
      supported: true,
      status: 409,
      error: 'session_active_elsewhere',
      row: refreshed.row,
    };
  }

  return {
    ok: false,
    supported: true,
    status: 409,
    error: 'session_claim_failed',
    row: refreshed.row || current,
  };
}

async function heartbeatSingleDeviceSession({ profileKey, deviceId, sessionId }) {
  const safeProfileKey = sanitizeIdentityKey(profileKey);
  const safeSessionId = sanitizeSessionToken(sessionId);
  const safeDeviceId = sanitizeSessionToken(deviceId);

  if (!safeProfileKey || !safeSessionId || !safeDeviceId) {
    const err = new Error('session identifiers required');
    err.status = 400;
    throw err;
  }

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        active_session_seen_at: nowIso,
        updated_at: nowIso,
      })
      .eq('telegram_id', safeProfileKey)
      .eq('active_session_id', safeSessionId)
      .eq('active_session_device_id', safeDeviceId)
      .select('telegram_id, username, active_session_id, active_session_device_id, active_session_device_label, active_session_claimed_at, active_session_seen_at')
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return { ok: true, supported: true, row: data };
    }
  } catch (err) {
    if (isSingleSessionColumnError(err)) {
      return { ok: true, supported: false, row: null };
    }
    throw err;
  }

  const refreshed = await readSingleSessionProfile(safeProfileKey);
  if (!refreshed.supported) {
    return { ok: true, supported: false, row: null };
  }

  if (!refreshed.row?.active_session_id) {
    return { ok: false, supported: true, status: 409, error: 'session_missing', row: refreshed.row };
  }

  if (
    sanitizeSessionToken(refreshed.row.active_session_id) !== safeSessionId ||
    sanitizeSessionToken(refreshed.row.active_session_device_id) !== safeDeviceId
  ) {
    return { ok: false, supported: true, status: 409, error: 'session_replaced', row: refreshed.row };
  }

  return { ok: false, supported: true, status: 409, error: 'session_missing', row: refreshed.row };
}

async function releaseSingleDeviceSession({ profileKey, deviceId, sessionId }) {
  const safeProfileKey = sanitizeIdentityKey(profileKey);
  const safeSessionId = sanitizeSessionToken(sessionId);
  const safeDeviceId = sanitizeSessionToken(deviceId);

  if (!safeProfileKey || !safeSessionId || !safeDeviceId) {
    return { ok: true, supported: true, released: false };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        active_session_id: null,
        active_session_device_id: null,
        active_session_device_label: null,
        active_session_claimed_at: null,
        active_session_seen_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_id', safeProfileKey)
      .eq('active_session_id', safeSessionId)
      .eq('active_session_device_id', safeDeviceId)
      .select('telegram_id')
      .maybeSingle();

    if (error) throw error;
    return { ok: true, supported: true, released: !!data };
  } catch (err) {
    if (isSingleSessionColumnError(err)) {
      return { ok: true, supported: false, released: false };
    }
    throw err;
  }
}

async function assertSingleDeviceSessionAccess(profileKey, body = {}) {
  const safeSessionId = sanitizeSessionToken(body?.session_id);
  const safeDeviceId = sanitizeSessionToken(body?.device_id);

  if (!safeSessionId || !safeDeviceId) {
    return { ok: true, supported: true, skipped: true };
  }

  const state = await readSingleSessionProfile(profileKey);
  if (!state.supported) {
    return { ok: true, supported: false, skipped: true };
  }

  const row = state.row || null;
  if (!row?.active_session_id) {
    return { ok: true, supported: true, skipped: true };
  }

  const rowSessionId = sanitizeSessionToken(row.active_session_id);
  const rowDeviceId = sanitizeSessionToken(row.active_session_device_id);
  if (rowSessionId === safeSessionId && rowDeviceId === safeDeviceId) {
    return { ok: true, supported: true, skipped: false };
  }

  return {
    ok: false,
    supported: true,
    status: 409,
    error: 'session_active_elsewhere',
    row,
  };
}

function readProfilePvpStats(row = {}) {
  return {
    wins: asInteger(row?.pvp_wins ?? row?.wins, 0),
    losses: asInteger(row?.pvp_losses ?? row?.losses, 0),
    rating: asInteger(row?.pvp_rating ?? row?.rating, 1000),
    lastMatchAt: toIsoTimestampOrNull(row?.pvp_last_match_at ?? row?.last_match_at ?? row?.updated_at),
  };
}

function buildPvpLeaderboardEntry(row = {}) {
  const stats = readProfilePvpStats(row);
  const username = sanitizeUsername(row?.username || 'Player');

  return {
    id: String(row?.id || row?.telegram_id || username).trim() || username,
    telegram_id: String(row?.telegram_id || '').trim(),
    name: username,
    level: Math.max(0, asInteger(row?.level, 0)),
    wins: stats.wins,
    losses: stats.losses,
    rating: stats.rating,
    score: stats.rating + stats.wins * 8,
    updatedAt: stats.lastMatchAt || toIsoTimestampOrNull(row?.updated_at) || new Date(0).toISOString(),
  };
}

async function tryPersistProfilePvpStats(profileKey, rawPatch = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(rawPatch, 'pvp_wins')) {
    patch.pvp_wins = asInteger(rawPatch.pvp_wins, 0);
  }
  if (Object.prototype.hasOwnProperty.call(rawPatch, 'pvp_losses')) {
    patch.pvp_losses = asInteger(rawPatch.pvp_losses, 0);
  }
  if (Object.prototype.hasOwnProperty.call(rawPatch, 'pvp_rating')) {
    patch.pvp_rating = asInteger(rawPatch.pvp_rating, 1000);
  }
  if (Object.prototype.hasOwnProperty.call(rawPatch, 'pvp_last_match_at')) {
    patch.pvp_last_match_at = toIsoTimestampOrNull(rawPatch.pvp_last_match_at);
  }

  if (!Object.keys(patch).length) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('telegram_id', profileKey)
    .select('*')
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('column') && msg.includes('pvp_')) {
      return null;
    }
    throw error;
  }

  return data || null;
}

function isDemoChatText(text) {
  const normalized = String(text || '').trim().toLowerCase();
  return /^(test|demo|deneme|sample|ornek|ornk)([\s\d!?.-]|$)/i.test(normalized);
}

function assertChatSendAllowed(identityKey, req) {
  const bucketKey = `chat:${sanitizeIdentityKey(identityKey) || getClientIp(req)}`;
  const rate = takeRateLimitBucket(chatSendBuckets, bucketKey, CHAT_SEND_WINDOW_MS, CHAT_SEND_MAX);
  if (rate.limited) {
    const error = new Error('Slow down');
    error.status = 429;
    throw error;
  }
}

function readRowQuantity(row, keys = []) {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function readRowText(row, keys = [], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function hasOwn(row, key) {
  return !!row && Object.prototype.hasOwnProperty.call(row, key);
}

function detectQuantityKey(row) {
  return ['quantity', 'qty', 'stock_qty', 'remaining_qty', 'stock'].find((key) => hasOwn(row, key)) || '';
}

function detectPriceKey(row) {
  return ['price_yton', 'price', 'unit_price', 'market_price'].find((key) => hasOwn(row, key)) || '';
}

function readBooleanish(row, keys = [], fallback = false) {
  for (const key of keys) {
    if (!hasOwn(row, key)) continue;
    const value = row?.[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const text = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(text)) return true;
      if (['false', '0', 'no', 'n', 'off'].includes(text)) return false;
    }
  }
  return fallback;
}

function normalizeMarketItemKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function inferMarketItemKind(source = {}, businessType = '') {
  const explicit = readRowText(source, ['kind', 'item_kind', 'category']);
  if (explicit) return explicit;

  const type = String(
    businessType ||
    readRowText(source, ['business_type', 'type'])
  ).trim().toLowerCase();

  if (type === 'brothel') return 'girls';
  if (type === 'nightclub') return 'consumable';
  if (type === 'coffeeshop') return 'goods';

  const raw = [
    readRowText(source, ['name', 'item_name', 'title']),
    readRowText(source, ['desc', 'description']),
    readRowText(source, ['item_key', 'product_key', 'key']),
  ].join(' ').toLowerCase();

  if (/(scarlett|ruby|luna|service|escort|girl)/.test(raw)) return 'girls';
  if (/(widow|kush|moon|weed|rocks)/.test(raw)) return 'goods';
  if (/(whiskey|prosecco|champagne|venom|drink|cocktail|energy)/.test(raw)) return 'consumable';

  return 'rare';
}

function sanitizeMarketId(value) {
  return String(value || '').trim().slice(0, 120);
}

function sanitizeMarketQuantity(value, fallback = 1) {
  return Math.max(1, Math.min(9999, Math.floor(asNumber(value, fallback))));
}

function sanitizeMarketPrice(value, fallback = 1) {
  return Math.max(1, Math.min(1_000_000_000, Math.floor(asNumber(value, fallback))));
}

const SERVER_BUSINESS_DEFS = {
  nightclub: {
    defaultName: 'Nightclub',
    priceYton: 1000,
    dailyProduction: 50,
    icon: 'NB',
    imageKey: 'nightclub',
    imageSrc: './src/assets/nightclub.jpg',
    theme: 'neon',
    products: [
      { key: 'street_whiskey', icon: 'SW', imageSrc: './src/assets/street.png', name: 'Street Whiskey', rarity: 'common', price: 27, energyGain: 8, desc: 'Nightclub urunu.' },
      { key: 'club_prosecco', icon: 'CP', imageSrc: './src/assets/club.png', name: 'Club Prosecco', rarity: 'rare', price: 33, energyGain: 11, desc: 'Kulup ici icecek.' },
      { key: 'blue_venom', icon: 'BV', imageSrc: './src/assets/mafia.png', name: 'Blue Venom', rarity: 'epic', price: 40, energyGain: 13, desc: 'VIP kokteyl.' },
    ],
  },
  coffeeshop: {
    defaultName: 'Coffeeshop',
    priceYton: 850,
    dailyProduction: 50,
    icon: 'CF',
    imageKey: 'coffeeshop',
    imageSrc: './src/assets/coffeeshop.jpg',
    theme: 'green',
    products: [
      { key: 'white_widow', icon: 'WW', imageSrc: './src/assets/white.png', name: 'White Widow', rarity: 'rare', price: 36, energyGain: 12, desc: 'Coffeeshop urunu.' },
      { key: 'og_kush', icon: 'OG', imageSrc: './src/assets/og.png', name: 'OG Kush', rarity: 'epic', price: 48, energyGain: 16, desc: 'Klasik kush.' },
      { key: 'moon_rocks', icon: 'MR', imageSrc: './src/assets/diamond.png', name: 'Moon Rocks', rarity: 'legendary', price: 62, energyGain: 18, desc: 'Nadir urun.' },
    ],
  },
  brothel: {
    defaultName: 'Brothel',
    priceYton: 1200,
    dailyProduction: 50,
    icon: 'BR',
    imageKey: 'xxx',
    imageSrc: './src/assets/xxx.jpg',
    theme: 'red',
    products: [
      { key: 'scarlett_blaze', icon: 'SB', imageSrc: './src/assets/g_star1.png', name: 'Scarlett Blaze', rarity: 'epic', price: 95, energyGain: 22, desc: 'Vip servis.' },
      { key: 'ruby_vane', icon: 'RV', imageSrc: './src/assets/g_star2.png', name: 'Ruby Vane', rarity: 'legendary', price: 120, energyGain: 26, desc: 'Deluxe servis.' },
      { key: 'luna_hart', icon: 'LH', imageSrc: './src/assets/g_star3.png', name: 'Luna Hart', rarity: 'legendary', price: 145, energyGain: 30, desc: 'Elite servis.' },
    ],
  },
  blackmarket: {
    defaultName: 'Black Market',
    priceYton: 0,
    dailyProduction: 0,
    icon: 'BM',
    imageKey: 'blackmarket',
    imageSrc: './src/assets/BlackMarket.png',
    theme: 'dark',
    products: [],
  },
};

function getServerBusinessDef(type = '') {
  return SERVER_BUSINESS_DEFS[String(type || '').trim().toLowerCase()] || null;
}

function parseMissingColumnName(error, tableName = '') {
  const msg = String(error?.message || '');
  const table = String(tableName || '').trim().toLowerCase();
  const patterns = [
    /column ["']?([a-zA-Z0-9_]+)["']? of relation ["']?([a-zA-Z0-9_]+)["']? does not exist/i,
    /Could not find the ['"]([a-zA-Z0-9_]+)['"] column of ['"]([a-zA-Z0-9_]+)['"]/i,
    /schema cache.*column ['"]([a-zA-Z0-9_]+)['"].*['"]([a-zA-Z0-9_]+)['"]/i,
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (!match) continue;
    const [, columnName, relationName] = match;
    if (!table || String(relationName || '').trim().toLowerCase() === table) {
      return String(columnName || '').trim();
    }
  }

  return '';
}

async function insertRowWithPruning(tableName, rawPayload = {}) {
  const payload = { ...(rawPayload || {}) };
  const stripped = new Set();

  while (Object.keys(payload).length) {
    const { data, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (!error) return data || null;

    const missingColumn = parseMissingColumnName(error, tableName);
    if (!missingColumn || !hasOwn(payload, missingColumn) || stripped.has(missingColumn)) {
      throw error;
    }

    stripped.add(missingColumn);
    delete payload[missingColumn];
  }

  throw new Error(`insert failed for ${tableName}`);
}

async function updateRowWithPruning(tableName, rowId, rawPatch = {}) {
  const patch = { ...(rawPatch || {}) };
  const stripped = new Set();

  while (Object.keys(patch).length) {
    const { data, error } = await supabase
      .from(tableName)
      .update(patch)
      .eq('id', rowId)
      .select('*')
      .maybeSingle();

    if (!error) return data || null;

    const missingColumn = parseMissingColumnName(error, tableName);
    if (!missingColumn || !hasOwn(patch, missingColumn) || stripped.has(missingColumn)) {
      throw error;
    }

    stripped.add(missingColumn);
    delete patch[missingColumn];
  }

  return null;
}

function normalizeTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function readJsonArray(row, keys = []) {
  for (const key of keys) {
    const value = row?.[key];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
  }
  return [];
}

async function resolveVerifiedProfile(req, { allowGuest = true } = {}) {
  const identity = resolveIdentityContext(req, { allowGuest });
  if (!identity.ok) {
    const error = new Error(identity.error || 'identity resolution failed');
    error.status = identity.status || 401;
    throw error;
  }

  const profile = await getProfileByKey(identity.profileKey);
  if (!profile?.id) {
    const error = new Error('Profile not found');
    error.status = 404;
    throw error;
  }

  return { identity, profile };
}

async function getOwnedBusiness(profileId, businessId = '', businessType = '') {
  let query = supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', profileId);

  if (businessId) query = query.eq('id', businessId);
  if (businessType) query = query.eq('business_type', businessType);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getOwnedInventoryItem(profileId, itemKey) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('profile_id', profileId)
    .eq('item_key', itemKey)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getOwnedBusinessProduct(businessId, productId) {
  const { data, error } = await supabase
    .from('business_products')
    .select('*')
    .eq('business_id', businessId)
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function createMarketListingSecure(params = {}) {
  const { data, error } = await supabase.rpc('create_market_listing', params);
  if (error) throw error;
  return Array.isArray(data) ? (data[0] || null) : (data || null);
}

async function getMarketListingById(listingId) {
  const { data, error } = await supabase
    .from('market_listings')
    .select('*')
    .eq('id', listingId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getProfileById(profileId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getInventoryItemById(itemId) {
  if (!itemId) return null;
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getBusinessById(businessId) {
  if (!businessId) return null;
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getBusinessProductById(productId) {
  if (!productId) return null;
  const { data, error } = await supabase
    .from('business_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function updateProfileCoinsExact(profileRow, nextCoins) {
  const patch = {
    coins: Math.max(0, asNumber(nextCoins, 0)),
  };
  if (hasOwn(profileRow, 'updated_at')) {
    patch.updated_at = new Date().toISOString();
  }

  let query = supabase
    .from('profiles')
    .update(patch)
    .eq('id', profileRow.id);

  if (hasOwn(profileRow, 'coins')) {
    query = query.eq('coins', asNumber(profileRow.coins, 0));
  }

  const { data, error } = await query
    .select('id, coins')
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    const conflict = new Error('Profile balance changed, retry');
    conflict.status = 409;
    throw conflict;
  }

  return data;
}

async function forceUpdateProfileCoins(profileId, nextCoins) {
  const patch = {
    coins: Math.max(0, asNumber(nextCoins, 0)),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select('id, coins')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function updateMarketListingQuantityExact(listingRow, nextQuantity) {
  const quantityKey = detectQuantityKey(listingRow);
  if (!quantityKey) {
    const error = new Error('Listing quantity field could not be resolved');
    error.status = 500;
    throw error;
  }

  const currentQuantity = Math.max(0, readRowQuantity(listingRow, [quantityKey]));
  const patch = {
    [quantityKey]: Math.max(0, asNumber(nextQuantity, 0)),
  };

  if (hasOwn(listingRow, 'updated_at')) patch.updated_at = new Date().toISOString();
  if (hasOwn(listingRow, 'is_active')) patch.is_active = asNumber(nextQuantity, 0) > 0;
  if (hasOwn(listingRow, 'status') && asNumber(nextQuantity, 0) <= 0) patch.status = 'sold_out';

  const { data, error } = await supabase
    .from('market_listings')
    .update(patch)
    .eq('id', listingRow.id)
    .eq(quantityKey, currentQuantity)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    const conflict = new Error('Listing stock changed, retry');
    conflict.status = 409;
    throw conflict;
  }

  return data;
}

function buildPurchasedItemSnapshot({
  listing = null,
  inventoryItem = null,
  businessProduct = null,
  business = null,
  unitPrice = 0,
}) {
  const source = inventoryItem || businessProduct || listing || {};
  const businessType = readRowText(business, ['business_type', 'type'])
    || readRowText(source, ['business_type', 'type']);
  const name = readRowText(source, ['name', 'item_name', 'title'])
    || readRowText(listing, ['item_name', 'name', 'title'])
    || 'Market Item';
  const itemKey = normalizeMarketItemKey(
    readRowText(source, ['item_key', 'product_key', 'key', 'slug']) || name
  );
  const energyGain = Math.max(0, Math.floor(asNumber(
    source?.energy_gain ??
    source?.energyGain ??
    listing?.energy_gain ??
    listing?.energyGain,
    0
  )));
  const usable = readBooleanish(source, ['usable'], energyGain > 0) || energyGain > 0;

  return {
    itemKey,
    name,
    kind: inferMarketItemKind(source, businessType),
    icon: readRowText(source, ['icon'], readRowText(listing, ['icon'], 'IT')) || 'IT',
    imageKey: readRowText(source, ['image_key', 'imageKey'], readRowText(listing, ['image_key', 'imageKey'])),
    imageSrc: readRowText(
      source,
      ['image_src', 'image', 'image_url', 'imageUrl'],
      readRowText(listing, ['image_src', 'image', 'image_url', 'imageUrl'])
    ),
    rarity: readRowText(source, ['rarity'], readRowText(listing, ['rarity'], 'common')) || 'common',
    usable,
    sellable: true,
    marketable: true,
    energyGain,
    sellPrice: Math.max(1, Math.floor(Math.max(1, asNumber(unitPrice, 1)) * 0.7)),
    marketPrice: Math.max(1, Math.floor(asNumber(unitPrice, 1))),
    desc: readRowText(source, ['desc', 'description'], readRowText(listing, ['desc', 'description'], 'Bought from market.')),
    businessType,
    businessId: readRowText(listing, ['business_id'], readRowText(business, ['id'])),
    businessProductId: readRowText(listing, ['business_product_id', 'product_id'], readRowText(businessProduct, ['id'])),
    inventoryItemId: readRowText(listing, ['inventory_item_id'], readRowText(inventoryItem, ['id'])),
  };
}

let cachedInventoryColumns = null;

async function getInventoryColumns() {
  if (Array.isArray(cachedInventoryColumns) && cachedInventoryColumns.length) {
    return cachedInventoryColumns;
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .limit(1);

  if (error) throw error;

  const sample = Array.isArray(data) ? data[0] : null;
  cachedInventoryColumns = sample && typeof sample === 'object'
    ? Object.keys(sample)
    : [
        'profile_id',
        'item_key',
        'name',
        'kind',
        'icon',
        'image_src',
        'image_key',
        'rarity',
        'quantity',
        'usable',
        'sellable',
        'marketable',
        'energy_gain',
        'sell_price',
        'market_price',
        'desc',
        'created_at',
        'updated_at',
      ];

  return cachedInventoryColumns;
}

async function persistPurchasedInventory({ buyerProfileId, item, quantity }) {
  const itemKey = normalizeMarketItemKey(item?.itemKey || item?.name);
  if (!buyerProfileId || !itemKey) {
    return { persisted: false, row: null };
  }

  const quantityValue = Math.max(1, Math.floor(asNumber(quantity, 1)));
  const columnNames = await getInventoryColumns().catch(() => []);
  const existing = await getOwnedInventoryItem(buyerProfileId, itemKey).catch(() => null);
  const nowIso = new Date().toISOString();

  if (existing?.id) {
    const quantityKey = detectQuantityKey(existing)
      || (columnNames.includes('quantity') ? 'quantity' : '')
      || (columnNames.includes('qty') ? 'qty' : '')
      || (columnNames.includes('stock_qty') ? 'stock_qty' : '');

    if (!quantityKey) {
      return { persisted: false, row: existing, error: 'inventory quantity field missing' };
    }

    const patch = {
      [quantityKey]: Math.max(0, readRowQuantity(existing, [quantityKey]) + quantityValue),
    };

    if (columnNames.includes('updated_at') || hasOwn(existing, 'updated_at')) patch.updated_at = nowIso;
    if (columnNames.includes('market_price')) patch.market_price = Math.max(1, asNumber(item.marketPrice, 1));
    if (columnNames.includes('sell_price')) patch.sell_price = Math.max(1, asNumber(item.sellPrice, 1));

    const { data, error } = await supabase
      .from('inventory_items')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();

    if (error) {
      return { persisted: false, row: existing, error: error.message };
    }

    return { persisted: true, row: data || existing };
  }

  const quantityKey = columnNames.includes('quantity')
    ? 'quantity'
    : columnNames.includes('qty')
      ? 'qty'
      : columnNames.includes('stock_qty')
        ? 'stock_qty'
        : 'quantity';

  const candidate = {
    profile_id: buyerProfileId,
    item_key: itemKey,
    name: item?.name || 'Market Item',
    item_name: item?.name || 'Market Item',
    kind: item?.kind || 'rare',
    category: item?.kind || 'rare',
    icon: item?.icon || 'IT',
    image_key: item?.imageKey || '',
    image_src: item?.imageSrc || '',
    image: item?.imageSrc || '',
    image_url: item?.imageSrc || '',
    rarity: item?.rarity || 'common',
    usable: !!item?.usable,
    sellable: item?.sellable !== false,
    marketable: item?.marketable !== false,
    energy_gain: Math.max(0, asNumber(item?.energyGain, 0)),
    energy: Math.max(0, asNumber(item?.energyGain, 0)),
    sell_price: Math.max(1, asNumber(item?.sellPrice, 1)),
    market_price: Math.max(1, asNumber(item?.marketPrice, 1)),
    price: Math.max(1, asNumber(item?.marketPrice, 1)),
    desc: item?.desc || 'Bought from market.',
    description: item?.desc || 'Bought from market.',
    business_type: item?.businessType || '',
    created_at: nowIso,
    updated_at: nowIso,
  };
  candidate[quantityKey] = quantityValue;

  const payload = {};
  const allowedColumns = columnNames.length ? columnNames : Object.keys(candidate);
  for (const key of allowedColumns) {
    if (candidate[key] !== undefined) payload[key] = candidate[key];
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    return { persisted: false, row: null, error: error.message };
  }

  return { persisted: true, row: data || null };
}

async function listOwnedBusinesses(profileId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', profileId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function listBusinessProductsByBusinessIds(businessIds = []) {
  const ids = [...new Set((businessIds || []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const rows = [];
  for (const chunk of chunkList(ids, 200)) {
    const { data, error } = await supabase
      .from('business_products')
      .select('*')
      .in('business_id', chunk);

    if (error) throw error;
    rows.push(...(Array.isArray(data) ? data : []));
  }

  return rows;
}

async function listMarketListingRows(limit = 500) {
  const { data, error } = await supabase
    .from('market_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(1000, asInteger(limit, 500))));

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function getProfilesByIdMap(profileIds = []) {
  const ids = [...new Set((profileIds || []).map((value) => String(value || '').trim()).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;

  for (const chunk of chunkList(ids, 200)) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', chunk);

    if (error) throw error;

    for (const row of data || []) {
      const id = String(row?.id || '').trim();
      if (id) out.set(id, row);
    }
  }

  return out;
}

async function getTableRowsByIds(tableName, ids = []) {
  const uniqueIds = [...new Set((ids || []).map((value) => String(value || '').trim()).filter(Boolean))];
  const rows = [];
  if (!uniqueIds.length) return rows;

  for (const chunk of chunkList(uniqueIds, 200)) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .in('id', chunk);

    if (error) throw error;
    rows.push(...(Array.isArray(data) ? data : []));
  }

  return rows;
}

function buildBusinessProductUiFromRow(row = {}, businessType = '') {
  const normalizedType = String(businessType || readRowText(row, ['business_type', 'type'])).trim().toLowerCase();
  const businessDef = getServerBusinessDef(normalizedType);
  const productKey = normalizeMarketItemKey(
    readRowText(row, ['product_key', 'item_key', 'key', 'slug'])
      || readRowText(row, ['name', 'item_name', 'title'])
  );
  const fallbackDef = (businessDef?.products || []).find((item) => item.key === productKey) || null;
  const energyGain = Math.max(0, Math.floor(asNumber(
    row?.energy_gain ??
    row?.energy ??
    row?.energyGain,
    fallbackDef?.energyGain ?? 0
  )));

  return {
    id: String(row?.id || productKey || `product_${Date.now()}`),
    key: productKey,
    productKey,
    icon: readRowText(row, ['icon'], fallbackDef?.icon || 'IT') || 'IT',
    imageKey: readRowText(row, ['image_key', 'imageKey'], fallbackDef?.imageKey || ''),
    imageSrc: readRowText(row, ['image_src', 'image', 'image_url', 'imageUrl'], fallbackDef?.imageSrc || ''),
    name: readRowText(row, ['name', 'item_name', 'title'], fallbackDef?.name || 'Product'),
    rarity: readRowText(row, ['rarity'], fallbackDef?.rarity || 'common') || 'common',
    qty: Math.max(0, readRowQuantity(row, ['quantity', 'qty', 'stock_qty'])),
    price: Math.max(1, Math.floor(asNumber(
      row?.price ??
      row?.market_price ??
      row?.sell_price,
      fallbackDef?.price ?? 1
    ))),
    energyGain,
    desc: readRowText(row, ['desc', 'description'], fallbackDef?.desc || ''),
    kind: inferMarketItemKind(
      {
        ...row,
        product_key: productKey,
        item_key: productKey,
      },
      normalizedType
    ),
  };
}

function buildBusinessUiFromRow(row = {}, ownerName = '', productRows = []) {
  const businessType = String(readRowText(row, ['business_type', 'type'])).trim().toLowerCase();
  const def = getServerBusinessDef(businessType);
  const products = (productRows || []).map((item) => buildBusinessProductUiFromRow(item, businessType));
  const stockFromProducts = products.reduce((sum, item) => sum + Math.max(0, Number(item?.qty || 0)), 0);

  return {
    id: String(row?.id || ''),
    type: businessType,
    icon: readRowText(row, ['icon'], def?.icon || 'MK') || 'MK',
    imageKey: readRowText(row, ['image_key', 'imageKey'], def?.imageKey || ''),
    imageSrc: readRowText(row, ['image_src', 'image', 'image_url', 'imageUrl'], def?.imageSrc || ''),
    name: readRowText(row, ['name', 'title'], def?.defaultName || 'Business'),
    ownerId: readRowText(row, ['owner_id']),
    ownerName: String(ownerName || 'Player'),
    dailyProduction: Math.max(0, Math.floor(asNumber(
      row?.daily_production ??
      row?.dailyProduction,
      def?.dailyProduction ?? 0
    ))),
    stock: products.length
      ? stockFromProducts
      : Math.max(0, readRowQuantity(row, ['stock_qty', 'stock', 'qty'])),
    theme: readRowText(row, ['theme'], def?.theme || businessType) || businessType || 'dark',
    products,
    acquiredFrom: readRowText(row, ['acquired_from', 'source'], 'shop'),
    productionDayKey: readRowText(row, ['production_day_key', 'productionDayKey']),
    productionReadyAt: normalizeTimestampMs(row?.production_ready_at ?? row?.productionReadyAt),
    productionClaimUntil: normalizeTimestampMs(row?.production_claim_until ?? row?.productionClaimUntil),
    productionCollectedAt: normalizeTimestampMs(row?.production_collected_at ?? row?.productionCollectedAt),
    productionMissedAt: normalizeTimestampMs(row?.production_missed_at ?? row?.productionMissedAt),
    pendingProduction: readJsonArray(row, ['pending_production', 'pendingProduction'])
      .map((item) => ({
        productId: String(item?.productId || item?.product_id || item?.id || ''),
        qty: Math.max(0, Math.floor(asNumber(item?.qty ?? item?.quantity, 0))),
      }))
      .filter((item) => item.productId && item.qty > 0),
    serverManaged: true,
  };
}

function buildMarketShopUiFromBusiness(business = {}, totalListings = 0) {
  const type = String(business?.type || business?.business_type || '').trim().toLowerCase();
  const def = getServerBusinessDef(type);

  return {
    id: `shop_from_${String(business?.id || '')}`,
    businessId: String(business?.id || ''),
    type,
    icon: String(business?.icon || def?.icon || 'MK'),
    imageKey: String(business?.imageKey || def?.imageKey || ''),
    imageSrc: String(business?.imageSrc || def?.imageSrc || ''),
    name: String(business?.name || def?.defaultName || 'Business'),
    ownerId: String(business?.ownerId || business?.owner_id || ''),
    ownerName: String(business?.ownerName || 'Player'),
    online: true,
    theme: String(business?.theme || def?.theme || type || 'dark'),
    rating: 5,
    totalListings: Math.max(0, Math.floor(asNumber(totalListings, 0))),
    totalSold: 0,
    totalRevenue: 0,
    lastSaleAt: 0,
    serverManaged: true,
  };
}

function buildMarketListingUiFromRow(row = {}, options = {}) {
  const business = options?.business || null;
  const inventoryItem = options?.inventoryItem || null;
  const businessProduct = options?.businessProduct || null;
  const source = inventoryItem || businessProduct || row || {};
  const businessType = String(
    business?.type ||
    business?.business_type ||
    readRowText(source, ['business_type', 'type'])
  ).trim().toLowerCase();
  const quantityKey = detectQuantityKey(row);
  const priceKey = detectPriceKey(row);
  const stock = Math.max(0, readRowQuantity(row, quantityKey ? [quantityKey] : []));
  const unitPrice = Math.max(1, Math.floor(asNumber(
    priceKey ? row?.[priceKey] : undefined,
    source?.market_price ?? source?.price ?? source?.sell_price ?? 1
  )));
  const energyGain = Math.max(0, Math.floor(asNumber(
    source?.energy_gain ??
    source?.energy ??
    source?.energyGain,
    0
  )));

  return {
    id: String(row?.id || ''),
    shopId: `shop_from_${String(business?.id || readRowText(row, ['business_id']) || '')}`,
    icon: readRowText(source, ['icon'], 'IT') || 'IT',
    imageKey: readRowText(source, ['image_key', 'imageKey']),
    imageSrc: readRowText(source, ['image_src', 'image', 'image_url', 'imageUrl']),
    itemName: readRowText(source, ['name', 'item_name', 'title'], 'Market Item'),
    kind: inferMarketItemKind(source, businessType),
    rarity: readRowText(source, ['rarity'], 'common') || 'common',
    stock,
    price: unitPrice,
    energyGain,
    usable: readBooleanish(source, ['usable'], energyGain > 0) || energyGain > 0,
    desc: readRowText(source, ['desc', 'description'], 'Market Item'),
    inventoryItemId: readRowText(row, ['inventory_item_id']),
    businessId: readRowText(row, ['business_id'], business?.id || ''),
    businessProductId: readRowText(row, ['business_product_id', 'product_id']),
    serverManaged: true,
  };
}

async function buildOwnedBusinessUiList(profileId, ownerName = 'Player') {
  const businessRows = await listOwnedBusinesses(profileId).catch(() => []);
  const filteredRows = (businessRows || []).filter((row) => {
    const type = String(readRowText(row, ['business_type', 'type'])).trim().toLowerCase();
    return type !== 'blackmarket';
  });
  const productRows = await listBusinessProductsByBusinessIds(
    filteredRows.map((row) => String(row?.id || '').trim()).filter(Boolean)
  ).catch(() => []);
  const productRowsByBusinessId = new Map();

  for (const row of productRows || []) {
    const businessId = String(row?.business_id || '').trim();
    if (!businessId) continue;
    if (!productRowsByBusinessId.has(businessId)) productRowsByBusinessId.set(businessId, []);
    productRowsByBusinessId.get(businessId).push(row);
  }

  return filteredRows.map((row) =>
    buildBusinessUiFromRow(
      row,
      sanitizeUsername(ownerName || 'Player'),
      productRowsByBusinessId.get(String(row?.id || '').trim()) || []
    )
  );
}

async function createBusinessWithProducts({
  ownerProfile = null,
  businessType = '',
  businessName = '',
  acquiredFrom = 'shop',
} = {}) {
  const normalizedType = String(businessType || '').trim().toLowerCase();
  const def = getServerBusinessDef(normalizedType);
  if (!ownerProfile?.id || !def) {
    const error = new Error('business definition is invalid');
    error.status = 400;
    throw error;
  }

  const nowIso = new Date().toISOString();
  const safeName = String(businessName || def.defaultName || 'Business').trim() || def.defaultName || 'Business';
  const businessPayload = {
    owner_id: ownerProfile.id,
    business_type: normalizedType,
    type: normalizedType,
    name: safeName,
    title: safeName,
    icon: def.icon || 'MK',
    image_key: def.imageKey || '',
    image_src: def.imageSrc || '',
    image: def.imageSrc || '',
    image_url: def.imageSrc || '',
    theme: def.theme || normalizedType,
    daily_production: Math.max(0, Math.floor(asNumber(def.dailyProduction, 0))),
    stock_qty: 0,
    stock: 0,
    qty: 0,
    acquired_from: acquiredFrom || 'shop',
    pending_production: JSON.stringify([]),
    production_day_key: '',
    production_ready_at: null,
    production_claim_until: null,
    production_collected_at: null,
    production_missed_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const businessRow = await insertRowWithPruning('businesses', businessPayload);
  const productRows = [];

  for (const product of def.products || []) {
    const productKey = normalizeMarketItemKey(product?.key || product?.name);
    const productName = String(product?.name || productKey || 'Product').trim() || 'Product';
    const quantityValue = 0;
    const payload = {
      business_id: businessRow.id,
      business_type: normalizedType,
      type: normalizedType,
      product_key: productKey,
      item_key: productKey,
      key: productKey,
      slug: productKey,
      name: productName,
      item_name: productName,
      title: productName,
      kind: inferMarketItemKind({ ...product, key: productKey, name: productName }, normalizedType),
      category: inferMarketItemKind({ ...product, key: productKey, name: productName }, normalizedType),
      icon: String(product?.icon || 'IT'),
      image_key: String(product?.imageKey || ''),
      image_src: String(product?.imageSrc || ''),
      image: String(product?.imageSrc || ''),
      image_url: String(product?.imageSrc || ''),
      rarity: String(product?.rarity || 'common'),
      quantity: quantityValue,
      qty: quantityValue,
      stock_qty: quantityValue,
      usable: Math.max(0, asNumber(product?.energyGain, 0)) > 0,
      sellable: true,
      marketable: true,
      energy_gain: Math.max(0, Math.floor(asNumber(product?.energyGain, 0))),
      energy: Math.max(0, Math.floor(asNumber(product?.energyGain, 0))),
      price: Math.max(1, Math.floor(asNumber(product?.price, 1))),
      market_price: Math.max(1, Math.floor(asNumber(product?.price, 1))),
      sell_price: Math.max(1, Math.floor(asNumber(product?.price, 1))),
      desc: String(product?.desc || ''),
      description: String(product?.desc || ''),
      created_at: nowIso,
      updated_at: nowIso,
    };
    try {
      const row = await insertRowWithPruning('business_products', payload);
      if (row?.id) productRows.push(row);
    } catch (error) {
      console.warn('[TonCrime] createBusinessWithProducts product insert skipped:', {
        businessType: normalizedType,
        productKey,
        error: error?.message || error,
      });
    }
  }

  return {
    businessRow,
    productRows,
    business: buildBusinessUiFromRow(
      businessRow,
      sanitizeUsername(ownerProfile.username || 'Player'),
      productRows
    ),
  };
}

async function ensureOwnedBlackmarketBusiness(profile = null) {
  if (!profile?.id) return null;

  const existing = await getOwnedBusiness(profile.id, '', 'blackmarket').catch(() => null);
  if (existing?.id) return existing;

  const created = await createBusinessWithProducts({
    ownerProfile: profile,
    businessType: 'blackmarket',
    businessName: 'Black Market',
    acquiredFrom: 'system',
  }).catch(() => null);

  return created?.businessRow || existing || null;
}

async function getWithdrawById(id) {
  const { data, error } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function chunkList(items = [], size = 200) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function readAllTableRows(table, columns = '*', orderColumn = 'id', pageSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function deleteRowsByIdList(table, ids = [], idColumn = 'id') {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return 0;

  for (const chunk of chunkList(uniqueIds, 200)) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in(idColumn, chunk);

    if (error) throw error;
  }

  return uniqueIds.length;
}

async function collectProfileCascadeDeleteSummary(profileIds = []) {
  const uniqueProfileIds = [...new Set((profileIds || []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!uniqueProfileIds.length) {
    return {
      profiles: [],
      inventory_items: [],
      businesses: [],
      business_products: [],
      market_listings: [],
      withdraw_requests: [],
      wallet_ledger: [],
    };
  }

  const profileIdSet = new Set(uniqueProfileIds);
  const [
    inventoryRows,
    businessRows,
    businessProductRows,
    marketListingRows,
    withdrawRows,
    walletLedgerRows,
  ] = await Promise.all([
    readAllTableRows('inventory_items').catch(() => []),
    readAllTableRows('businesses').catch(() => []),
    readAllTableRows('business_products').catch(() => []),
    readAllTableRows('market_listings').catch(() => []),
    readAllTableRows('withdraw_requests').catch(() => []),
    readAllTableRows('wallet_ledger').catch(() => []),
  ]);

  const inventoryIds = inventoryRows
    .filter((row) => profileIdSet.has(String(row?.profile_id || '').trim()))
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean);
  const inventoryIdSet = new Set(inventoryIds);

  const businessIds = businessRows
    .filter((row) => profileIdSet.has(String(row?.owner_id || '').trim()))
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean);
  const businessIdSet = new Set(businessIds);

  const businessProductIds = businessProductRows
    .filter((row) => businessIdSet.has(String(row?.business_id || '').trim()))
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean);
  const businessProductIdSet = new Set(businessProductIds);

  const marketListingIds = marketListingRows
    .filter((row) =>
      profileIdSet.has(String(row?.seller_profile_id || '').trim()) ||
      profileIdSet.has(String(row?.profile_id || '').trim()) ||
      profileIdSet.has(String(row?.owner_id || '').trim()) ||
      businessIdSet.has(String(row?.business_id || '').trim()) ||
      inventoryIdSet.has(String(row?.inventory_item_id || '').trim()) ||
      businessProductIdSet.has(String(row?.business_product_id || row?.product_id || '').trim())
    )
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean);

  const withdrawIds = withdrawRows
    .filter((row) => profileIdSet.has(String(row?.profile_id || '').trim()))
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean);

  const walletLedgerIds = walletLedgerRows
    .filter((row) => profileIdSet.has(String(row?.profile_id || '').trim()))
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean);

  return {
    profiles: uniqueProfileIds,
    inventory_items: inventoryIds,
    businesses: businessIds,
    business_products: businessProductIds,
    market_listings: marketListingIds,
    withdraw_requests: withdrawIds,
    wallet_ledger: walletLedgerIds,
  };
}

async function purgeProfilesByIds(profileIds = []) {
  const summary = await collectProfileCascadeDeleteSummary(profileIds);

  await deleteRowsByIdList('market_listings', summary.market_listings);
  await deleteRowsByIdList('business_products', summary.business_products);
  await deleteRowsByIdList('inventory_items', summary.inventory_items);
  await deleteRowsByIdList('businesses', summary.businesses);
  await deleteRowsByIdList('wallet_ledger', summary.wallet_ledger);
  await deleteRowsByIdList('withdraw_requests', summary.withdraw_requests);
  await deleteRowsByIdList('profiles', summary.profiles);

  return {
    profiles: summary.profiles.length,
    inventory_items: summary.inventory_items.length,
    businesses: summary.businesses.length,
    business_products: summary.business_products.length,
    market_listings: summary.market_listings.length,
    withdraw_requests: summary.withdraw_requests.length,
    wallet_ledger: summary.wallet_ledger.length,
  };
}

/* =========================
   PUBLIC ROUTES
========================= */
app.get('/health', async (_req, res) => {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    res.json({ ok: true, uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Health failed' });
  }
});

/* =========================
   WALLET VALIDATION (PUBLIC)
========================= */
app.post('/wallet/validate', async (req, res) => {
  try {
    const walletAddress = String(req.body?.wallet_address || '').trim();
    const result = validateTonAddressOrThrow(walletAddress);

    return res.json({
      ok: true,
      valid: true,
      wallet_address: result.normalized,
      bounceable: result.bounceable,
      non_bounceable: result.nonBounceable,
      message: 'Valid TON wallet address',
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      valid: false,
      error: err.message || 'Invalid wallet address',
    });
  }
});


app.use('/public', (req, res, next) => {
  disableResponseCache(res);
  next();
});

app.post('/public/auth/session', makePublicRateLimit('auth-session', 60_000, 40), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    const result = await signInIdentityAuthUser(identity.authIdentityKey, identity.username);
    if (!result?.session?.access_token || !result?.session?.refresh_token) {
      throw new Error('session bridge failed');
    }

    return res.json({
      ok: true,
      identity_key: identity.authIdentityKey,
      profile_key: identity.profileKey,
      user: result.user || null,
      session: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_at: result.session.expires_at,
        expires_in: result.session.expires_in,
        token_type: result.session.token_type,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'auth session failed' });
  }
});

app.get('/public/profile', makePublicRateLimit('profile-read', 60_000, 120), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    let data = await getProfileByKey(identity.profileKey);
    if (!data && identity.verified && !identity.isGuest) {
      await ensureProfileRecordForIdentity(identity.profileKey, identity.username || 'Player');
      data = await getProfileByKey(identity.profileKey);
    }

    return res.json({ ok: true, item: data || null, profile_key: identity.profileKey });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'profile fetch failed' });
  }
});

app.post('/public/profile-reset', makePublicRateLimit('profile-reset', 60_000, 20), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    const profile = await getProfileByKey(identity.profileKey).catch(() => null);
    if (!profile?.id) {
      return res.json({
        ok: true,
        profile_key: identity.profileKey,
        deleted: {
          profiles: 0,
          inventory_items: 0,
          businesses: 0,
          business_products: 0,
          market_listings: 0,
          withdraw_requests: 0,
          wallet_ledger: 0,
        },
      });
    }

    const deleted = await purgeProfilesByIds([profile.id]);
    return res.json({
      ok: true,
      profile_key: identity.profileKey,
      deleted,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'profile reset failed' });
  }
});

app.get('/public/pvp/leaderboard', makePublicRateLimit('pvp-leaderboard', 60_000, 180), async (req, res) => {
  try {
    const limit = Math.max(5, Math.min(100, asInteger(req.query.limit, 50)));
    let rows = [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, telegram_id, username, level, updated_at, pvp_wins, pvp_losses, pvp_rating, pvp_last_match_at')
        .order('pvp_rating', { ascending: false })
        .order('pvp_wins', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(Math.max(limit * 4, 120));

      if (error) throw error;
      rows = data || [];
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (!(msg.includes('pvp_') || msg.includes('column'))) throw err;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(500);

      if (error) throw error;
      rows = data || [];
    }

    const items = rows
      .map((row) => buildPvpLeaderboardEntry(row))
      .filter((item) => item.id && item.name)
      .sort((a, b) => {
        const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        const winsDiff = Number(b.wins || 0) - Number(a.wins || 0);
        if (winsDiff !== 0) return winsDiff;
        return String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')) * -1;
      })
      .slice(0, limit)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'pvp leaderboard failed' });
  }
});

app.post('/public/session/claim', makePublicRateLimit('session-claim', 60_000, 120), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    const result = await claimSingleDeviceSession({
      profileKey: identity.profileKey,
      username: req.body?.username || identity.username || 'Player',
      deviceId: req.body?.device_id,
      sessionId: req.body?.session_id,
      deviceLabel: req.body?.device_label,
    });

    if (!result.ok) {
      return res.status(result.status || 409).json({
        ok: false,
        error: result.error || 'session claim failed',
        supported: result.supported !== false,
        active_session: buildSingleSessionSummary(result.row),
      });
    }

    return res.json({
      ok: true,
      supported: result.supported !== false,
      profile_key: identity.profileKey,
      active_session: buildSingleSessionSummary(result.row),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'session claim failed' });
  }
});

app.post('/public/session/heartbeat', makePublicRateLimit('session-heartbeat', 60_000, 240), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    const result = await heartbeatSingleDeviceSession({
      profileKey: identity.profileKey,
      deviceId: req.body?.device_id,
      sessionId: req.body?.session_id,
    });

    if (!result.ok) {
      return res.status(result.status || 409).json({
        ok: false,
        error: result.error || 'session heartbeat failed',
        supported: result.supported !== false,
        active_session: buildSingleSessionSummary(result.row),
      });
    }

    return res.json({
      ok: true,
      supported: result.supported !== false,
      active_session: buildSingleSessionSummary(result.row),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'session heartbeat failed' });
  }
});

app.post('/public/session/release', makePublicRateLimit('session-release', 60_000, 240), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    const result = await releaseSingleDeviceSession({
      profileKey: identity.profileKey,
      deviceId: req.body?.device_id,
      sessionId: req.body?.session_id,
    });

    return res.json({
      ok: true,
      supported: result.supported !== false,
      released: !!result.released,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'session release failed' });
  }
});

app.post('/public/profile-sync', makePublicRateLimit('profile-sync', 60_000, 120), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    const sessionAccess = await assertSingleDeviceSessionAccess(identity.profileKey, req.body);
    if (!sessionAccess.ok) {
      return res.status(sessionAccess.status || 409).json({
        ok: false,
        error: sessionAccess.error || 'session_active_elsewhere',
        active_session: buildSingleSessionSummary(sessionAccess.row),
      });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const current = await getProfileByKey(identity.profileKey).catch(() => null);
    const hasAgeColumn = !!current ? hasOwn(current, 'age') : true;

    const username = hasOwn(body, 'username')
      ? sanitizeUsername(body.username || identity.username || current?.username || 'Player')
      : sanitizeUsername(current?.username || identity.username || 'Player');
    const level = hasOwn(body, 'level')
      ? Math.max(0, asNumber(body.level, current?.level ?? 0))
      : Math.max(0, asNumber(current?.level, 0));
    const coins = hasOwn(body, 'coins')
      ? Math.max(0, asNumber(body.coins, current?.coins ?? 100))
      : Math.max(0, asNumber(current?.coins, 100));
    const requestedEnergy = hasOwn(body, 'energy')
      ? Math.max(0, asNumber(body.energy, current?.energy ?? 100))
      : Math.max(0, asNumber(current?.energy, 100));
    const fallbackEnergyMax = current?.energy_max ?? requestedEnergy ?? 100;
    const requestedEnergyMax = hasOwn(body, 'energy_max')
      ? Math.min(100, Math.max(1, asNumber(body.energy_max, fallbackEnergyMax)))
      : Math.min(100, Math.max(1, asNumber(current?.energy_max, requestedEnergy || 100)));
    const energy = Math.min(requestedEnergyMax, requestedEnergy);
    const energyMax = requestedEnergyMax;
    const age = hasOwn(body, 'age')
      ? (body.age == null ? null : asNumber(body.age, current?.age ?? null))
      : (hasAgeColumn ? (current?.age ?? null) : null);
    const pvpPatch = {
      pvp_wins: body?.pvp_wins,
      pvp_losses: body?.pvp_losses,
      pvp_rating: body?.pvp_rating,
      pvp_last_match_at: body?.pvp_last_match_at,
    };

    const payload = {
      telegram_id: identity.profileKey,
      username,
      age,
      level,
      coins,
      energy,
      energy_max: energyMax,
      updated_at: new Date().toISOString(),
    };

    let profileData = null;
    {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'telegram_id' })
        .select('*')
        .single();

      if (error) {
        if (!isMissingProfileColumnError(error, 'age')) throw error;

        const fallbackPayload = { ...payload };
        delete fallbackPayload.age;

        const fallback = await supabase
          .from('profiles')
          .upsert(fallbackPayload, { onConflict: 'telegram_id' })
          .select('*')
          .single();

        if (fallback.error) throw fallback.error;
        profileData = fallback.data || null;
      } else {
        profileData = data || null;
      }
    }

    let finalData = profileData;
    const pvpData = await tryPersistProfilePvpStats(identity.profileKey, pvpPatch);
    if (pvpData) {
      finalData = pvpData;
    } else if (Object.values(pvpPatch).some((value) => value != null)) {
      finalData = await getProfileByKey(identity.profileKey).catch(() => profileData) || profileData;
    }

    return res.json({ ok: true, item: finalData });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'profile-sync failed' });
  }
});

app.get('/public/trade/state', makePublicRateLimit('trade-state', 60_000, 120), async (req, res) => {
  try {
    const { profile } = await resolveVerifiedProfile(req, { allowGuest: true });
    await ensureOwnedBlackmarketBusiness(profile).catch(() => null);

    const [freshProfile, ownedBusinessRows, rawListingRows] = await Promise.all([
      getProfileById(profile.id).catch(() => profile),
      listOwnedBusinesses(profile.id),
      listMarketListingRows(500),
    ]);

    const ownedBusinessIdSet = new Set(
      (ownedBusinessRows || []).map((row) => String(row?.id || '').trim()).filter(Boolean)
    );

    const activeListingRows = (rawListingRows || []).filter((row) => {
      const quantityKey = detectQuantityKey(row);
      if (!quantityKey) return false;
      if (Math.max(0, readRowQuantity(row, [quantityKey])) <= 0) return false;
      if (hasOwn(row, 'is_active') && !readBooleanish(row, ['is_active'], true)) return false;

      const status = String(row?.status || '').trim().toLowerCase();
      if (status && ['inactive', 'sold_out', 'deleted', 'removed', 'cancelled'].includes(status)) {
        return false;
      }

      return !!readRowText(row, ['business_id']);
    });

    const listingBusinessIds = activeListingRows
      .map((row) => readRowText(row, ['business_id']))
      .filter(Boolean);
    const missingBusinessIds = listingBusinessIds.filter((id) => !ownedBusinessIdSet.has(String(id)));
    const missingBusinessRows = await getTableRowsByIds('businesses', missingBusinessIds).catch(() => []);
    const allBusinessRows = [...(ownedBusinessRows || []), ...(missingBusinessRows || [])];
    const allBusinessIds = allBusinessRows
      .map((row) => String(row?.id || '').trim())
      .filter(Boolean);

    const [allProductRows, inventoryRows, ownerProfiles] = await Promise.all([
      listBusinessProductsByBusinessIds(allBusinessIds).catch(() => []),
      getTableRowsByIds(
        'inventory_items',
        activeListingRows.map((row) => readRowText(row, ['inventory_item_id'])).filter(Boolean)
      ).catch(() => []),
      getProfilesByIdMap(allBusinessRows.map((row) => readRowText(row, ['owner_id'])).filter(Boolean)).catch(() => new Map()),
    ]);

    const businessRowsById = new Map();
    for (const row of allBusinessRows || []) {
      const id = String(row?.id || '').trim();
      if (id) businessRowsById.set(id, row);
    }

    const businessProductsByBusinessId = new Map();
    const businessProductsById = new Map();
    for (const row of allProductRows || []) {
      const businessId = String(row?.business_id || '').trim();
      const rowId = String(row?.id || '').trim();
      if (rowId) businessProductsById.set(rowId, row);
      if (!businessId) continue;
      if (!businessProductsByBusinessId.has(businessId)) businessProductsByBusinessId.set(businessId, []);
      businessProductsByBusinessId.get(businessId).push(row);
    }

    const inventoryById = new Map();
    for (const row of inventoryRows || []) {
      const id = String(row?.id || '').trim();
      if (id) inventoryById.set(id, row);
    }

    const businessUiById = new Map();
    const allBusinessesUi = (allBusinessRows || []).map((row) => {
      const ownerId = readRowText(row, ['owner_id']);
      const ownerName = sanitizeUsername(ownerProfiles.get(ownerId)?.username || 'Player');
      const ui = buildBusinessUiFromRow(
        row,
        ownerName,
        businessProductsByBusinessId.get(String(row?.id || '').trim()) || []
      );
      if (ui?.id) businessUiById.set(ui.id, ui);
      return ui;
    });

    const listings = activeListingRows
      .map((row) => {
        const businessId = readRowText(row, ['business_id']);
        const businessUi = businessUiById.get(String(businessId || '').trim()) || null;
        if (!businessUi?.id) return null;

        return buildMarketListingUiFromRow(row, {
          business: businessUi,
          inventoryItem: inventoryById.get(readRowText(row, ['inventory_item_id'])) || null,
          businessProduct: businessProductsById.get(readRowText(row, ['business_product_id', 'product_id'])) || null,
        });
      })
      .filter((item) => item?.id && item?.shopId);

    const listingCountByBusinessId = new Map();
    for (const item of listings) {
      const businessId = String(item?.businessId || '').trim();
      if (!businessId) continue;
      listingCountByBusinessId.set(
        businessId,
        Math.max(0, asInteger(listingCountByBusinessId.get(businessId), 0) + 1)
      );
    }

    const shops = [...listingCountByBusinessId.entries()]
      .map(([businessId, totalListings]) => {
        const business = businessUiById.get(String(businessId || '').trim()) || null;
        if (!business?.id) return null;
        return buildMarketShopUiFromBusiness(business, totalListings);
      })
      .filter((item) => item?.id);

    const ownedBusinesses = allBusinessesUi.filter(
      (item) =>
        item?.id &&
        ownedBusinessIdSet.has(String(item.id)) &&
        String(item.type || '').toLowerCase() !== 'blackmarket'
    );

    return res.json({
      ok: true,
      profile: freshProfile || profile,
      businesses: ownedBusinesses,
      market: {
        shops,
        listings,
      },
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'trade state failed' });
  }
});

app.post('/public/businesses/purchase', makePublicRateLimit('business-purchase', 60_000, 40), async (req, res) => {
  let buyerAfterUpdate = null;
  let originalProfile = null;

  try {
    const { profile } = await resolveVerifiedProfile(req, { allowGuest: true });
    const businessType = String(req.body?.business_type || req.body?.type || '').trim().toLowerCase();
    const def = getServerBusinessDef(businessType);
    const grantPremium = !!(req.body?.grant_premium || req.body?.premium_membership || req.body?.premium);
    const restoreExisting = !!(req.body?.restore_existing || req.body?.restoreExisting);

    if (!def || businessType === 'blackmarket') {
      return res.status(400).json({ ok: false, error: 'business_type is invalid' });
    }

    originalProfile = await getProfileById(profile.id).catch(() => profile);
    if (!originalProfile?.id) {
      return res.status(404).json({ ok: false, error: 'Profile was not found' });
    }

    const requestedName = String(req.body?.name || def.defaultName || 'Business').trim().slice(0, 80);
    const safeName = requestedName || def.defaultName || 'Business';

    if (grantPremium) {
      const nextLevel = Math.max(50, asInteger(originalProfile.level, 1));
      buyerAfterUpdate = await updateRowWithPruning('profiles', originalProfile.id, {
        level: nextLevel,
        membership: 'premium',
        premium: true,
        can_own_business: true,
        can_withdraw: true,
        updated_at: new Date().toISOString(),
      }).catch(() => null);
      buyerAfterUpdate = buyerAfterUpdate || await getProfileById(originalProfile.id).catch(() => originalProfile) || originalProfile;
    } else if (!restoreExisting) {
      const priceYton = Math.max(1, Math.floor(asNumber(def.priceYton, 1)));
      const currentCoins = Math.max(0, asNumber(originalProfile.coins, 0));
      if (currentCoins < priceYton) {
        return res.status(400).json({ ok: false, error: 'Not enough yton' });
      }
      buyerAfterUpdate = await updateProfileCoinsExact(originalProfile, currentCoins - priceYton);
    } else {
      buyerAfterUpdate = originalProfile;
    }

    let created = null;
    try {
      created = await createBusinessWithProducts({
        ownerProfile: {
          ...originalProfile,
          ...(buyerAfterUpdate || {}),
        },
        businessType,
        businessName: safeName,
        acquiredFrom: grantPremium ? 'premium' : 'shop',
      });
    } catch (err) {
      if (grantPremium) {
        await updateRowWithPruning('profiles', originalProfile.id, {
          level: originalProfile.level,
          membership: originalProfile.membership ?? null,
          premium: originalProfile.premium ?? null,
          can_own_business: originalProfile.can_own_business ?? null,
          can_withdraw: originalProfile.can_withdraw ?? null,
          updated_at: new Date().toISOString(),
        }).catch(() => null);
      } else if (originalProfile?.id) {
        await forceUpdateProfileCoins(originalProfile.id, asNumber(originalProfile.coins, 0)).catch(() => null);
      }
      throw err;
    }

    return res.json({
      ok: true,
      profile: await getProfileById(originalProfile.id).catch(() => buyerAfterUpdate || originalProfile) || buyerAfterUpdate || originalProfile,
      business: created?.business || null,
      businesses: await buildOwnedBusinessUiList(
        originalProfile.id,
        buyerAfterUpdate?.username || originalProfile.username || profile.username || 'Player'
      ).catch(() => (created?.business ? [created.business] : [])),
      granted_premium: grantPremium,
      restored_existing: restoreExisting,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'business purchase failed' });
  }
});

app.post('/public/businesses/sync', makePublicRateLimit('business-sync', 60_000, 80), async (req, res) => {
  try {
    const { profile } = await resolveVerifiedProfile(req, { allowGuest: true });
    const businessId = sanitizeMarketId(req.body?.business_id || req.body?.id);
    if (!businessId) {
      return res.status(400).json({ ok: false, error: 'business_id is required' });
    }

    const businessRow = await getOwnedBusiness(profile.id, businessId);
    if (!businessRow?.id) {
      return res.status(404).json({ ok: false, error: 'Business was not found' });
    }

    const productRows = await listBusinessProductsByBusinessIds([businessRow.id]).catch(() => []);
    const productRowsById = new Map();
    for (const row of productRows || []) {
      const id = String(row?.id || '').trim();
      if (id) productRowsById.set(id, row);
    }

    const requestProducts = Array.isArray(req.body?.products) ? req.body.products : [];
    const updatedProductsById = new Map();
    const nowIso = new Date().toISOString();

    for (const item of requestProducts) {
      const productId = sanitizeMarketId(item?.id || item?.product_id);
      const productRow = productRowsById.get(productId);
      if (!productRow?.id) continue;

      const quantityKey = detectQuantityKey(productRow) || 'quantity';
      const nextQty = Math.max(0, Math.floor(asNumber(item?.qty ?? item?.quantity, readRowQuantity(productRow, [quantityKey]))));
      const updatedRow = await updateRowWithPruning('business_products', productRow.id, {
        [quantityKey]: nextQty,
        quantity: nextQty,
        qty: nextQty,
        stock_qty: nextQty,
        updated_at: nowIso,
      }).catch(() => null);

      updatedProductsById.set(productId, {
        ...productRow,
        ...(updatedRow || {}),
        [quantityKey]: nextQty,
        quantity: nextQty,
        qty: nextQty,
        stock_qty: nextQty,
      });
    }

    const finalProductRows = (productRows || []).map((row) => updatedProductsById.get(String(row?.id || '').trim()) || row);
    const explicitStock = req.body?.stock_qty ?? req.body?.stock;
    const nextStock = Number.isFinite(Number(explicitStock))
      ? Math.max(0, Math.floor(asNumber(explicitStock, 0)))
      : finalProductRows.reduce((sum, row) => sum + Math.max(0, readRowQuantity(row, ['quantity', 'qty', 'stock_qty'])), 0);
    const pendingProduction = Array.isArray(req.body?.pending_production || req.body?.pendingProduction)
      ? (req.body?.pending_production || req.body?.pendingProduction)
      : null;

    const updatedBusinessRow = await updateRowWithPruning('businesses', businessRow.id, {
      stock_qty: nextStock,
      stock: nextStock,
      qty: nextStock,
      pending_production: pendingProduction ? JSON.stringify(pendingProduction) : undefined,
      production_day_key: req.body?.production_day_key ?? req.body?.productionDayKey,
      production_ready_at: toIsoTimestampOrNull(req.body?.production_ready_at ?? req.body?.productionReadyAt),
      production_claim_until: toIsoTimestampOrNull(req.body?.production_claim_until ?? req.body?.productionClaimUntil),
      production_collected_at: toIsoTimestampOrNull(req.body?.production_collected_at ?? req.body?.productionCollectedAt),
      production_missed_at: toIsoTimestampOrNull(req.body?.production_missed_at ?? req.body?.productionMissedAt),
      updated_at: nowIso,
    }).catch(() => null);

    const ownerName = sanitizeUsername(profile.username || 'Player');
    const business = buildBusinessUiFromRow(
      updatedBusinessRow || { ...businessRow, stock_qty: nextStock, stock: nextStock, qty: nextStock },
      ownerName,
      finalProductRows
    );

    return res.json({
      ok: true,
      business,
      synced_at: nowIso,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'business sync failed' });
  }
});

app.post('/public/chat/cleanup-demo', requireAdmin, adminRateLimit, async (_req, res) => {
  try {
    const filters = CHAT_DEMO_PATTERNS.map((pattern) => `text.ilike.${pattern}`).join(',');
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .or(filters);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'chat cleanup failed' });
  }
});

app.get('/public/chat/history', makePublicRateLimit('chat-history', 60_000, 180), async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(300, asNumber(req.query.limit, 180)));
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return res.json({
      ok: true,
      items: (data || []).filter((item) => !isDemoChatText(item?.text)),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'chat history failed' });
  }
});

app.post('/public/chat/send', makePublicRateLimit('chat-send', 60_000, 80), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    assertChatSendAllowed(identity.authIdentityKey, req);

    const profile = await getProfileByKey(identity.profileKey).catch(() => null);
    const username = sanitizeUsername(
      profile?.username ||
      identity.username ||
      req.body?.username ||
      'Player'
    );
    const text = String(req.body?.text || '').trim().replace(/\s+/g, ' ').slice(0, 500);
    const inputMeta = req.body?.player_meta && typeof req.body.player_meta === 'object' ? req.body.player_meta : {};

    if (!text) {
      return res.status(400).json({ ok: false, error: 'text is required' });
    }

    if (isDemoChatText(text)) {
      return res.status(400).json({ ok: false, error: 'demo messages are blocked' });
    }

    const player_meta = {
      username,
      clan: String(inputMeta.clan || '').trim().slice(0, 24),
      level: Math.max(0, asNumber(profile?.level ?? inputMeta.level, 0)),
      rating: Math.max(0, asNumber(inputMeta.rating, 1000)),
      wins: Math.max(0, asNumber(inputMeta.wins, 0)),
      losses: Math.max(0, asNumber(inputMeta.losses, 0)),
      premium: !!inputMeta.premium,
      online: true,
      verified: !!identity.verified,
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ username, text, player_meta })
      .select('*')
      .single();

    if (error) throw error;

    return res.json({ ok: true, item: data });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'chat send failed' });
  }
});

app.post('/public/market/list-inventory', makePublicRateLimit('market-list-inventory', 60_000, 60), async (req, res) => {
  try {
    const { profile } = await resolveVerifiedProfile(req, { allowGuest: true });
    const itemKey = sanitizeMarketId(req.body?.item_key || req.body?.inventory_key);
    const quantity = sanitizeMarketQuantity(req.body?.quantity, 1);
    const priceYton = sanitizeMarketPrice(req.body?.price_yton, 1);

    if (!itemKey) {
      return res.status(400).json({ ok: false, error: 'item_key is required' });
    }

    const invRow = await getOwnedInventoryItem(profile.id, itemKey);
    if (!invRow?.id) {
      return res.status(404).json({ ok: false, error: 'Inventory row was not found' });
    }

    const availableQty = readRowQuantity(invRow, ['quantity', 'qty', 'stock_qty']);
    if (availableQty < quantity) {
      return res.status(400).json({ ok: false, error: 'Not enough inventory quantity' });
    }

    const marketBusiness = await ensureOwnedBlackmarketBusiness(profile);
    if (!marketBusiness?.id) {
      return res.status(400).json({ ok: false, error: 'Blackmarket business is required' });
    }

    const item = await createMarketListingSecure({
      p_seller_profile_id: profile.id,
      p_business_id: marketBusiness.id,
      p_inventory_item_id: invRow.id,
      p_quantity: quantity,
      p_price_yton: priceYton,
    });

    return res.json({
      ok: true,
      item,
      inventory_item_id: invRow.id,
      business: {
        id: marketBusiness.id,
        name: marketBusiness.name || 'Black Market',
        business_type: marketBusiness.business_type || 'blackmarket',
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'inventory listing failed' });
  }
});

app.post('/public/market/list-business-product', makePublicRateLimit('market-list-business-product', 60_000, 60), async (req, res) => {
  try {
    const { profile } = await resolveVerifiedProfile(req, { allowGuest: true });
    const businessId = sanitizeMarketId(req.body?.business_id);
    const productId = sanitizeMarketId(req.body?.business_product_id || req.body?.product_id);
    const quantity = sanitizeMarketQuantity(req.body?.quantity, 1);
    const priceYton = sanitizeMarketPrice(req.body?.price_yton, 1);

    if (!businessId) {
      return res.status(400).json({ ok: false, error: 'business_id is required' });
    }
    if (!productId) {
      return res.status(400).json({ ok: false, error: 'business_product_id is required' });
    }

    const business = await getOwnedBusiness(profile.id, businessId);
    if (!business?.id) {
      return res.status(404).json({ ok: false, error: 'Business was not found' });
    }

    const businessProduct = await getOwnedBusinessProduct(business.id, productId);
    if (!businessProduct?.id) {
      return res.status(404).json({ ok: false, error: 'Business product was not found' });
    }

    const availableQty = readRowQuantity(businessProduct, ['quantity', 'qty', 'stock_qty']);
    if (availableQty < quantity) {
      return res.status(400).json({ ok: false, error: 'Not enough business product quantity' });
    }

    const item = await createMarketListingSecure({
      p_seller_profile_id: profile.id,
      p_business_id: business.id,
      p_business_product_id: businessProduct.id,
      p_quantity: quantity,
      p_price_yton: priceYton,
    });

    return res.json({
      ok: true,
      item,
      business_product_id: businessProduct.id,
      business: {
        id: business.id,
        name: business.name || 'Business',
        business_type: business.business_type || '',
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'business product listing failed' });
  }
});

app.post('/public/market/buy', makePublicRateLimit('market-buy', 60_000, 80), async (req, res) => {
  let buyerAfterDebit = null;
  let sellerAfterCredit = null;

  try {
    const { profile } = await resolveVerifiedProfile(req, { allowGuest: true });
    const listingId = sanitizeMarketId(req.body?.listing_id || req.body?.id);
    const quantity = sanitizeMarketQuantity(req.body?.quantity, 1);

    if (!listingId) {
      return res.status(400).json({ ok: false, error: 'listing_id is required' });
    }

    const listing = await getMarketListingById(listingId);
    if (!listing?.id) {
      return res.status(404).json({ ok: false, error: 'Listing was not found' });
    }

    const quantityKey = detectQuantityKey(listing);
    const priceKey = detectPriceKey(listing);
    if (!quantityKey || !priceKey) {
      return res.status(500).json({ ok: false, error: 'Listing schema is incomplete' });
    }

    const availableQty = Math.max(0, readRowQuantity(listing, [quantityKey]));
    if (availableQty < quantity) {
      return res.status(400).json({ ok: false, error: 'Not enough listing stock' });
    }

    if (hasOwn(listing, 'is_active') && !readBooleanish(listing, ['is_active'], true)) {
      return res.status(400).json({ ok: false, error: 'Listing is inactive' });
    }

    const unitPrice = Math.max(1, Math.floor(asNumber(listing?.[priceKey], 0)));
    const totalPrice = unitPrice * quantity;

    const business = await getBusinessById(readRowText(listing, ['business_id'])).catch(() => null);
    const sellerProfileId = readRowText(
      listing,
      ['seller_profile_id', 'profile_id', 'owner_id'],
      readRowText(business, ['owner_id'])
    );

    if (!sellerProfileId) {
      return res.status(409).json({ ok: false, error: 'Listing seller could not be resolved' });
    }

    if (String(sellerProfileId) === String(profile.id)) {
      return res.status(400).json({ ok: false, error: 'You cannot buy your own listing' });
    }

    const buyerProfile = await getProfileById(profile.id);
    if (!buyerProfile?.id) {
      return res.status(404).json({ ok: false, error: 'Buyer profile was not found' });
    }

    const sellerProfile = await getProfileById(sellerProfileId);
    if (!sellerProfile?.id) {
      return res.status(404).json({ ok: false, error: 'Seller profile was not found' });
    }

    const buyerCoins = Math.max(0, asNumber(buyerProfile.coins, 0));
    if (buyerCoins < totalPrice) {
      return res.status(400).json({ ok: false, error: 'Not enough yton' });
    }

    const inventoryItem = await getInventoryItemById(readRowText(listing, ['inventory_item_id'])).catch(() => null);
    const businessProduct = await getBusinessProductById(readRowText(listing, ['business_product_id', 'product_id'])).catch(() => null);
    const item = buildPurchasedItemSnapshot({
      listing,
      inventoryItem,
      businessProduct,
      business,
      unitPrice,
    });

    const nextBuyerCoins = Math.max(0, buyerCoins - totalPrice);
    const nextSellerCoins = Math.max(0, asNumber(sellerProfile.coins, 0) + totalPrice);
    const nextListingQty = Math.max(0, availableQty - quantity);

    buyerAfterDebit = await updateProfileCoinsExact(buyerProfile, nextBuyerCoins);

    try {
      sellerAfterCredit = await updateProfileCoinsExact(sellerProfile, nextSellerCoins);
    } catch (err) {
      await forceUpdateProfileCoins(buyerProfile.id, buyerCoins).catch(() => null);
      throw err;
    }

    let updatedListing = null;
    try {
      updatedListing = await updateMarketListingQuantityExact(listing, nextListingQty);
    } catch (err) {
      await forceUpdateProfileCoins(buyerProfile.id, buyerCoins).catch(() => null);
      await forceUpdateProfileCoins(sellerProfile.id, asNumber(sellerProfile.coins, 0)).catch(() => null);
      throw err;
    }

    const inventoryPersist = await persistPurchasedInventory({
      buyerProfileId: buyerProfile.id,
      item,
      quantity,
    }).catch((error) => ({
      persisted: false,
      row: null,
      error: error?.message || 'inventory persist failed',
    }));

    return res.json({
      ok: true,
      item,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      buyer_coins: Math.max(0, asNumber(buyerAfterDebit?.coins, nextBuyerCoins)),
      remaining_stock: Math.max(0, readRowQuantity(updatedListing, [detectQuantityKey(updatedListing)])),
      listing_id: String(updatedListing?.id || listing.id),
      inventory_persisted: !!inventoryPersist?.persisted,
      inventory_error: inventoryPersist?.persisted ? null : (inventoryPersist?.error || null),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, error: err.message || 'market purchase failed' });
  }
});

/* =========================
   ADMIN ROUTES
========================= */
app.use(requireAdmin);
app.use(adminRateLimit);

app.get('/withdraws', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending').trim();
    const allowed = new Set(['all', 'pending', 'processing', 'paid', 'rejected']);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    let query = supabase
      .from('withdraw_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ items: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load withdraws' });
  }
});

app.get('/profiles', requireAdmin, adminRateLimit, async (req, res) => {
  try {
    const queryText = String(req.query.query || '').trim();
    const limit = Math.max(20, Math.min(250, asInteger(req.query.limit, 120)));

    let query = supabase
      .from('profiles')
      .select('id, telegram_id, username, level, coins, energy, energy_max, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (queryText) {
      const safe = queryText.replace(/[%(),]/g, ' ').trim().slice(0, 64);
      if (safe) {
        const filters = [
          `telegram_id.ilike.%${safe}%`,
          `username.ilike.%${safe}%`,
        ];
        if (/^[0-9a-f-]{8,}$/i.test(safe)) {
          filters.unshift(`id.eq.${safe}`);
        }
        query = query.or(filters.join(','));
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ items: data || [], limit, query: queryText });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load profiles' });
  }
});

app.post('/profiles/purge-all', async (req, res) => {
  try {
    const confirm = String(req.body?.confirm || '').trim().toUpperCase();
    if (confirm !== 'TUM PROFILLERI SIL') {
      return res.status(400).json({ error: 'Confirmation text mismatch' });
    }

    const profileRows = await readAllTableRows('profiles', 'id, telegram_id, username');
    const profileIds = profileRows.map((row) => String(row?.id || '').trim()).filter(Boolean);

    if (!profileIds.length) {
      return res.json({
        ok: true,
        deleted: {
          profiles: 0,
          inventory_items: 0,
          businesses: 0,
          business_products: 0,
          market_listings: 0,
          withdraw_requests: 0,
          wallet_ledger: 0,
        },
      });
    }
    const deleted = await purgeProfilesByIds(profileIds);

    await logAdminAction({
      req,
      action: 'profiles_purge_all',
      note: `Deleted ${deleted.profiles} profiles and linked records`,
      meta: deleted,
    });

    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Profile purge failed' });
  }
});

app.post('/profiles/hard-reset-all', async (req, res) => {
  try {
    const confirm = String(req.body?.confirm || '').trim().toUpperCase();
    if (confirm !== 'TUM SISTEMI SIFIRLA') {
      return res.status(400).json({ error: 'Confirmation text mismatch' });
    }

    const profileRows = await readAllTableRows('profiles', 'id, telegram_id, username');
    const profileIds = profileRows.map((row) => String(row?.id || '').trim()).filter(Boolean);
    const authUsers = await listManagedTonCrimeAuthUsers();
    const authSummary = summarizeManagedAuthUsers(authUsers);

    const deletedProfiles = profileIds.length
      ? await purgeProfilesByIds(profileIds)
      : {
          profiles: 0,
          inventory_items: 0,
          businesses: 0,
          business_products: 0,
          market_listings: 0,
          withdraw_requests: 0,
          wallet_ledger: 0,
        };

    const deletedAuthUsers = authUsers.length ? await deleteManagedAuthUsers(authUsers) : 0;
    const deleted = {
      ...deletedProfiles,
      ...authSummary,
      auth_users_deleted: deletedAuthUsers,
    };

    await logAdminAction({
      req,
      action: 'profiles_hard_reset_all',
      note: `Hard reset completed for ${deletedProfiles.profiles} profiles and ${deletedAuthUsers} auth users`,
      meta: deleted,
    });

    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Hard reset failed' });
  }
});

app.post('/profiles/:id/update', requireAdmin, adminRateLimit, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Profile id is required' });
    }

    const { data: current, error: currentError } = await supabase
      .from('profiles')
      .select('id, telegram_id, username, level, coins, energy, energy_max')
      .eq('id', id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const nextLevel = Math.max(0, Math.min(9999, Math.floor(asNumber(req.body?.level, current.level || 0))));
    const nextCoins = Math.max(
      0,
      Math.min(999999999, Math.floor(asNumber(req.body?.coins ?? req.body?.yton, current.coins || 0)))
    );
    const nextEnergyMax = Math.max(
      1,
      Math.min(500, Math.floor(asNumber(req.body?.energy_max ?? req.body?.energyMax, current.energy_max || 100)))
    );
    const nextEnergy = Math.max(
      0,
      Math.min(nextEnergyMax, Math.floor(asNumber(req.body?.energy, current.energy || 0)))
    );

    const payload = {
      level: nextLevel,
      coins: nextCoins,
      energy: nextEnergy,
      energy_max: nextEnergyMax,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select('id, telegram_id, username, level, coins, energy, energy_max, created_at, updated_at')
      .single();

    if (error) throw error;

    await logAdminAction({
      req,
      action: 'profile_update',
      targetId: id,
      note: `Profile updated for ${current.username || current.telegram_id || id}`,
      meta: {
        before: {
          level: asNumber(current.level, 0),
          coins: asNumber(current.coins, 0),
          energy: asNumber(current.energy, 0),
          energy_max: asNumber(current.energy_max, 100),
        },
        after: payload,
      },
    });

    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Profile update failed' });
  }
});

app.post('/profiles/:id/reset-energy', requireAdmin, adminRateLimit, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const value = Math.max(1, Math.min(500, asNumber(req.body?.energy, 50)));

    const { data, error } = await supabase
      .from('profiles')
      .update({
        energy: value,
        energy_max: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction({
      req,
      action: 'reset_energy',
      targetId: id,
      note: `Energy reset to ${value}`,
      meta: { energy: value },
    });

    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Energy reset failed' });
  }
});

app.get('/admin/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [
      pendingRes,
      processingRes,
      paidTodayRes,
      rejectedTodayRes,
    ] = await Promise.all([
      supabase.from('withdraw_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('withdraw_requests').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('withdraw_requests').select('ton_amount').eq('status', 'paid').gte('paid_at', today.toISOString()),
      supabase.from('withdraw_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected').gte('rejected_at', today.toISOString()),
    ]);

    if (pendingRes.error) throw pendingRes.error;
    if (processingRes.error) throw processingRes.error;
    if (paidTodayRes.error) throw paidTodayRes.error;
    if (rejectedTodayRes.error) throw rejectedTodayRes.error;

    const paidTonToday = (paidTodayRes.data || []).reduce(
      (sum, row) => sum + asNumber(row.ton_amount, 0),
      0
    );

    res.json({
      pending_count: pendingRes.count || 0,
      processing_count: processingRes.count || 0,
      paid_ton_today: paidTonToday,
      rejected_today: rejectedTodayRes.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Stats failed' });
  }
});

app.post('/withdraws/:id/reject', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const admin_note = sanitizeNote(req.body?.admin_note, 'Rejected by admin');

    const { data, error } = await supabase
      .from('withdraw_requests')
      .update({
        status: 'rejected',
        admin_note,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(409).json({ error: 'Request is not pending or already handled' });
    }

    await logAdminAction({
      req,
      action: 'withdraw_reject',
      targetId: id,
      note: admin_note,
      meta: {
        profile_id: data.profile_id,
        wallet_address: data.wallet_address,
        ton_amount: data.ton_amount,
      },
    });

    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Reject failed' });
  }
});

app.post('/withdraws/:id/pay', async (req, res) => {
  const id = String(req.params.id || '').trim();

  try {
    const preRow = await getWithdrawById(id);

    if (preRow.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending requests can be paid' });
    }

    const walletInfo = validateTonAddressOrThrow(preRow.wallet_address);
    const normalizedWallet = walletInfo.normalized;
    const tonAmount = asNumber(preRow.ton_amount, NaN);
    const ytonAmount = asNumber(preRow.yton_amount, 0);

    if (!Number.isFinite(tonAmount) || tonAmount <= 0) {
      return res.status(400).json({ error: 'Invalid ton_amount' });
    }

    const limits = await getWithdrawLimits();

    if (tonAmount < limits.min_amount) {
      return res.status(400).json({ error: `Below min withdraw amount (${limits.min_amount} TON)` });
    }

    if (tonAmount > limits.max_amount) {
      return res.status(400).json({ error: `Above max withdraw amount (${limits.max_amount} TON)` });
    }

    const paidToday = await getTodayPaidTotalForProfile(preRow.profile_id);
    if (paidToday + tonAmount > limits.daily_limit) {
      return res.status(400).json({ error: `Daily withdraw limit exceeded (${limits.daily_limit} TON)` });
    }

    const { data: lockedRow, error: lockError } = await supabase
      .from('withdraw_requests')
      .update({
        status: 'processing',
        processing_at: new Date().toISOString(),
        admin_note: sanitizeNote(req.body?.admin_note, 'Processing by admin'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (lockError) throw lockError;
    if (!lockedRow) {
      return res.status(409).json({ error: 'Request is already being processed or already handled' });
    }

    await logAdminAction({
      req,
      action: 'withdraw_processing',
      targetId: id,
      note: 'Withdraw locked for payout',
      meta: {
        profile_id: lockedRow.profile_id,
        wallet_address: normalizedWallet,
        ton_amount: tonAmount,
        yton_amount: ytonAmount,
      },
    });

    let payout;
    try {
      payout = await sendTon({
        toAddress: normalizedWallet,
        tonAmount,
      });
    } catch (payErr) {
      await supabase
        .from('withdraw_requests')
        .update({
          status: 'pending',
          admin_note: sanitizeNote(`Payment failed: ${payErr.message}`, 'Payment failed'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'processing');

      await logAdminAction({
        req,
        action: 'withdraw_pay_failed',
        targetId: id,
        note: payErr.message || 'Payment failed',
        meta: {
          profile_id: lockedRow.profile_id,
          wallet_address: normalizedWallet,
          ton_amount: tonAmount,
        },
      });

      return res.status(500).json({ error: payErr.message || 'Payment failed' });
    }

    const { data: paidRow, error: paidError } = await supabase
      .from('withdraw_requests')
      .update({
        status: 'paid',
        wallet_address: normalizedWallet,
        tx_hash: payout.tx_hash,
        paid_at: new Date().toISOString(),
        admin_note: sanitizeNote(req.body?.admin_note, 'Paid by admin panel'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'processing')
      .select()
      .single();

    if (paidError) {
      throw new Error(`Paid update failed after payout: ${paidError.message}`);
    }

    const { error: ledgerError } = await supabase.from('wallet_ledger').insert({
      profile_id: paidRow.profile_id,
      entry_type: 'withdraw_paid',
      yton_amount: ytonAmount,
      ton_amount: tonAmount,
      note: `Withdraw paid to ${normalizedWallet}`,
      ref_id: paidRow.id,
      created_at: new Date().toISOString(),
    });

    if (ledgerError) {
      console.error('[wallet_ledger insert failed]', ledgerError.message);
    }

    await logAdminAction({
      req,
      action: 'withdraw_paid',
      targetId: id,
      note: 'Withdraw paid successfully',
      meta: {
        profile_id: paidRow.profile_id,
        wallet_address: normalizedWallet,
        ton_amount: tonAmount,
        tx_hash: payout.tx_hash,
        seqno_before: payout.seqno_before,
        seqno_after: payout.seqno_after,
      },
    });

    res.json({
      item: paidRow,
      payout,
    });
  } catch (err) {
    await logAdminAction({
      req,
      action: 'withdraw_pay_exception',
      targetId: id,
      note: err.message || 'Unknown pay exception',
    });

    res.status(500).json({ error: err.message || 'Payment failed' });
  }
});

/* =========================
   404 / ERROR
========================= */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TonCrime secure admin backend running on :${PORT}`);
});
 

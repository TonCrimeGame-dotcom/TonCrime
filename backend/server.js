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
const TELEGRAM_INIT_DATA_MAX_AGE_SEC = Math.max(
  60,
  Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SEC || 3600)
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
    .filter(([key]) => key !== 'hash' && key !== 'signature')
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
        ? 'Verified Telegram session required'
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

    const data = await getProfileByKey(identity.profileKey);
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

    const username = sanitizeUsername(req.body?.username || identity.username || 'Player');
    const level = Math.max(0, asNumber(req.body?.level, 0));
    const coins = Math.max(0, asNumber(req.body?.coins, 0));
    const energy = Math.max(0, asNumber(req.body?.energy, 0));
    const energyMax = Math.min(100, Math.max(1, asNumber(req.body?.energy_max, energy || 1)));
    const age = req.body?.age == null ? null : asNumber(req.body?.age, null);
    const pvpPatch = {
      pvp_wins: req.body?.pvp_wins,
      pvp_losses: req.body?.pvp_losses,
      pvp_rating: req.body?.pvp_rating,
      pvp_last_match_at: req.body?.pvp_last_match_at,
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

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'telegram_id' })
      .select('*')
      .single();

    if (error) throw error;

    let finalData = data;
    const pvpData = await tryPersistProfilePvpStats(identity.profileKey, pvpPatch);
    if (pvpData) {
      finalData = pvpData;
    } else if (Object.values(pvpPatch).some((value) => value != null)) {
      finalData = await getProfileByKey(identity.profileKey).catch(() => data) || data;
    }

    return res.json({ ok: true, item: finalData });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'profile-sync failed' });
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

    const marketBusiness = await getOwnedBusiness(profile.id, '', 'blackmarket');
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
 

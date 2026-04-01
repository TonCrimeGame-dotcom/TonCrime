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
const IDENTITY_AUTH_SECRET = String(
  process.env.IDENTITY_AUTH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.ADMIN_API_KEY ||
  ''
).trim();
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

  if (allowGuest && isGuestIdentityKey(requestedProfileKey || requestedIdentityKey)) {
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
      ? 'Valid Telegram session or guest identity is required'
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

app.post('/public/profile-sync', makePublicRateLimit('profile-sync', 60_000, 120), async (req, res) => {
  try {
    const identity = resolveIdentityContext(req, { allowGuest: true });
    if (!identity.ok) {
      return res.status(identity.status || 401).json({ ok: false, error: identity.error });
    }

    const username = sanitizeUsername(req.body?.username || identity.username || 'Player');
    const level = Math.max(0, asNumber(req.body?.level, 0));
    const coins = Math.max(0, asNumber(req.body?.coins, 0));
    const energy = Math.max(0, asNumber(req.body?.energy, 0));
    const energyMax = Math.min(100, Math.max(1, asNumber(req.body?.energy_max, energy || 1)));
    const age = req.body?.age == null ? null : asNumber(req.body?.age, null);

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

    return res.json({ ok: true, item: data });
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

app.get('/profiles', async (req, res) => {
  try {
    const queryText = String(req.query.query || '').trim();

    let query = supabase
      .from('profiles')
      .select('id, telegram_id, username, level, coins, energy, energy_max, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (queryText) {
      const safe = queryText.replace(/[%(),]/g, ' ').trim();
      query = query.or(`telegram_id.ilike.%${safe}%,username.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ items: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load profiles' });
  }
});

app.post('/profiles/:id/reset-energy', async (req, res) => {
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
 

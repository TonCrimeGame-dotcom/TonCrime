import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
const MAX_ADMIN_NOTE_LEN = 500;
const PAYOUT_MEMO = String(process.env.TON_PAYOUT_MEMO || 'TonCrime payout');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* =========================
   SIMPLE RATE LIMIT
========================= */
const rateBuckets = new Map();

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


const publicRateBuckets = new Map();
const PUBLIC_RATE_LIMIT_WINDOW_MS = Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS || 60_000);
const PUBLIC_PROFILE_SYNC_MAX = Number(process.env.PUBLIC_PROFILE_SYNC_MAX || 30);

function publicRateLimit(key) {
  const now = Date.now();
  const bucketKey = String(key || 'unknown');
  const bucket = publicRateBuckets.get(bucketKey) || { count: 0, resetAt: now + PUBLIC_RATE_LIMIT_WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + PUBLIC_RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  publicRateBuckets.set(bucketKey, bucket);

  return bucket.count <= PUBLIC_PROFILE_SYNC_MAX;
}

app.post('/public/profile-sync', async (req, res) => {
  try {
    const telegramId = String(req.body?.telegram_id || '').trim().slice(0, 120);
    const username = String(req.body?.username || 'Player').trim().slice(0, 24) || 'Player';
    const ageRaw = req.body?.age;
    const age = ageRaw === null || ageRaw === undefined || ageRaw === '' ? null : Math.max(18, Math.min(120, asNumber(ageRaw, 18)));
    const level = Math.max(1, Math.min(9999, asNumber(req.body?.level, 1)));
    const coins = Math.max(0, Math.min(1_000_000_000, asNumber(req.body?.coins, 0)));
    const energyMax = Math.max(1, Math.min(500, asNumber(req.body?.energy_max, 50)));
    const energy = Math.max(0, Math.min(energyMax, asNumber(req.body?.energy, energyMax)));
    const updatedAt = String(req.body?.updated_at || new Date().toISOString());

    if (!telegramId) {
      return res.status(400).json({ ok: false, error: 'telegram_id_required' });
    }

    const rateKey = `${getClientIp(req)}:${telegramId}`;
    if (!publicRateLimit(rateKey)) {
      return res.status(429).json({ ok: false, error: 'rate_limited' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        telegram_id: telegramId,
        username,
        age,
        level,
        coins,
        energy,
        energy_max: energyMax,
        updated_at: updatedAt,
      }, { onConflict: 'telegram_id' })
      .select('id, telegram_id, username, level, coins, energy, energy_max, updated_at')
      .single();

    if (error) {
      throw error;
    }

    return res.json({ ok: true, item: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'profile_sync_failed' });
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

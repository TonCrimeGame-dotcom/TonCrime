
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { TonClient, WalletContractV4, internal, toNano, SendMode } from '@ton/ton';
import { beginCell, Address } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';

const app = express();
app.use(cors());
app.use(express.json());

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_API_KEY'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-key'];
  if (!token || token !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/withdraws', requireAdmin, async (req, res) => {
  const status = String(req.query.status || 'pending');
  let query = supabase.from('withdraw_requests').select('*').order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

async function sendTon({ toAddress, tonAmount }) {
  if (!process.env.TON_RPC_ENDPOINT) throw new Error('Missing TON_RPC_ENDPOINT');
  if (!process.env.TON_WALLET_MNEMONIC) throw new Error('Missing TON_WALLET_MNEMONIC');

  const client = new TonClient({ endpoint: process.env.TON_RPC_ENDPOINT });
  const keyPair = await mnemonicToPrivateKey(String(process.env.TON_WALLET_MNEMONIC).trim().split(/\s+/));
  const wallet = WalletContractV4.create({
    workchain: Number(process.env.TON_WALLET_WORKCHAIN || 0),
    publicKey: keyPair.publicKey,
  });

  const openedWallet = client.open(wallet);
  const seqno = await openedWallet.getSeqno();

  await openedWallet.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: Address.parse(toAddress),
        value: toNano(String(tonAmount)),
        bounce: false,
        body: beginCell().storeUint(0, 32).storeStringTail('TonCrime payout').endCell(),
      }),
    ],
  });

  return {
    tx_hash: `seqno:${seqno}`,
    admin_wallet: wallet.address.toString(),
  };
}

app.post('/withdraws/:id/pay', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { data: row, error: fetchError } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return res.status(404).json({ error: fetchError.message });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be paid' });

  try {
    const payout = await sendTon({
      toAddress: row.wallet_address,
      tonAmount: row.ton_amount,
    });

    const { data: updated, error: updateError } = await supabase
      .from('withdraw_requests')
      .update({
        status: 'paid',
        tx_hash: payout.tx_hash,
        paid_at: new Date().toISOString(),
        admin_note: 'Paid by admin panel',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });

    await supabase.from('wallet_ledger').insert({
      profile_id: row.profile_id,
      entry_type: 'withdraw_paid',
      yton_amount: Number(row.yton_amount || 0),
      ton_amount: Number(row.ton_amount || 0),
      note: `Withdraw paid to ${row.wallet_address}`,
      ref_id: row.id,
    });

    res.json({ item: updated, payout });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Payment failed' });
  }
});

app.post('/withdraws/:id/reject', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const admin_note = String(req.body?.admin_note || 'Rejected by admin');
  const { data: row, error: fetchError } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return res.status(404).json({ error: fetchError.message });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be rejected' });

  const { data, error } = await supabase
    .from('withdraw_requests')
    .update({
      status: 'rejected',
      admin_note,
      rejected_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ item: data });
});

app.get('/profiles', requireAdmin, async (req, res) => {
  const queryText = String(req.query.query || '').trim();
  let query = supabase
    .from('profiles')
    .select('id, telegram_id, username, level, coins, energy, energy_max, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (queryText) {
    query = query.or(`telegram_id.ilike.%${queryText}%,username.ilike.%${queryText}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

app.post('/profiles/:id/reset-energy', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const value = Math.max(1, Number(req.body?.energy || 50));

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

  if (error) return res.status(500).json({ error: error.message });
  res.json({ item: data });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`TonCrime admin backend running on :${port}`);
});


import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { Address, beginCell, internal, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';

const app = express();
app.use(cors());
app.use(express.json());

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
  const status = req.query.status || 'pending';
  const query = supabase
    .from('withdraw_requests')
    .select('*')
    .order('created_at', { ascending: false });

  const { data, error } = status === 'all'
    ? await query
    : await query.eq('status', String(status));

  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

app.post('/withdraws/:id/approve', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const adminNote = String(req.body?.admin_note || '');

  const { data: row, error: fetchError } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return res.status(404).json({ error: fetchError.message });
  if (row.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending requests can be approved' });
  }

  const { data, error } = await supabase
    .from('withdraw_requests')
    .update({
      status: 'approved',
      admin_note: adminNote,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ item: data });
});

app.post('/withdraws/:id/reject', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const adminNote = String(req.body?.admin_note || 'Rejected by admin');

  const { data: row, error: fetchError } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return res.status(404).json({ error: fetchError.message });
  if (!['pending', 'approved'].includes(row.status)) {
    return res.status(400).json({ error: 'Only pending/approved requests can be rejected' });
  }

  const { data, error } = await supabase
    .from('withdraw_requests')
    .update({
      status: 'rejected',
      admin_note: adminNote,
      rejected_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ item: data });
});

async function sendTon({ toAddress, tonAmount }) {
  const endpoint = process.env.TON_RPC_ENDPOINT;
  const mnemonic = process.env.TON_WALLET_MNEMONIC;
  const workchain = Number(process.env.TON_WALLET_WORKCHAIN || 0);

  if (!endpoint || !mnemonic) {
    throw new Error('TON automation not configured. Set TON_RPC_ENDPOINT and TON_WALLET_MNEMONIC');
  }

  const client = new TonClient({ endpoint });
  const key = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({
    workchain,
    publicKey: key.publicKey,
  });

  const contract = client.open(wallet);
  const seqno = await contract.getSeqno();

  await contract.sendTransfer({
    secretKey: key.secretKey,
    seqno,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: Address.parse(toAddress),
        value: toNano(String(tonAmount)),
        bounce: false,
        body: beginCell().storeUint(0, 32).storeStringTail('TonCrime withdraw').endCell(),
      }),
    ],
  });

  return { seqno, walletAddress: wallet.address.toString() };
}

app.post('/withdraws/:id/pay', requireAdmin, async (req, res) => {
  const id = req.params.id;

  const { data: row, error: fetchError } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) return res.status(404).json({ error: fetchError.message });
  if (row.status !== 'approved') {
    return res.status(400).json({ error: 'Only approved requests can be paid' });
  }

  try {
    const payout = await sendTon({
      toAddress: row.wallet_address,
      tonAmount: row.ton_amount,
    });

    const txHash = `seqno:${payout.seqno}`;
    const paidAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('withdraw_requests')
      .update({
        status: 'paid',
        tx_hash: txHash,
        paid_at: paidAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({
        error: updateError.message,
        warning: 'Payment may have been sent. Check chain manually.',
      });
    }

    await supabase.from('wallet_ledger').insert({
      profile_id: row.profile_id,
      entry_type: 'withdraw_paid',
      ton_amount: row.ton_amount,
      yton_amount: row.yton_amount,
      note: `Withdraw paid to ${row.wallet_address}`,
      ref_id: row.id,
    });

    res.json({
      item: updated,
      payout,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Withdraw admin backend listening on :${port}`);
});


TonCrime Withdraw Admin Backend

1) Copy .env.example to .env
2) npm install
3) npm run dev

Endpoints:
GET  /health
GET  /withdraws?status=pending
POST /withdraws/:id/approve
POST /withdraws/:id/reject
POST /withdraws/:id/pay

Admin auth:
Pass header x-admin-key: YOUR_ADMIN_API_KEY

Security:
- Never expose SUPABASE_SERVICE_ROLE_KEY in the browser.
- Never expose TON_WALLET_MNEMONIC in the browser.
- Keep this backend private.

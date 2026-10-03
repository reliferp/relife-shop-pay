// ReLife Stripe backend — create a HOSTED Checkout Session.
// Deploy on Vercel. Stripe keys live ONLY in Vercel env vars.
// Called by FiveM (relife-pm) over HTTPS with Authorization: Bearer <SHARED_TOKEN>.
//
// The player opens session.url in their REAL browser (via QR on phone, or the
// "open browser" button on PC). FiveM's CEF cannot render Stripe (it crashes), so
// card entry happens in a real browser. The game polls /verify and credits RLC.

const Stripe = require('stripe');

// RLC packages (server-side source of truth; client/game NEVER sets the price).
const PACKAGES = {
  rlc_5:   { rlc: 5,   eurCents: 500  },
  rlc_10:  { rlc: 10,  eurCents: 1000 },
  rlc_20:  { rlc: 20,  eurCents: 2000 },
  rlc_35:  { rlc: 35,  eurCents: 3500 },
  rlc_50:  { rlc: 50,  eurCents: 5000 },
  rlc_100: { rlc: 100, eurCents: 10000 },
};

function timingSafeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    // --- auth: shared bearer token (over HTTPS) ---
    const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (!process.env.SHARED_TOKEN || !timingSafeEqual(token, process.env.SHARED_TOKEN)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const intent = String(body.intent || '');
    const packageId = String(body.packageId || '');
    if (!/^[a-f0-9]{16,64}$/i.test(intent)) return res.status(400).json({ error: 'bad_intent' });
    const pkg = PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ error: 'bad_package' });

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    const base = process.env.PUBLIC_BASE_URL || 'https://reliferp.com';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: pkg.eurCents,
          product_data: { name: `${pkg.rlc} RLC - ReLife Romania` },
        },
      }],
      client_reference_id: intent,
      metadata: { intent, packageId, rlc: String(pkg.rlc) },
      success_url: `${base}/?rlc=success`,
      cancel_url: `${base}/?rlc=cancel`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('create-checkout error', e && e.message);
    return res.status(500).json({ error: 'server' });
  }
};

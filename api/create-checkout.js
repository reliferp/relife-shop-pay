// ReLife Stripe backend — create a PaymentIntent (lightweight in-game card form).
// Deploy on Vercel. Stripe keys live ONLY in Vercel env vars.
// Called by FiveM (relife-pm) over HTTPS with Authorization: Bearer <SHARED_TOKEN>.
//
// We use a PaymentIntent + Stripe Card Element (ONE iframe) instead of Embedded
// Checkout (dozens of iframes) because the heavy Embedded Checkout crashed FiveM's
// CEF. The game opens /api/pay (Card Element) in its NUI window; crediting still
// happens server-side in FiveM after /verify confirms the PaymentIntent succeeded.

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

    // Card-only PaymentIntent. Amount is server-side (never from the client/game).
    const pi = await stripe.paymentIntents.create({
      amount: pkg.eurCents,
      currency: 'eur',
      payment_method_types: ['card'],
      description: `${pkg.rlc} RLC - ReLife Romania`,
      metadata: { intent, packageId, rlc: String(pkg.rlc) },
    });

    // The URL the GAME opens in its NUI window = our light card page carrying the
    // PaymentIntent client_secret (base64url-encoded so it survives the URL query).
    const selfBase = 'https://' + req.headers.host;
    const csParam = Buffer.from(pi.client_secret, 'utf8').toString('base64url');
    const payUrl = selfBase + '/api/pay?cs=' + csParam;

    // sessionId carries the PaymentIntent id; the game stores it and polls /verify.
    return res.status(200).json({ url: payUrl, sessionId: pi.id });
  } catch (e) {
    console.error('create-checkout error', e && e.message);
    return res.status(500).json({ error: 'server' });
  }
};

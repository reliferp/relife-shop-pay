// ReLife Stripe backend — verify a PaymentIntent (or legacy Checkout Session).
// Called by FiveM (relife-pm) over HTTPS with Authorization: Bearer <SHARED_TOKEN>.
// Returns ONLY Stripe's truth; the game decides crediting (amount is server-side there).

const Stripe = require('stripe');

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

    const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (!process.env.SHARED_TOKEN || !timingSafeEqual(token, process.env.SHARED_TOKEN)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const id = String(body.sessionId || '');

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    // New flow: PaymentIntent (pi_...). Paid when status === 'succeeded'.
    if (/^pi_[A-Za-z0-9_]+$/.test(id)) {
      const pi = await stripe.paymentIntents.retrieve(id);
      const m = pi.metadata || {};
      return res.status(200).json({
        paid: pi.status === 'succeeded',
        status: pi.status,
        intent: m.intent || null,
        packageId: m.packageId || null,
        rlc: m.rlc ? parseInt(m.rlc, 10) : null,
        amountTotal: pi.amount,
        currency: pi.currency,
      });
    }

    // Legacy flow: Checkout Session (cs_...). Paid when payment_status === 'paid'.
    if (/^cs_[A-Za-z0-9_]+$/.test(id)) {
      const s = await stripe.checkout.sessions.retrieve(id);
      const m = s.metadata || {};
      return res.status(200).json({
        paid: s.payment_status === 'paid',
        status: s.payment_status,
        intent: m.intent || s.client_reference_id || null,
        packageId: m.packageId || null,
        rlc: m.rlc ? parseInt(m.rlc, 10) : null,
        amountTotal: s.amount_total,
        currency: s.currency,
      });
    }

    return res.status(400).json({ error: 'bad_session' });
  } catch (e) {
    console.error('verify error', e && e.message);
    return res.status(500).json({ error: 'server' });
  }
};

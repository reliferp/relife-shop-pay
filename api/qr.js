// ReLife Stripe backend — QR code PNG for the hosted Stripe Checkout URL.
// The in-game NUI shows this as a plain <img> (images don't crash FiveM's CEF),
// so the player can scan it with a phone and pay there. No auth needed: it only
// ever encodes a public checkout.stripe.com URL and returns an image.

const QRCode = require('qrcode');

module.exports = async (req, res) => {
  try {
    const u = String((req.query && req.query.u) || '');
    // only ever encode a Stripe hosted checkout URL
    if (!/^https:\/\/checkout\.stripe\.com\/[A-Za-z0-9/_%+=.\-?&]+$/.test(u) || u.length > 2048) {
      return res.status(400).json({ error: 'bad_url' });
    }
    const png = await QRCode.toBuffer(u, {
      type: 'png',
      width: 260,
      margin: 1,
      color: { dark: '#0b0d10', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(png);
  } catch (e) {
    console.error('qr error', e && e.message);
    return res.status(500).json({ error: 'server' });
  }
};

// ReLife Stripe backend — in-game embedded payment page.
// Loaded INSIDE the game's NUI window (iframe). Mounts Stripe Embedded Checkout
// using the publishable key (public, safe) + the session client_secret from ?cs=.
// No secret key here; crediting still happens server-side in FiveM after /verify.

module.exports = (req, res) => {
  const cs = String((req.query && req.query.cs) || '');
  const pk = process.env.STRIPE_PUBLISHABLE_KEY || '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  // allow being framed by the game NUI
  res.setHeader('X-Frame-Options', 'ALLOWALL');

  if (!/^cs_[A-Za-z0-9_]+$/.test(cs)) {
    return res.status(400).send(page('<h1>Sesiune invalida</h1><p>Reia cumpararea din meniul ESC.</p>'));
  }
  if (!/^pk_(live|test)_[A-Za-z0-9]+$/.test(pk)) {
    return res.status(500).send(page('<h1>Config incompleta</h1><p>Lipseste STRIPE_PUBLISHABLE_KEY pe server.</p>'));
  }

  const html = `<!doctype html><html lang="ro"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ReLife - Plata</title>
<script src="https://js.stripe.com/v3/"></script>
<style>
  html,body{margin:0;height:100%;background:#0b0d10;color:#e8eaed;font:14px/1.5 system-ui,Segoe UI,Arial}
  #wrap{max-width:560px;margin:0 auto;padding:18px 14px 40px}
  #head{display:flex;align-items:center;gap:10px;margin:6px 2px 16px}
  #head b{font-size:16px;color:#fff}
  #head span{color:#9499a2;font-size:12px}
  #checkout{background:#fff;border-radius:10px;overflow:hidden;min-height:320px}
  #done{display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:48px 16px;text-align:center}
  #done .ok{width:64px;height:64px;border-radius:50%;background:#16a34a;color:#fff;display:grid;place-items:center;font-size:34px}
  #done h2{margin:6px 0 0;color:#fff}
  #done p{color:#9499a2;margin:0;max-width:360px}
  #err{display:none;color:#ff6b81;padding:16px;text-align:center}
</style></head><body>
<div id="wrap">
  <div id="head"><b>ReLife Romania</b><span>• Plata securizata prin Stripe</span></div>
  <div id="checkout"></div>
  <div id="done"><div class="ok">✓</div><h2>Plata reusita!</h2><p>RLC-ul tau apare in cont in cateva secunde. Poti inchide fereastra (butonul INCHIDE sus).</p></div>
  <div id="err"></div>
</div>
<script>
  (function(){
    var stripe = Stripe(${JSON.stringify(pk)});
    function fail(m){var e=document.getElementById('err');e.textContent=m||'A aparut o eroare. Reia din meniul ESC.';e.style.display='block';document.getElementById('checkout').style.display='none';}
    try{
      stripe.initEmbeddedCheckout({
        clientSecret: ${JSON.stringify(cs)},
        onComplete: function(){
          document.getElementById('checkout').style.display='none';
          document.getElementById('done').style.display='flex';
          try{ window.parent.postMessage({ action:'payDone' }, '*'); }catch(e){}
        }
      }).then(function(c){ c.mount('#checkout'); }).catch(function(e){ fail(e && e.message); });
    }catch(e){ fail(e && e.message); }
  })();
</script>
</body></html>`;
  return res.status(200).send(html);
};

function page(inner) {
  return `<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<body style="margin:0;background:#0b0d10;color:#e8eaed;font:15px/1.6 system-ui;display:grid;place-items:center;height:100vh;text-align:center">`
    + `<div style="padding:24px">${inner}</div></body>`;
}

// ReLife Stripe backend — in-game LIGHT card page (Stripe Card Element).
// Loaded INSIDE the game's NUI window (iframe). One Stripe iframe only (the card
// field), so it is far lighter than Embedded Checkout (which crashed FiveM's CEF).
// pk is public/safe; the real secret key stays on the server. Crediting is still
// done server-side in FiveM after /verify confirms the PaymentIntent succeeded.

module.exports = (req, res) => {
  const csParam = String((req.query && req.query.cs) || '');
  const pk = process.env.STRIPE_PUBLISHABLE_KEY || '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'ALLOWALL');

  // cs = base64url of the PaymentIntent client_secret (see create-checkout.js).
  if (!/^[A-Za-z0-9_-]{8,8000}$/.test(csParam)) {
    return res.status(400).send(page('<h1>Sesiune invalida</h1><p>Reia cumpararea din meniul ESC.</p>'));
  }
  let cs = '';
  try { cs = Buffer.from(csParam, 'base64url').toString('utf8'); } catch (e) { cs = ''; }
  if (cs.indexOf('pi_') !== 0 || cs.length > 4000) {
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
  #wrap{max-width:440px;margin:0 auto;padding:22px 16px 40px}
  #head{margin:4px 2px 16px}
  #head b{font-size:16px;color:#fff;display:block}
  #head span{color:#9499a2;font-size:12px}
  label{display:block;font-size:12px;color:#9499a2;margin:0 0 6px}
  #card{background:#fff;border-radius:10px;padding:14px 12px}
  #pay{width:100%;margin-top:16px;background:#e5143c;color:#fff;border:0;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer}
  #pay:disabled{opacity:.6;cursor:default}
  #err{color:#ff6b81;font-size:13px;margin-top:12px;min-height:16px;text-align:center}
  #done{display:none;flex-direction:column;align-items:center;gap:10px;padding:40px 10px;text-align:center}
  #done .ok{width:64px;height:64px;border-radius:50%;background:#16a34a;color:#fff;display:grid;place-items:center;font-size:34px}
  #done h2{margin:6px 0 0;color:#fff}
  #done p{color:#9499a2;margin:0;max-width:340px}
  .sec{color:#6b7280;font-size:11px;text-align:center;margin-top:14px}
</style></head><body>
<div id="wrap">
  <div id="head"><b>ReLife Romania</b><span>Plata securizata prin Stripe</span></div>
  <div id="form">
    <label>Datele cardului</label>
    <div id="card"></div>
    <button id="pay" disabled>Se incarca...</button>
    <div id="err"></div>
    <div class="sec">Plata e procesata de Stripe. Cardul nu e vazut de ReLife.</div>
  </div>
  <div id="done"><div class="ok">&#10003;</div><h2>Plata reusita!</h2><p>RLC-ul tau apare in cont in cateva secunde. Poti inchide fereastra (butonul INCHIDE sus).</p></div>
</div>
<script>
  (function(){
    var CS = ${JSON.stringify(cs)};
    var errEl = document.getElementById('err');
    var payBtn = document.getElementById('pay');
    function showErr(m){ errEl.textContent = m || 'A aparut o eroare. Incearca din nou.'; }
    function done(){ document.getElementById('form').style.display='none'; document.getElementById('done').style.display='flex'; try{ window.parent.postMessage({action:'payDone'},'*'); }catch(e){} }
    try{
      var stripe = Stripe(${JSON.stringify(pk)});
      var elements = stripe.elements();
      var card = elements.create('card', { hidePostalCode:true, style:{ base:{ fontSize:'16px', color:'#111827', '::placeholder':{ color:'#9aa0a6' } } } });
      card.mount('#card');
      card.on('ready', function(){ payBtn.disabled=false; payBtn.textContent='Plateste'; });
      card.on('change', function(ev){ showErr(ev.error ? ev.error.message : ''); });
      payBtn.onclick = function(){
        payBtn.disabled=true; payBtn.textContent='Se proceseaza...'; showErr('');
        stripe.confirmCardPayment(CS, { payment_method: { card: card } }).then(function(r){
          if(r.error){ showErr(r.error.message); payBtn.disabled=false; payBtn.textContent='Plateste'; }
          else if(r.paymentIntent && r.paymentIntent.status==='succeeded'){ done(); }
          else { showErr('Stare: '+(r.paymentIntent && r.paymentIntent.status)); payBtn.disabled=false; payBtn.textContent='Plateste'; }
        }).catch(function(e){ showErr(e && e.message); payBtn.disabled=false; payBtn.textContent='Plateste'; });
      };
    }catch(e){ showErr(e && e.message); }
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

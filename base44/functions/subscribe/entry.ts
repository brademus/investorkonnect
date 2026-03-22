// AUTH GATE → CHECKOUT
Deno.serve(async (req) => {
  try {
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    
    if (!base) {
      return new Response('Set PUBLIC_APP_URL', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const url = new URL(req.url, base);
    const passthru = url.search || '';
    
    console.log('💳 /functions/subscribe called with:', passthru);

    // Get user state from /functions/me
    const meUrl = `${base}/functions/me`;
    const meResponse = await fetch(meUrl, {
      method: 'POST',
      headers: {
        'Cookie': req.headers.get('Cookie') || '',
        'x-internal': '1'
      }
    });

    let state = null;
    try {
      state = meResponse.ok ? await meResponse.json() : null;
    } catch (e) {
      console.error('Failed to parse /functions/me:', e);
    }

    console.log('📊 User state:', state);

    // Not signed in → redirect to login, then back here
    if (!state || !state.authenticated) {
      const loginUrl = `${base}/authcallback`;
      console.log('❌ Not authenticated → redirect to:', loginUrl);
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authentication Required</title>
  <meta http-equiv="refresh" content="0;url=${loginUrl}">
  <script>
    try { top.location.replace(${JSON.stringify(loginUrl)}); }
    catch(e) { location.href = ${JSON.stringify(loginUrl)}; }
  </script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #2563eb; border-radius: 50%; 
                width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Redirecting to login...</p>
  <p><a href="${loginUrl}">Continue</a></p>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // User is authenticated → proceed to checkout
    const checkoutUrl = `${base}/functions/checkoutLite${passthru}`;
    console.log('✅ Proceeding to checkout:', checkoutUrl);
    
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Continuing to Checkout...</title>
  <meta http-equiv="refresh" content="0;url=${checkoutUrl}">
  <script>
    try { top.location.replace(${JSON.stringify(checkoutUrl)}); }
    catch(e) { location.href = ${JSON.stringify(checkoutUrl)}; }
  </script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #2563eb; border-radius: 50%; 
                width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Continuing to Stripe checkout...</p>
  <p><a href="${checkoutUrl}">Continue</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('❌ /functions/subscribe error:', error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});
// HEALTH CHECK - Verify PUBLIC_APP_URL and Stripe configuration
Deno.serve(async (req) => {
  const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
  
  return Response.json({
    ok: !!base,
    base: base,
    baseLooksRight: /^https:\/\/.+\.base44\.app$/.test(base),
    hasSecret: !!Deno.env.get('STRIPE_SECRET_KEY'),
    prices: {
      starter: !!Deno.env.get('STRIPE_PRICE_STARTER'),
      pro: !!Deno.env.get('STRIPE_PRICE_PRO'),
      enterprise: !!Deno.env.get('STRIPE_PRICE_ENTERPRISE')
    },
    ts: Date.now()
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
});
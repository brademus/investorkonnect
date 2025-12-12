import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is admin
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.entities.Profile.filter({ created_by: user.email });
    if (!profiles[0] || profiles[0].role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_PUBLISHABLE_KEY = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';
    const STRIPE_MODE = Deno.env.get('STRIPE_MODE') || 'live';
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    const STRIPE_PRICE_STARTER = Deno.env.get('STRIPE_PRICE_STARTER') || '';
    const STRIPE_PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO') || '';
    const STRIPE_PRICE_ENTERPRISE = Deno.env.get('STRIPE_PRICE_ENTERPRISE') || '';

    const messages = [];
    let ok = true;

    // Check secret key exists
    if (!STRIPE_SECRET_KEY) {
      ok = false;
      messages.push('❌ STRIPE_SECRET_KEY is missing (add in Base44 Secrets)');
      return Response.json({ 
        ok: false, 
        messages,
        account: null,
        publishable_key_ok: false,
        secret_key_ok: false,
        prices: {}
      });
    }

    // Validate secret key format
    const isLiveSecret = STRIPE_SECRET_KEY.startsWith('sk_live_');
    const isTestSecret = STRIPE_SECRET_KEY.startsWith('sk_test_');
    
    if (!isLiveSecret && !isTestSecret) {
      ok = false;
      messages.push('❌ STRIPE_SECRET_KEY must start with sk_live_ or sk_test_');
    }

    // Fetch account info
    let account = null;
    try {
      const accountResponse = await fetch('https://api.stripe.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        }
      });
      
      account = await accountResponse.json();
      
      if (!accountResponse.ok) {
        ok = false;
        messages.push(`❌ Secret key invalid: ${account.error?.message || 'Unknown error'}`);
        return Response.json({ 
          ok: false, 
          messages,
          account: null,
          publishable_key_ok: false,
          secret_key_ok: false,
          prices: {}
        });
      }
      
      messages.push(`✅ Stripe account reachable: ${account.id}`);
      messages.push(`📊 Account mode: ${account.livemode ? 'LIVE' : 'TEST'}`);
      
      // Check mode match
      if (STRIPE_MODE === 'live' && !account.livemode) {
        ok = false;
        messages.push('❌ STRIPE_MODE is "live" but secret key is for TEST mode');
      } else if (STRIPE_MODE === 'test' && account.livemode) {
        ok = false;
        messages.push('❌ STRIPE_MODE is "test" but secret key is for LIVE mode');
      } else {
        messages.push(`✅ Mode consistency: ${STRIPE_MODE} matches ${account.livemode ? 'live' : 'test'}`);
      }
    } catch (error) {
      ok = false;
      messages.push(`❌ Failed to connect to Stripe: ${error.message}`);
      return Response.json({ 
        ok: false, 
        messages,
        account: null,
        publishable_key_ok: false,
        secret_key_ok: false,
        prices: {}
      });
    }

    // Validate publishable key
    let publishable_key_ok = false;
    if (!STRIPE_PUBLISHABLE_KEY) {
      ok = false;
      messages.push('❌ STRIPE_PUBLISHABLE_KEY is missing');
    } else {
      const isLivePk = STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_');
      const isTestPk = STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_');
      
      if (!isLivePk && !isTestPk) {
        ok = false;
        messages.push('❌ STRIPE_PUBLISHABLE_KEY must start with pk_live_ or pk_test_');
      } else if (account.livemode && !isLivePk) {
        ok = false;
        messages.push('❌ Account is LIVE but publishable key is TEST');
      } else if (!account.livemode && !isTestPk) {
        ok = false;
        messages.push('❌ Account is TEST but publishable key is LIVE');
      } else {
        publishable_key_ok = true;
        messages.push(`✅ Publishable key prefix matches mode`);
      }
    }

    // Validate prices
    const prices = {};
    const priceIds = {
      starter: STRIPE_PRICE_STARTER,
      pro: STRIPE_PRICE_PRO,
      enterprise: STRIPE_PRICE_ENTERPRISE
    };

    for (const [tier, priceId] of Object.entries(priceIds)) {
      if (!priceId) {
        ok = false;
        prices[tier] = { ok: false, error: 'Missing price ID' };
        messages.push(`❌ STRIPE_PRICE_${tier.toUpperCase()} is missing`);
        continue;
      }

      if (!priceId.startsWith('price_')) {
        ok = false;
        prices[tier] = { ok: false, error: 'Invalid price ID format' };
        messages.push(`❌ ${tier}: Price ID must start with "price_"`);
        continue;
      }

      try {
        const priceResponse = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
          headers: {
            'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          }
        });

        const priceData = await priceResponse.json();

        if (!priceResponse.ok) {
          ok = false;
          prices[tier] = { 
            ok: false, 
            id: priceId,
            error: priceData.error?.message || 'Price not found'
          };
          messages.push(`❌ ${tier}: ${priceData.error?.message || 'Price not found'} (likely wrong MODE)`);
          continue;
        }

        if (priceData.livemode !== account.livemode) {
          ok = false;
          prices[tier] = {
            ok: false,
            id: priceId,
            livemode: priceData.livemode,
            error: `Price is ${priceData.livemode ? 'LIVE' : 'TEST'} but account is ${account.livemode ? 'LIVE' : 'TEST'}`
          };
          messages.push(`❌ ${tier}: Mode mismatch (price is ${priceData.livemode ? 'live' : 'test'}, account is ${account.livemode ? 'live' : 'test'})`);
        } else {
          prices[tier] = {
            ok: true,
            id: priceId,
            livemode: priceData.livemode,
            currency: priceData.currency,
            unit_amount: priceData.unit_amount,
            interval: priceData.recurring?.interval
          };
          messages.push(`✅ ${tier}: $${(priceData.unit_amount / 100).toFixed(2)}/${priceData.recurring?.interval || 'once'} (${priceData.currency})`);
        }
      } catch (error) {
        ok = false;
        prices[tier] = { ok: false, id: priceId, error: error.message };
        messages.push(`❌ ${tier}: Failed to fetch price - ${error.message}`);
      }
    }

    // Check webhook secret
    if (STRIPE_WEBHOOK_SECRET) {
      messages.push('✅ Webhook secret present (signature verification enabled)');
    } else {
      messages.push('⚠️  Webhook secret absent (events will be unverified until set)');
    }

    return Response.json({
      ok,
      mode: STRIPE_MODE,
      account: account ? { id: account.id, livemode: account.livemode } : null,
      publishable_key_ok,
      secret_key_ok: !!account,
      prices,
      webhook_secret_present: !!STRIPE_WEBHOOK_SECRET,
      messages
    });

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ 
      ok: false,
      error: error.message,
      messages: [`❌ Unexpected error: ${error.message}`]
    }, { status: 500 });
  }
});
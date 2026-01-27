import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.11.0';

/**
 * Create a Stripe coupon/promotion code for discounts
 * Admin-only function
 * 
 * Usage: 
 * POST with { code: "SAVE50", percent_off: 50, duration: "forever" }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only access
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { code, percent_off, amount_off, duration = 'forever', duration_in_months } = await req.json();

    if (!code) {
      return Response.json({ error: 'code required' }, { status: 400 });
    }

    if (!percent_off && !amount_off) {
      return Response.json({ error: 'percent_off or amount_off required' }, { status: 400 });
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Create coupon first
    const couponParams = {
      duration,
      name: code
    };

    if (percent_off) {
      couponParams.percent_off = percent_off;
    } else if (amount_off) {
      couponParams.amount_off = amount_off;
      couponParams.currency = 'usd';
    }

    if (duration === 'repeating' && duration_in_months) {
      couponParams.duration_in_months = duration_in_months;
    }

    console.log('[createStripeCoupon] Creating coupon:', couponParams);
    const coupon = await stripe.coupons.create(couponParams);

    // Create promotion code
    console.log('[createStripeCoupon] Creating promotion code:', code);
    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code.toUpperCase(),
      active: true
    });

    console.log('[createStripeCoupon] ✅ Success:', {
      coupon_id: coupon.id,
      promo_code_id: promotionCode.id,
      code: promotionCode.code
    });

    return Response.json({
      success: true,
      coupon,
      promotion_code: promotionCode
    });

  } catch (error) {
    console.error('[createStripeCoupon] Error:', error);
    return Response.json({ 
      error: error.message,
      type: error.type
    }, { status: 500 });
  }
});
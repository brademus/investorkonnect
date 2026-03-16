import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT TEAM — Creates a Stripe checkout session for membership + team seats.
 * Body: { emails: string[] }
 * Each email becomes a TeamSeat with status 'pending_payment'.
 * On successful payment (webhook), seats flip to 'invited' and emails are sent.
 */
Deno.serve(async (req) => {
  try {
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    if (!base) return Response.json({ ok: false, message: 'Server configuration error' }, { status: 500 });

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const MEMBERSHIP_PRICE = Deno.env.get('STRIPE_PRICE_MEMBERSHIP');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured' }, { status: 500 });
    if (!MEMBERSHIP_PRICE) return Response.json({ ok: false, message: 'Membership price not configured' }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'Team seat price not configured' }, { status: 500 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const emails = (body.emails || [])
      .map(e => e?.toLowerCase().trim())
      .filter(e => e && e.includes('@'));

    if (emails.length === 0) return Response.json({ ok: false, message: 'At least one team member email is required' }, { status: 400 });
    if (emails.length > 10) return Response.json({ ok: false, message: 'Maximum 10 team seats per checkout' }, { status: 400 });

    // Get owner profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) return Response.json({ ok: false, message: 'Profile not found' }, { status: 404 });
    const ownerProfile = profiles[0];

    // Domain validation
    const ownerDomain = user.email.split('@')[1]?.toLowerCase();
    for (const email of emails) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain !== ownerDomain) {
        return Response.json({ ok: false, message: `All team members must use @${ownerDomain} email addresses. ${email} does not match.` }, { status: 400 });
      }
      if (email === user.email.toLowerCase()) {
        return Response.json({ ok: false, message: 'You cannot add yourself as a team member.' }, { status: 400 });
      }
    }

    // Check for duplicate emails in request
    const uniqueEmails = [...new Set(emails)];
    if (uniqueEmails.length !== emails.length) {
      return Response.json({ ok: false, message: 'Duplicate email addresses are not allowed.' }, { status: 400 });
    }

    // Check for existing active seats
    for (const email of uniqueEmails) {
      const existing = await base44.asServiceRole.entities.TeamSeat.filter({
        owner_profile_id: ownerProfile.id,
        member_email: email
      });
      const active = existing.find(s => s.status !== 'removed');
      if (active) {
        return Response.json({ ok: false, message: `${email} has already been invited to your team.` }, { status: 400 });
      }
    }

    // Stripe helper
    const stripeApi = async (endpoint, params) => {
      const resp = await fetch(`https://api.stripe.com/v1${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || `Stripe error ${resp.status}`);
      return data;
    };

    // Get or create Stripe customer
    let customerId = ownerProfile.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripeApi('/customers', {
        'email': user.email,
        'name': ownerProfile.full_name || '',
        'metadata[user_id]': user.id,
        'metadata[app]': 'agentvault',
      });
      customerId = customer.id;
      await base44.asServiceRole.entities.Profile.update(ownerProfile.id, { stripe_customer_id: customerId });
    }

    // Pre-create TeamSeat records with status 'pending_payment'
    const seatIds = [];
    for (const email of uniqueEmails) {
      const existing = await base44.asServiceRole.entities.TeamSeat.filter({
        owner_profile_id: ownerProfile.id,
        member_email: email,
        status: 'removed'
      });

      if (existing.length) {
        await base44.asServiceRole.entities.TeamSeat.update(existing[0].id, {
          team_role: 'admin',
          status: 'pending_payment',
          invited_at: new Date().toISOString(),
          member_profile_id: null,
          joined_at: null,
        });
        seatIds.push(existing[0].id);
      } else {
        const seat = await base44.asServiceRole.entities.TeamSeat.create({
          owner_profile_id: ownerProfile.id,
          owner_email: user.email.toLowerCase(),
          member_email: email,
          team_role: 'admin',
          status: 'pending_payment',
          invited_at: new Date().toISOString(),
        });
        seatIds.push(seat.id);
      }
    }

    // Build Stripe checkout session with membership + seats
    const seatCount = uniqueEmails.length;
    const successUrl = `${base}/BillingSuccess?session_id={CHECKOUT_SESSION_ID}&team=true`;
    const cancelUrl = `${base}/Pricing?cancelled=true`;

    const checkoutParams = {
      'mode': 'subscription',
      'customer': customerId,
      'customer_update[name]': 'auto',
      'line_items[0][price]': MEMBERSHIP_PRICE,
      'line_items[0][quantity]': '1',
      'line_items[1][price]': SEAT_PRICE,
      'line_items[1][quantity]': String(seatCount),
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'allow_promotion_codes': 'true',
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan]': 'team',
      'subscription_data[metadata][seat_count]': String(seatCount),
      'subscription_data[metadata][seat_emails]': uniqueEmails.join(','),
      'subscription_data[metadata][seat_ids]': seatIds.join(','),
      'metadata[user_id]': user.id,
      'metadata[plan]': 'team',
      'metadata[seat_ids]': seatIds.join(','),
    };

    const session = await stripeApi('/checkout/sessions', checkoutParams);
    console.log('Team checkout session created:', session.id, `(${seatCount} seats)`);

    return Response.json({
      ok: true,
      url: session.url,
      session_id: session.id,
      seat_count: seatCount,
    });

  } catch (error) {
    console.error('Team checkout error:', error);
    return Response.json({ ok: false, message: `Server error: ${error.message}` }, { status: 500 });
  }
});
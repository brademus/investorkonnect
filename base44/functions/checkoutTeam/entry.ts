import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * CHECKOUT TEAM — Creates a Stripe checkout session for membership + team seats.
 * Body: { emails: string[] }
 * 
 * Flow:
 * 1. Validate emails (domain match, no self-invite, no duplicates)
 * 2. Get/create Stripe customer
 * 3. Create TeamSeat records with status 'pending_payment'
 * 4. Send invite emails immediately (before checkout)
 * 5. Invite users to the app (Base44 login link)
 * 6. Create Stripe checkout session with membership + seat line items
 * 7. Return checkout URL
 * 
 * After payment succeeds, stripeWebhook.ts flips seats from 'pending_payment' to 'invited'.
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
    const ownerName = ownerProfile.full_name || user.email;

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
          team_role: 'member',
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
          team_role: 'member',
          status: 'pending_payment',
          invited_at: new Date().toISOString(),
        });
        seatIds.push(seat.id);
      }
    }

    // =============================================
    // SEND INVITE EMAILS + INVITE USERS TO THE APP
    // Done here (not in webhook) because this runs in an
    // authenticated user context where SendEmail works reliably.
    // =============================================
    for (let i = 0; i < uniqueEmails.length; i++) {
      const email = uniqueEmails[i];
      const seatId = seatIds[i];

      // Invite the user to the app (sends them a Base44 login link automatically)
      try {
        await base44.users.inviteUser(email, 'user');
      } catch (inviteErr) {
        console.log('inviteUser result for', email, ':', inviteErr?.message || 'ok/already exists');
      }

      // Send custom invite email with owner name and accept link
      try {
        const inviteUrl = `${base}/AcceptInvite?seatId=${seatId}`;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `${ownerName} invited you to join their team on Investor Konnect`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #E3C567;">Team Invitation</h2>
              <p><strong>${ownerName}</strong> has invited you to join their team on Investor Konnect as an <strong>admin</strong>.</p>
              <p>As a team admin, you'll have full access to create, edit, and manage all of their deals on the dashboard.</p>
              <div style="margin: 30px 0; text-align: center;">
                <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:#E3C567;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">View Invitation</a>
              </div>
              <p style="color: #808080; font-size: 13px;">Click the button above to accept or decline the invitation. If you don't have an account yet, you'll be prompted to create one first.</p>
            </div>
          `
        });
        console.log('Invite email sent to', email);
      } catch (emailErr) {
        console.error('Failed to send invite email to', email, ':', emailErr?.message || emailErr);
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
    console.log('Team checkout session created:', session.id, `(${seatCount} seats, emails sent)`);

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
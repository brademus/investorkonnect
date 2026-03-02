import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agentProfileId, agentName, score } = await req.json();

    // Fetch all admin profiles
    const admins = await base44.asServiceRole.entities.Profile.filter({ role: 'admin' });

    if (!admins || admins.length === 0) {
      console.log('[notifyAdminConditionalAgent] No admin profiles found');
      return Response.json({ ok: true, sent: 0 });
    }

    const subject = `⚠️ Conditional Agent Review Needed: ${agentName}`;
    const body = `
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2 style="color: #D4AF37;">Conditional Agent Flagged for Review</h2>
  <p>An agent has scored in the <strong>Conditional</strong> range (50–69) on the vetting questionnaire and requires manual review.</p>
  <table style="border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 8px 16px; color: #888;">Agent Name</td><td style="padding: 8px 16px; font-weight: bold;">${agentName}</td></tr>
    <tr><td style="padding: 8px 16px; color: #888;">Vetting Score</td><td style="padding: 8px 16px; font-weight: bold;">${score}/100</td></tr>
    <tr><td style="padding: 8px 16px; color: #888;">Profile ID</td><td style="padding: 8px 16px; font-size: 12px; color: #666;">${agentProfileId}</td></tr>
  </table>
  <p>Please review this agent in the <a href="https://investorkonnect.com/Admin" style="color: #D4AF37;">Admin Panel</a> and decide whether to approve or reject them.</p>
</div>
    `.trim();

    let sent = 0;
    for (const admin of admins) {
      if (!admin.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body,
          from_name: 'Investor Konnect',
        });
        sent++;
      } catch (emailErr) {
        console.error(`[notifyAdminConditionalAgent] Failed to email ${admin.email}:`, emailErr.message);
      }
    }

    return Response.json({ ok: true, sent });
  } catch (error) {
    console.error('[notifyAdminConditionalAgent] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
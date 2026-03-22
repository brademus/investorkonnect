import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { agreement_id } = await req.json();
    if (!agreement_id) return Response.json({ error: 'Missing agreement_id' }, { status: 400 });

    // Fetch the agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    const agreement = agreements?.[0];
    if (!agreement) return Response.json({ error: 'Agreement not found' }, { status: 404 });

    // If signed PDF already exists, return it
    if (agreement.signed_pdf_url) {
      return Response.json({ signed_pdf_url: agreement.signed_pdf_url });
    }

    // Must be fully_signed with a DocuSign envelope
    if (agreement.status !== 'fully_signed' || !agreement.docusign_envelope_id) {
      return Response.json({ error: 'Agreement not fully signed or no envelope' }, { status: 400 });
    }

    // Get DocuSign connection
    const conns = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
    if (!conns?.length) return Response.json({ error: 'DocuSign not connected' }, { status: 500 });
    const conn = conns[0];

    // Download combined signed document from DocuSign
    const resp = await fetch(
      `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${agreement.docusign_envelope_id}/documents/combined`,
      { headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Accept': 'application/pdf' } }
    );
    if (!resp.ok) {
      console.error('[downloadSignedPdf] DocuSign error:', resp.status, await resp.text());
      return Response.json({ error: 'Failed to download from DocuSign' }, { status: 502 });
    }

    const buf = await resp.arrayBuffer();
    const blob = new Blob([buf], { type: 'application/pdf' });
    const file = new File([blob], `agreement_${agreement_id}_signed.pdf`);
    const upload = await base44.integrations.Core.UploadFile({ file });
    const signed_pdf_url = upload.file_url;

    // Persist so we don't need to re-download
    await base44.asServiceRole.entities.LegalAgreement.update(agreement_id, { signed_pdf_url });

    return Response.json({ signed_pdf_url });
  } catch (error) {
    console.error('[downloadSignedPdf] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
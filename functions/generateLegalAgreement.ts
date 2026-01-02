import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { renderPackage } from '../components/services/legalEngine/renderPackage.ts';
import jsPDF from 'npm:jspdf@2.5.2';
import { createHash } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deal_id, exhibit_a } = await req.json();
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get deal
    const deal = await base44.entities.Deal.get(deal_id);
    
    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    
    // Check if user is investor for this deal
    if (deal.investor_id !== profile.id) {
      return Response.json({ error: 'Only the investor can generate the agreement' }, { status: 403 });
    }
    
    // Get agent profile
    const agentProfile = await base44.entities.Profile.get(deal.agent_id);
    
    if (!agentProfile) {
      return Response.json({ error: 'Agent profile not found' }, { status: 404 });
    }
    
    // Count investor's deals in last 365 days
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const investorDeals = await base44.asServiceRole.entities.Deal.filter({
      investor_id: profile.id
    });
    const recentDeals = investorDeals.filter(d => 
      new Date(d.created_date) > oneYearAgo && d.status !== 'cancelled'
    );
    
    // Render the package
    const result = renderPackage({
      deal: {
        property_address: deal.property_address || '',
        city: deal.city || '',
        state: deal.state || '',
        zip: deal.zip || '',
        property_type: deal.property_type || ''
      },
      investor: {
        name: profile.full_name || user.full_name || user.email,
        email: profile.email || user.email,
        status: profile.investor?.certification === 'licensed' ? 'LICENSED' : 'UNLICENSED',
        deal_count_last_365: recentDeals.length
      },
      agent: {
        name: agentProfile.full_name || agentProfile.email,
        email: agentProfile.email,
        license_number: agentProfile.agent?.license_number || 'N/A'
      },
      transaction_type: exhibit_a.transaction_type || 'ASSIGNMENT',
      exhibit_a: {
        compensation_model: exhibit_a.compensation_model || 'FLAT_FEE',
        flat_fee_amount: exhibit_a.flat_fee_amount,
        commission_percentage: exhibit_a.commission_percentage,
        net_target: exhibit_a.net_target,
        transaction_type: exhibit_a.transaction_type || 'ASSIGNMENT',
        buyer_commission_type: exhibit_a.buyer_commission_type,
        buyer_commission_amount: exhibit_a.buyer_commission_amount,
        seller_commission_type: exhibit_a.seller_commission_type,
        seller_commission_amount: exhibit_a.seller_commission_amount,
        agreement_length_days: exhibit_a.agreement_length_days || 180,
        termination_notice_days: exhibit_a.termination_notice_days || 30
      }
    });
    
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    
    // Generate PDF from markdown
    const doc = new jsPDF();
    const lines = result.full_md.split('\n');
    let y = 20;
    const pageHeight = doc.internal.pageSize.height;
    
    lines.forEach(line => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      
      // Simple formatting
      if (line.startsWith('# ')) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(line.substring(2), 20, y);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        y += 10;
      } else if (line.startsWith('## ')) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(line.substring(3), 20, y);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        y += 8;
      } else if (line.trim()) {
        const splitText = doc.splitTextToSize(line, 170);
        doc.text(splitText, 20, y);
        y += splitText.length * 5;
      } else {
        y += 5;
      }
    });
    
    const pdfBytes = doc.output('arraybuffer');
    
    // Compute SHA-256
    const hash = createHash('sha256');
    hash.update(new Uint8Array(pdfBytes));
    const sha256 = hash.digest('hex');
    
    // Upload PDF
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], `agreement_${deal_id}.pdf`, { type: 'application/pdf' });
    
    const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
    
    // Create or update LegalAgreement
    const existingAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    
    const agreementData = {
      deal_id,
      investor_profile_id: profile.id,
      agent_profile_id: agentProfile.id,
      governing_state: deal.state,
      property_zip: deal.zip,
      city_overlay: result.evaluation.city_overlay,
      transaction_type: exhibit_a.transaction_type || 'ASSIGNMENT',
      property_type: deal.property_type,
      investor_status: profile.investor?.certification === 'licensed' ? 'LICENSED' : 'UNLICENSED',
      deal_count_last_365: recentDeals.length,
      agreement_version: '1.0.1',
      status: 'draft',
      selected_rule_id: result.evaluation.selected_rule_id,
      selected_clause_ids: result.evaluation.selected_clause_ids,
      deep_dive_module_ids: result.evaluation.deep_dive_module_ids,
      exhibit_a_terms: result.exhibit_a_terms,
      rendered_markdown_full: result.full_md,
      pdf_file_url: file_url,
      pdf_sha256: sha256,
      audit_log: [
        {
          timestamp: new Date().toISOString(),
          actor: user.email,
          action: 'generated',
          details: 'Agreement generated'
        }
      ]
    };
    
    let agreement;
    if (existingAgreements.length > 0) {
      agreement = await base44.asServiceRole.entities.LegalAgreement.update(
        existingAgreements[0].id,
        agreementData
      );
    } else {
      agreement = await base44.asServiceRole.entities.LegalAgreement.create(agreementData);
    }
    
    return Response.json({ 
      success: true, 
      agreement,
      converted_from_net: result.exhibit_a_terms.converted_from_net || false
    });
    
  } catch (error) {
    console.error('Generate agreement error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate agreement' 
    }, { status: 500 });
  }
});
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CheckCircle2, Clock, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LegalAgreementPanel({ deal, profile, onUpdate }) {
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState(false);
  
  const [exhibitA, setExhibitA] = useState(null);
  const [netPolicy, setNetPolicy] = useState('ALLOWED');
  
  const isInvestor = deal?.investor_id === profile?.id;
  const isAgent = deal?.agent_id === profile?.id;

  useEffect(() => {
    if (deal?.id) {
      loadAgreement();
      determineNetPolicy();
    }
  }, [deal?.id]);
  
  // When the modal opens, fetch fresh deal data and initialize exhibitA
  const handleOpenGenerateModal = async () => {
    if (!deal?.id) {
      console.error('[LegalAgreementPanel] No deal ID available');
      return;
    }

    try {
      // Fetch fresh deal data to ensure we have latest proposed_terms
      const freshDeal = await base44.entities.Deal.filter({ id: deal.id });
      if (!freshDeal || freshDeal.length === 0) {
        console.error('[LegalAgreementPanel] Deal not found');
        return;
      }

      const currentDeal = freshDeal[0];
      const terms = currentDeal.proposed_terms || {};
      
      console.log('[LegalAgreementPanel] 📋 Fresh deal data loaded:', {
        deal_id: currentDeal.id,
        seller_commission_type: terms.seller_commission_type,
        seller_commission_percentage: terms.seller_commission_percentage,
        seller_flat_fee: terms.seller_flat_fee,
        agreement_length: terms.agreement_length,
        full_proposed_terms: terms
      });

      // Use the same commission type format as NewDeal page: "percentage" or "flat"
      const newExhibitAState = {
        commission_type: terms.seller_commission_type || 'flat',
        flat_fee_amount: terms.seller_flat_fee || 0, 
        commission_percentage: terms.seller_commission_percentage || 0,
        net_target: terms.net_target || 0,
        transaction_type: currentDeal.transaction_type || 'ASSIGNMENT',
        agreement_length_days: terms.agreement_length || 180,
        termination_notice_days: 30
      };
      
      console.log('[LegalAgreementPanel] ✅ Loaded exhibitA state:', newExhibitAState);
      
      setExhibitA(newExhibitAState);
      setShowGenerateModal(true);
    } catch (error) {
      console.error('[LegalAgreementPanel] Error loading fresh deal data:', error);
      toast.error('Failed to load deal data');
    }
  };

  const handleCloseGenerateModal = () => {
    setExhibitA(null);
    setShowGenerateModal(false);
  };
  
  const determineNetPolicy = () => {
    if (!deal) return;
    const state = deal.state;
    const bannedStates = ['IL', 'NY'];
    const restrictedStates = ['TX', 'CA'];
    
    if (bannedStates.includes(state)) {
      setNetPolicy('BANNED');
    } else if (restrictedStates.includes(state)) {
      setNetPolicy('RESTRICTED');
    } else {
      setNetPolicy('ALLOWED');
    }
  };
  
  const loadAgreement = async () => {
    // Validate required params
    if (!deal?.id) {
      toast.error('Missing deal ID — cannot load agreement.');
      setLoading(false);
      return;
    }
    if (!profile?.user_id) {
      toast.error('Missing user ID — cannot load agreement.');
      setLoading(false);
      return;
    }
    if (!profile?.user_role) {
      toast.error('Missing user role — cannot load agreement.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const actorRole = (profile.user_role || '').toLowerCase();
      const params = new URLSearchParams({ 
        deal_id: deal.id,
        role: actorRole
      });
      const response = await fetch(`/api/functions/getLegalAgreement?${params}`);
      const data = await response.json();
      setAgreement(data.agreement || null);
    } catch (error) {
      console.error('Failed to load agreement:', error);
      toast.error(`Failed to load agreement: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerate = async () => {
    // Validate required params
    if (!deal?.id) {
      toast.error('Missing deal ID — cannot generate agreement.');
      return;
    }
    if (!profile?.user_id) {
      toast.error('Missing user ID — cannot generate agreement.');
      return;
    }
    if (!profile?.user_role) {
      toast.error('Missing user role — cannot generate agreement.');
      return;
    }
    
    setGenerating(true);
    try {
      // Normalize role to lowercase
      const actorRole = (profile.user_role || '').toLowerCase();
      
      // Convert commission_type to compensation_model for backend
      let compensationModel = 'FLAT_FEE';
      if (exhibitA?.commission_type === 'percentage') {
        compensationModel = 'COMMISSION_PCT';
      } else if (exhibitA?.commission_type === 'flat') { 
        compensationModel = 'FLAT_FEE';
      } else if (exhibitA?.commission_type === 'net') {
        compensationModel = 'NET_SPREAD';
      }
      
      const derivedExhibitA = {
        compensation_model: compensationModel,
        flat_fee_amount: exhibitA?.flat_fee_amount || 0,
        commission_percentage: exhibitA?.commission_percentage || 0,
        net_target: exhibitA?.net_target || 0,
        transaction_type: exhibitA?.transaction_type || deal.transaction_type || 'ASSIGNMENT',
        agreement_length_days: exhibitA?.agreement_length_days || 180,
        termination_notice_days: exhibitA?.termination_notice_days || 30,
        buyer_commission_type: deal.proposed_terms?.buyer_commission_type, 
        buyer_commission_amount: deal.proposed_terms?.buyer_commission_percentage || deal.proposed_terms?.buyer_flat_fee,
        seller_commission_type: deal.proposed_terms?.seller_commission_type, 
        seller_commission_amount: deal.proposed_terms?.seller_commission_percentage || deal.proposed_terms?.seller_flat_fee
      };
      
      const response = await base44.functions.invoke('generateLegalAgreement', {
        deal_id: deal.id,
        exhibit_a: derivedExhibitA
      });
      
      if (response.data?.error) {
        // Show detailed error with missing placeholders if available
        if (response.data?.missing_placeholders && response.data.missing_placeholders.length > 0) {
          const missingList = response.data.missing_placeholders.join(', ');
          toast.error(`Missing required data: ${missingList}`, { duration: 6000 });
        } else {
          toast.error(response.data.error);
        }
        if (response.data?.debug) {
          console.error('Backend debug info:', response.data.debug);
        }
        return;
      }
      
      if (response.data?.converted_from_net) {
        toast.warning('Net listing converted to Flat Fee due to state restrictions');
      }
      
      console.log('Generate response:', response.data);
      
      if (!response.data?.agreement) {
        toast.error('Agreement generated but not returned from server');
        console.error('No agreement in response:', response.data);
        return;
      }
      
      if (response.data?.regenerated === false) {
        toast.info('Agreement already up to date (no changes needed)');
      } else {
        toast.success('Agreement generated successfully');
      }
      
      // Set agreement immediately from response
      setAgreement(response.data.agreement);
      setShowGenerateModal(false);
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Generate error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || error;
      toast.error(`Generate agreement failed: ${errorMessage}`);
    } finally {
      setGenerating(false);
    }
  };
  
  const handleSign = async (signatureType) => {
    try {
      setSigning(true);
      
      // Capture current page URL for return
      const returnTo = window.location.href;
      
      console.log('[LegalAgreement] Starting signing flow:', { agreementId: agreement.id, role: signatureType, returnTo });
      
      // Create embedded signing session with token-based return
      const response = await base44.functions.invoke('docusignCreateSigningSession', {
        agreementId: agreement.id,
        role: signatureType, // 'investor' or 'agent'
        returnTo
      });
      
      console.log('[LegalAgreement] Full response:', response);
      
      if (!response || !response.data) {
        console.error('[LegalAgreement] No response data:', response);
        toast.error('No response from signing service');
        setSigning(false);
        return;
      }
      
      const data = response.data;
      
      if (data.error) {
        console.error('[LegalAgreement] Error from backend:', data.error);
        toast.error(data.error);
        setSigning(false);
        return;
      }
      
      if (!data.signingUrl) {
        console.error('[LegalAgreement] No signing URL in response:', data);
        toast.error('Failed to get signing URL');
        setSigning(false);
        return;
      }
      
      console.log('[LegalAgreement] Redirecting to DocuSign:', data.signingUrl);
      console.log('[LegalAgreement] Will return to:', data.returnUrl);
      
      // Redirect to DocuSign embedded signing
      window.location.assign(data.signingUrl);
    } catch (error) {
      console.error('[LegalAgreement] Sign error:', error);
      toast.error('Failed to open signing: ' + error.message);
      setSigning(false);
    }
  };
  
  const getStatusDisplay = () => {
    if (!agreement) return null;
    
      const statusConfig = {
      draft: { icon: FileText, color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Draft' },
      sent: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Sent' },
      investor_signed: { icon: CheckCircle2, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Investor Signed' },
      agent_signed: { icon: CheckCircle2, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Agent Signed' },
      attorney_review_pending: { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Attorney Review' },
      fully_signed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Fully Executed' }
    };
    
    const config = statusConfig[agreement.status] || statusConfig.draft;
    const Icon = config.icon;
    
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>
    );
  };
  
  const getNJCountdown = () => {
    if (agreement?.status !== 'attorney_review_pending' || !agreement.nj_review_end_at) {
      return null;
    }
    
    const end = new Date(agreement.nj_review_end_at);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Review period ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };
  
  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading agreement...</div>;
  }
  
  return (
    <Card className="ik-card p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[#FAFAFA] mb-1">Legal Agreement</h3>
          <p className="text-sm text-[#808080]">Internal Operating Agreement v1.0.1</p>
        </div>
        {agreement && getStatusDisplay()}
      </div>
      
      {!agreement && isInvestor && (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
          <p className="text-[#808080] mb-4">No agreement generated yet</p>
          <Button
            onClick={handleOpenGenerateModal}
            className="bg-[#E3C567] hover:bg-[#EDD89F] text-black">
            Generate Agreement
          </Button>
        </div>
      )}
      
      {!agreement && !isInvestor && (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-[#808080] mx-auto mb-4" />
          <p className="text-[#808080] mb-2">Waiting for investor to generate agreement</p>
          <p className="text-xs text-[#666]">The investor will initiate contract generation from the Agreement tab</p>
        </div>
      )}
      
      {agreement && (
        <div className="space-y-4">
          {/* NJ Attorney Review Countdown */}
          {agreement.status === 'attorney_review_pending' && (
            <div className="bg-orange-400/10 border border-orange-400/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-orange-400 mb-1">NJ Attorney Review Period</div>
                  <div className="text-sm text-[#808080]">{getNJCountdown()}</div>
                  <div className="text-xs text-[#808080] mt-1">
                    Either party may cancel until 11:59 PM on the review end date
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Agreement Details */}
          <div className="bg-[#0D0D0D] rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#808080]">Governing State:</span>
              <span className="text-[#FAFAFA]">{agreement.governing_state}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#808080]">Transaction Type:</span>
              <span className="text-[#FAFAFA]">{agreement.transaction_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#808080]">Compensation Model:</span>
              <span className="text-[#FAFAFA]">{agreement.exhibit_a_terms?.compensation_model}</span>
            </div>
            {agreement.exhibit_a_terms?.converted_from_net && (
              <div className="text-xs text-yellow-400 mt-2">
                * Converted from Net listing due to state restrictions
              </div>
            )}
          </div>
          
          {/* Signature Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0D0D0D] rounded-lg p-4">
              <div className="text-xs text-[#808080] mb-2">Investor</div>
              {agreement.investor_signed_at ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Signed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#808080]">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Pending</span>
                </div>
              )}
            </div>
            
            <div className="bg-[#0D0D0D] rounded-lg p-4">
              <div className="text-xs text-[#808080] mb-2">Agent</div>
              {agreement.agent_signed_at ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Signed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#808080]">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Pending</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            {(agreement.final_pdf_url || agreement.pdf_file_url) && (
              <Button
                variant="outline"
                onClick={() => window.open(agreement.final_pdf_url || agreement.pdf_file_url, '_blank')}
                className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
            
            {isInvestor && !agreement.investor_signed_at && (
              <Button
                onClick={() => handleSign('investor')}
                disabled={signing}
                className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                Sign as Investor
              </Button>
            )}
            
            {isAgent && agreement.investor_signed_at && !agreement.agent_signed_at && (
              <Button
                onClick={() => handleSign('agent')}
                disabled={signing}
                className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                Sign as Agent
              </Button>
            )}
            
            {isInvestor && agreement.status === 'draft' && (
              <>
                <Button
                  onClick={handleOpenGenerateModal}
                  variant="outline"
                  className="flex-1">
                  Regenerate
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const { data } = await base44.functions.invoke('sendLegalAgreement', {
                        agreement_id: agreement.id
                      });
                      if (data.error) {
                        toast.error(data.error);
                      } else {
                        toast.success('Agreement sent');
                        setAgreement(data.agreement);
                        if (onUpdate) onUpdate();
                      }
                    } catch (error) {
                      toast.error('Failed to send agreement');
                    }
                  }}
                  className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                  Send for Signature
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={handleCloseGenerateModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Generate Agreement</DialogTitle>
          </DialogHeader>
          
          {!exhibitA ? (
            <div className="py-8 text-center text-[#808080]">Loading terms...</div>
          ) : (
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[#FAFAFA]">Seller's Agent Commission Type</Label>
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg px-4 py-3 text-[#FAFAFA]">
                {exhibitA.commission_type === 'percentage' ? 'Percentage of Purchase Price' : 
                 exhibitA.commission_type === 'flat' ? 'Flat Fee' : 
                 exhibitA.commission_type === 'net' ? 'Net/Spread' : 'Not Set'}
              </div>
              <p className="text-xs text-[#808080] mt-1">
                From deal: seller_commission_type = "{exhibitA.commission_type}"
              </p>
            </div>
            
            {exhibitA.commission_type === 'flat' && (
              <div>
                <Label className="text-[#FAFAFA]">Seller's Agent Flat Fee</Label>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg px-4 py-3 text-[#FAFAFA]">
                  ${(exhibitA.flat_fee_amount || 0).toLocaleString()}
                </div>
                <p className="text-xs text-[#808080] mt-1">
                  From deal: seller_flat_fee = {exhibitA.flat_fee_amount}
                </p>
              </div>
            )}
            
            {exhibitA.commission_type === 'percentage' && (
              <div>
                <Label className="text-[#FAFAFA]">Seller's Agent Commission %</Label>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg px-4 py-3 text-[#FAFAFA]">
                  {exhibitA.commission_percentage || 0}%
                </div>
                <p className="text-xs text-[#808080] mt-1">
                  From deal: seller_commission_percentage = {exhibitA.commission_percentage}
                </p>
              </div>
            )}
            
            {exhibitA.commission_type === 'net' && (
              <div>
                <Label className="text-[#FAFAFA]">Net Target Amount</Label>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg px-4 py-3 text-[#FAFAFA]">
                  ${(exhibitA.net_target || 0).toLocaleString()}
                </div>
              </div>
            )}
            
            <div>
              <Label className="text-[#FAFAFA]">Transaction Type</Label>
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg px-4 py-3 text-[#FAFAFA]">
                {exhibitA.transaction_type === 'ASSIGNMENT' ? 'Assignment' : 'Double Close'}
              </div>
            </div>
            
            <div>
              <Label className="text-[#FAFAFA]">Agreement Length</Label>
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-lg px-4 py-3 text-[#FAFAFA]">
                {exhibitA.agreement_length_days || 180} Days
              </div>
            </div>
            
            <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 mt-4">
              <p className="text-sm text-[#FAFAFA]/80 mb-3">
                Need to change these terms? Go to the edit deal page to update commission type, amounts, or agreement length.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setShowGenerateModal(false);
                  window.location.href = `/NewDeal?dealId=${deal.id}`;
                }}
                className="border-[#60A5FA] text-[#60A5FA] hover:bg-[#60A5FA]/10 w-full">
                Edit Deal Terms
              </Button>
            </div>
          </div>
          )}
          
          {exhibitA && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowGenerateModal(false)}
              className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black">
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
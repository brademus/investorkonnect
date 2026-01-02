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
  
  const [exhibitA, setExhibitA] = useState({
    compensation_model: 'FLAT_FEE',
    flat_fee_amount: 5000,
    transaction_type: 'ASSIGNMENT',
    agreement_length_days: 180,
    termination_notice_days: 30
  });
  
  const [netPolicy, setNetPolicy] = useState('ALLOWED');
  
  const isInvestor = deal.investor_id === profile.id;
  const isAgent = deal.agent_id === profile.id;
  
  useEffect(() => {
    loadAgreement();
    determineNetPolicy();
  }, [deal.id]);
  
  const determineNetPolicy = () => {
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
    try {
      setLoading(true);
      const params = new URLSearchParams({ deal_id: deal.id });
      const response = await fetch(`/api/functions/getLegalAgreement?${params}`, {
        headers: { 'Authorization': `Bearer ${await base44.auth.getAccessToken()}` }
      });
      const data = await response.json();
      setAgreement(data.agreement || null);
    } catch (error) {
      console.error('Failed to load agreement:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerate = async () => {
    if (!deal?.id) return;
    
    setGenerating(true);
    try {
      // Derive exhibit_a from deal's existing terms
      const derivedExhibitA = {
        compensation_model: deal.proposed_terms?.seller_commission_type === 'percentage' ? 'COMMISSION_PCT' : 
                           deal.proposed_terms?.seller_commission_type === 'net' ? 'NET_SPREAD' :
                           'FLAT_FEE',
        flat_fee_amount: deal.proposed_terms?.seller_flat_fee || exhibitA.flat_fee_amount || 5000,
        commission_percentage: deal.proposed_terms?.seller_commission_percentage || exhibitA.commission_percentage,
        net_target: deal.proposed_terms?.net_target || exhibitA.net_target,
        transaction_type: deal.transaction_type || exhibitA.transaction_type || 'ASSIGNMENT',
        agreement_length_days: exhibitA.agreement_length_days || 180,
        termination_notice_days: exhibitA.termination_notice_days || 30,
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
        toast.error(response.data.error);
        return;
      }
      
      if (response.data?.converted_from_net) {
        toast.warning('Net listing converted to Flat Fee due to state restrictions');
      }
      
      if (response.data?.regenerated === false) {
        toast.info('Agreement already up to date (no changes needed)');
      } else {
        toast.success('Agreement generated successfully');
      }
      
      setAgreement(response.data.agreement);
      setShowGenerateModal(false);
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Generate error:', error);
      toast.error(error.message || 'Failed to generate agreement');
    } finally {
      setGenerating(false);
    }
  };
  
  const handleSign = async (signatureType) => {
    try {
      setSigning(true);
      const { data } = await base44.functions.invoke('signLegalAgreement', {
        agreement_id: agreement.id,
        signature_type: signatureType
      });
      
      if (data.error) {
        toast.error(data.error);
        return;
      }
      
      toast.success('Agreement signed successfully');
      setAgreement(data.agreement);
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Sign error:', error);
      toast.error('Failed to sign agreement');
    } finally {
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
            onClick={() => setShowGenerateModal(true)}
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
            {agreement.pdf_file_url && (
              <Button
                variant="outline"
                onClick={() => window.open(agreement.pdf_file_url, '_blank')}
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
                  onClick={() => setShowGenerateModal(true)}
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
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Generate Agreement</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[#FAFAFA]">Compensation Model</Label>
              <Select
                value={exhibitA.compensation_model}
                onValueChange={(value) => setExhibitA({ ...exhibitA, compensation_model: value })}>
                <SelectTrigger className="bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLAT_FEE">Flat Fee</SelectItem>
                  <SelectItem value="COMMISSION_PCT">Commission %</SelectItem>
                  {netPolicy !== 'BANNED' && (
                    <SelectItem value="NET_SPREAD">Net/Spread</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {netPolicy === 'BANNED' && (
                <p className="text-xs text-yellow-400 mt-1">
                  Net/Spread not permitted in {deal.state}
                </p>
              )}
              {netPolicy === 'RESTRICTED' && exhibitA.compensation_model === 'NET_SPREAD' && (
                <p className="text-xs text-yellow-400 mt-1">
                  {deal.state} requires Net Listing Addendum / restricted clause
                </p>
              )}
            </div>
            
            {exhibitA.compensation_model === 'FLAT_FEE' && (
              <div>
                <Label className="text-[#FAFAFA]">Flat Fee Amount ($)</Label>
                <Input
                  type="number"
                  value={exhibitA.flat_fee_amount}
                  onChange={(e) => setExhibitA({ ...exhibitA, flat_fee_amount: Number(e.target.value) })}
                  className="bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            )}
            
            <div>
              <Label className="text-[#FAFAFA]">Transaction Type</Label>
              <Select
                value={exhibitA.transaction_type}
                onValueChange={(value) => setExhibitA({ ...exhibitA, transaction_type: value })}>
                <SelectTrigger className="bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                  <SelectItem value="DOUBLE_CLOSE">Double Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-[#FAFAFA]">Agreement Length (Days)</Label>
              <Input
                type="number"
                value={exhibitA.agreement_length_days}
                onChange={(e) => setExhibitA({ ...exhibitA, agreement_length_days: Number(e.target.value) })}
                className="bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]"
              />
            </div>
          </div>
          
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
        </DialogContent>
      </Dialog>
    </Card>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SendCounter() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useCurrentProfile();

  const dealId = params.get('dealId');
  const roomId = params.get('roomId');

  const [commissionType, setCommissionType] = useState('percentage');
  const [commissionPercentage, setCommissionPercentage] = useState('');
  const [flatFee, setFlatFee] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!commissionType) {
      toast.error('Select commission type');
      return;
    }

    if (commissionType === 'percentage' && !commissionPercentage) {
      toast.error('Enter commission percentage');
      return;
    }

    if (commissionType === 'flat_fee' && !flatFee) {
      toast.error('Enter flat fee');
      return;
    }

    setSending(true);
    try {
      const newTerms = {
        buyer_commission_type: commissionType,
        buyer_commission_percentage: commissionType === 'percentage' ? Number(commissionPercentage) : null,
        buyer_flat_fee: commissionType === 'flat_fee' ? Number(flatFee) : null
      };

      const res = await base44.functions.invoke('sendCounterOffer', {
        deal_id: dealId,
        room_id: roomId,
        new_terms: newTerms
      });

      if (res.data?.error) {
        toast.error(res.data.error);
        setSending(false);
        return;
      }

      toast.success('Counter offer sent');
      navigate(`${createPageUrl('Room')}?roomId=${roomId}`);
    } catch (e) {
      console.error('[SendCounter] Error:', e);
      toast.error('Failed to send counter');
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate(`${createPageUrl('Room')}?roomId=${roomId}`)}
          className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Deal
        </button>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E3C567]">Make Counter Offer</h1>
          <p className="text-sm text-[#808080] mt-2">Propose new commission terms</p>
        </div>

        <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
          <CardHeader>
            <CardTitle className="text-[#E3C567]">Buyer Agent Commission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission Type</label>
              <Select value={commissionType} onValueChange={setCommissionType}>
                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="flat_fee">Flat Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {commissionType === 'percentage' && (
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission %</label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    value={commissionPercentage}
                    onChange={(e) => setCommissionPercentage(e.target.value)}
                    placeholder="3.0"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080]">%</span>
                </div>
              </div>
            )}

            {commissionType === 'flat_fee' && (
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Flat Fee</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                  <Input
                    type="number"
                    value={flatFee}
                    onChange={(e) => setFlatFee(e.target.value)}
                    placeholder="5000"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => navigate(`${createPageUrl('Room')}?roomId=${roomId}`)}
                variant="outline"
                className="flex-1 border-[#1F1F1F] text-[#FAFAFA]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black"
              >
                {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Counter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
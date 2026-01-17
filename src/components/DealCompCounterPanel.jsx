import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Handshake, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function DealCompCounterPanel({ dealId, profile }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('percentage');
  const [amount, setAmount] = useState('');

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';

  useEffect(() => {
    let unsub;
    (async () => {
      if (!dealId) return;
      const rows = await base44.entities.DealCompCounter.filter({ dealId });
      setRow(rows[0] || null);
      setLoading(false);
      unsub = base44.entities.DealCompCounter.subscribe((event) => {
        if (event?.data?.dealId === dealId) setRow(event.data);
      });
    })();
    return () => { try { unsub && unsub(); } catch (_) {} };
  }, [dealId]);

  if (loading) return null;

  const pending = row?.pendingOffer;
  const showInvestorPanel = isInvestor && pending && pending.fromRole === 'AGENT';
  const showAgentPanel = isAgent && pending && pending.fromRole === 'INVESTOR';

  if (!showInvestorPanel && !showAgentPanel) return null;

  const accept = async () => {
    if (!row) return;
    const now = new Date().toISOString();
    const accepted = { compensationType: pending.compensationType, compensationAmount: pending.compensationAmount };
    await base44.entities.DealCompCounter.update(row.id, {
      status: 'ACCEPTED',
      currentAccepted: accepted,
      pendingOffer: null,
      history: [...(row.history || []), { fromRole: isInvestor ? 'INVESTOR' : 'AGENT', compensationType: pending.compensationType, compensationAmount: pending.compensationAmount, createdAt: now, createdByUserId: profile?.user_id, action: 'ACCEPT' }]
    });
    toast.success('Offer accepted');
  };

  const deny = async () => {
    if (!row) return;
    const now = new Date().toISOString();
    await base44.entities.DealCompCounter.update(row.id, {
      status: 'DECLINED',
      history: [...(row.history || []), { fromRole: isInvestor ? 'INVESTOR' : 'AGENT', compensationType: pending.compensationType, compensationAmount: pending.compensationAmount, createdAt: now, createdByUserId: profile?.user_id, action: 'DENY' }],
      pendingOffer: null
    });
    toast.success('Offer denied');
  };

  const counter = async () => {
    if (!row) return;
    const now = new Date().toISOString();
    const next = {
      fromRole: isInvestor ? 'INVESTOR' : 'AGENT',
      compensationType: type,
      compensationAmount: Number(amount || 0),
      createdAt: now,
      createdByUserId: profile?.user_id
    };
    await base44.entities.DealCompCounter.update(row.id, {
      status: isInvestor ? 'INVESTOR_COUNTER_PENDING' : 'AGENT_COUNTER_PENDING',
      pendingOffer: next,
      history: [...(row.history || []), { ...next, action: 'COUNTER' }]
    });
    toast.success('Counter sent');
  };

  return (
    <Card className="ik-card p-6">
      <div className="flex items-center gap-3 mb-3">
        <Handshake className="w-5 h-5 text-[#E3C567]" />
        <h4 className="text-md font-semibold text-[#FAFAFA]">Agent Counter Offer</h4>
      </div>
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#FAFAFA]">
            <div className="text-[#808080]">Compensation Type</div>
            <div className="capitalize">{pending?.compensationType}</div>
          </div>
          <div className="text-sm text-[#FAFAFA]">
            <div className="text-[#808080]">Amount</div>
            <div>{pending?.compensationType === 'percentage' ? `${pending?.compensationAmount}%` : `$${(pending?.compensationAmount || 0).toLocaleString()}`}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="bg-[#10B981] hover:bg-[#059669] text-white" onClick={accept}><CheckCircle2 className="w-4 h-4 mr-1"/>Confirm</Button>
        <Button variant="outline" className="border-[#EF4444] text-[#EF4444]" onClick={deny}><XCircle className="w-4 h-4 mr-1"/>Deny</Button>
        <div className="ml-auto flex items-center gap-2 w-full md:w-auto">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="flat">Flat Fee</SelectItem>
              <SelectItem value="net">Net</SelectItem>
            </SelectContent>
          </Select>
          <Input className="w-32 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button className="bg-[#E3C567] hover:bg-[#EDD89F] text-black" onClick={counter}>Counter</Button>
        </div>
      </div>
      {row?.currentAccepted?.compensationType && (
        <div className="mt-4 text-xs text-[#808080] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Latest accepted terms: {row.currentAccepted.compensationType} • {row.currentAccepted.compensationType === 'percentage' ? `${row.currentAccepted.compensationAmount}%` : `$${(row.currentAccepted.compensationAmount || 0).toLocaleString()}`}
        </div>
      )}
    </Card>
  );
}
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import LoadingAnimation from '@/components/LoadingAnimation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * MY AGREEMENT PAGE
 * Investor signs the base agreement here
 * After signing, converts draft to real deal
 */
export default function MyAgreement() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, loading: loadingProfile } = useCurrentProfile();

  const [draftId, setDraftId] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [signingUrl, setSigningUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [agentProfiles, setAgentProfiles] = useState([]);

  useEffect(() => {
    if (!profile) return;

    // Get draft ID from sessionStorage or URL
    const storedDraftId = sessionStorage.getItem('draft_id') || params.get('draft_id');
    if (!storedDraftId) {
      toast.error('No draft found');
      navigate(createPageUrl('Pipeline'), { replace: true });
      return;
    }

    setDraftId(storedDraftId);

    // Get selected agents
    const agentIds = JSON.parse(sessionStorage.getItem('selectedAgentIds') || '[]');
    setSelectedAgents(agentIds);

    // Load agent profiles
    (async () => {
      try {
        const profiles = await Promise.all(
          agentIds.map(id => base44.entities.Profile.filter({ id }).then(p => p[0]))
        );
        setAgentProfiles(profiles.filter(Boolean));
      } catch (e) {
        console.error('[MyAgreement] Error loading agents:', e);
      }
    })();

    // Check if agreement exists (by draft_id or deal_id)
    (async () => {
      try {
        // First try by the ID as-is (might be deal_id if already converted)
        let agreements = await base44.entities.LegalAgreement.filter({ 
          deal_id: storedDraftId 
        });
        
        // If no agreement found, try searching all and filter client-side
        if (!agreements[0]) {
          const allAgreements = await base44.entities.LegalAgreement.list();
          // LegalAgreement doesn't have draft_id, but try to find one associated with this draft
          agreements = allAgreements.filter(a => a.deal_id === storedDraftId);
        }
        
        if (agreements[0]) {
          setAgreement(agreements[0]);
        }
      } catch (e) {
        console.error('[MyAgreement] Error loading agreement:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile, navigate, params]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateInvestorAgreement', {
        draft_id: draftId
      });

      if (res.data?.error) {
        toast.error(res.data.error);
        setGenerating(false);
        return;
      }

      setAgreement({ id: res.data.agreement_id });
      setSigningUrl(res.data.signing_url);
      
      // Redirect to DocuSign
      window.location.assign(res.data.signing_url);
    } catch (e) {
      console.error('[MyAgreement] Error:', e);
      toast.error('Failed to generate agreement');
      setGenerating(false);
    }
  };

  // Check if returning from DocuSign
  useEffect(() => {
    if (params.get('signed') === '1' && draftId) {
      // Convert draft to real deal
      (async () => {
        try {
          const res = await base44.functions.invoke('convertDraftToDeal', {
            draft_id: draftId
          });

          if (res.data?.error) {
            toast.error(res.data.error);
            return;
          }

          // Clear sessionStorage
          sessionStorage.removeItem('newDealDraft');
          sessionStorage.removeItem('draft_id');
          sessionStorage.removeItem('selectedAgentIds');

          toast.success('Deal created! Agents have been notified.');
          navigate(createPageUrl('Pipeline'), { replace: true });
        } catch (e) {
          console.error('[MyAgreement] Error converting draft:', e);
          toast.error('Failed to create deal');
        }
      })();
    }
  }, [params, draftId, navigate]);

  if (loadingProfile || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  const signed = agreement?.investor_signed_at || params.get('signed') === '1';

  return (
    <div className="min-h-screen bg-transparent px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => navigate(createPageUrl('SelectAgent'))}
          className="text-[#808080] hover:text-[#E3C567] text-sm"
        >
          ← Back
        </button>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E3C567]">Sign Agreement</h1>
          <p className="text-sm text-[#808080] mt-2">
            Review and sign to send your deal to selected agents
          </p>
        </div>

        {/* Selected Agents */}
        {agentProfiles.length > 0 && (
          <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
            <CardHeader>
              <CardTitle className="text-[#E3C567]">Selected Agents ({agentProfiles.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentProfiles.map(agent => (
                <div key={agent.id} className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[#FAFAFA] font-semibold">{agent.full_name}</p>
                    <p className="text-sm text-[#808080]">{agent.email}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-[#34D399]" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Agreement Card */}
        <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
          <CardHeader>
            <CardTitle className="text-[#E3C567]">Investor Agreement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!agreement && !signed && (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
                <p className="text-[#808080] mb-4">Ready to generate your agreement</p>
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                >
                  {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate & Sign Agreement
                </Button>
              </div>
            )}

            {signed && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-4" />
                <p className="text-[#FAFAFA] font-semibold mb-2">Agreement Signed!</p>
                <p className="text-sm text-[#808080]">Creating your deal and notifying agents...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
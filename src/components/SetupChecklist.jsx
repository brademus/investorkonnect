import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, ChevronUp, ChevronDown, 
  User, FileText, Shield, CreditCard, Sparkles
} from 'lucide-react';

export function SetupChecklist({ profile, onRefresh }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  // Debug: log what profile we're receiving
  console.log('[SetupChecklist] Profile received:', {
    id: profile?.id,
    onboarding_completed_at: profile?.onboarding_completed_at,
    onboarding_step: profile?.onboarding_step,
    onboarding_version: profile?.onboarding_version,
    kyc_status: profile?.kyc_status,
    nda_accepted: profile?.nda_accepted,
    subscription_status: profile?.subscription_status,
    user_role: profile?.user_role
  });

  // Determine user role
  const isInvestor = profile?.user_role === 'investor' || profile?.user_type === 'investor';
  const isAgent = profile?.user_role === 'agent' || profile?.user_type === 'agent';

  // Check completion states - check multiple indicators for onboarding
  const onboardingComplete = !!(
    profile?.onboarding_completed_at || 
    profile?.onboarding_step === 'basic_complete' || 
    profile?.onboarding_step === 'deep_complete' ||
    profile?.onboarding_version
  );
  
  console.log('[SetupChecklist] onboardingComplete:', onboardingComplete);
  const kycComplete = profile?.kyc_status === 'approved';
  const ndaComplete = !!profile?.nda_accepted;
  const subscriptionComplete = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  // Core steps - subscription only for investors, agents are always free
  const baseSteps = [
    {
      id: 'onboarding',
      title: 'Complete Onboarding',
      description: 'Set up your profile and preferences',
      completed: onboardingComplete,
      icon: User,
      link: isAgent ? 'AgentDeepOnboarding' : 'InvestorDeepOnboarding'
    },
    {
      id: 'verify',
      title: 'Verify Identity',
      description: 'Complete KYC verification',
      completed: kycComplete,
      icon: Shield,
      link: 'Verify'
    },
    {
      id: 'nda',
      title: 'Sign NDA',
      description: 'Review and accept confidentiality agreement',
      completed: ndaComplete,
      icon: FileText,
      link: 'NDA'
    }
  ];

  // Only add subscription step for investors, not agents
  const steps = isAgent ? baseSteps : [
    ...baseSteps,
    {
      id: 'subscription',
      title: 'Select Subscription',
      description: 'Choose a plan to unlock all features',
      completed: subscriptionComplete,
      icon: CreditCard,
      link: 'Pricing'
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progress = (completedCount / totalSteps) * 100;
  const allComplete = completedCount === totalSteps;
  const nextStep = steps.find(s => !s.completed);

  // If all steps are complete, hide the entire checklist
  if (allComplete) {
    return null;
  }

  // Filter out completed steps - only show incomplete ones
  const visibleSteps = steps.filter(s => !s.completed);

  // Collapsed state - minimal banner
  if (collapsed) {
    return (
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl px-4 py-2.5">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#E3C567] rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-black" />
            </div>
            <p className="text-sm font-medium text-[#FAFAFA]">
              {`Setup: ${completedCount}/${totalSteps} done`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-[#1F1F1F] rounded-full overflow-hidden">
              <div className="h-full bg-[#E3C567] rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <ChevronDown className="w-4 h-4 text-[#E3C567]" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-sm">
      {/* Compact Header */}
      <div className="bg-[#E3C567] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black/20 backdrop-blur rounded-lg flex items-center justify-center">
             <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-black">
              Complete Your Setup
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-1.5 bg-black/20 rounded-full overflow-hidden">
                <div className="h-full bg-black rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-black/80">{completedCount}/{totalSteps}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-black/80 hover:text-black p-1.5 hover:bg-black/10 rounded-lg transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Compact Checklist Items */}
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleSteps.map((step, idx) => {
            const Icon = step.icon;
            // The next incomplete step is always the first one in visibleSteps (since we filtered out completed ones)
            // But we need to know if it's the *actual* next step in the sequence. 
            // Since we filter out completed, the first visible one IS the next step.
            const isNext = visibleSteps[0].id === step.id;
            
            // Is Locked? 
            // In the filtered list, the first item is the next step.
            // If we are strictly sequential, then all items after the first visible one are locked?
            // Original logic: "previous steps complete".
            // Since we filtered out completed steps, the first item in visibleSteps is the current active one.
            // Any subsequent item in visibleSteps is locked IF we enforce strict order.
            // Let's check original logic: `prevStepsComplete = steps.slice(0, idx).every(s => s.completed)`
            // Here we iterate visibleSteps.
            // The step is locked if it's NOT the first visible step.
            const isLocked = idx > 0; 
            
            const handleClick = () => {
              if (isLocked) {
                // Navigate to the first incomplete step (which is visibleSteps[0])
                navigate(createPageUrl(visibleSteps[0].link));
              } else {
                navigate(createPageUrl(step.link));
              }
            };
            
            return (
              <button
                key={step.id}
                onClick={handleClick}
                className={`group flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                   isNext
                    ? 'bg-[#E3C567]/20 border border-[#E3C567]'
                    : isLocked
                    ? 'bg-[#1F1F1F] border border-transparent opacity-60'
                    : 'bg-[#141414] border border-transparent hover:border-[#E3C567] hover:bg-[#E3C567]/10'
                }`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                   isNext
                    ? 'bg-[#E3C567] text-black'
                    : 'bg-[#333333] text-[#808080] group-hover:bg-[#E3C567] group-hover:text-black'
                }`}>
                    <Icon className="w-4 h-4" />
                </div>
                
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium truncate ${
                     isLocked ? 'text-[#666666]' : 'text-[#FAFAFA]'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-[#808080] truncate">
                    {isNext ? 'Up next' : isLocked ? 'Complete previous' : 'Click to start'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SetupChecklist;
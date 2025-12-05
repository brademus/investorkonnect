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
    kyc_status: profile?.kyc_status,
    nda_accepted: profile?.nda_accepted,
    subscription_status: profile?.subscription_status,
    user_role: profile?.user_role
  });

  // Determine user role
  const isInvestor = profile?.user_role === 'investor' || profile?.user_type === 'investor';
  const isAgent = profile?.user_role === 'agent' || profile?.user_type === 'agent';

  // Check completion states - check multiple indicators for onboarding
  const onboardingComplete = !!profile?.onboarding_completed_at || 
    profile?.onboarding_step === 'basic_complete' || 
    profile?.onboarding_step === 'deep_complete';
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

  // Collapsed state - minimal banner
  if (collapsed) {
    return (
      <div className="bg-gradient-to-r from-[#FFFBEB] to-white border border-[#FDE68A] rounded-2xl px-4 py-2.5">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#D3A029] rounded-lg flex items-center justify-center">
              {allComplete ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
            </div>
            <p className="text-sm font-medium text-[#111827]">
              {allComplete ? 'Setup Complete!' : `Setup: ${completedCount}/${totalSteps} done`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-[#FDE68A] rounded-full overflow-hidden">
              <div className="h-full bg-[#D3A029] rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <ChevronDown className="w-4 h-4 text-[#D3A029]" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-[#D3A029] to-[#E9B949] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
            {allComplete ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {allComplete ? 'Setup Complete!' : 'Complete Your Setup'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-white/80">{completedCount}/{totalSteps}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Compact Checklist Items */}
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isNext = nextStep?.id === step.id;
            
            // Determine if step is locked (previous steps not complete)
            const prevStepsComplete = steps.slice(0, idx).every(s => s.completed);
            const isLocked = !step.completed && !prevStepsComplete;
            
            // Debug logging
            console.log(`[SetupChecklist] Step ${step.id}:`, {
              completed: step.completed,
              isNext,
              prevStepsComplete,
              isLocked
            });
            
            const handleClick = () => {
              console.log(`[SetupChecklist] Clicked step: ${step.id}, isLocked: ${isLocked}, link: ${step.link}`);
              if (isLocked) {
                // Navigate to the first incomplete step
                const firstIncomplete = steps.find(s => !s.completed);
                if (firstIncomplete) {
                  console.log(`[SetupChecklist] Redirecting to first incomplete: ${firstIncomplete.link}`);
                  navigate(createPageUrl(firstIncomplete.link));
                }
              } else {
                console.log(`[SetupChecklist] Navigating to: ${step.link}`);
                navigate(createPageUrl(step.link));
              }
            };
            
            return (
              <button
                key={step.id}
                onClick={handleClick}
                className={`group flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                  step.completed
                    ? 'bg-[#D1FAE5] border border-[#A7F3D0]'
                    : isNext
                    ? 'bg-[#FFFBEB] border border-[#D3A029]'
                    : isLocked
                    ? 'bg-slate-100 border border-transparent opacity-60'
                    : 'bg-slate-50 border border-transparent hover:border-[#D3A029] hover:bg-[#FFFBEB]'
                }`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  step.completed
                    ? 'bg-[#10B981] text-white'
                    : isNext
                    ? 'bg-[#D3A029] text-white'
                    : 'bg-slate-200 text-slate-500 group-hover:bg-[#D3A029] group-hover:text-white'
                }`}>
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium truncate ${
                    step.completed ? 'text-[#065F46]' : isLocked ? 'text-slate-400' : 'text-[#111827]'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-[#6B7280] truncate">
                    {step.completed ? 'Done ✓' : isNext ? 'Up next' : isLocked ? 'Complete previous' : 'Click to start'}
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
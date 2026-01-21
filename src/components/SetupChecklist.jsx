import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, ChevronUp, ChevronDown, 
  User, FileText, Shield, CreditCard, Sparkles, Briefcase
} from 'lucide-react';

export function SetupChecklist({ profile, onRefresh }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const isInvestor = profile?.user_role === 'investor' || profile?.user_type === 'investor';
  const isAgent = profile?.user_role === 'agent' || profile?.user_type === 'agent';

  const onboardingComplete = !!(
    profile?.onboarding_completed_at || 
    profile?.onboarding_step === 'basic_complete' || 
    profile?.onboarding_step === 'deep_complete' ||
    profile?.onboarding_version
  );
  
  const subscriptionComplete = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
  const kycComplete = !!profile?.identity_verified || profile?.kyc_status === 'approved';
  const ndaComplete = !!profile?.nda_accepted;
  const brokerageComplete = Boolean(profile?.broker || profile?.agent?.brokerage);

  // Define steps in strict order based on role
  // Investor: Onboarding -> Subscription -> Identity -> NDA
  // Agent: Onboarding -> Identity -> NDA -> Brokerage
  const steps = [];

  // Step 1: Onboarding (both roles)
  steps.push({
    id: 'onboarding',
    title: 'Onboarding',
    description: 'Set up your profile',
    completed: onboardingComplete,
    icon: User,
    link: isAgent ? 'AgentOnboarding' : 'InvestorOnboarding'
  });

  // Step 2: Subscription (Investors only)
  if (isInvestor) {
    steps.push({
      id: 'subscription',
      title: 'Subscription',
      description: 'Choose your plan',
      completed: subscriptionComplete,
      icon: CreditCard,
      link: 'Pricing'
    });
  }

  // Step 3: Identity Verification (both roles)
  steps.push({
    id: 'identity',
    title: 'Identity',
    description: 'Verify your identity',
    completed: kycComplete,
    icon: Shield,
    link: 'IdentityVerification'
  });

  // Step 4: NDA (both roles)
  steps.push({
    id: 'nda',
    title: 'Sign NDA',
    description: 'Accept confidentiality',
    completed: ndaComplete,
    icon: FileText,
    link: 'NDA'
  });

  // Step 5: Brokerage (Agents only)
  if (isAgent) {
    steps.push({
      id: 'brokerage',
      title: 'Brokerage',
      description: 'Add your brokerage',
      completed: brokerageComplete,
      icon: Briefcase,
      link: 'AgentDeepOnboarding'
    });
  }

  const completedCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progress = (completedCount / totalSteps) * 100;
  const allComplete = completedCount === totalSteps;

  if (allComplete) return null;

  if (collapsed) {
    return (
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl px-4 py-2.5">
        <button onClick={() => setCollapsed(false)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#E3C567] rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-black" />
            </div>
            <p className="text-sm font-medium text-[#FAFAFA]">{`Setup: ${completedCount}/${totalSteps} done`}</p>
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
      <div className="bg-[#E3C567] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black/20 backdrop-blur rounded-lg flex items-center justify-center">
             <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-black">Complete Your Setup</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-1.5 bg-black/20 rounded-full overflow-hidden">
                <div className="h-full bg-black rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-black/80">{completedCount}/{totalSteps}</span>
            </div>
          </div>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-black/80 hover:text-black p-1.5 hover:bg-black/10 rounded-lg transition-colors">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        <div className={`grid gap-2 ${steps.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-5'}`}>
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = step.completed;
            const isNext = !isCompleted && steps.slice(0, idx).every(s => s.completed);
            const isLocked = !isCompleted && !isNext;
            
            const handleClick = () => {
              if (!isLocked && !isCompleted) {
                navigate(createPageUrl(step.link));
              }
            };
            
            return (
              <button
                key={step.id}
                onClick={handleClick}
                disabled={isLocked || isCompleted}
                className={`group flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200 ${
                   isCompleted 
                    ? 'bg-[#141414] border border-transparent opacity-50 cursor-default'
                    : isNext
                    ? 'bg-[#E3C567]/20 border border-[#E3C567] cursor-pointer'
                    : 'bg-[#1F1F1F] border border-transparent opacity-30 cursor-not-allowed'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                   isCompleted ? 'bg-green-500/20 text-green-500' : isNext ? 'bg-[#E3C567] text-black' : 'bg-[#333333] text-[#808080]'
                }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-medium truncate ${isLocked ? 'text-[#666666]' : 'text-[#FAFAFA]'}`}>
                    {step.title}
                  </p>
                  <p className="text-[8px] text-[#808080] truncate">
                    {isCompleted ? 'Completed' : isNext ? 'Up next' : 'Locked'}
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

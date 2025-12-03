import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, Circle, ChevronUp, ChevronDown, 
  User, Target, FileText, Shield, CreditCard, Sparkles, MapPin, ClipboardList
} from 'lucide-react';

export function SetupChecklist({ profile, onRefresh }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [steps, setSteps] = useState([]);

  useEffect(() => {
    if (profile) {
      calculateSteps();
    }
  }, [profile]);

  const calculateSteps = () => {
    const isInvestor = profile.user_role === 'investor' || profile.user_type === 'investor';
    
    const investorSteps = [
      {
        id: 'complete_profile',
        title: 'Complete profile',
        description: 'Add your basic information',
        completed: !!(profile.full_name && profile.email && profile.phone),
        icon: User,
        link: 'AccountProfile'
      },
      {
        id: 'deep_onboarding',
        title: 'In-depth profile',
        description: 'Share your investment preferences',
        completed: !!(profile.onboarding_step === 'deep_complete' || profile.metadata?.experienceAccreditation),
        icon: ClipboardList,
        link: 'InvestorDeepOnboarding'
      },
      {
        id: 'buy_box',
        title: 'Set up buy box',
        description: 'Define your ideal deal criteria',
        completed: !!(profile.investor?.buy_box && Object.keys(profile.investor.buy_box).length > 0),
        icon: Target,
        link: 'InvestorBuyBox'
      },
      {
        id: 'nda',
        title: 'Accept NDA',
        description: 'Review and sign confidentiality',
        completed: !!(profile.nda_accepted),
        icon: FileText,
        link: 'NDA'
      },
      {
        id: 'verify',
        title: 'Verify identity',
        description: 'Complete KYC verification',
        completed: !!(profile.kyc_status === 'approved'),
        icon: Shield,
        link: 'Verify',
        optional: true
      },
      {
        id: 'payment',
        title: 'Add payment',
        description: 'Subscribe to unlock features',
        completed: !!(profile.subscription_status === 'active' || profile.subscription_status === 'trialing'),
        icon: CreditCard,
        link: 'Pricing'
      }
    ];

    const agentSteps = [
      {
        id: 'complete_profile',
        title: 'Complete profile',
        description: 'Add your basic information',
        completed: !!(profile.full_name && profile.email && profile.phone),
        icon: User,
        link: 'AccountProfile'
      },
      {
        id: 'deep_onboarding',
        title: 'In-depth profile',
        description: 'Showcase your expertise',
        completed: !!(profile.onboarding_step === 'deep_complete' || profile.agent?.what_sets_you_apart),
        icon: ClipboardList,
        link: 'AgentDeepOnboarding'
      },
      {
        id: 'markets',
        title: 'Add markets',
        description: 'Define your service areas',
        completed: !!(profile.agent?.markets && profile.agent.markets.length > 0),
        icon: MapPin,
        link: 'AgentOnboarding'
      },
      {
        id: 'nda',
        title: 'Accept NDA',
        description: 'Review and sign confidentiality',
        completed: !!(profile.nda_accepted),
        icon: FileText,
        link: 'NDA'
      },
      {
        id: 'verify',
        title: 'Verify identity',
        description: 'Complete KYC verification',
        completed: !!(profile.kyc_status === 'approved'),
        icon: Shield,
        link: 'Verify',
        optional: true
      }
    ];

    const stepsToSet = isInvestor ? investorSteps : agentSteps;
    setSteps(stepsToSet);
  };

  // Also check if profile has a valid role
  const hasRole = profile?.user_role === 'investor' || profile?.user_role === 'agent' || profile?.user_type === 'investor' || profile?.user_type === 'agent';

  const completedCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const allComplete = completedCount === totalSteps;

  // Auto-collapse if all complete
  useEffect(() => {
    if (allComplete && steps.length > 0) {
      setCollapsed(true);
    }
  }, [allComplete, steps.length]);

  // Don't render if no profile or no role - show nothing
  if (!profile || !hasRole) {
    return null;
  }

  // If steps not calculated yet, show loading placeholder
  if (steps.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  // Collapsed state - minimal banner with gold accent
  if (collapsed) {
    return (
      <div className="bg-gradient-to-r from-[#FFFBEB] to-white border border-[#FDE68A] rounded-3xl p-4">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D3A029] rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#111827]">
                Setup Progress
              </p>
              <p className="text-xs text-[#6B7280]">
                {completedCount} of {totalSteps} steps complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-2 bg-[#FDE68A] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#D3A029] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#D3A029]">{Math.round(progress)}%</span>
            </div>
            <ChevronDown className="w-5 h-5 text-[#D3A029]" />
          </div>
        </button>
      </div>
    );
  }

  // Find the first incomplete step for CTA
  const nextStep = steps.find(s => !s.completed);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-[#D3A029] to-[#E9B949] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white">Complete Your Setup</h3>
              <p className="text-sm text-white/80">
                {allComplete ? 'All done! Your profile is complete.' : `${totalSteps - completedCount} steps remaining to unlock all features`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">{completedCount} of {totalSteps} complete</span>
            <span className="text-sm font-semibold text-white">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isNext = nextStep?.id === step.id;
            
            return (
              <button
                key={idx}
                onClick={() => step.link && navigate(createPageUrl(step.link))}
                className={`group relative flex items-start gap-3 p-4 rounded-2xl text-left transition-all duration-200 ${
                  step.completed
                    ? 'bg-[#D1FAE5] border-2 border-[#A7F3D0]'
                    : isNext
                    ? 'bg-[#FFFBEB] border-2 border-[#D3A029] shadow-lg shadow-[#D3A029]/10'
                    : 'bg-slate-50 border-2 border-transparent hover:border-slate-200 hover:bg-slate-100'
                }`}
              >
                {/* Step number or check */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  step.completed
                    ? 'bg-[#10B981] text-white'
                    : isNext
                    ? 'bg-[#D3A029] text-white'
                    : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'
                }`}>
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${
                      step.completed ? 'text-[#065F46]' : 'text-[#111827]'
                    }`}>
                      {step.title}
                    </p>
                    {step.optional && (
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-medium rounded">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">
                    {step.description}
                  </p>
                </div>

                {/* Arrow for incomplete steps */}
                {!step.completed && (
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    isNext ? 'bg-[#D3A029]/20 text-[#D3A029]' : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* CTA for next step */}
        {nextStep && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <Button
              onClick={() => navigate(createPageUrl(nextStep.link))}
              className="w-full sm:w-auto bg-[#D3A029] hover:bg-[#B8902A] text-white shadow-lg shadow-[#D3A029]/20"
            >
              <nextStep.icon className="w-4 h-4 mr-2" />
              Continue: {nextStep.title}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetupChecklist;
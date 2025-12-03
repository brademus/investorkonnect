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
        completed: !!(profile.full_name && profile.email && profile.phone),
        icon: User,
        link: 'AccountProfile'
      },
      {
        id: 'deep_onboarding',
        title: 'In-depth profile',
        completed: !!(profile.onboarding_step === 'deep_complete' || profile.metadata?.experienceAccreditation),
        icon: ClipboardList,
        link: 'InvestorDeepOnboarding'
      },
      {
        id: 'buy_box',
        title: 'Set up buy box',
        completed: !!(profile.investor?.buy_box && Object.keys(profile.investor.buy_box).length > 0),
        icon: Target,
        link: 'InvestorBuyBox'
      },
      {
        id: 'nda',
        title: 'Accept NDA',
        completed: !!(profile.nda_accepted),
        icon: FileText,
        link: 'NDA'
      },
      {
        id: 'verify',
        title: 'Verify identity',
        completed: !!(profile.kyc_status === 'approved'),
        icon: Shield,
        link: 'Verify',
        optional: true
      },
      {
        id: 'payment',
        title: 'Add payment',
        completed: !!(profile.subscription_status === 'active' || profile.subscription_status === 'trialing'),
        icon: CreditCard,
        link: 'Pricing'
      }
    ];

    const agentSteps = [
      {
        id: 'complete_profile',
        title: 'Complete profile',
        completed: !!(profile.full_name && profile.email && profile.phone),
        icon: User,
        link: 'AccountProfile'
      },
      {
        id: 'deep_onboarding',
        title: 'In-depth profile',
        completed: !!(profile.onboarding_step === 'deep_complete' || profile.agent?.what_sets_you_apart),
        icon: ClipboardList,
        link: 'AgentDeepOnboarding'
      },
      {
        id: 'markets',
        title: 'Add markets',
        completed: !!(profile.agent?.markets && profile.agent.markets.length > 0),
        icon: MapPin,
        link: 'AgentOnboarding'
      },
      {
        id: 'nda',
        title: 'Accept NDA',
        completed: !!(profile.nda_accepted),
        icon: FileText,
        link: 'NDA'
      },
      {
        id: 'verify',
        title: 'Verify identity',
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
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  // Collapsed state - minimal banner
  if (collapsed) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-between w-full"
        >
          <span className="text-sm font-medium text-[#111827]">
            Setup Progress: {completedCount} of {totalSteps} complete
          </span>
          <ChevronDown className="w-4 h-4 text-[#4B5563]" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Complete Your Setup</h3>
          <p className="text-xs text-[#4B5563]">{completedCount} of {totalSteps} complete</p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-[#4B5563] hover:text-[#111827]"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className="bg-[#D3A029] h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Checklist Items - Compact Grid */}
      <div className="grid grid-cols-2 gap-2">
        {steps.map((step, idx) => (
          <button
            key={idx}
            onClick={() => step.link && navigate(createPageUrl(step.link))}
            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
              step.completed
                ? 'bg-[#FFFBEB] border border-[#FDE68A]'
                : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {step.completed ? (
              <CheckCircle2 className="w-4 h-4 text-[#D3A029] flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span className="text-xs font-medium text-[#111827]">{step.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SetupChecklist;
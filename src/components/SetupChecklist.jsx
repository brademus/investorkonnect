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

  // Determine user role
  const isInvestor = profile?.user_role === 'investor' || profile?.user_type === 'investor';
  const isAgent = profile?.user_role === 'agent' || profile?.user_type === 'agent';

  // Core steps that apply to everyone - always visible
  const steps = [
    {
      id: 'onboarding',
      title: 'Complete Onboarding',
      description: 'Set up your profile and preferences',
      completed: !!profile?.onboarding_completed_at,
      icon: User,
      link: isAgent ? 'AgentDeepOnboarding' : 'InvestorDeepOnboarding'
    },
    {
      id: 'verify',
      title: 'Verify Identity',
      description: 'Complete KYC verification',
      completed: profile?.kyc_status === 'approved',
      icon: Shield,
      link: 'Verify'
    },
    {
      id: 'nda',
      title: 'Sign NDA',
      description: 'Review and accept confidentiality agreement',
      completed: !!profile?.nda_accepted,
      icon: FileText,
      link: 'NDA'
    },
    {
      id: 'subscription',
      title: 'Select Subscription',
      description: 'Choose a plan to unlock all features',
      completed: profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing',
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
      <div className="bg-gradient-to-r from-[#FFFBEB] to-white border border-[#FDE68A] rounded-3xl p-4">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D3A029] rounded-xl flex items-center justify-center">
              {allComplete ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#111827]">
                {allComplete ? 'Setup Complete!' : 'Setup Progress'}
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
            
            return (
              <button
                key={step.id}
                onClick={() => navigate(createPageUrl(step.link))}
                className={`group flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                  step.completed
                    ? 'bg-[#D1FAE5] border border-[#A7F3D0]'
                    : isNext
                    ? 'bg-[#FFFBEB] border border-[#D3A029]'
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
                    step.completed ? 'text-[#065F46]' : 'text-[#111827]'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-[#6B7280] truncate">
                    {step.completed ? 'Done ✓' : isNext ? 'Up next' : 'Click to start'}
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
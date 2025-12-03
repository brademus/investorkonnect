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
    <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-[#D3A029] to-[#E9B949] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              {allComplete ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Sparkles className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                {allComplete ? 'Setup Complete!' : 'Complete Your Setup'}
              </h3>
              <p className="text-sm text-white/80">
                {allComplete 
                  ? 'Your account is fully set up and ready to go.' 
                  : `${totalSteps - completedCount} steps remaining to unlock all features`}
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
          <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Items - Always visible grid */}
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isNext = nextStep?.id === step.id;
            
            return (
              <button
                key={step.id}
                onClick={() => navigate(createPageUrl(step.link))}
                className={`group relative flex flex-col items-center gap-3 p-5 rounded-2xl text-center transition-all duration-200 cursor-pointer ${
                  step.completed
                    ? 'bg-[#D1FAE5] border-2 border-[#A7F3D0] hover:border-[#6EE7B7]'
                    : isNext
                    ? 'bg-[#FFFBEB] border-2 border-[#D3A029] shadow-lg shadow-[#D3A029]/10 hover:shadow-xl'
                    : 'bg-slate-50 border-2 border-transparent hover:border-[#D3A029] hover:bg-[#FFFBEB]'
                }`}
              >
                {/* Step number badge */}
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                  {idx + 1}
                </div>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  step.completed
                    ? 'bg-[#10B981] text-white'
                    : isNext
                    ? 'bg-[#D3A029] text-white'
                    : 'bg-slate-200 text-slate-500 group-hover:bg-[#D3A029] group-hover:text-white'
                }`}>
                  {step.completed ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>
                
                {/* Content */}
                <div>
                  <p className={`text-sm font-semibold ${
                    step.completed ? 'text-[#065F46]' : 'text-[#111827]'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {step.description}
                  </p>
                </div>

                {/* Status badge */}
                {step.completed ? (
                  <span className="px-2 py-1 bg-[#10B981]/20 text-[#065F46] text-xs font-medium rounded-full">
                    Complete ✓
                  </span>
                ) : isNext ? (
                  <span className="px-2 py-1 bg-[#D3A029]/20 text-[#92400E] text-xs font-medium rounded-full">
                    Up Next →
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full group-hover:bg-[#D3A029]/20 group-hover:text-[#92400E]">
                    Click to start
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* CTA for next step */}
        {nextStep && (
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#6B7280]">
              <span className="font-medium text-[#111827]">Next up:</span> {nextStep.title}
            </p>
            <Button
              onClick={() => navigate(createPageUrl(nextStep.link))}
              className="w-full sm:w-auto bg-[#D3A029] hover:bg-[#B8902A] text-white shadow-lg shadow-[#D3A029]/20"
            >
              <nextStep.icon className="w-4 h-4 mr-2" />
              Continue Setup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetupChecklist;
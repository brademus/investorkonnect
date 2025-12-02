import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, Circle, ChevronUp, ChevronDown, 
  User, Target, FileText, Shield, CreditCard, Sparkles, MapPin
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
    const isInvestor = profile.user_role === 'investor';
    
    const investorSteps = [
      {
        id: 'simple_onboarding',
        title: 'Simple onboarding',
        description: 'Location and role selected',
        completed: !!(profile.target_state && profile.user_role),
        icon: Sparkles,
        action: null
      },
      {
        id: 'complete_profile',
        title: 'Complete profile',
        description: 'Add your name, email, and phone',
        completed: !!(profile.full_name && profile.email && profile.phone),
        icon: User,
        action: () => navigate(createPageUrl('AccountProfile')),
        buttonText: 'Complete Profile'
      },
      {
        id: 'buy_box',
        title: 'Set up buy box',
        description: 'Define your investment criteria',
        completed: !!(profile.investor?.buy_box && Object.keys(profile.investor.buy_box).length > 0),
        icon: Target,
        action: () => navigate(createPageUrl('InvestorBuyBox')),
        buttonText: 'Set Up Buy Box'
      },
      {
        id: 'nda',
        title: 'Accept NDA',
        description: 'Required to view agent details',
        completed: !!(profile.nda_accepted),
        icon: FileText,
        action: () => navigate(createPageUrl('NDA')),
        buttonText: 'Sign NDA'
      },
      {
        id: 'verify',
        title: 'Verify identity',
        description: 'Optional - increases trust',
        completed: !!(profile.kyc_status === 'approved'),
        icon: Shield,
        action: () => navigate(createPageUrl('Verify')),
        buttonText: 'Verify',
        optional: true
      },
      {
        id: 'payment',
        title: 'Add payment method',
        description: 'Required to fund deals',
        completed: !!(profile.stripe_customer_id),
        icon: CreditCard,
        action: () => navigate(createPageUrl('BillingSetup')),
        buttonText: 'Add Card'
      }
    ];

    const agentSteps = [
      {
        id: 'simple_onboarding',
        title: 'Simple onboarding',
        description: 'Location and role selected',
        completed: !!(profile.target_state && profile.user_role),
        icon: Sparkles,
        action: null
      },
      {
        id: 'complete_profile',
        title: 'Complete profile',
        description: 'Add your name, email, and phone',
        completed: !!(profile.full_name && profile.email && profile.phone),
        icon: User,
        action: () => navigate(createPageUrl('AccountProfile')),
        buttonText: 'Complete Profile'
      },
      {
        id: 'markets',
        title: 'Add markets & experience',
        description: 'Define your service areas',
        completed: !!(profile.agent?.markets && profile.agent.markets.length > 0),
        icon: MapPin,
        action: () => navigate(createPageUrl('AgentOnboarding')),
        buttonText: 'Add Markets'
      },
      {
        id: 'contract',
        title: 'Upload contract template',
        description: 'Your standard service agreement',
        completed: !!(profile.agent?.documents && profile.agent.documents.length > 0),
        icon: FileText,
        action: () => navigate(createPageUrl('AgentDocuments')),
        buttonText: 'Upload Contract'
      },
      {
        id: 'nda',
        title: 'Accept NDA',
        description: 'Required to access platform',
        completed: !!(profile.nda_accepted),
        icon: FileText,
        action: () => navigate(createPageUrl('NDA')),
        buttonText: 'Sign NDA'
      },
      {
        id: 'verify',
        title: 'Verify identity',
        description: 'Optional - increases trust',
        completed: !!(profile.kyc_status === 'approved'),
        icon: Shield,
        action: () => navigate(createPageUrl('Verify')),
        buttonText: 'Verify',
        optional: true
      }
    ];

    setSteps(isInvestor ? investorSteps : agentSteps);
  };

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allComplete = completedCount === totalCount;

  // Auto-collapse if all complete
  useEffect(() => {
    if (allComplete && steps.length > 0) {
      setCollapsed(true);
    }
  }, [allComplete, steps.length]);

  if (!profile || steps.length === 0) return null;

  return (
    <div className={`bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA] rounded-3xl shadow-sm transition-all ${
      collapsed ? 'p-4' : 'p-6'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#D3A029] rounded-xl flex items-center justify-center">
            {allComplete ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : (
              <Sparkles className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {allComplete ? 'Setup complete!' : 'Get the most out of Investor Konnect'}
            </h3>
            {!collapsed && (
              <p className="text-sm text-slate-600">
                {allComplete 
                  ? 'You\'re all set to start creating deals'
                  : `${completedCount} of ${totalCount} steps complete`
                }
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-700 hover:text-slate-900"
        >
          {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </Button>
      </div>

      {!collapsed && (
        <>
          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={progress} className="h-2 bg-white" />
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    step.completed 
                      ? 'bg-white/50' 
                      : 'bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                    <Icon className={`w-5 h-5 flex-shrink-0 ${
                      step.completed ? 'text-slate-400' : 'text-[#D3A029]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${
                        step.completed ? 'text-slate-600' : 'text-slate-900'
                      }`}>
                        {step.title}
                        {step.optional && (
                          <span className="ml-2 text-xs text-slate-500">(optional)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{step.description}</p>
                    </div>
                  </div>

                  {!step.completed && step.action && (
                    <Button
                      onClick={step.action}
                      size="sm"
                      className="bg-[#D3A029] hover:bg-[#B8902A] text-white text-xs font-semibold ml-3"
                    >
                      {step.buttonText}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default SetupChecklist;
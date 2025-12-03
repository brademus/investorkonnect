import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { profileUpsert } from '@/components/functions';
import { createPageUrl } from '@/components/utils';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, User, Briefcase, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

export default function SimpleOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    document.title = "Get Started - Investor Konnect";
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (!currentUser) {
        toast.error('Please sign in first');
        navigate(createPageUrl("Home"));
        return;
      }

      // Check if already onboarded (has location + role)
      const profiles = await base44.entities.Profile.filter({ 
        user_id: currentUser.id 
      });
      
      if (profiles.length > 0 && profiles[0].target_state && profiles[0].user_role) {
        // Already onboarded, go to dashboard
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }
      
      // Pre-fill if partial data exists
      if (profiles.length > 0) {
        if (profiles[0].target_state) setLocation(profiles[0].target_state);
        if (profiles[0].user_role) setRole(profiles[0].user_role);
      }
      
      setCheckingAuth(false);
    } catch (error) {
      console.error('Error loading user:', error);
      toast.error('Please sign in first');
      navigate(createPageUrl("Home"));
    }
  };

  const handleContinue = () => {
    if (!location) {
      toast.error('Please select your state');
      return;
    }
    setStep(2);
  };

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
  };

  const handleComplete = async () => {
    if (!role) {
      toast.error('Please select your role');
      return;
    }

    setLoading(true);

    try {
      // Update profile with location and role
      await profileUpsert({
        target_state: location,
        markets: [location],
        user_role: role,
        user_type: role,
        onboarding_step: 'simple_complete'
      });

      toast.success('Welcome to Investor Konnect!');
      
      // Redirect to dashboard
      setTimeout(() => {
        navigate(createPageUrl("Dashboard"), { replace: true });
      }, 500);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Failed to save. Please try again.');
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="large" showText={false} linkTo={null} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome to Investor Konnect!
          </h1>
          <p className="text-slate-600">Let's get you started</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
          {step === 1 ? (
            <>
              {/* Step 1: Location */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-[#FEF3C7] rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-[#D3A029]">1</span>
                  </div>
                  <span className="text-sm text-slate-600">Step 1 of 2</span>
                </div>

                <div className="mb-6">
                  <MapPin className="w-12 h-12 text-[#D3A029] mb-4" />
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Where are you investing?
                  </h2>
                  <p className="text-sm text-slate-600">
                    We'll match you with agents in your target market
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Select your state
                    </label>
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger className="w-full h-12 text-base">
                        <SelectValue placeholder="Choose a state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(state => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleContinue}
                    className="w-full h-12 bg-[#D3A029] hover:bg-[#B8902A] text-white text-base font-semibold"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Role Selection */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-[#FEF3C7] rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-[#D3A029]">2</span>
                  </div>
                  <span className="text-sm text-slate-600">Step 2 of 2</span>
                </div>

                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    I am a...
                  </h2>
                  <p className="text-sm text-slate-600">
                    Choose the option that best describes you
                  </p>
                </div>

                <div className="space-y-4 mb-6">
                  {/* Investor Option */}
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('investor')}
                    onTouchEnd={(e) => { e.preventDefault(); handleRoleSelect('investor'); }}
                    className={`w-full p-6 rounded-2xl border-2 transition-all text-left touch-manipulation ${
                      role === 'investor'
                        ? 'border-[#D3A029] bg-[#FEF3C7]'
                        : 'border-slate-200 hover:border-slate-300 bg-white active:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-4 pointer-events-none">
                      <div className="w-12 h-12 bg-[#D3A029] rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                          Investor
                        </h3>
                        <p className="text-sm text-slate-600">
                          Find vetted agents, submit deals, and track your investments
                        </p>
                      </div>
                      {role === 'investor' && (
                        <div className="w-6 h-6 bg-[#D3A029] rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Agent Option */}
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('agent')}
                    onTouchEnd={(e) => { e.preventDefault(); handleRoleSelect('agent'); }}
                    className={`w-full p-6 rounded-2xl border-2 transition-all text-left touch-manipulation ${
                      role === 'agent'
                        ? 'border-[#D3A029] bg-[#FEF3C7]'
                        : 'border-slate-200 hover:border-slate-300 bg-white active:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-4 pointer-events-none">
                      <div className="w-12 h-12 bg-[#D3A029] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                          Agent
                        </h3>
                        <p className="text-sm text-slate-600">
                          Get qualified investor leads and grow your business
                        </p>
                      </div>
                      {role === 'agent' && (
                        <div className="w-6 h-6 bg-[#D3A029] rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="flex-1 h-12 text-base font-semibold"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={loading || !role}
                    className="flex-1 h-12 bg-[#D3A029] hover:bg-[#B8902A] text-white text-base font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Get Started
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="mt-6 flex justify-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-colors ${
            step >= 1 ? 'bg-[#D3A029]' : 'bg-slate-300'
          }`} />
          <div className={`w-2 h-2 rounded-full transition-colors ${
            step >= 2 ? 'bg-[#D3A029]' : 'bg-slate-300'
          }`} />
        </div>
      </div>
    </div>
  );
}
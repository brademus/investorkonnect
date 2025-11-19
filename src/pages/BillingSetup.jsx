import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { stripeValidate } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, CheckCircle, X, AlertCircle, Loader2, 
  Key, CreditCard, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export default function BillingSetup() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);

  const [config, setConfig] = useState({
    STRIPE_MODE: 'live',
    STRIPE_PUBLISHABLE_KEY: '',
    STRIPE_PRICE_STARTER: '',
    STRIPE_PRICE_PRO: '',
    STRIPE_PRICE_ENTERPRISE: '',
    STRIPE_PORTAL_URL: '',
    BASE_URL: 'https://agent-vault-da3d088b.base44.app',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: ''
  });

  useEffect(() => {
    loadProfile();
    document.title = "Stripe Billing Setup - AgentVault Admin";
  }, []);

  const loadProfile = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ created_by: user.email });
      if (profiles.length > 0 && profiles[0].role === "admin") {
        setProfile(profiles[0]);
      } else {
        toast.error("Admin access required");
        navigate(createPageUrl("Dashboard"));
      }
    } catch (error) {
      navigate(createPageUrl("SignIn"));
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const response = await stripeValidate();
      setValidation(response.data);
      
      if (response.data.ok) {
        toast.success("✅ All Stripe configuration validated!");
      } else {
        toast.error("❌ Validation failed - see details below");
      }
    } catch (error) {
      toast.error("Failed to validate: " + error.message);
      setValidation({ ok: false, messages: [`Error: ${error.message}`] });
    } finally {
      setValidating(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Stripe Billing Setup</h1>
          </div>
          <p className="text-slate-600">Configure and validate Stripe integration</p>
        </div>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList>
            <TabsTrigger value="config" className="gap-2">
              <Key className="w-4 h-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="validation" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Validation
              {validation?.ok === true && (
                <Badge className="ml-2 bg-emerald-500">PASS</Badge>
              )}
              {validation?.ok === false && (
                <Badge className="ml-2 bg-red-500">FAIL</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <div className="bg-white rounded-xl border border-slate-200 p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Stripe Configuration</h2>
              
              <div className="space-y-6">
                {/* Mode Selection */}
                <div>
                  <Label className="text-base font-semibold">Stripe Mode</Label>
                  <p className="text-sm text-slate-600 mb-3">
                    Are you using live or test keys? This must match your keys and prices.
                  </p>
                  <div className="flex gap-4">
                    <Button
                      variant={config.STRIPE_MODE === 'live' ? 'default' : 'outline'}
                      onClick={() => setConfig({...config, STRIPE_MODE: 'live'})}
                    >
                      Live Mode
                    </Button>
                    <Button
                      variant={config.STRIPE_MODE === 'test' ? 'default' : 'outline'}
                      onClick={() => setConfig({...config, STRIPE_MODE: 'test'})}
                    >
                      Test Mode
                    </Button>
                  </div>
                </div>

                {/* Public Keys */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">Public Configuration</h3>
                  
                  <div>
                    <Label htmlFor="pk">Publishable Key (pk_live_... or pk_test_...)</Label>
                    <Input
                      id="pk"
                      value={config.STRIPE_PUBLISHABLE_KEY}
                      onChange={(e) => setConfig({...config, STRIPE_PUBLISHABLE_KEY: e.target.value})}
                      placeholder="pk_live_51..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="starter">Starter Price ID ($19/mo)</Label>
                    <Input
                      id="starter"
                      value={config.STRIPE_PRICE_STARTER}
                      onChange={(e) => setConfig({...config, STRIPE_PRICE_STARTER: e.target.value})}
                      placeholder="price_1..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="pro">Pro Price ID ($49/mo)</Label>
                    <Input
                      id="pro"
                      value={config.STRIPE_PRICE_PRO}
                      onChange={(e) => setConfig({...config, STRIPE_PRICE_PRO: e.target.value})}
                      placeholder="price_1..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="enterprise">Enterprise Price ID ($99/mo)</Label>
                    <Input
                      id="enterprise"
                      value={config.STRIPE_PRICE_ENTERPRISE}
                      onChange={(e) => setConfig({...config, STRIPE_PRICE_ENTERPRISE: e.target.value})}
                      placeholder="price_1..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="portal">Customer Portal URL (optional)</Label>
                    <Input
                      id="portal"
                      value={config.STRIPE_PORTAL_URL}
                      onChange={(e) => setConfig({...config, STRIPE_PORTAL_URL: e.target.value})}
                      placeholder="https://billing.stripe.com/p/login/..."
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Get this from Stripe Dashboard → Settings → Billing → Customer Portal
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="base">Base URL</Label>
                    <Input
                      id="base"
                      value={config.BASE_URL}
                      onChange={(e) => setConfig({...config, BASE_URL: e.target.value})}
                      placeholder="https://agent-vault-da3d088b.base44.app"
                    />
                  </div>
                </div>

                {/* Secret Keys */}
                <div className="space-y-4 pt-6 border-t border-slate-200">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Secret Configuration (Server-Only)
                  </h3>
                  <p className="text-sm text-slate-600">
                    These are managed in Base44 Secrets. Contact support to update.
                  </p>
                  
                  <div>
                    <Label>Secret Key (sk_live_... or sk_test_...)</Label>
                    <Input
                      value="••••••••••••••••"
                      disabled
                      placeholder="Managed in Base44 Secrets"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Set via: Dashboard → Settings → Secrets → STRIPE_SECRET_KEY
                    </p>
                  </div>

                  <div>
                    <Label>Webhook Secret (whsec_...)</Label>
                    <Input
                      value="••••••••••••••••"
                      disabled
                      placeholder="Managed in Base44 Secrets"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Set via: Dashboard → Settings → Secrets → STRIPE_WEBHOOK_SECRET
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <Button
                    onClick={handleValidate}
                    disabled={validating}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {validating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Validate Configuration
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="validation">
            <div className="space-y-6">
              {/* Validation Summary */}
              {validation && (
                <div className={`rounded-xl border-2 p-6 ${
                  validation.ok 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-4">
                    {validation.ok ? (
                      <CheckCircle className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <X className="w-8 h-8 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <h3 className={`text-xl font-bold mb-2 ${
                        validation.ok ? 'text-emerald-900' : 'text-red-900'
                      }`}>
                        {validation.ok ? 'All Checks Passed!' : 'Validation Failed'}
                      </h3>
                      <p className={validation.ok ? 'text-emerald-700' : 'text-red-700'}>
                        {validation.ok 
                          ? 'Your Stripe configuration is valid and ready to use.' 
                          : 'Some configuration issues were found. See details below.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Details */}
              {validation && (
                <div className="bg-white rounded-xl border border-slate-200 p-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Validation Details</h3>
                  
                  {/* Account Info */}
                  {validation.account && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                      <div className="font-semibold text-slate-900 mb-2">Stripe Account</div>
                      <div className="text-sm space-y-1">
                        <div>ID: <code className="bg-slate-200 px-2 py-0.5 rounded">{validation.account.id}</code></div>
                        <div>Mode: <Badge className={validation.account.livemode ? 'bg-green-600' : 'bg-amber-600'}>
                          {validation.account.livemode ? 'LIVE' : 'TEST'}
                        </Badge></div>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="space-y-2">
                    {validation.messages?.map((msg, idx) => {
                      const isSuccess = msg.startsWith('✅');
                      const isWarning = msg.startsWith('⚠️');
                      const isError = msg.startsWith('❌');
                      
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-3 p-3 rounded-lg ${
                            isSuccess ? 'bg-emerald-50 text-emerald-800' :
                            isWarning ? 'bg-amber-50 text-amber-800' :
                            isError ? 'bg-red-50 text-red-800' :
                            'bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="text-lg">{msg.slice(0, 2)}</span>
                          <span className="text-sm flex-1">{msg.slice(2)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Prices Table */}
                  {validation.prices && Object.keys(validation.prices).length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-slate-900 mb-3">Price Validation</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="text-left p-3 font-semibold">Tier</th>
                              <th className="text-left p-3 font-semibold">Status</th>
                              <th className="text-left p-3 font-semibold">Price ID</th>
                              <th className="text-left p-3 font-semibold">Amount</th>
                              <th className="text-left p-3 font-semibold">Mode</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(validation.prices).map(([tier, data]) => (
                              <tr key={tier}>
                                <td className="p-3 font-medium capitalize">{tier}</td>
                                <td className="p-3">
                                  {data.ok ? (
                                    <Badge className="bg-emerald-100 text-emerald-800">✓ Valid</Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-800">✗ Invalid</Badge>
                                  )}
                                </td>
                                <td className="p-3">
                                  <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                                    {data.id || 'N/A'}
                                  </code>
                                </td>
                                <td className="p-3">
                                  {data.unit_amount ? (
                                    `$${(data.unit_amount / 100).toFixed(2)}/${data.interval || 'once'}`
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {data.livemode !== undefined ? (
                                    <Badge className={data.livemode ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                                      {data.livemode ? 'live' : 'test'}
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!validation && (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Validation Run Yet</h3>
                  <p className="text-slate-600 mb-6">
                    Go to the Configuration tab and click "Validate Configuration"
                  </p>
                </div>
              )}

              {/* Webhook Setup Instructions */}
              {validation?.ok && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="font-semibold text-blue-900 mb-3">🎉 Configuration Valid!</h3>
                  <p className="text-blue-800 mb-4">
                    Your pricing page is now wired. To complete the setup:
                  </p>
                  <ol className="space-y-2 text-sm text-blue-800 ml-5 list-decimal">
                    <li>Go to Stripe Dashboard → Developers → Webhooks</li>
                    <li>Add endpoint: <code className="bg-blue-100 px-2 py-0.5 rounded">
                      https://agent-vault-da3d088b.base44.app/functions/stripeWebhook
                    </code></li>
                    <li>Listen for events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted</li>
                    <li>Copy the signing secret (whsec_...) and add to Base44 Secrets as STRIPE_WEBHOOK_SECRET</li>
                  </ol>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
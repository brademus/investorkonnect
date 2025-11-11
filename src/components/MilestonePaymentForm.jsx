import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, X, CreditCard } from "lucide-react";
import { toast } from "sonner";

/**
 * MILESTONE PAYMENT FORM
 * 
 * Embedded Stripe payment form using Stripe.js directly (no React wrapper needed).
 * Loads Stripe.js dynamically and creates Payment Element.
 * 
 * Props:
 * - clientSecret: Stripe PaymentIntent client_secret
 * - milestone: PaymentMilestone object
 * - onSuccess: Called after successful payment
 * - onClose: Called when user cancels
 */
export default function MilestonePaymentForm({ clientSecret, milestone, onSuccess, onClose }) {
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Load Stripe.js
  useEffect(() => {
    if (!clientSecret) return;

    const loadStripe = async () => {
      try {
        // Load Stripe script if not already loaded
        if (!window.Stripe) {
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.async = true;
          document.body.appendChild(script);
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        // Initialize Stripe with publishable key
        const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 
          'pk_test_51Q7Ub50nQRABXxQyZWQoKMOOJiXeAP8pM7HBG9yJQGJkqGPxQKUPxsM1Hv9h2kjN8vAKYVMqZsJCW0c5oKQxsQmQ00lPHWPuAE';
        
        const stripeInstance = window.Stripe(stripePublishableKey);
        setStripe(stripeInstance);

        // Create Elements instance
        const elementsInstance = stripeInstance.elements({
          clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#2563eb',
              colorBackground: '#ffffff',
              colorText: '#1e293b',
              colorDanger: '#dc2626',
              fontFamily: 'system-ui, sans-serif',
              spacingUnit: '4px',
              borderRadius: '8px'
            }
          }
        });
        
        setElements(elementsInstance);

        // Mount Payment Element
        const paymentElement = elementsInstance.create('payment');
        paymentElement.mount('#payment-element');
        
        paymentElement.on('ready', () => {
          setLoading(false);
        });

        paymentElement.on('change', (event) => {
          if (event.error) {
            setError(event.error.message);
          } else {
            setError('');
          }
        });

      } catch (err) {
        console.error('[MilestonePaymentForm] Stripe load error:', err);
        setError('Failed to load payment form. Please refresh and try again.');
        setLoading(false);
      }
    };

    loadStripe();
  }, [clientSecret]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required"
      });
      
      if (stripeError) {
        console.error('[MilestonePaymentForm] Payment error:', stripeError);
        setError(stripeError.message || "Payment failed");
        setSubmitting(false);
        toast.error(stripeError.message || "Payment failed");
        return;
      }
      
      // Payment succeeded!
      console.log('[MilestonePaymentForm] ✅ Payment succeeded');
      setSuccess(true);
      toast.success("Payment successful! Milestone will be marked as paid.");
      
      // Wait a moment for user to see success message
      setTimeout(() => {
        onSuccess();
      }, 1500);
      
    } catch (err) {
      console.error('[MilestonePaymentForm] Unexpected error:', err);
      setError("Unexpected error occurred");
      setSubmitting(false);
      toast.error("Unexpected error occurred");
    }
  };

  if (!clientSecret) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">Payment initialization failed. Please try again.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white border-2 border-blue-200 rounded-xl shadow-lg p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Payment Successful!</h3>
          <p className="text-sm text-slate-600">
            Your payment has been processed. The milestone will be marked as paid shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-blue-200 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-slate-900">Pay Milestone</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          type="button"
          disabled={submitting}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Milestone:</span>
            <span className="text-sm text-slate-900">{milestone.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Amount:</span>
            <span className="text-lg font-bold text-slate-900">
              ${((milestone.amount_cents || 0) / 100).toFixed(2)} USD
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-slate-600">Loading payment form...</span>
          </div>
        ) : (
          <div id="payment-element" className="mb-4"></div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        
        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            disabled={submitting || loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!stripe || submitting || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay ${((milestone.amount_cents || 0) / 100).toFixed(2)}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
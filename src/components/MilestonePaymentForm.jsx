import React, { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import { stripePromise } from "@/lib/stripe";
import { toast } from "sonner";

/**
 * MILESTONE PAYMENT FORM (INTERNAL)
 * 
 * Handles the actual payment submission using Stripe Elements.
 * Wrapped by Elements provider with clientSecret.
 */
function PaymentFormContent({ milestone, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
          return_url: window.location.href, // Fallback, but we prefer redirect: "if_required"
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

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Payment Successful!</h3>
        <p className="text-sm text-slate-600">
          Your payment has been processed. The milestone will be marked as paid shortly.
        </p>
      </div>
    );
  }

  return (
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

      <PaymentElement />
      
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
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || submitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Pay ${((milestone.amount_cents || 0) / 100).toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

/**
 * MILESTONE PAYMENT FORM (WRAPPER)
 * 
 * Wraps PaymentFormContent with Stripe Elements provider.
 * 
 * Props:
 * - clientSecret: Stripe PaymentIntent client_secret
 * - milestone: PaymentMilestone object
 * - onSuccess: Called after successful payment
 * - onClose: Called when user cancels
 */
export default function MilestonePaymentForm({ clientSecret, milestone, onSuccess, onClose }) {
  if (!clientSecret) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">Payment initialization failed. Please try again.</p>
      </div>
    );
  }

  const options = {
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
  };

  return (
    <div className="bg-white border-2 border-blue-200 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-slate-900">Pay Milestone</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <Elements stripe={stripePromise} options={options}>
        <PaymentFormContent 
          milestone={milestone} 
          onSuccess={onSuccess} 
          onClose={onClose}
        />
      </Elements>
    </div>
  );
}
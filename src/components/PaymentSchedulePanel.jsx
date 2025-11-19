import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, Calendar, Plus, X, Save, Edit, 
  CheckCircle, Clock, Loader2, AlertCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getScheduleForDeal } from "@/components/functions";
import { toast } from "sonner";

/**
 * PAYMENT SCHEDULE PANEL - Simplified (no external dependencies)
 * 
 * Shows/edits payment schedule for a deal.
 * Supports REAL Stripe payments for milestones.
 */
export default function PaymentSchedulePanel({ 
  dealId, 
  currentProfileId, 
  currentRole,
  investorProfileId,
  agentProfileId
}) {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (dealId) {
      loadSchedule();
    }
  }, [dealId]);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load via backend function
      const response = await getScheduleForDeal({ dealId });
      
      if (response.data?.ok) {
        setSchedule(response.data.schedule);
        setMilestones(response.data.milestones || []);
      } else {
        setSchedule(null);
        setMilestones([]);
      }
    } catch (err) {
      console.error('[PaymentSchedulePanel] Error loading schedule:', err);
      setError('Failed to load payment schedule');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!schedule && !isEditing) {
    return (
      <div className="text-center py-12">
        <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Payment Schedule Yet</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Create a payment schedule to manage all deal payments in one place.
        </p>
        <Button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Payment Schedule
        </Button>
      </div>
    );
  }

  // View mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{schedule?.title || 'Payment Schedule'}</h3>
          {schedule?.description && (
            <p className="text-sm text-slate-600 mt-1">{schedule.description}</p>
          )}
        </div>
        <Badge className="bg-blue-100 text-blue-800">
          REAL PAYMENTS
        </Badge>
      </div>

      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Total Amount</p>
            <p className="text-2xl font-bold text-slate-900">
              ${((schedule?.total_amount_cents || 0) / 100).toLocaleString('en-US', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Currency</p>
            <p className="font-semibold text-slate-900">{schedule?.currency || 'USD'}</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-bold text-slate-900 mb-3">Payment Milestones</h4>
        {milestones.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg">
            <p className="text-slate-600">No milestones added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {milestones.map((milestone) => {
              const status = milestone.status || 'pending';
              const isPaid = status === 'paid';
              
              return (
                <div 
                  key={milestone.id}
                  className="bg-white border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h5 className="font-semibold text-slate-900">{milestone.label}</h5>
                    {isPaid && (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Paid
                      </Badge>
                    )}
                    {!isPaid && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                  
                  {milestone.description && (
                    <p className="text-sm text-slate-600 mb-2">{milestone.description}</p>
                  )}
                  
                  <div className="flex items-center gap-6 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(milestone.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold">
                        ${(milestone.amount_cents / 100).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
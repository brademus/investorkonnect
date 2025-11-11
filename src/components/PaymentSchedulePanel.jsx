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
import * as Payments from "@/api/payments";
import { toast } from "sonner";

/**
 * PAYMENT SCHEDULE PANEL
 * 
 * Shows/edits payment schedule for a deal.
 * Test mode only - no real money moves.
 */
export default function PaymentSchedulePanel({ 
  dealId, 
  currentProfileId, 
  currentRole 
}) {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for editing
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMilestones, setEditMilestones] = useState([]);

  useEffect(() => {
    if (dealId) {
      loadSchedule();
    }
  }, [dealId]);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await Payments.getScheduleWithMilestonesForDeal({ dealId });
      
      if (data) {
        setSchedule(data.schedule);
        setMilestones(data.milestones);
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

  const startEditing = () => {
    if (schedule) {
      setEditTitle(schedule.title || '');
      setEditDescription(schedule.description || '');
      setEditMilestones(milestones.map(m => ({
        id: m.id,
        label: m.label,
        description: m.description || '',
        due_date: m.due_date ? m.due_date.split('T')[0] : '',
        amount_dollars: (m.amount_cents / 100).toFixed(2),
        payer_profile_id: m.payer_profile_id,
        payee_profile_id: m.payee_profile_id,
        sort_order: m.sort_order || 0
      })));
    } else {
      // Creating new schedule
      setEditTitle('Deal Payment Schedule');
      setEditDescription('');
      setEditMilestones([]);
    }
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditDescription('');
    setEditMilestones([]);
  };

  const addMilestone = () => {
    setEditMilestones([
      ...editMilestones,
      {
        label: '',
        description: '',
        due_date: '',
        amount_dollars: '0.00',
        payer_profile_id: null,
        payee_profile_id: null,
        sort_order: editMilestones.length
      }
    ]);
  };

  const removeMilestone = (index) => {
    setEditMilestones(editMilestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index, field, value) => {
    const updated = [...editMilestones];
    updated[index][field] = value;
    setEditMilestones(updated);
  };

  const saveSchedule = async () => {
    // Validation
    if (!editTitle.trim()) {
      toast.error('Please enter a schedule title');
      return;
    }

    if (editMilestones.length === 0) {
      toast.error('Please add at least one milestone');
      return;
    }

    for (const m of editMilestones) {
      if (!m.label.trim()) {
        toast.error('All milestones must have a label');
        return;
      }
      if (!m.due_date) {
        toast.error('All milestones must have a due date');
        return;
      }
    }

    setSaving(true);

    try {
      const scheduleInput = {
        title: editTitle,
        description: editDescription,
        currency: 'USD',
        status: 'active'
      };

      const milestonesInput = editMilestones.map(m => ({
        id: m.id,
        label: m.label,
        description: m.description,
        due_date: new Date(m.due_date).toISOString(),
        amount_dollars: parseFloat(m.amount_dollars),
        payer_profile_id: m.payer_profile_id,
        payee_profile_id: m.payee_profile_id,
        sort_order: m.sort_order || 0
      }));

      await Payments.upsertScheduleAndMilestones({
        dealId,
        ownerProfileId: currentProfileId,
        scheduleInput,
        milestonesInput
      });

      toast.success('Payment schedule saved!');
      setIsEditing(false);
      await loadSchedule();
    } catch (err) {
      console.error('[PaymentSchedulePanel] Error saving:', err);
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (milestoneId) => {
    try {
      await Payments.markMilestonePaid({ milestoneId });
      toast.success('Milestone marked as paid (test mode)');
      await loadSchedule();
    } catch (err) {
      console.error('[PaymentSchedulePanel] Error marking paid:', err);
      toast.error('Failed to mark milestone as paid');
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

  // No schedule - show create prompt
  if (!schedule && !isEditing) {
    return (
      <div className="text-center py-12">
        <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Payment Schedule Yet</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Create a payment schedule so both sides can see all deal payments in one place. 
          This is test mode only—no real money moves yet.
        </p>
        <Button onClick={startEditing} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Payment Schedule
        </Button>
      </div>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            {schedule ? 'Edit Payment Schedule' : 'Create Payment Schedule'}
          </h3>
          <Badge className="bg-orange-100 text-orange-800">
            TEST MODE
          </Badge>
        </div>

        {/* Schedule Fields */}
        <div className="space-y-4 bg-slate-50 rounded-lg p-4">
          <div>
            <Label htmlFor="title">Schedule Title *</Label>
            <Input
              id="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Fix & Flip – 123 Main St"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional notes about this payment schedule"
              rows={2}
            />
          </div>

          <div>
            <Label>Currency</Label>
            <p className="text-sm text-slate-600 mt-1">USD (fixed for test mode)</p>
          </div>
        </div>

        {/* Milestones */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-900">Payment Milestones</h4>
            <Button onClick={addMilestone} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Milestone
            </Button>
          </div>

          {editMilestones.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
              <p className="text-slate-600 mb-3">No milestones yet</p>
              <Button onClick={addMilestone} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add First Milestone
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {editMilestones.map((milestone, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-600">
                      Milestone {index + 1}
                    </span>
                    <button
                      onClick={() => removeMilestone(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Label *</Label>
                      <Input
                        value={milestone.label}
                        onChange={(e) => updateMilestone(index, 'label', e.target.value)}
                        placeholder="e.g. Earnest money, Closing"
                      />
                    </div>

                    <div>
                      <Label>Due Date *</Label>
                      <Input
                        type="date"
                        value={milestone.due_date}
                        onChange={(e) => updateMilestone(index, 'due_date', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Amount (USD) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={milestone.amount_dollars}
                        onChange={(e) => updateMilestone(index, 'amount_dollars', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={milestone.description}
                        onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                        placeholder="Optional details"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            onClick={saveSchedule} 
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Schedule
              </>
            )}
          </Button>
          <Button onClick={cancelEditing} variant="outline" disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // View mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{schedule.title}</h3>
          {schedule.description && (
            <p className="text-sm text-slate-600 mt-1">{schedule.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge className="bg-orange-100 text-orange-800">
            TEST MODE
          </Badge>
          <Button onClick={startEditing} size="sm" variant="outline">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Total Amount</p>
            <p className="text-2xl font-bold text-slate-900">
              ${((schedule.total_amount_cents || 0) / 100).toLocaleString('en-US', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Currency</p>
            <p className="font-semibold text-slate-900">{schedule.currency}</p>
          </div>
        </div>
      </div>

      {/* Milestones Table */}
      <div>
        <h4 className="font-bold text-slate-900 mb-3">Payment Milestones</h4>
        {milestones.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg">
            <p className="text-slate-600">No milestones added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {milestones.map((milestone) => {
              const isPaid = milestone.status === 'paid';
              const isPending = milestone.status === 'pending';
              
              return (
                <div 
                  key={milestone.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-semibold text-slate-900">{milestone.label}</h5>
                      {isPaid && (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Paid
                        </Badge>
                      )}
                      {isPending && (
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

                  {isPending && (
                    <Button
                      onClick={() => handleMarkPaid(milestone.id)}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Paid (test)
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  Loader2,
  ArrowRight,
  Lock,
  Unlock
} from "lucide-react";
import { toast } from "sonner";
import { 
  initiateEscrowTransaction, 
  getEscrowStatus, 
  fundEscrow, 
  releaseEscrow 
} from "@/components/functions";

const STATUS_CONFIG = {
  none: { label: "No Escrow", color: "bg-slate-100 text-slate-700", icon: Shield },
  created: { label: "Created", color: "bg-blue-100 text-blue-700", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  funded: { label: "Funded", color: "bg-emerald-100 text-emerald-700", icon: DollarSign },
  inspection: { label: "Inspection", color: "bg-amber-100 text-amber-700", icon: Clock },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: AlertCircle },
  disbursed: { label: "Disbursed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-700", icon: AlertCircle },
  disputed: { label: "Disputed", color: "bg-red-100 text-red-700", icon: AlertCircle }
};

export default function EscrowPanel({ room, profile, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [escrowData, setEscrowData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const isInvestor = profile?.id === room?.investorId;
  const isAgent = profile?.id === room?.agentId;
  const escrowStatus = room?.escrow_status || "none";
  const statusConfig = STATUS_CONFIG[escrowStatus] || STATUS_CONFIG.none;
  const StatusIcon = statusConfig.icon;

  useEffect(() => {
    if (room?.escrow_transaction_id) {
      refreshStatus();
    }
  }, [room?.id]);

  const refreshStatus = async () => {
    if (!room?.id) return;
    setRefreshing(true);
    try {
      const response = await getEscrowStatus({ room_id: room.id });
      if (response.data?.ok) {
        setEscrowData(response.data);
      }
    } catch (err) {
      console.error("Failed to refresh escrow status:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleInitiateEscrow = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const response = await initiateEscrowTransaction({
        room_id: room.id,
        amount: parseFloat(amount),
        description: description || `Deal Room Transaction`
      });

      if (response.data?.ok) {
        toast.success("Escrow transaction created!");
        setAmount("");
        setDescription("");
        onUpdate?.();
      } else {
        toast.error(response.data?.error || "Failed to create escrow");
      }
    } catch (err) {
      toast.error(err.message || "Failed to create escrow");
    } finally {
      setLoading(false);
    }
  };

  const handleFundEscrow = async () => {
    setLoading(true);
    try {
      const response = await fundEscrow({ room_id: room.id });

      if (response.data?.ok) {
        if (response.data.payment_url) {
          window.open(response.data.payment_url, "_blank");
          toast.success("Opening payment page...");
        } else {
          toast.info("Check your email for payment instructions");
        }
      } else {
        toast.error(response.data?.error || "Failed to get payment info");
      }
    } catch (err) {
      toast.error(err.message || "Failed to initiate funding");
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseEscrow = async (action) => {
    const confirmMsg = action === "accept" 
      ? "Are you sure you want to release the funds to the agent?"
      : "Are you sure you want to reject this transaction?";
    
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const response = await releaseEscrow({ room_id: room.id, action });

      if (response.data?.ok) {
        toast.success(action === "accept" ? "Funds released!" : "Transaction rejected");
        onUpdate?.();
      } else {
        toast.error(response.data?.error || `Failed to ${action} escrow`);
      }
    } catch (err) {
      toast.error(err.message || `Failed to ${action} escrow`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Secure Escrow</CardTitle>
              <CardDescription>Protected by Escrow.com</CardDescription>
            </div>
          </div>
          <Badge className={statusConfig.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* No Escrow Yet */}
        {escrowStatus === "none" && (
          <>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Secure Your Transaction</h4>
              <p className="text-sm text-blue-700 mb-4">
                Protect both parties with escrow. Funds are held securely until 
                the transaction is complete.
              </p>
              
              {isInvestor && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="amount">Transaction Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="10000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      placeholder="Property acquisition services..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    onClick={handleInitiateEscrow}
                    disabled={loading || !amount}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      <><Lock className="w-4 h-4 mr-2" /> Create Escrow</>
                    )}
                  </Button>
                </div>
              )}

              {isAgent && (
                <p className="text-sm text-blue-600 italic">
                  The investor will initiate the escrow transaction.
                </p>
              )}
            </div>
          </>
        )}

        {/* Escrow Created - Needs Funding */}
        {escrowStatus === "created" && (
          <div className="space-y-3">
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <h4 className="font-medium text-amber-900 mb-2">Awaiting Funding</h4>
              <p className="text-sm text-amber-700">
                Escrow transaction created. {isInvestor ? "Please fund the escrow to proceed." : "Waiting for investor to fund."}
              </p>
              {room?.escrow_amount && (
                <p className="text-lg font-bold text-amber-900 mt-2">
                  ${room.escrow_amount.toLocaleString()} {room.escrow_currency?.toUpperCase()}
                </p>
              )}
            </div>

            {isInvestor && (
              <Button 
                onClick={handleFundEscrow}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                ) : (
                  <><DollarSign className="w-4 h-4 mr-2" /> Fund Escrow</>
                )}
              </Button>
            )}

            {room?.escrow_landing_page && (
              <Button 
                variant="outline"
                onClick={() => window.open(room.escrow_landing_page, "_blank")}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" /> View on Escrow.com
              </Button>
            )}
          </div>
        )}

        {/* Funded - In Inspection */}
        {(escrowStatus === "funded" || escrowStatus === "inspection") && (
          <div className="space-y-3">
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <h4 className="font-medium text-emerald-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Escrow Funded
              </h4>
              <p className="text-sm text-emerald-700">
                ${room?.escrow_amount?.toLocaleString()} is held securely in escrow.
              </p>
              {escrowStatus === "inspection" && (
                <p className="text-sm text-emerald-600 mt-2">
                  Currently in inspection period.
                </p>
              )}
            </div>

            {isInvestor && (
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleReleaseEscrow("accept")}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Unlock className="w-4 h-4 mr-2" /> Release Funds</>
                  )}
                </Button>
                <Button 
                  onClick={() => handleReleaseEscrow("reject")}
                  disabled={loading}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Reject
                </Button>
              </div>
            )}

            {isAgent && (
              <p className="text-sm text-emerald-600 italic text-center">
                Waiting for investor to release funds after inspection.
              </p>
            )}
          </div>
        )}

        {/* Completed */}
        {(escrowStatus === "accepted" || escrowStatus === "disbursed" || escrowStatus === "completed") && (
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <h4 className="font-medium text-emerald-900 mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Transaction Complete
            </h4>
            <p className="text-sm text-emerald-700">
              Funds have been {escrowStatus === "disbursed" || escrowStatus === "completed" ? "disbursed" : "released"}.
            </p>
            {room?.escrow_completed_at && (
              <p className="text-xs text-emerald-600 mt-2">
                Completed: {new Date(room.escrow_completed_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Disputed/Cancelled */}
        {(escrowStatus === "disputed" || escrowStatus === "cancelled" || escrowStatus === "rejected") && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> {statusConfig.label}
            </h4>
            <p className="text-sm text-red-700">
              {escrowStatus === "disputed" && "A dispute has been opened. Please contact Escrow.com support."}
              {escrowStatus === "cancelled" && "This escrow transaction has been cancelled."}
              {escrowStatus === "rejected" && "This transaction was rejected by the buyer."}
            </p>
          </div>
        )}

        {/* Refresh Button */}
        {room?.escrow_transaction_id && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-slate-500">
              ID: {room.escrow_transaction_id.slice(0, 12)}...
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={refreshStatus}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
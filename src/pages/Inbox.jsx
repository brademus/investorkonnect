import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { inboxList, introRespond } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Loader2, CheckCircle, X, 
  MessageCircle, Shield
} from "lucide-react";
import { toast } from "sonner";

export default function Inbox() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    loadInbox();
  }, []);

  const loadInbox = async () => {
    try {
      setLoading(true);
      
      // Load intro requests
      const requestsRes = await inboxList();
      setRequests(requestsRes.data.requests || []);
      
      // Load active rooms
      const userProfiles = await base44.entities.Profile.filter({ 
        created_by: (await base44.auth.me()).email 
      });
      
      if (userProfiles.length > 0) {
        const myRooms = await base44.entities.Room.filter({ 
          agentId: userProfiles[0].id 
        }, '-created_date');
        setRooms(myRooms);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Load inbox error:', error);
      toast.error("Failed to load inbox");
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      const response = await introRespond({
        requestId,
        action: 'accept'
      });
      
      toast.success("Connection accepted!");
      
      // Navigate to room
      if (response.data.roomId) {
        navigate(createPageUrl("Room") + `?roomId=${response.data.roomId}`);
      } else {
        loadInbox();
      }
    } catch (error) {
      console.error('Accept error:', error);
      toast.error("Failed to accept request");
    }
  };

  const handleDecline = async (requestId) => {
    try {
      await introRespond({
        requestId,
        action: 'decline'
      });
      
      toast.success("Request declined");
      loadInbox();
    } catch (error) {
      console.error('Decline error:', error);
      toast.error("Failed to decline request");
    }
  };

  const goToRoom = (roomId) => {
    navigate(createPageUrl("Room") + `?roomId=${roomId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Agent Inbox</h1>
          <p className="text-slate-600">Connection requests and active conversations</p>
        </div>

        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList>
            <TabsTrigger value="requests" className="gap-2">
              <Users className="w-4 h-4" />
              Requests
              {requests.length > 0 && (
                <Badge variant="destructive" className="ml-2">{requests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Active Rooms
              {rooms.length > 0 && (
                <Badge variant="secondary" className="ml-2">{rooms.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="bg-white rounded-xl border border-slate-200">
              {requests.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No pending requests</h3>
                  <p className="text-slate-600">New connection requests will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {requests.map((request) => (
                    <div key={request.requestId} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-1">
                            {request.investor.name || 'Investor'}
                          </h3>
                          {request.investor.company && (
                            <p className="text-sm text-slate-600 mb-2">{request.investor.company}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {request.investor.markets?.map(market => (
                              <Badge key={market} variant="secondary" className="text-xs">
                                {market}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>

                      {request.message && (
                        <div className="bg-slate-50 rounded-lg p-4 mb-4">
                          <p className="text-sm text-slate-700">{request.message}</p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleAccept(request.requestId)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => handleDecline(request.requestId)}
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active">
            <div className="bg-white rounded-xl border border-slate-200">
              {rooms.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No active rooms</h3>
                  <p className="text-slate-600">Accepted connections will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {rooms.map((room) => (
                    <div 
                      key={room.id} 
                      className="p-6 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => goToRoom(room.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">Intro Room</h3>
                            <p className="text-sm text-slate-600">
                              Created {new Date(room.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {room.ndaAcceptedInvestor && room.ndaAcceptedAgent && (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              <Shield className="w-3 h-3 mr-1" />
                              NDA Signed
                            </Badge>
                          )}
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
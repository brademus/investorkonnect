import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { inboxList, introRespond, listMyRooms } from "@/components/functions";
import { getRoomsFromListMyRoomsResponse } from "@/components/utils/getRoomsFromListMyRooms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, CheckCircle, X, 
  MessageCircle, Shield, Home as HomeIcon, ArrowLeft
} from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
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
      
      const requestsRes = await inboxList();
      setRequests(requestsRes.data.requests || []);
      
      // Load active rooms for both investors and agents
      const roomsRes = await listMyRooms({});
      setRooms(getRoomsFromListMyRoomsResponse(roomsRes));
      
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
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Navigation Bar */}
      <nav className="bg-[#0D0D0D] border-b border-[#1F1F1F] sticky top-0 z-50 px-6 md:px-20 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
              alt="Investor Konnect"
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-bold text-[#E3C567]">INVESTOR KONNECT</span>
          </Link>
          
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="rounded-full font-medium gap-2 text-[#808080] hover:text-[#E3C567]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 bg-[#E3C567]/20 rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-[#E3C567]" />
            </div>
            <h1 className="text-4xl font-bold text-[#E3C567]">Messages</h1>
          </div>
          <p className="text-lg text-[#808080]">
            Connection requests and active conversations
          </p>
        </div>

        <Tabs defaultValue="requests" className="space-y-8">
          <TabsList className="bg-[#0D0D0D] rounded-full p-1 border border-[#1F1F1F]">
            <TabsTrigger 
              value="requests" 
              className="rounded-full px-6 data-[state=active]:bg-[#E3C567] data-[state=active]:text-black"
            >
              <Users className="w-4 h-4 mr-2" />
              Requests
              {requests.length > 0 && (
                <Badge variant="destructive" className="ml-2 bg-red-500">{requests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="active" 
              className="rounded-full px-6 data-[state=active]:bg-[#E3C567] data-[state=active]:text-black"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Active Rooms
              {rooms.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3C567]/20 text-[#E3C567]">{rooms.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="bg-[#0D0D0D] rounded-3xl border border-[#1F1F1F] overflow-hidden">
              {requests.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-[#141414] rounded-2xl mb-6">
                    <Users className="w-10 h-10 text-[#808080]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#FAFAFA] mb-3">No pending requests</h3>
                  <p className="text-[#808080] text-lg">New connection requests will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-[#1F1F1F]">
                  {requests.map((request) => (
                    <div key={request.requestId} className="p-8 hover:bg-[#141414] transition-colors">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-[#FAFAFA]">
                              {request.investor.name || 'Investor'}
                            </h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3C567]/20 text-[#E3C567]">New</span>
                          </div>
                          {request.investor.company && (
                            <p className="text-sm text-[#808080] mb-2">{request.investor.company}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {request.investor.markets?.map(market => (
                              <Badge key={market} variant="secondary" className="text-xs rounded-full bg-[#1F1F1F] text-[#FAFAFA] border-[#333]">
                                {market}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-full border-[#1F1F1F] text-[#808080]">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>

                      {request.message && (
                        <div className="bg-[#141414] rounded-2xl p-4 mb-6 border border-[#1F1F1F]">
                          <p className="text-sm text-[#FAFAFA]">{request.message}</p>
                        </div>
                      )}

                      <div className="flex gap-4">
                        <Button
                          onClick={() => handleAccept(request.requestId)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 font-semibold"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => handleDecline(request.requestId)}
                          variant="outline"
                          className="border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#1F1F1F] rounded-xl px-6 font-semibold"
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
            <div className="bg-[#0D0D0D] rounded-3xl border border-[#1F1F1F] overflow-hidden">
              {rooms.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-[#141414] rounded-2xl mb-6">
                    <MessageCircle className="w-10 h-10 text-[#808080]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#FAFAFA] mb-3">No active rooms</h3>
                  <p className="text-[#808080] text-lg">Accepted connections will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-[#1F1F1F]">
                  {rooms.map((room) => (
                    <div 
                      key={room.id} 
                      className="p-6 hover:bg-[#141414] cursor-pointer transition-colors"
                      onClick={() => goToRoom(room.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-[#E3C567]/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-[#E3C567]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#FAFAFA]">
                              {room.counterparty_name || room.deal_title || 'Deal Room'}
                            </h3>
                            <p className="text-sm text-[#808080]">
                              Created {new Date(room.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {room.ndaAcceptedInvestor && room.ndaAcceptedAgent && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3C567]/20 text-[#E3C567]">
                              <Shield className="w-3 h-3 mr-1" />
                              NDA Signed
                            </span>
                          )}
                          <Button variant="ghost" size="sm" className="rounded-full text-[#E3C567] hover:bg-[#E3C567]/10">
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
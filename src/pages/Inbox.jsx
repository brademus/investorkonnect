import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { inboxList, introRespond } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm px-6 md:px-20 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <HomeIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-700">INVESTOR KONNECT</span>
          </Link>
          
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="rounded-full font-medium gap-2"
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
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">Messages</h1>
          </div>
          <p className="text-lg text-gray-600">
            Connection requests and active conversations
          </p>
        </div>

        <Tabs defaultValue="requests" className="space-y-8">
          <TabsList className="bg-white rounded-full p-1 border border-gray-200 shadow-sm">
            <TabsTrigger 
              value="requests" 
              className="rounded-full px-6 data-[state=active]:bg-amber-500 data-[state=active]:text-white"
            >
              <Users className="w-4 h-4 mr-2" />
              Requests
              {requests.length > 0 && (
                <Badge variant="destructive" className="ml-2 bg-red-500">{requests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="active" 
              className="rounded-full px-6 data-[state=active]:bg-amber-500 data-[state=active]:text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Active Rooms
              {rooms.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{rooms.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              {requests.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-6">
                    <Users className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">No pending requests</h3>
                  <p className="text-gray-600 text-lg">New connection requests will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {requests.map((request) => (
                    <div key={request.requestId} className="p-8 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-800">
                              {request.investor.name || 'Investor'}
                            </h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">New</span>
                          </div>
                          {request.investor.company && (
                            <p className="text-sm text-gray-600 mb-2">{request.investor.company}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {request.investor.markets?.map(market => (
                              <Badge key={market} variant="secondary" className="text-xs rounded-full">
                                {market}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>

                      {request.message && (
                        <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                          <p className="text-sm text-gray-700">{request.message}</p>
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
                          className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl px-6 font-semibold"
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
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              {rooms.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-6">
                    <MessageCircle className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">No active rooms</h3>
                  <p className="text-gray-600 text-lg">Accepted connections will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {rooms.map((room) => (
                    <div 
                      key={room.id} 
                      className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => goToRoom(room.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">Intro Room</h3>
                            <p className="text-sm text-gray-500">
                              Created {new Date(room.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {room.ndaAcceptedInvestor && room.ndaAcceptedAgent && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Shield className="w-3 h-3 mr-1" />
                              NDA Signed
                            </span>
                          )}
                          <Button variant="ghost" size="sm" className="rounded-full">
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
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Shield, AlertCircle, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Reviews() {
  const [filters, setFilters] = useState({ market: "all", minRating: "all", sort: "-created_date" });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews', filters],
    queryFn: () => base44.entities.Review.filter({ verified: true, moderation_status: "approved" }, filters.sort),
    initialData: []
  });

  const { data: profiles } = useQuery({
    queryKey: ['agent-profiles'],
    queryFn: () => base44.entities.Profile.filter({ role: "agent", status: "approved" }),
    initialData: []
  });

  const getAgentProfile = (profileId) => {
    return profiles.find(p => p.id === profileId);
  };

  const filteredReviews = reviews.filter(review => {
    const matchesMarket = filters.market === "all" || review.market === filters.market;
    const matchesRating = filters.minRating === "all" || review.rating >= parseInt(filters.minRating);
    const agent = getAgentProfile(review.reviewee_profile_id);
    const matchesSearch = !searchTerm || agent?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesMarket && matchesRating && matchesSearch;
  });

  const markets = [...new Set(reviews.map(r => r.market).filter(Boolean))];

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`}
      />
    ));
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-6 text-blue-400" />
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Verified Reviews</h1>
          <p className="text-xl text-slate-300">
            All reviews are verified from real transactions. No fake reviews, no manipulation.
          </p>
        </div>
      </section>

      {/* How Verification Works */}
      <section className="py-12 bg-blue-50 border-y border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <Shield className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Transaction Verified</h3>
              <p className="text-sm text-slate-600">Only investors who completed deals can review</p>
            </div>
            <div>
              <Shield className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">NDA Confirmed</h3>
              <p className="text-sm text-slate-600">Reviewer must have signed platform NDA</p>
            </div>
            <div>
              <Shield className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Moderation</h3>
              <p className="text-sm text-slate-600">All reviews are reviewed for authenticity</p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Filter Reviews</h3>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              <Input
                placeholder="Search by agent name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select value={filters.market} onValueChange={(val) => setFilters({...filters, market: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Market" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Markets</SelectItem>
                  {markets.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.minRating} onValueChange={(val) => setFilters({...filters, minRating: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Min Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4+ Stars</SelectItem>
                  <SelectItem value="3">3+ Stars</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.sort} onValueChange={(val) => setFilters({...filters, sort: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-created_date">Newest First</SelectItem>
                  <SelectItem value="created_date">Oldest First</SelectItem>
                  <SelectItem value="-rating">Highest Rated</SelectItem>
                  <SelectItem value="rating">Lowest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-6">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <Skeleton className="h-6 w-48 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))
            ) : filteredReviews.length > 0 ? (
              filteredReviews.map((review) => {
                const agent = getAgentProfile(review.reviewee_profile_id);
                return (
                  <div key={review.id} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                          {agent?.name || "Agent"}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex">{renderStars(review.rating)}</div>
                          <span className="text-sm text-slate-600">({review.rating}.0)</span>
                        </div>
                        {review.market && (
                          <Badge variant="secondary" className="text-xs">
                            {review.market}
                          </Badge>
                        )}
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        <Shield className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                    <p className="text-slate-700 leading-relaxed mb-3">{review.body}</p>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>— {review.reviewer_name}</span>
                      <span>{new Date(review.created_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No reviews found</h3>
                <p className="text-slate-600">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
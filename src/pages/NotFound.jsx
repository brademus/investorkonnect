import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <AlertCircle className="w-20 h-20 text-[#808080] mx-auto mb-4 opacity-50" />
          <h1 className="text-6xl font-bold text-[#E3C567] mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-[#FAFAFA] mb-4">Page Not Found</h2>
          <p className="text-[#808080]">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link to={createPageUrl("RoleLanding")}>
          <Button className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
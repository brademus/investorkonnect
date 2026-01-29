import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export default async function billingPortal(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("VITE_APP_URL");

    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing STRIPE_SECRET_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Supabase env vars" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = authData.user;

    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .limit(1);

    if (profileErr || !profiles?.length) {
      return new Response(JSON.stringify({ ok: false, error: "Profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const profile = profiles[0];
    const customerId = profile.stripe_customer_id;

    if (!customerId) {
      return new Response(JSON.stringify({ ok: false, error: "No Stripe customer found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl || ""}/pricing`,
    });

    return new Response(JSON.stringify({ ok: true, url: session.url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export default async function syncSubscription(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const subscriptionId = body?.subscription_id;

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

    if (!subscriptionId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing subscription_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

    // Find profile by customer id
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("stripe_customer_id", customerId)
      .limit(1);

    if (profErr || !profiles?.length) {
      return new Response(JSON.stringify({ ok: false, error: "Profile not found for customer" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const profile = profiles[0];

    await supabase
      .from("profiles")
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
      })
      .eq("id", profile.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
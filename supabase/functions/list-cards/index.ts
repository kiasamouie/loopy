// supabase/functions/list-cards/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.1/node/crypto.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.37.0?target=deno";
// Read your Loopy credentials & default campaign ID from env
const API_KEY = Deno.env.get("LOOPY_API_KEY");
const API_SECRET = Deno.env.get("LOOPY_API_SECRET");
const USERNAME = Deno.env.get("LOOPY_USERNAME");
const BASE_URL = Deno.env.get("LOOPY_BASE_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
async function headers(jwt, publicCall = false) {
  const headers1 = {
    "Content-Type": "application/json"
  };
  if (!publicCall) headers1["Authorization"] = `${jwt}`;
  return headers1;
}
async function generateJwt() {
  const base64url = (input)=>{
    const str = typeof input === "string" ? input : new TextDecoder().decode(input);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: API_KEY,
    exp: now + 3600,
    iat: now - 10,
    username: USERNAME
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", API_SECRET).update(`${headerB64}.${payloadB64}`).digest("base64");
  const sigB64 = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${headerB64}.${payloadB64}.${sigB64}`;
}
function normalizeDate(input) {
  if (!input || typeof input !== "string") return null;
  const clean = input.trim();
  if (!clean || clean.toLowerCase() === "null") return null;
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().split("T")[0]; // YYYY-MM-DD
  }
  return null;
}
serve(async (req)=>{
  try {
    const url = new URL(req.url);
    const syncToDbParam = url.searchParams.get("syncToDb");
    const syncToDb = syncToDbParam === null ? true : syncToDbParam.toLowerCase() === "true";
    var campaignId = url.searchParams.get("campaignId");
    const jwt = await generateJwt();
    if (!campaignId) {
      const resp = await fetch(`${BASE_URL}/campaigns`, {
        headers: await headers(jwt)
      });
      if (!resp.ok) throw new Error(`Failed to fetch campaigns: ${resp.status}`);
      const data = await resp.json();
      console.log("data: ", data);
      if (data.rows && data.rows.length > 0) {
        campaignId = data.rows[0].value.id;
      } else {
        throw new Error("No campaign found");
      }
    }
    const cards_url = new URL(`${BASE_URL}/card/cid/${campaignId}`);
    cards_url.searchParams.set("count", "false");
    const payload = {
      dt: {
        draw: 1,
        start: 0,
        length: 9999,
        search: "",
        order: {
          column: "created",
          dir: "desc"
        }
      }
    };
    const resp = await fetch(cards_url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": jwt
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      throw new Error(`Failed to list cards: ${resp.status} ${await resp.text()}`);
    }
    const json = await resp.json();
    const cards = json.data || [];
    if (syncToDb && cards.length > 0) {
      const upserts = cards.map((c)=>({
          loopy_id: c.id,
          campaign_id: campaignId,
          status: c.status,
          current_stamps: c.currentStamps,
          total_stamps_earned: c.totalStampsEarned,
          total_rewards_earned: c.totalRewardsEarned,
          total_rewards_redeemed: c.totalRewardsRedeemed,
          created: c.created,
          updated: c.updated,
          email: c.customerDetails?.Email ?? null,
          first_name: c.customerDetails?.["First Name"] ?? null,
          last_name: c.customerDetails?.["Last Name"] ?? null,
          mobile_number: c.customerDetails?.["Mobile Number"] ?? null,
          date_of_birth: normalizeDate(c.customerDetails?.["Date Of Birth - Birthday Discounts!"]),
          postcode: c.customerDetails?.Postcode ?? null
        }));
      const { error } = await supabase.from("cards").upsert(upserts, {
        onConflict: "loopy_id"
      });
      if (error) throw error;
    }
    return new Response(JSON.stringify({
      data: cards,
      total_rows: cards.length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Error listing cards:", err);
    return new Response(JSON.stringify({
      error: err.message || String(err)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});

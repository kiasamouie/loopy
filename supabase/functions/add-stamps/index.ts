import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.1/node/crypto.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.37.0?target=deno";

// Env vars
const API_KEY = Deno.env.get("LOOPY_API_KEY");
const API_SECRET = Deno.env.get("LOOPY_API_SECRET");
const USERNAME = Deno.env.get("LOOPY_USERNAME");
const BASE_URL = Deno.env.get("LOOPY_BASE_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function headers(jwt: string, publicCall = false): Promise<HeadersInit> {
  const headers1: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (!publicCall) headers1["Authorization"] = `${jwt}`;
  return headers1;
}

async function generateJwt(): Promise<string> {
  const base64url = (input: string | Uint8Array): string => {
    const str = typeof input === "string" ? input : new TextDecoder().decode(input);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { uid: API_KEY, exp: now + 3600, iat: now - 10, username: USERNAME };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));

  const signature = createHmac("sha256", API_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64");

  const sigB64 = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST requests allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { email, cardId: providedCardId, stamps: stampsParam } = body;
    const stamps = (typeof stampsParam === "number" && stampsParam > 0) ? stampsParam : 1;

    let cardId = providedCardId;

    if (!cardId) {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Must provide either cardId or email" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Find cardId from email
      const { data, error } = await supabase
        .from("cards")
        .select("loopy_id")
        .eq("email", email)
        .limit(1)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: `Card not found for email: ${email}` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      cardId = data.loopy_id;
    }

    if (!cardId) {
      return new Response(
        JSON.stringify({ error: "cardId could not be resolved" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const jwt = await generateJwt();
    const addStampsUrl = `${BASE_URL}/card/cid/${cardId}/addStamps/${stamps}`;

    const resp = await fetch(addStampsUrl, {
      method: "POST",
      headers: await headers(jwt),
    });

    const text = await resp.text();

    if (!resp.ok) {
      throw new Error(`Failed to add stamps: ${resp.status} ${text}`);
    }

    const json = JSON.parse(text);

    const { error } = await supabase.rpc('increment_stamps', {
        p_loopy_id: cardId,
        p_stamps: stamps,
    });
    if (error) {
        console.error("Error incrementing stamps:", error);
    }

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error adding stamps:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

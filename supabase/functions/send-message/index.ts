import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.1/node/crypto.ts";

const API_KEY = Deno.env.get("LOOPY_API_KEY")!;
const API_SECRET = Deno.env.get("LOOPY_API_SECRET")!;
const USERNAME = Deno.env.get("LOOPY_USERNAME")!;
const BASE_URL = Deno.env.get("LOOPY_BASE_URL")!;

async function base64url(input: string | Uint8Array): Promise<string> {
  const str = typeof input === "string" ? input : new TextDecoder().decode(input);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateJwt(): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { uid: API_KEY, exp: now + 3600, iat: now - 10, username: USERNAME };

  const headerB64 = await base64url(JSON.stringify(header));
  const payloadB64 = await base64url(JSON.stringify(payload));

  const signature = createHmac("sha256", API_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64");
  const sigB64 = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function headers(jwt: string): Promise<HeadersInit> {
  return {
    "Content-Type": "application/json",
    "Authorization": jwt,
  };
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST requests allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const jwt = await generateJwt();

    const body = await req.json();

    // Campaign ID from query or body
    let campaignId = url.searchParams.get("campaignId") || body.campaignId;

    // Resolve campaignId if missing
    if (!campaignId) {
      const resp = await fetch(`${BASE_URL}/campaigns`, {
        headers: await headers(jwt),
      });
      if (!resp.ok) throw new Error(`Failed to fetch campaigns: ${resp.status}`);
      const data = await resp.json();
      if (data.rows && data.rows.length > 0) {
        campaignId = data.rows[0].value.id;
      } else {
        throw new Error("No campaign found");
      }
    }

    const isSendToAll = body.sendToAll === true;
    const sendUrl = isSendToAll
      ? `${BASE_URL}/card/cid/${campaignId}/push`
      : `${BASE_URL}/card/push`;
    const payload = isSendToAll ? (body.message || body) : body;

    const resp = await fetch(sendUrl, {
      method: "POST",
      headers: await headers(jwt),
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(
        `Failed to send${isSendToAll ? " to all cards" : " to individual card"}: ${resp.status} ${errorText}`
      );
    }
    const json = await resp.json();
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error sending message:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

import { createHmac } from "https://deno.land/std@0.177.1/node/crypto.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.37.0?target=deno";

// Initialize Supabase client for any fallback lookups
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface Card {
  id: string;
  campaign_key: string;
  status: string;
  currentStamps: number;
  totalStampsEarned: number;
  totalRewardsEarned?: number;
  totalRewardsRedeemed: number;
  created: string;
  updated: string;
  customerDetails?: Record<string, any>;
}

export default class LoopyClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private username: string;
  public token: string;
  public campaignId?: string;

  constructor(
    apiKey: string,
    apiSecret: string,
    username: string,
    baseUrl = "https://api.loopyloyalty.com/v1"
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.username = username;
    this.token = "";
  }

  private base64url(input: string | Uint8Array): string {
    const str = typeof input === "string" ? input : new TextDecoder().decode(input);
    return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  private async generateJwt(ttl = 3600): Promise<void> {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = { uid: this.apiKey, exp: now + ttl, iat: now - 10, username: this.username };

    const headerB64 = this.base64url(JSON.stringify(header));
    const payloadB64 = this.base64url(JSON.stringify(payload));
    const signature = createHmac("sha256", this.apiSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64");
    const sigB64 = signature
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    this.token = `${headerB64}.${payloadB64}.${sigB64}`;
  }

  private async headers(publicCall = false): Promise<HeadersInit> {
    if (!publicCall && !this.token) {
      await this.generateJwt();
    }
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (!publicCall) headers["Authorization"] = this.token;
    return headers;
  }

  // — Auth —
  async login(username: string, password: string): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/account/login`, {
      method: "POST",
      headers: await this.headers(true),
      body: JSON.stringify({ username, password }),
    });
    resp.ok || (() => { throw new Error(`Login failed: ${resp.status}`) })();
    const data = await resp.json();
    this.token = data.token;
    return this.token;
  }

  // — Campaigns —
  async listCampaigns(): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/campaigns`, { headers: await this.headers() });
    return resp.json();
  }

  async createCampaign(campaignData: any): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/campaign`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(campaignData),
    });
    return resp.json();
  }

  async campaignExists(name: string): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/campaign/exists/${encodeURIComponent(name)}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async getCampaignById(campaignId?: string): Promise<any> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const resp = await fetch(
      `${this.baseUrl}/campaign/id/${cid}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async getCampaignByName(name: string): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/campaign/name/${encodeURIComponent(name)}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async getCampaignPublic(campaignId?: string): Promise<any> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const resp = await fetch(
      `${this.baseUrl}/campaign/public/${cid}`,
      { headers: await this.headers(true) }
    );
    return resp.json();
  }

  async updateCampaign(updates: any, campaignId?: string): Promise<any> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const resp = await fetch(
      `${this.baseUrl}/campaign/${cid}`,
      { method: "PATCH", headers: await this.headers(), body: JSON.stringify(updates) }
    );
    return resp.json();
  }

  async deleteCampaign(campaignId?: string): Promise<void> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const resp = await fetch(
      `${this.baseUrl}/campaign/${cid}`,
      { method: "DELETE", headers: await this.headers() }
    );
    resp.ok || (() => { throw new Error(`Delete campaign failed: ${resp.status}`) })();
  }

  async pushCampaignChanges(payload: any, campaignId?: string): Promise<any> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const resp = await fetch(
      `${this.baseUrl}/campaign/${cid}/push`,
      { method: "POST", headers: await this.headers(), body: JSON.stringify(payload) }
    );
    return resp.json();
  }

  // — Beacons —
  async createBeacon(beaconData: any): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/beacon`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(beaconData),
    });
    return resp.json();
  }

  async getBeacon(beaconId: string): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/beacon/${beaconId}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async listBeacons(): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/beacons`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async updateBeacon(beaconId: string, updates: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/beacon/${beaconId}`,
      { method: "PATCH", headers: await this.headers(), body: JSON.stringify(updates) }
    );
    return resp.json();
  }

  async deleteBeacon(beaconId: string): Promise<void> {
    const resp = await fetch(
      `${this.baseUrl}/beacon/${beaconId}`,
      { method: "DELETE", headers: await this.headers() }
    );
    resp.ok || (() => { throw new Error(`Delete beacon failed: ${resp.status}`) })();
  }

  // — Locations —
  async createLocation(locationData: any): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/location`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(locationData),
    });
    return resp.json();
  }

  async getLocation(locationId: string): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/location/${locationId}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async listLocations(): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/locations`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async updateLocation(locationId: string, updates: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/location/${locationId}`,
      { method: "PATCH", headers: await this.headers(), body: JSON.stringify(updates) }
    );
    return resp.json();
  }

  async deleteLocation(locationId: string): Promise<void> {
    const resp = await fetch(
      `${this.baseUrl}/location/${locationId}`,
      { method: "DELETE", headers: await this.headers() }
    );
    resp.ok || (() => { throw new Error(`Delete location failed: ${resp.status}`) })();
  }
  

  // — Cards & Stamps —
  async listCards(count = false,dt?: any,campaignId?: string, syncToDb = true): Promise<{ data: Card[]; total_rows: number }> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const payload = dt || {
      dt: { draw: 1, start: 0, length: 9999, search: "", order: { column: "created", dir: "desc" } }
    };
    const url = new URL(`${this.baseUrl}/card/cid/${cid}`);
    url.searchParams.set("count", String(count));

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    const cards: Card[] = json.data || [];

    function normalizeDate(input: string | undefined): string | null {
      if (!input || typeof input !== "string") return null;

      const clean = input.trim();
      if (!clean || clean.toLowerCase() === "null") return null;

      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
        return parsed.toISOString().split("T")[0]; // Return YYYY-MM-DD
      }

      return null;
    }

    if (syncToDb && cards.length) {
      const upserts = cards.map(c => ({
        loopy_id: c.id,
        campaign_id: cid,
        status: c.status,
        current_stamps: c.currentStamps,
        total_stamps_earned: c.totalStampsEarned,
        total_rewards_earned: c.totalRewardsEarned,
        total_rewards_redeemed: c.totalRewardsRedeemed,
        created: c.created,
        updated: c.updated,
        email: c.customerDetails?.Email,
        first_name: c.customerDetails?.["First Name"],
        last_name: c.customerDetails?.["Last Name"],
        mobile_number: c.customerDetails?.["Mobile Number"],
        date_of_birth: normalizeDate(c.customerDetails?.["Date Of Birth - Birthday Discounts!"]),
        postcode: c.customerDetails?.Postcode ?? null,
      }));

      const { error } = await supabase
        .from("cards")
        .upsert(upserts, { onConflict: "loopy_id" });

      if (error) throw error;
    }

    this.campaignId = cid;
    return { data: cards, total_rows: cards.length };
  }

  async getCardById(
    cardId: string,
    includeEvents = false,
    includeRewards = false
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}/card/${cardId}`);
    if (includeEvents) url.searchParams.set("includeEvents", "true");
    if (includeRewards) url.searchParams.set("includeRewards", "true");
    const resp = await fetch(url.toString(), { headers: await this.headers() });
    return resp.json();
  }

  async getCardByUniqueId(
    campaignId: string,
    uniqueIdType: string,
    uniqueIdValue: string
  ): Promise<any> {
    const safe = encodeURIComponent(uniqueIdValue);
    const resp = await fetch(
      `${this.baseUrl}/uniquecard/campaignid/${campaignId}/${uniqueIdType}/${safe}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async addStamps(
    cardId: string,
    stamps = 1
  ): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/card/cid/${cardId}/addStamps/${stamps}`,
      { method: "POST", headers: await this.headers() }
    );
    return resp.json();
  }

  async addStampsByUniqueId(
    uniqueIdType: string,
    uniqueIdValue: string,
    stamps = 1,
    campaignId?: string
  ): Promise<any> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const safe = encodeURIComponent(uniqueIdValue);
    const resp = await fetch(
      `${this.baseUrl}/uniquecard/campaignid/${cid}/${uniqueIdType}/${safe}/addStamps/${stamps}`,
      { method: "POST", headers: await this.headers() }
    );
    return resp.json();
  }

  async redeemReward(
    cardId: string,
    rewardType: number,
    quantity = 1
  ): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/card/cid/${cardId}/redeemReward/${rewardType}/${quantity}`,
      { method: "POST", headers: await this.headers() }
    );
    return resp.json();
  }

  async redeemRewardByUniqueId(
    uniqueIdType: string,
    uniqueIdValue: string,
    rewardType: number,
    quantity = 1,
    campaignId?: string
  ): Promise<any> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const safe = encodeURIComponent(uniqueIdValue);
    const resp = await fetch(
      `${this.baseUrl}/uniquecard/campaignid/${cid}/${uniqueIdType}/${safe}/redeemReward/${rewardType}/${quantity}`,
      { method: "POST", headers: await this.headers() }
    );
    return resp.json();
  }

  async resyncCard(cardId: string, payload: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/card/cid/${cardId}/resync`,
      { method: "PUT", headers: await this.headers(), body: JSON.stringify(payload) }
    );
    return resp.json();
  }

  async deleteCard(cardId: string): Promise<void> {
    const resp = await fetch(
      `${this.baseUrl}/card/cid/${cardId}/delete`,
      { method: "DELETE", headers: await this.headers() }
    );
    resp.ok || (() => { throw new Error(`Delete card failed: ${resp.status}`) })();
  }

  async sendMessageToAllCards(message: any, campaignId?: string): Promise<any> {
    const cid = campaignId || await this.resolveDefaultCampaign();
    const resp = await fetch(
      `${this.baseUrl}/card/cid/${cid}/push`,
      { method: "POST", headers: await this.headers(), body: JSON.stringify(message) }
    );
    return resp.json();
  }

  async sendMessageToIndividualCard(messagePayload: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/card/push`,
      { method: "POST", headers: await this.headers(), body: JSON.stringify(messagePayload) }
    );
    return resp.json();
  }

  async enrolCustomer(
    campaignId: string,
    customerData: any,
    dataConsentOptIn = true
  ): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/enrol/${campaignId}`,
      { method: "POST", headers: await this.headers(true), body: JSON.stringify({ customerData, dataConsentOptIn }) }
    );
    return resp.json();
  }

  async listEventsForCampaign(
    campaignId: string,
    count = false,
    payload?: any
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}/events/analytics/transactions/${campaignId}`);
    if (count) url.searchParams.set("count", "true");
    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(payload || {})
    });
    return resp.json();
  }

  async exportCampaign(campaignId: string, exportPayload: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/export/${campaignId}`,
      { method: "POST", headers: await this.headers(), body: JSON.stringify(exportPayload) }
    );
    return resp.json();
  }

  async createImageAsset(imagePayload: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/imageAsset`,
      { method: "POST", headers: await this.headers(), body: JSON.stringify(imagePayload) }
    );
    return resp.json();
  }

  async getStripImage(params: Record<string,string>): Promise<Response> {
    const url = new URL(`${this.baseUrl}/images`);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
    return fetch(url.toString(), { headers: await this.headers() });
  }

  async getStripImageTemplate(): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/images/jsonTemplate`, { headers: await this.headers() });
    return resp.json();
  }

  async getStampImage(imageId: string): Promise<Response> {
    return fetch(
      `${this.baseUrl}/images/stampImage/${imageId}`,
      { headers: await this.headers() }
    );
  }

  async listStampImages(): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/images/stampTemplates`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async createSubscription(subscriptionPayload: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/subscription`,
      { method: "POST", headers: await this.headers(), body: JSON.stringify(subscriptionPayload) }
    );
    return resp.json();
  }

  async getSampleEvent(eventType: string, campaignId: string): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/subscription/${eventType}/${campaignId}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    const resp = await fetch(
      `${this.baseUrl}/subscription/${subscriptionId}`,
      { method: "DELETE", headers: await this.headers() }
    );
    resp.ok || (() => { throw new Error(`Delete subscription failed: ${resp.status}`) })();
  }

  async createSubuser(subuserPayload: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/subuser`,
      { method: "POST",	headers: await this.headers(), body: JSON.stringify(subuserPayload) }
    );
    return resp.json();
  }

  async listSubusers(): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/subusers`, { headers: await this.headers() });
    return resp.json();
  }

  async getSubuser(subuserId: string): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/subuser/${subuserId}`,
      { headers: await this.headers() }
    );
    return resp.json();
  }

  async updateSubuser(subuserId: string, updates: any): Promise<any> {
    const resp = await fetch(
      `${this.baseUrl}/subuser/${subuserId}`,
      { method: "PATCH", headers: await this.headers(), body: JSON.stringify(updates) }
    );
    return resp.json();
  }

  async deleteSubuser(subuserId: string): Promise<void> {
    const resp = await fetch(
      `${this.baseUrl}/subuser/${subuserId}`,
      { method: "DELETE", headers: await this.headers() }
    );
    resp.ok || (() => { throw new Error(`Delete subuser failed: ${resp.status}`) })();
  }

  private async resolveDefaultCampaign(): Promise<string> {
    if (!this.campaignId) {
      const { data, error } = await supabase
        .from('campaigns')
        .select('loopy_id')
        .limit(1)
        .single();
      if (!error && data?.loopy_id) {
        this.campaignId = data.loopy_id;
      } else {
        // Fallback to fetching from Loopy
        const res = await this.listCampaigns();
        this.campaignId = res.rows[0].value.id;
      }
    }
    return this.campaignId!;
  }
}

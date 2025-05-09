import os
import time
import pyperclip
import hmac
import hashlib
import base64
import json
import requests
import pandas as pd
from typing import Any, Dict, Optional


class LoopyClient:
    def __init__(
        self,
        api_key: str,
        api_secret: str,
        username: str,
        base_url: str = "https://api.loopyloyalty.com/v1",
        session: Optional[requests.Session] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.api_secret = api_secret
        self.username = username
        self.token: Optional[str] = None
        self.session = session or requests.Session()
        self.generate_jwt()
        self.campaign_id = self.list_campaigns()["rows"][0]["value"]["id"]
        self.cards = None

    def _headers(self, public: bool = False) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if not public:
            if not self.token:
                raise RuntimeError("No JWT set; please login or generate one first")
            headers["Authorization"] = self.token
        return headers

    def generate_jwt(self, ttl: int = 3600) -> str:
        header = {"alg": "HS256", "typ": "JWT"}
        now = int(time.time())
        payload = {"uid": self.api_key, "exp": now + ttl, "iat": now - 10, "username": self.username}
        def b64url(data: bytes) -> str:
            return base64.urlsafe_b64encode(data).decode().rstrip("=")
        h_b = b64url(json.dumps(header).encode())
        p_b = b64url(json.dumps(payload).encode())
        sig = hmac.new(self.api_secret.encode(), f"{h_b}.{p_b}".encode(), hashlib.sha256).digest()
        s_b = b64url(sig)
        self.token = f"{h_b}.{p_b}.{s_b}"
        return self.token

    def login(self, username: str, password: str) -> str:
        resp = self.session.post(f"{self.base_url}/account/login", json={"username": username, "password": password})
        resp.raise_for_status()
        self.token = resp.json().get("token")
        return self.token

    def create_campaign(self, campaign_data: Dict[str, Any]) -> Dict:
        return self.session.post(f"{self.base_url}/campaign", headers=self._headers(), json=campaign_data).json()

    def campaign_exists(self, name: str) -> Dict:
        return self.session.get(f"{self.base_url}/campaign/exists/{name}", headers=self._headers()).json()

    def get_campaign_by_id(self, campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        return self.session.get(f"{self.base_url}/campaign/id/{cid}", headers=self._headers()).json()

    def get_campaign_by_name(self, name: str) -> Dict:
        return self.session.get(f"{self.base_url}/campaign/name/{name}", headers=self._headers()).json()

    def get_campaign_public(self, campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        return self.session.get(f"{self.base_url}/campaign/public/{cid}", headers=self._headers(public=True)).json()

    def list_campaigns(self) -> Dict:
        return self.session.get(f"{self.base_url}/campaigns", headers=self._headers()).json()

    def update_campaign(self, updates: Dict[str, Any], campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        return self.session.patch(f"{self.base_url}/campaign/{cid}", headers=self._headers(), json=updates).json()

    def delete_campaign(self, payload: Optional[Dict[str, Any]] = None, campaign_id: Optional[str] = None) -> None:
        cid = campaign_id or self.campaign_id
        self.session.delete(f"{self.base_url}/campaign/{cid}", headers=self._headers(), json=payload or {}).raise_for_status()

    def push_campaign_changes(self, payload: Dict[str, Any], campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        return self.session.post(f"{self.base_url}/campaign/{cid}/push", headers=self._headers(), json=payload).json()

    def create_beacon(self, beacon_data: Dict[str, Any]) -> Dict:
        return self.session.post(f"{self.base_url}/beacon", headers=self._headers(), json=beacon_data).json()

    def get_beacon(self, beacon_id: str) -> Dict:
        return self.session.get(f"{self.base_url}/beacon/{beacon_id}", headers=self._headers()).json()

    def list_beacons(self) -> Dict:
        return self.session.get(f"{self.base_url}/beacons", headers=self._headers()).json()

    def update_beacon(self, beacon_id: str, updates: Dict[str, Any]) -> Dict:
        return self.session.patch(f"{self.base_url}/beacon/{beacon_id}", headers=self._headers(), json=updates).json()

    def delete_beacon(self, beacon_id: str, payload: Dict[str, Any]) -> None:
        self.session.delete(f"{self.base_url}/beacon/{beacon_id}", headers=self._headers(), json=payload).raise_for_status()

    def create_location(self, location_data: Dict[str, Any]) -> Dict:
        return self.session.post(f"{self.base_url}/location", headers=self._headers(), json=location_data).json()

    def get_location(self, location_id: str) -> Dict:
        return self.session.get(f"{self.base_url}/location/{location_id}", headers=self._headers()).json()

    def list_locations(self) -> Dict:
        return self.session.get(f"{self.base_url}/locations", headers=self._headers()).json()

    def update_location(self, location_id: str, updates: Dict[str, Any]) -> Dict:
        return self.session.patch(f"{self.base_url}/location/{location_id}", headers=self._headers(), json=updates).json()

    def delete_location(self, location_id: str, payload: Dict[str, Any]) -> None:
        self.session.delete(f"{self.base_url}/location/{location_id}", headers=self._headers(), json=payload).raise_for_status()
        
    def list_cards(self, count: bool = False, dt: Optional[Dict[str, Any]] = None, campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        response = self.session.post(f"{self.base_url}/card/cid/{cid}", headers=self._headers(), params={"count": str(count).lower()}, json={
            "dt": {
                "draw": 1,
                "start": 0,
                "length": 9999,
                "search": "",
                "order": {"column": "created", "dir": "desc"},
            }
        }).json()
        if not count:
            self.cards = response['data']
            self.to_excel(response, "cards.xlsx")
        return response

    def get_card_by_id(self, card_id: str, include_events: bool = False, include_rewards: bool = False) -> Dict:
        params = {}
        if include_events:
            params["includeEvents"] = "true"
        if include_rewards:
            params["includeRewards"] = "true"
        return self.session.get(f"{self.base_url}/card/{card_id}", headers=self._headers(), params=params).json()

    def get_card_by_unique_id(self, unique_id_type: str, unique_id_value: str, campaign_id: Optional[str] = None) -> Dict:
        from urllib.parse import quote
        cid = campaign_id or self.campaign_id
        v = quote(unique_id_value, safe="")
        return self.session.get(f"{self.base_url}/uniquecard/campaignid/{cid}/{unique_id_type}/{v}", headers=self._headers()).json()

    def add_stamps(self, card_id: str, stamps: int = 1, payload: Optional[Dict[str, Any]] = None) -> Dict:
        return self.session.post(f"{self.base_url}/card/cid/{card_id}/addStamps/{stamps}", headers=self._headers(), json=payload or {}).json()

    def add_stamps_by_unique_id(self, unique_id_type: str, unique_id_value: str, stamps: int = 1, payload: Optional[Dict[str, Any]] = None, campaign_id: Optional[str] = None) -> Dict:
        from urllib.parse import quote
        cid = campaign_id or self.campaign_id
        v = quote(unique_id_value, safe="")
        return self.session.post(f"{self.base_url}/uniquecard/campaignid/{cid}/{unique_id_type}/{v}/addStamps/{stamps}", headers=self._headers(), json=payload or {}).json()

    def redeem_reward(self, card_id: str, reward_type: int = 1, quantity: int = 1, payload: Optional[Dict[str, Any]] = None) -> Dict:
        return self.session.post(f"{self.base_url}/card/cid/{card_id}/redeemReward/{reward_type}/{quantity}", headers=self._headers(), json=payload or {}).json()

    def redeem_reward_by_unique_id(self, unique_id_type: str, unique_id_value: str, reward_type: int, quantity: int = 1, payload: Optional[Dict[str, Any]] = None, campaign_id: Optional[str] = None) -> Dict:
        from urllib.parse import quote
        cid = campaign_id or self.campaign_id
        v = quote(unique_id_value, safe="")
        return self.session.post(f"{self.base_url}/uniquecard/campaignid/{cid}/{unique_id_type}/{v}/redeemReward/{reward_type}/{quantity}", headers=self._headers(), json=payload or {}).json()

    def resync_card(self, card_id: str, payload: Dict[str, Any]) -> Dict:
        return self.session.put(f"{self.base_url}/card/cid/{card_id}/resync", headers=self._headers(), json=payload).json()

    def delete_card(self, card_id: str, payload: Dict[str, Any]) -> None:
        self.session.delete(f"{self.base_url}/card/cid/{card_id}/delete", headers=self._headers(), json=payload).raise_for_status()

    def send_message_to_all_cards(self, message, campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        return self.session.post(f"{self.base_url}/card/cid/{cid}/push", headers=self._headers(), json={"message": message}).json()

    def send_message_to_individual_card(self, card_id, message) -> Dict:
        return self.session.post(f"{self.base_url}/card/push", headers=self._headers(), json={"message": message, "cardID": card_id}).json()

    def enrol_customer(self, customer_data: Dict[str, Any], data_consent_opt_in: bool = True, campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        payload = {"customerData": customer_data, "dataConsentOptIn": data_consent_opt_in}
        return self.session.post(f"{self.base_url}/enrol/{cid}", headers=self._headers(public=True), json=payload).json()

    def list_events_for_campaign(self, count: bool = False, payload: Optional[Dict[str, Any]] = None, campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        params = {"count": str(count).lower()} if count else {}
        return self.session.post(f"{self.base_url}/events/analytics/transactions/{cid}", headers=self._headers(), params=params, json=payload or {}).json()

    def export_campaign(self, export_payload: Dict[str, Any], campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        return self.session.post(f"{self.base_url}/export/{cid}", headers=self._headers(), json=export_payload).json()

    def create_image_asset(self, image_payload: Dict[str, Any]) -> Dict:
        return self.session.post(f"{self.base_url}/imageAsset", headers=self._headers(), json=image_payload).json()

    def get_strip_image(self, params: Dict[str, Any]) -> requests.Response:
        return self.session.get(f"{self.base_url}/images", headers=self._headers(), params=params)

    def get_strip_image_template(self) -> Dict:
        return self.session.get(f"{self.base_url}/images/jsonTemplate", headers=self._headers()).json()

    def get_stamp_image(self, image_id: str) -> requests.Response:
        return self.session.get(f"{self.base_url}/images/stampImage/{image_id}", headers=self._headers())

    def list_stamp_images(self) -> Dict:
        return self.session.get(f"{self.base_url}/images/stampTemplates", headers=self._headers()).json()

    def create_subscription(self, subscription_payload: Dict[str, Any]) -> Dict:
        return self.session.post(f"{self.base_url}/subscription", headers=self._headers(), json=subscription_payload).json()

    def get_sample_event(self, event_type: str, campaign_id: Optional[str] = None) -> Dict:
        cid = campaign_id or self.campaign_id
        return self.session.get(f"{self.base_url}/subscription/{event_type}/{cid}", headers=self._headers()).json()

    def delete_subscription(self, subscription_id: str, payload: Dict[str, Any]) -> None:
        self.session.delete(f"{self.base_url}/subscription/{subscription_id}", headers=self._headers(), json=payload).raise_for_status()

    def create_subuser(self, subuser_payload: Dict[str, Any]) -> Dict:
        return self.session.post(f"{self.base_url}/subuser", headers=self._headers(), json=subuser_payload).json()

    def list_subusers(self) -> Dict:
        return self.session.get(f"{self.base_url}/subusers", headers=self._headers()).json()

    def get_subuser(self, subuser_id: str) -> Dict:
        return self.session.get(f"{self.base_url}/subuser/{subuser_id}", headers=self._headers()).json()

    def update_subuser(self, subuser_id: str, updates: Dict[str, Any]) -> Dict:
        return self.session.patch(f"{self.base_url}/subuser/{subuser_id}", headers=self._headers(), json=updates).json()

    def delete_subuser(self, subuser_id: str, payload: Dict[str, Any]) -> None:
        self.session.delete(f"{self.base_url}/subuser/{subuser_id}", headers=self._headers(), json=payload).raise_for_status()

    def to_excel(self, response_json: dict, file_path: str) -> None:
        cards = response_json.get("data", [])
        df = pd.json_normalize(cards, sep="_")
        df.rename(columns=lambda c: c.replace("customerDetails_", "") if c.startswith("customerDetails_") else c, inplace=True)
        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Cards")
            ws = writer.sheets["Cards"]
            ws.auto_filter.ref = ws.dimensions
            for col_cells in ws.columns:
                max_length = max(len(str(cell.value)) if cell.value is not None else 0 for cell in col_cells)
                ws.column_dimensions[col_cells[0].column_letter].width = max_length + 2
        os.startfile(file_path)
        

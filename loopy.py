import json
import os
from loopyclient import LoopyClient
import pyperclip
from dotenv import load_dotenv

load_dotenv()

client = LoopyClient(api_key=os.getenv("LOOPY_API_KEY"), api_secret=os.getenv("LOOPY_API_SECRET"), username=os.getenv("LOOPY_USERNAME"))

email = 'thekiadoe@gmail.com'
kia = '1hnSgkKszttJfH'

# print(client.list_cards())

print(client.add_stamps(kia, 1))

# print(client.send_message_to_all_cards("Thank you for being a loyal customer!"))
# print(client.send_message_to_individual_card(kia, "Alex tunca thinks you the most loyal because of the database!"))

# print(client.add_stamps(kia))
# print(client.redeem_reward(kia))

# 2) Enrol the customer under that email (if you haven't already done so)
# enrol_resp = client.enrol_customer(
#     campaign_id=campaign_id,
#     customer_data={
#         "Email": email,
#         "First Name": "Alex",
#         "Last Name": "Tunca",
#         "Mobile Number": "+1234567890",
#     },
#     data_consent_opt_in=True
# )
# print("Enrol response:", enrol_resp)

# card = client.get_card_by_id(kia)
# card = client.get_card_by_id(kia,True,True)
# pyperclip.copy(json.dumps(card, indent=4))
# print("Fetched card:", card)
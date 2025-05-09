# Loopy Python Client SDK

A simple Python client for interacting with the Loopy Loyalty API.

## Features

- Generate and manage JWT authentication
- Create, list, update, and delete campaigns, beacons, locations, cards, and more
- Export cards data to Excel with auto-formatted columns
- Enrol customers and handle events
- Manage image assets and subscriptions

## Prerequisites

- Python 3.7+
- [pip](https://pip.pypa.io/en/stable/)
- A Loopy Loyalty account with API credentials

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/kiasamouie/loopy.git
   cd loopy
   ```

2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv env
   source env/bin/activate    # On Windows use `env\Scripts\activate`
   ```

3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
   *Or install manually:*
   ```bash
   pip install python-dotenv pyperclip requests pandas openpyxl
   ```

## Configuration

1. Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in your editor and set:
   ```dotenv
   API_KEY=your_api_key_here
   API_SECRET=your_api_secret_here
   API_USERNAME=your_username_here
   ```

## Usage

1. Load environment variables and create a `LoopyClient` instance:
   ```python
   import os
   from dotenv import load_dotenv
   from loopyclient import LoopyClient

   load_dotenv()  # loads .env into environment

   client = LoopyClient(
       api_key=os.getenv("API_KEY"),
       api_secret=os.getenv("API_SECRET"),
       username=os.getenv("API_USERNAME")
   )

   # List campaigns
   campaigns = client.list_campaigns()
   print(campaigns)

   # Export cards to Excel
   response = client.list_cards()
   # This will generate cards.xlsx and open it
   ```

2. Alternatively, run the provided `loopy.py` script:
   ```bash
   python loopy.py
   ```
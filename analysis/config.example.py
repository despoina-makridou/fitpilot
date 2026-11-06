# Copy this file to `config.py` and fill in your values.
# config.py is gitignored so your secret key isn't committed.

SUPABASE_URL = "https://lbnfshhjjgoydfylaqiw.supabase.co"

# The SERVICE_ROLE key (Supabase -> Project Settings -> API -> service_role).
# It bypasses row-level security so the script can read ALL participants'
# study data. Keep it secret — never ship it in the app or commit it.
SERVICE_ROLE_KEY = "PASTE_YOUR_SERVICE_ROLE_KEY_HERE"

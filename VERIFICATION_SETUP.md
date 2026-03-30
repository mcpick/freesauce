# Google Places Verification Setup

## API Key Required

To enable automatic verification of new shops, set the Google Places API key:

```bash
CF_TOKEN=$(op item get "KAI Cloudflare Workers API token" --vault "Kai Vault" --field notesPlain)
CLOUDFLARE_API_TOKEN="$CF_TOKEN" CLOUDFLARE_ACCOUNT_ID="16a04bbc76ee5eccbcc1d6c39bc9a797" npx wrangler secret put GOOGLE_PLACES_API_KEY
```

## Admin Key for Bulk Verification

For the `/api/verify-all` endpoint, also set:

```bash
CF_TOKEN=$(op item get "KAI Cloudflare Workers API token" --vault "Kai Vault" --field notesPlain)
CLOUDFLARE_API_TOKEN="$CF_TOKEN" CLOUDFLARE_ACCOUNT_ID="16a04bbc76ee5eccbcc1d6c39bc9a797" npx wrangler secret put ADMIN_KEY
```

## How It Works

1. **New Shops**: When created, they're automatically verified in the background using Google Places API
2. **Existing Shops**: Use the `/api/verify-all` endpoint with `X-Admin-Key` header to verify all unverified shops
3. **Map Display**: Only verified shops show by default, with a toggle to show unverified ones

## Features Added

- ✅ Added `google_place_id` column to shops table
- ✅ Background verification using Google Places API (Text Search)
- ✅ Hide unverified shops on map by default with toggle
- ✅ Bulk verification endpoint for existing shops
- ✅ Update stats to show verified count instead of total
- ✅ Graceful fallback when API key is missing

The system handles missing API keys gracefully - verification simply gets skipped without breaking shop creation.
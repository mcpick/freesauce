# Free Sauce v2 Deployment Guide

## Before deploying, you'll need to:

### 1. Run Database Migration

```bash
# Apply schema changes to D1 database
npx wrangler d1 execute freesauce-db --file=./schema-v2.sql

# Generate and run slug migration for existing shops
# First, customize migrate-slugs.js based on your actual shop data
# Then generate the SQL file:
node migrate-slugs.js

# Apply the slug migration:
npx wrangler d1 execute freesauce-db --file=./slug-migration.sql
```

### 2. Set Environment Secrets

```bash
# Set Resend API key
npx wrangler secret put RESEND_API_KEY
# Enter your Resend API key when prompted
```

### 3. Verify R2 Bucket

Ensure the R2 bucket `freesauce-images` exists in your Cloudflare account.

## What's New in V2

✅ **Shop Detail Pages** - Each shop now gets its own page at `/shop/slug-name`
✅ **Photo Upload** - Users can take photos when adding shops (client-side resize to 1024px, JPEG 80%)
✅ **Voting System** - Email-verified thumbs up/down voting on each shop
✅ **Enhanced Map** - Popups now show vote counts, relative time, and link to shop pages
✅ **Better API** - New endpoints for photos, voting, and shop details

## API Endpoints

- `GET /api/shops` - All shops (now includes vote counts, slugs, last_activity)
- `GET /api/shop/[slug]` - Single shop detail
- `POST /api/shops` - Create shop (now handles photos and generates slugs)
- `POST /api/photo` - Upload photo
- `GET /api/photo/[key]` - Serve photo from R2
- `POST /api/vote` - Submit vote (creates pending, sends email)
- `GET /api/vote/confirm` - Confirm vote via token

## Files Changed

### New Files

- `src/pages/shop/[slug].astro` - Shop detail page
- `src/pages/api/vote.ts` - Vote submission and confirmation
- `src/pages/api/photo.ts` - Photo upload
- `src/pages/api/photo/[key].ts` - Photo serving
- `src/pages/api/shop/[slug].ts` - Shop detail API
- `schema-v2.sql` - Database migration
- `migrate-slugs.js` - Slug generation script

### Updated Files

- `src/pages/index.astro` - Enhanced map with vote counts and shop links
- `src/pages/add.astro` - Photo upload with client-side resize
- `src/pages/api/shops.ts` - Now handles photos, generates slugs, returns vote data
- `wrangler.toml` - Added R2 binding and environment variables

## Testing Checklist

- [ ] Add a new shop with photo
- [ ] Visit shop detail page
- [ ] Submit a vote and confirm via email
- [ ] Check map shows updated vote counts
- [ ] Verify photos display correctly
- [ ] Test mobile photo capture

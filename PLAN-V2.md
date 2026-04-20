# Free Sauce v2 — Shop Pages, Photos, Voting

## Features

### 1. Shop Detail Pages (`/shop/[slug]`)

- Each shop gets a dedicated page at `/shop/vilis-west-hindmarsh`
- Shows: name, address, sauce types, verified badge, photo, map pin, vote counts
- Slug generated from name + suburb on creation (lowercase, hyphenated, deduped)
- Map popup links to the detail page

**Schema change — add slug to shops:**

```sql
ALTER TABLE shops ADD COLUMN slug TEXT UNIQUE;
```

Generate slugs for existing entries via migration script.

### 2. Photo Upload on Add Form

- Single photo per shop, uploaded when submitting the "add a pie shop" form
- User takes a photo of the free sauce bottle at the shop
- Frontend: `<input type="file" accept="image/*" capture="environment">` (opens camera on mobile)
- **Client-side:** Validate max 5MB before upload
- **Client-side resize:** Canvas API — resize to max 1024px wide, JPEG at 80% quality before upload. Keeps upload small and avoids Workers image processing costs.
- **Backend (Workers):**
    - Accept multipart form data (already resized)
    - Validate max 2MB after resize
    - Upload to R2 bucket `freesauce-images`
    - Store R2 key in shops table as `photo_key`
- **Serving:** Public R2 bucket or presigned URL, served at `/api/photo/[key]`

**Schema change:**

```sql
ALTER TABLE shops ADD COLUMN photo_key TEXT;
```

**R2 setup:**

- Bucket: `freesauce-images` (Mcpickle account)
- Binding: `IMAGES` in wrangler.toml
- Image path convention: `shops/{shop_id}/{timestamp}.jpg`

### 3. Vote System (Thumbs Up/Down with Email Confirmation)

**Flow:**

1. User visits `/shop/[slug]`
2. Clicks 👍 or 👎
3. Enters email address
4. Backend creates vote in `pending` state
5. Resend sends confirmation email with verification link
6. User clicks link → vote moves to `confirmed` state
7. Page shows confirmed vote counts only

**One vote per email per shop.** If same email votes again on same shop, update existing vote (requires re-confirmation).

**Schema — new votes table:**

```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  email TEXT NOT NULL,
  vote TEXT NOT NULL CHECK(vote IN ('up', 'down')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed')),
  token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT,
  UNIQUE(shop_id, email)
);

CREATE INDEX idx_votes_shop ON votes(shop_id, status);
CREATE INDEX idx_votes_token ON votes(token);
```

**Email:**

- From: Resend (same setup as other projects)
- Template: Simple — "Confirm your vote for {shop_name}" with a link to `/api/vote/confirm?token={token}`
- From address: TBD (e.g. `freesauce@updates.mcpickle.com.au`)

### 4. Map Updates

- Popup now includes:
    - Shop name (linked to `/shop/[slug]`)
    - 👍 X / 👎 Y (confirmed vote counts)
    - "Updated 3 days ago" (relative time from latest activity: vote or creation)
    - Sauce types
    - Verified badge if applicable
- Relative time calculated client-side (no library needed — simple function)

### 5. Shop Detail Page Content

```
/shop/[slug]
├── Hero: Photo (if exists) or placeholder
├── Shop name + verified badge
├── Address + map pin (small static map or link to Google Maps)
├── Sauce types (chips/badges)
├── Vote counts: 👍 12  👎 2
├── "Last updated 3 days ago"
├── Vote form:
│   ├── 👍 / 👎 toggle
│   ├── Email input
│   └── Submit → "Check your email to confirm"
└── Back to map link
```

## API Endpoints

| Method | Path                | Description                                     |
| ------ | ------------------- | ----------------------------------------------- |
| GET    | `/api/shops`        | All shops (existing, add vote counts + slug)    |
| GET    | `/api/shops/[slug]` | Single shop detail with votes                   |
| POST   | `/api/shops`        | Create shop (existing, update for photo + slug) |
| POST   | `/api/photo/upload` | Upload + resize photo, return key               |
| GET    | `/api/photo/[key]`  | Serve photo from R2                             |
| POST   | `/api/vote`         | Submit vote (creates pending, sends email)      |
| GET    | `/api/vote/confirm` | Confirm vote via token                          |

## File Changes

### New files

- `src/pages/shop/[slug].astro` — shop detail page
- `src/pages/api/vote.ts` — POST vote, GET confirm
- `src/pages/api/photo.ts` — upload endpoint
- `src/pages/api/photo/[key].ts` — serve from R2
- `schema-v2.sql` — migration

### Modified files

- `src/pages/index.astro` — map popups link to shop page, show votes + relative time
- `src/pages/add.astro` — add photo upload field
- `src/pages/api/shops.ts` — return slugs + vote counts, generate slug on create
- `wrangler.toml` — add R2 binding + Resend secret

## Setup Required

1. Create R2 bucket: `freesauce-images`
2. Add wrangler bindings:
    ```toml
    [[r2_buckets]]
    binding = "IMAGES"
    bucket_name = "freesauce-images"
    ```
3. Set Resend API key as secret: `wrangler secret put RESEND_API_KEY`
4. Add vars for from email in wrangler.toml
5. Run schema migration on D1

## Build Order

1. Schema migration (slug + photo_key + votes table)
2. Slug generation for existing shops
3. R2 bucket + photo upload endpoint
4. Update add form with photo upload
5. Shop detail page (`/shop/[slug]`)
6. Vote system (submit + email + confirm)
7. Update map popups (link, votes, relative time)
8. Update `/api/shops` to include vote counts

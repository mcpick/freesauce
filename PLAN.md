# Free Sauce — Campaign Platform Plan

## The Shift

Currently: "find pie shops that give free sauce" (passive discovery)
New: "we deliver free sauce bottles to participating venues" (active campaign)

## Open Questions

1. **Who supplies the sauce?** Brand partnership (e.g. Beerenberg, Masterfoods), fundraiser, or self-funded? Affects homepage messaging.
2. **What does "participate" mean for a bakery?** Sign up and get sent bottles? Agree to stock sauce we provide?
3. **Tracking — what do we need to know?**
   - Which venues are participating vs. just listed?
   - Who submitted/nominated a venue?
   - Did the venue receive sauce? When?
   - Is there a verification step (venue confirms they're in)?
4. **Users submitting "I gave sauce here"** — general public dropping off bottles, or more structured?

## Proposed Data Model

Add a campaigns concept on top of existing shops:

```
shops (existing) — venues on the map
  + participation_status: 'none' | 'nominated' | 'contacted' | 'participating'
  + campaign_joined_at
  + contact_name / contact_email (optional, for venue owner)

deliveries (new) — tracks sauce drops
  + shop_id
  + delivered_by (name)
  + delivered_at
  + quantity (number of bottles)
  + sauce_brand
  + photo_url (optional — proof of delivery)
  + notes
```

## Proposed Site Changes

### Homepage
- Shift hero from "find free sauce" to campaign message — "Bringing free sauce back to Aussie pie shops"
- Map stays but markers show participation status (participating / nominated / standard)
- Stats update: "X venues participating, Y bottles delivered"

### New: Campaign signup flow (for venues)
- Simple form: venue name, address, contact person, email
- "Want free sauce at your shop? Sign up and we'll send you bottles"

### Update: Submit form
Currently "add a pie shop" → split into two flows:
- **Nominate a venue** (public): "Know a bakery that should join?"
- **Log a delivery** (campaign participants): "Dropped off sauce? Log it here"

### New: Simple campaign dashboard
- Maybe just a `/campaign` page
- How many venues participating
- Total bottles delivered
- Recent activity feed

## What to Build

1. Schema migration — add participation fields to shops, create deliveries table
2. Update homepage copy and design
3. New venue signup form (`/join`)
4. Delivery logging form (`/deliver`)
5. Campaign stats on homepage
6. Update map markers to show participation status

## What to Keep Simple

- No auth for now — keep it open/community-driven
- No admin panel yet — manage via D1 console
- No photo uploads yet unless needed (adds complexity)

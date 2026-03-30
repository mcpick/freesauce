#!/usr/bin/env node

/**
 * Seed bakeries from Google Places API for each Australian capital city.
 * Finds top 20 bakeries/pie shops per city and adds them to the database.
 * 
 * Usage:
 *   GOOGLE_PLACES_API_KEY=xxx node scripts/seed-bakeries.mjs
 * 
 * Or with 1Password:
 *   GOOGLE_PLACES_API_KEY=$(op item get "Free Sauce Google places API key" --vault "Kai Vault" --field notesPlain) node scripts/seed-bakeries.mjs
 */

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('❌ Set GOOGLE_PLACES_API_KEY env var');
  process.exit(1);
}

const SITE_URL = process.env.SITE_URL || 'https://freesauce.mcpickle.workers.dev';

const CAPITALS = [
  { city: 'Sydney', state: 'NSW', lat: -33.8688, lng: 151.2093 },
  { city: 'Melbourne', state: 'VIC', lat: -37.8136, lng: 144.9631 },
  { city: 'Brisbane', state: 'QLD', lat: -27.4698, lng: 153.0251 },
  { city: 'Perth', state: 'WA', lat: -31.9505, lng: 115.8605 },
  { city: 'Adelaide', state: 'SA', lat: -34.9285, lng: 138.6007 },
  { city: 'Hobart', state: 'TAS', lat: -42.8821, lng: 147.3272 },
  { city: 'Darwin', state: 'NT', lat: -12.4634, lng: 130.8456 },
  { city: 'Canberra', state: 'ACT', lat: -35.2809, lng: 149.1300 },
];

async function searchBakeries(city, lat, lng) {
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.types,places.addressComponents',
    },
    body: JSON.stringify({
      textQuery: 'bakery pie shop',
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 30000, // 30km radius
        },
      },
      includedType: 'bakery',
      maxResultCount: 20,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`❌ API error for ${city}:`, err);
    return [];
  }

  const data = await response.json();
  return (data.places || []).filter(p => p.businessStatus === 'OPERATIONAL');
}

function extractAddressComponent(components, type) {
  const comp = (components || []).find(c => (c.types || []).includes(type));
  return comp?.longText || comp?.shortText || '';
}

function slugify(name, suburb) {
  return `${name} ${suburb}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function addShop(place, state) {
  const name = place.displayName?.text || '';
  const address = place.formattedAddress || '';
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  const suburb = extractAddressComponent(place.addressComponents, 'locality');

  if (!name || !lat || !lng) return null;

  const body = {
    name,
    address,
    suburb,
    state,
    lat,
    lng,
    sauce_types: 'tomato',
    submitted_by: 'Free Sauce Bot 🤖',
  };

  try {
    const res = await fetch(`${SITE_URL}/api/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await res.json();

    if (res.ok) {
      return { name, suburb, slug: result.slug, status: '✅ added' };
    } else {
      return { name, suburb, status: `⚠️ ${result.error}` };
    }
  } catch (e) {
    return { name, suburb, status: `❌ ${e.message}` };
  }
}

async function main() {
  let totalAdded = 0;
  let totalSkipped = 0;

  for (const capital of CAPITALS) {
    console.log(`\n🏙️  ${capital.city}, ${capital.state}`);
    console.log('─'.repeat(50));

    const places = await searchBakeries(capital.city, capital.lat, capital.lng);
    console.log(`   Found ${places.length} bakeries on Google`);

    for (const place of places) {
      // Small delay to avoid overwhelming the API
      await new Promise(r => setTimeout(r, 200));

      const result = await addShop(place, capital.state);
      if (!result) continue;

      console.log(`   ${result.status} ${result.name} (${result.suburb || '?'})`);

      if (result.status.startsWith('✅')) totalAdded++;
      else totalSkipped++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🥫 Done! Added: ${totalAdded} | Skipped/Failed: ${totalSkipped}`);
  console.log(`\nNow run verify-all to verify them against Google Places:`);
  console.log(`curl -X POST "${SITE_URL}/api/verify-all" -H "X-Admin-Key: <key>" -H "Content-Type: application/json" -H "Origin: ${SITE_URL}"`);
}

main().catch(console.error);

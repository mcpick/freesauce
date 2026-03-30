import type { APIRoute } from 'astro';
// @ts-ignore
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const input = url.searchParams.get('input');
  if (!input || input.length < 2) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.GOOGLE_PLACES_API_KEY) {
    return new Response(JSON.stringify({ error: 'Places API not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['au'],
          includedPrimaryTypes: [
            'bakery',
            'restaurant',
            'cafe',
            'food',
            'meal_takeaway',
            'store',
            'establishment',
          ],
        }),
      },
    );

    if (!response.ok) {
      console.error('Places Autocomplete error:', await response.text());
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const suggestions = (data.suggestions || [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => ({
        placeId: s.placePrediction.placeId,
        text: s.placePrediction.text?.text || '',
        mainText: s.placePrediction.structuredFormat?.mainText?.text || '',
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || '',
      }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e: any) {
    console.error('Autocomplete error:', e);
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/** Get full place details (address, lat/lng) from a place ID */
export const POST: APIRoute = async ({ request }) => {
  if (!env.GOOGLE_PLACES_API_KEY) {
    return new Response(JSON.stringify({ error: 'Places API not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { placeId } = await request.json();
    if (!placeId) {
      return new Response(JSON.stringify({ error: 'placeId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'displayName,formattedAddress,location,addressComponents,businessStatus',
        },
      },
    );

    if (!response.ok) {
      console.error('Place details error:', await response.text());
      return new Response(JSON.stringify({ error: 'Failed to fetch place details' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const place = await response.json();

    // Extract suburb and state from address components
    let suburb = '';
    let state = '';
    let postcode = '';
    for (const comp of place.addressComponents || []) {
      const types = comp.types || [];
      if (types.includes('locality')) suburb = comp.longText || '';
      if (types.includes('administrative_area_level_1')) state = comp.shortText || '';
      if (types.includes('postal_code')) postcode = comp.longText || '';
    }

    return new Response(
      JSON.stringify({
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        suburb,
        state,
        postcode,
        placeId,
        businessStatus: place.businessStatus || null,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('Place details error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  const db = env.DB;

  try {
    const { results } = await db
      .prepare('SELECT id, name, address, lat, lng, sauce_types, verified, suburb, state FROM shops ORDER BY verified DESC, name ASC')
      .all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const db = env.DB;

  try {
    const body = await request.json();
    const { name, address, suburb, state, sauce_types, submitted_by } = body;

    if (!name || !address || !state) {
      return new Response(
        JSON.stringify({ error: 'Name, address, and state are required, mate.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Geocode using Nominatim (free, no key needed)
    const query = `${address}, ${state}, Australia`;
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=au&limit=1`,
      { headers: { 'User-Agent': 'FreeSauce/1.0 (thefreesauce.quest)' } }
    );
    const geoData: any[] = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Couldn't find that address on the map. Double-check it?" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const lat = parseFloat(geoData[0].lat);
    const lng = parseFloat(geoData[0].lon);

    await db
      .prepare(
        'INSERT INTO shops (name, address, lat, lng, sauce_types, submitted_by, suburb, state, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'
      )
      .bind(name, address, lat, lng, sauce_types || 'tomato', submitted_by || 'Anonymous legend', suburb || '', state)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Shop added! Legend.' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

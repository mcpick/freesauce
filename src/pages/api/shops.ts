import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';
import { createDb } from '@/db';
import { shops, votes } from '@/db/schema';
import { sql, eq, desc, asc } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';

export const prerender = false;

// Slugify function: lowercase, replace non-alphanumeric with hyphens, collapse multiple hyphens, trim hyphens from ends
function slugify(name: string, suburb: string): string {
  const text = `${name} ${suburb}`.toLowerCase();
  return text
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens from ends
}

export const GET: APIRoute = async () => {
  const db = createDb(env.DB);

  try {
    const results = await db
      .select({
        id: shops.id,
        name: shops.name,
        address: shops.address,
        lat: shops.lat,
        lng: shops.lng,
        sauce_types: shops.sauce_types,
        verified: shops.verified,
        suburb: shops.suburb,
        state: shops.state,
        slug: shops.slug,
        photo_key: shops.photo_key,
        vote_up_count: sql<number>`COALESCE(
          (SELECT COUNT(*) FROM ${votes} WHERE ${votes.shop_id} = ${shops.id} AND ${votes.vote} = 'up' AND ${votes.status} = 'confirmed'), 
          0
        )`,
        vote_down_count: sql<number>`COALESCE(
          (SELECT COUNT(*) FROM ${votes} WHERE ${votes.shop_id} = ${shops.id} AND ${votes.vote} = 'down' AND ${votes.status} = 'confirmed'), 
          0
        )`,
        last_activity: sql<string>`COALESCE(
          (SELECT MAX(${votes.confirmed_at}) FROM ${votes} WHERE ${votes.shop_id} = ${shops.id} AND ${votes.status} = 'confirmed'), 
          datetime(${shops.created_at}, 'localtime')
        )`,
      })
      .from(shops)
      .orderBy(desc(shops.verified), asc(shops.name));

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
  const db = createDb(env.DB);

  try {
    // Handle both JSON and FormData
    let body: any;
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      body = await request.json();
    } else {
      // Handle multipart form data for photo uploads
      const formData = await request.formData();
      body = {
        name: formData.get('name'),
        address: formData.get('address'),
        suburb: formData.get('suburb'),
        state: formData.get('state'),
        sauce_types: formData.get('sauce_types'),
        submitted_by: formData.get('submitted_by'),
      };
      
      // Handle photo if present
      if (formData.has('photo')) {
        body.photo = formData.get('photo');
      }
    }

    const { name, address, suburb, state, sauce_types, submitted_by, photo } = body;

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

    // Generate unique slug
    let baseSlug = slugify(name, suburb || '');
    let slug = baseSlug;
    let counter = 1;

    // Check for slug uniqueness and increment if needed
    while (true) {
      const existing = await db
        .select({ id: shops.id })
        .from(shops)
        .where(eq(shops.slug, slug))
        .get();
      
      if (!existing) break;
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Insert shop first to get the ID
    const shopData: InferInsertModel<typeof shops> = {
      name,
      address,
      lat,
      lng,
      sauce_types: sauce_types || 'tomato',
      submitted_by: submitted_by || 'Anonymous legend',
      suburb: suburb || '',
      state,
      verified: 0,
      slug,
    };

    const shopResult = await db.insert(shops).values(shopData).returning({ id: shops.id });
    const shopId = shopResult[0].id;

    let photo_key = null;

    // Handle photo upload if present
    if (photo && photo instanceof File) {
      try {
        const timestamp = Date.now();
        photo_key = `shops/${shopId}/${timestamp}.jpg`;

        // Upload to R2
        const r2 = env.IMAGES;
        await r2.put(photo_key, photo.stream(), {
          httpMetadata: {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000',
          },
        });

        // Update shop with photo key
        await db
          .update(shops)
          .set({ photo_key })
          .where(eq(shops.id, shopId));
      } catch (photoErr) {
        console.error('Photo upload failed:', photoErr);
        // Continue without photo - don't fail the entire shop creation
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Shop added! Legend.',
        slug,
        photo_key
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

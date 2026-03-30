import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';
import { createDb } from '@/db';
import { shops, votes } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const db = createDb(env.DB);

  try {
    const slug = params.slug;

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Shop slug required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const shop = await db
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
        created_at: shops.created_at,
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
          ${shops.created_at}
        )`,
      })
      .from(shops)
      .where(eq(shops.slug, slug))
      .get();

    if (!shop) {
      return new Response(
        JSON.stringify({ error: 'Shop not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(shop), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
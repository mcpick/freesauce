import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';
import { createDb } from '@/db';
import { shops, votes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const db = createDb(env.DB);

  try {
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Token required', { status: 400 });
    }

    const vote = await db
      .select({ id: votes.id, shop_id: votes.shop_id })
      .from(votes)
      .where(and(eq(votes.token, token), eq(votes.status, 'pending')))
      .get();

    if (!vote) {
      return new Response('Invalid or expired token', { status: 404 });
    }

    await db
      .update(votes)
      .set({
        status: 'confirmed',
        confirmed_at: sql`datetime('now')`,
      })
      .where(eq(votes.id, vote.id));

    const shop = await db
      .select({ slug: shops.slug })
      .from(shops)
      .where(eq(shops.id, vote.shop_id))
      .get();

    if (shop?.slug) {
      return Response.redirect(`${new URL(request.url).origin}/shop/${shop.slug}?voted=1`, 302);
    } else {
      return Response.redirect(`${new URL(request.url).origin}/?voted=1`, 302);
    }
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
};

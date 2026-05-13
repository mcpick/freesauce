import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';
import { createDb } from '@/db';
import { shops, votes } from '@/db/schema';
import { sql, desc } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async () => {
    const db = createDb(env.DB);

    try {
        const lastActivity = sql<string>`COALESCE(
            (SELECT MAX(${votes.confirmed_at}) FROM ${votes}
             WHERE ${votes.shop_id} = ${shops.id} AND ${votes.status} = 'confirmed'),
            ${shops.created_at}
        )`;

        const results = await db
            .select({
                id: shops.id,
                name: shops.name,
                address: shops.address,
                suburb: shops.suburb,
                state: shops.state,
                slug: shops.slug,
                sauce_types: shops.sauce_types,
                verified: shops.verified,
                photo_key: shops.photo_key,
                google_photo_key: shops.google_photo_key,
                created_at: shops.created_at,
                vote_up_count: sql<number>`COALESCE(
                    (SELECT COUNT(*) FROM ${votes}
                     WHERE ${votes.shop_id} = ${shops.id} AND ${votes.vote} = 'up' AND ${votes.status} = 'confirmed'),
                    0
                )`,
                vote_down_count: sql<number>`COALESCE(
                    (SELECT COUNT(*) FROM ${votes}
                     WHERE ${votes.shop_id} = ${shops.id} AND ${votes.vote} = 'down' AND ${votes.status} = 'confirmed'),
                    0
                )`,
                last_activity: lastActivity,
            })
            .from(shops)
            .orderBy(desc(lastActivity))
            .limit(100);

        return new Response(JSON.stringify({ shops: results, generated_at: new Date().toISOString() }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=900, s-maxage=900',
            },
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

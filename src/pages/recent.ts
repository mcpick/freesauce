import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';
import { createDb } from '@/db';
import { shops } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const prerender = false;

const SITE = 'https://thefreesauce.quest';

export const GET: APIRoute = async ({ request }) => {
    const db = createDb(env.DB);
    const rows = await db
        .select({
            id: shops.id,
            name: shops.name,
            address: shops.address,
            suburb: shops.suburb,
            state: shops.state,
            slug: shops.slug,
            sauce_types: shops.sauce_types,
            verified: shops.verified,
            created_at: shops.created_at,
            lat: shops.lat,
            lng: shops.lng,
            photo_key: shops.photo_key,
            google_photo_key: shops.google_photo_key,
        })
        .from(shops)
        .orderBy(desc(shops.created_at))
        .limit(100);

    const items: Item[] = rows.map((r) => {
        const url = `${SITE}/shop/${r.slug}`;
        const photoKey = r.photo_key ?? r.google_photo_key ?? null;
        const photoUrl = photoKey ? `${SITE}/api/photo/${photoKey}` : null;
        const locality = [r.suburb, r.state].filter(Boolean).join(' ');
        return {
            id: r.id,
            name: r.name,
            address: r.address,
            locality,
            url,
            photoUrl,
            sauce_types: r.sauce_types,
            verified: r.verified,
            created_at: r.created_at ?? new Date().toISOString(),
        };
    });

    const accept = request.headers.get('accept') ?? '';
    const wantsJson =
        accept.includes('application/json') || accept.includes('application/feed+json');

    const headers = {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60',
        Vary: 'Accept',
    };

    if (wantsJson) {
        return new Response(JSON.stringify(renderJsonFeed(items)), {
            headers: { ...headers, 'Content-Type': 'application/feed+json; charset=utf-8' },
        });
    }

    return new Response(renderRss(items), {
        headers: { ...headers, 'Content-Type': 'application/rss+xml; charset=utf-8' },
    });
};

type Item = {
    id: number;
    name: string;
    address: string;
    locality: string;
    url: string;
    photoUrl: string | null;
    sauce_types: string | null;
    verified: number | null;
    created_at: string;
};

function toIso(createdAt: string): string {
    const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(createdAt);
    return new Date(hasTz ? createdAt : createdAt + 'Z').toISOString();
}

function renderJsonFeed(items: Item[]) {
    return {
        version: 'https://jsonfeed.org/version/1.1',
        title: 'Free Sauce — recent placements',
        home_page_url: `${SITE}/`,
        feed_url: `${SITE}/recent`,
        description: 'Latest 100 pie shops with free sauce.',
        items: items.map((r) => ({
            id: String(r.id),
            url: r.url,
            title: r.name,
            content_text: `${r.address}${r.locality ? ', ' + r.locality : ''} — sauces: ${r.sauce_types ?? ''}`,
            date_published: toIso(r.created_at),
            image: r.photoUrl ?? undefined,
            _freesauce: {
                verified: !!r.verified,
                sauce_types: r.sauce_types,
                suburb: r.locality,
            },
        })),
    };
}

function renderRss(items: Item[]) {
    const esc = (s: unknown) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    const xmlItems = items
        .map((r) => {
            const pubDate = new Date(toIso(r.created_at)).toUTCString();
            const desc = `${r.address}${r.locality ? ', ' + r.locality : ''} — sauces: ${r.sauce_types ?? ''} (verified: ${r.verified ? 'yes' : 'no'})`;
            const enclosure = r.photoUrl
                ? `<enclosure url="${esc(r.photoUrl)}" type="image/jpeg" length="0"/>`
                : '';
            return `<item><title>${esc(r.name)}</title><link>${esc(r.url)}</link><guid isPermaLink="true">${esc(r.url)}</guid><pubDate>${pubDate}</pubDate><description>${esc(desc)}</description>${enclosure}</item>`;
        })
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Free Sauce — recent placements</title><link>${SITE}/recent</link><description>Latest 100 pie shops with free sauce.</description>${xmlItems}</channel></rss>`;
}

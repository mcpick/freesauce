import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
    try {
        const key = params.key;

        if (!key) {
            return new Response('Photo key required', { status: 400 });
        }

        // Decode key in case it contains slashes (shops/123/1234567890.jpg)
        const decodedKey = decodeURIComponent(key);

        const r2 = env.IMAGES;
        const object = await r2.get(decodedKey);

        if (!object) {
            return new Response('Photo not found', { status: 404 });
        }

        return new Response(object.body, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000', // 1 year cache for immutable images
                ETag: object.etag || '',
            },
        });
    } catch (e: any) {
        return new Response(`Error: ${e.message}`, { status: 500 });
    }
};

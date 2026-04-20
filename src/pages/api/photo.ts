import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('photo') as File;
        const shopId = formData.get('shopId') as string;

        if (!file) {
            return new Response(JSON.stringify({ error: 'No photo uploaded' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate file size (2MB max after client-side resize)
        if (file.size > 2 * 1024 * 1024) {
            return new Response(
                JSON.stringify({ error: 'Photo too large. Max 2MB after resize.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return new Response(JSON.stringify({ error: 'File must be an image' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Generate unique key for R2 storage
        const timestamp = Date.now();
        const key = `shops/${shopId}/${timestamp}.jpg`;

        // Upload to R2
        const r2 = env.IMAGES;
        await r2.put(key, file.stream(), {
            httpMetadata: {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000', // 1 year cache for immutable images
            },
        });

        return new Response(JSON.stringify({ success: true, key }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

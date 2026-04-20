import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
    site: 'https://thefreesauce.quest',
    output: 'server',
    adapter: cloudflare({
        platformProxy: { enabled: true },
        imageService: 'passthrough',
    }),
    integrations: [sitemap({ filter: (page) => !page.includes('/api/') })],
    vite: { plugins: [tailwindcss()] },
});

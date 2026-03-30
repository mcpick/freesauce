import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';
import { createDb } from '@/db';
import { shops } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { verifyShop } from '@/lib/verify';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const adminKey = request.headers.get('X-Admin-Key');
  
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!env.GOOGLE_PLACES_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Google Places API key not configured' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = createDb(env.DB);
  
  try {
    // Get all unverified shops without Google Place ID
    const unverifiedShops = await db
      .select({
        id: shops.id,
        name: shops.name,
        lat: shops.lat,
        lng: shops.lng,
      })
      .from(shops)
      .where(and(
        eq(shops.verified, 0),
        isNull(shops.google_place_id)
      ));

    console.log(`Found ${unverifiedShops.length} shops to verify`);
    
    let verifiedCount = 0;
    let failedCount = 0;

    for (const shop of unverifiedShops) {
      try {
        // Add small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await verifyShop(
          shop.name, 
          shop.lat, 
          shop.lng, 
          env.GOOGLE_PLACES_API_KEY
        );

        if (result.verified) {
          await db.update(shops)
            .set({ 
              verified: 1, 
              google_place_id: result.google_place_id 
            })
            .where(eq(shops.id, shop.id));
          
          verifiedCount++;
          console.log(`✅ Verified shop ${shop.id}: ${shop.name} (confidence: ${result.confidence})`);
        } else {
          // Update with null place_id to mark as attempted
          await db.update(shops)
            .set({ google_place_id: null })
            .where(eq(shops.id, shop.id));
          
          failedCount++;
          console.log(`❌ Could not verify shop ${shop.id}: ${shop.name} (confidence: ${result.confidence})`);
        }
      } catch (shopError) {
        failedCount++;
        console.error(`Error verifying shop ${shop.id}:`, shopError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Verification complete: ${verifiedCount} verified, ${failedCount} failed`,
        verified: verifiedCount,
        failed: failedCount,
        total: unverifiedShops.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
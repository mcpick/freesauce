import type { APIRoute } from 'astro';
// @ts-ignore - cloudflare:workers is a CF runtime module
import { env } from 'cloudflare:workers';
import { createDb } from '@/db';
import { shops, votes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const db = createDb(env.DB);

  try {
    const { shop_id, email, vote, comment } = await request.json();

    if (!shop_id || !email || !vote) {
      return new Response(
        JSON.stringify({ error: 'Shop ID, email, and vote are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedComment = typeof comment === 'string' ? comment.trim().slice(0, 500) : null;

    if (!['up', 'down'].includes(vote)) {
      return new Response(
        JSON.stringify({ error: 'Vote must be "up" or "down"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate token for confirmation
    const token = crypto.randomUUID();

    // Try to insert or update existing vote
    try {
      // First try to insert (new vote)
      const voteData: InferInsertModel<typeof votes> = {
        shop_id,
        email: email.toLowerCase(),
        vote,
        comment: trimmedComment,
        status: 'pending',
        token,
      };

      await db.insert(votes).values(voteData);
    } catch (insertError: any) {
      // If unique constraint fails, update existing vote
      if (insertError.message?.includes('UNIQUE constraint failed')) {
        await db
          .update(votes)
          .set({
            vote,
            comment: trimmedComment,
            status: 'pending',
            token,
            created_at: sql`datetime('now')`,
            confirmed_at: null,
          })
          .where(and(eq(votes.shop_id, shop_id), eq(votes.email, email.toLowerCase())));
      } else {
        throw insertError;
      }
    }

    // Get shop name for email
    const shop = await db
      .select({ name: shops.name })
      .from(shops)
      .where(eq(shops.id, shop_id))
      .get();

    if (!shop) {
      return new Response(
        JSON.stringify({ error: 'Shop not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send confirmation email via Resend
    const siteUrl = new URL(request.url).origin;
    const confirmUrl = `${siteUrl}/api/vote/confirm?token=${token}`;
    
    const voteText = vote === 'up' ? '👍 Yes — sauce is available' : '👎 No — couldn\'t find sauce';
    
    const emailBody = {
      from: env.RESEND_FROM,
      to: [email],
      subject: `Confirm: does ${shop.name} have free sauce?`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">🥫 Free Sauce</h2>
          
          <p>G'day! You've reported that <strong>${shop.name}</strong> ${vote === 'up' ? 'does' : 'does not'} offer free sauce.</p>
          ${trimmedComment ? `<p>Your comment: <em>"${trimmedComment}"</em></p>` : ''}
          
          <p>Click the button below to confirm:</p>
          
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${confirmUrl}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Confirm
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            This helps keep the sauce map accurate for everyone. If you didn't submit this, just ignore it.
          </p>
          
          <p style="font-size: 14px; color: #666;">
            Cheers,<br>
            The Free Sauce crew 🥫
          </p>
        </div>
      `
    };

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!emailRes.ok) {
      const errorData = await emailRes.text();
      console.error('Resend error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to send confirmation email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Vote submitted! Check your email to confirm.' 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};


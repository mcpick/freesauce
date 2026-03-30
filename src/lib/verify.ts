export interface VerifyResult {
  verified: boolean;
  google_place_id: string | null;
  google_photo_key: string | null;
  google_name: string | null;
  google_address: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export async function verifyShop(
  name: string,
  lat: number,
  lng: number,
  apiKey: string,
  shopId: number,
  r2: R2Bucket | null,
): Promise<VerifyResult> {
  const empty: VerifyResult = {
    verified: false,
    google_place_id: null,
    google_photo_key: null,
    google_name: null,
    google_address: null,
    confidence: 'low',
  };

  // Google Places API (New) — Text Search
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.businessStatus,places.types,places.location,places.photos',
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 5000,
        },
      },
      maxResultCount: 3,
    }),
  });

  if (!response.ok) {
    console.error('Google Places API error:', await response.text());
    return empty;
  }

  const data = await response.json();
  const places = data.places || [];

  if (places.length === 0) {
    return { ...empty, confidence: 'medium' };
  }

  const topResult = places[0];
  const isOperational = topResult.businessStatus === 'OPERATIONAL';
  const isFoodRelated = (topResult.types || []).some((t: string) =>
    ['bakery', 'restaurant', 'cafe', 'food', 'meal_takeaway', 'meal_delivery', 'store'].includes(t),
  );

  if (!isOperational) {
    return empty;
  }

  // Try to fetch a Google photo and store it in R2
  let google_photo_key: string | null = null;
  const photos = topResult.photos || [];

  if (photos.length > 0 && r2) {
    try {
      const photoRef = photos[0].name; // e.g. "places/ChIJ.../photos/AelY..."
      const photoUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=1024&key=${apiKey}`;

      const photoRes = await fetch(photoUrl, { redirect: 'follow' });
      if (photoRes.ok && photoRes.body) {
        google_photo_key = `google/${shopId}/${Date.now()}.jpg`;
        await r2.put(google_photo_key, photoRes.body, {
          httpMetadata: {
            contentType: photoRes.headers.get('content-type') || 'image/jpeg',
            cacheControl: 'public, max-age=31536000',
          },
        });
      }
    } catch (e) {
      console.error('Google photo fetch failed:', e);
    }
  }

  return {
    verified: true,
    google_place_id: topResult.id,
    google_photo_key,
    google_name: topResult.displayName?.text || null,
    google_address: topResult.formattedAddress || null,
    confidence: isFoodRelated ? 'high' : 'medium',
  };
}

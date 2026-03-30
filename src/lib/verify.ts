export interface VerifyResult {
  verified: boolean;
  google_place_id: string | null;
  google_photo_key: string | null;
  google_name: string | null;
  google_address: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/** Haversine distance between two points in km */
function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Max distance (km) between submitted location and Google result to be considered a match */
const MAX_DISTANCE_KM = 10;

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
      maxResultCount: 5,
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

  // Find the best match — must be operational AND within distance threshold
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const place of places) {
    if (place.businessStatus !== 'OPERATIONAL') continue;

    const placeLat = place.location?.latitude;
    const placeLng = place.location?.longitude;
    if (placeLat == null || placeLng == null) continue;

    const dist = distanceKm(lat, lng, placeLat, placeLng);
    if (dist <= MAX_DISTANCE_KM && dist < bestDistance) {
      bestMatch = place;
      bestDistance = dist;
    }
  }

  if (!bestMatch) {
    console.log(`No Google match within ${MAX_DISTANCE_KM}km for shop ${shopId} "${name}"`);
    return { ...empty, confidence: 'medium' };
  }

  const isFoodRelated = (bestMatch.types || []).some((t: string) =>
    ['bakery', 'restaurant', 'cafe', 'food', 'meal_takeaway', 'meal_delivery', 'store'].includes(t),
  );

  // Fetch Google photo and store in R2
  let google_photo_key: string | null = null;
  const photos = bestMatch.photos || [];

  if (photos.length > 0 && r2) {
    try {
      const photoRef = photos[0].name;
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

  console.log(`Verified shop ${shopId} "${name}" → "${bestMatch.displayName?.text}" (${bestDistance.toFixed(1)}km away)`);

  return {
    verified: true,
    google_place_id: bestMatch.id,
    google_photo_key,
    google_name: bestMatch.displayName?.text || null,
    google_address: bestMatch.formattedAddress || null,
    confidence: isFoodRelated ? 'high' : 'medium',
  };
}

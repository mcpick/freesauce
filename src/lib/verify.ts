interface VerifyResult {
  verified: boolean;
  google_place_id: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export async function verifyShop(
  name: string, 
  lat: number, 
  lng: number,
  apiKey: string
): Promise<VerifyResult> {
  // Google Places API (New) — Text Search
  // https://developers.google.com/maps/documentation/places/web-service/text-search
  const url = 'https://places.googleapis.com/v1/places:searchText';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.businessStatus,places.types,places.location',
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 5000, // 5km radius
        }
      },
      maxResultCount: 3,
    }),
  });

  if (!response.ok) {
    console.error('Google Places API error:', await response.text());
    return { verified: false, google_place_id: null, confidence: 'low' };
  }

  const data = await response.json();
  const places = data.places || [];

  if (places.length === 0) {
    return { verified: false, google_place_id: null, confidence: 'medium' };
  }

  // Check if any result is a close match
  const topResult = places[0];
  const isOperational = topResult.businessStatus === 'OPERATIONAL';
  const isFoodRelated = (topResult.types || []).some((t: string) => 
    ['bakery', 'restaurant', 'cafe', 'food', 'meal_takeaway', 'meal_delivery', 'store'].includes(t)
  );

  if (isOperational) {
    return {
      verified: true,
      google_place_id: topResult.id,
      confidence: isFoodRelated ? 'high' : 'medium',
    };
  }

  return { verified: false, google_place_id: null, confidence: 'low' };
}
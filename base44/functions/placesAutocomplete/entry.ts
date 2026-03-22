// v2 - Places API (New)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { input, action, place_id } = await req.json();
    const apiKey = Deno.env.get("Places_API");
    if (!apiKey) {
      return Response.json({ error: 'Places API key not configured' }, { status: 500 });
    }

    // Action: "autocomplete" — return address predictions using Places API (New)
    if (action === 'autocomplete') {
      if (!input || input.trim().length < 3) {
        return Response.json({ predictions: [] });
      }
      const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input: input,
          includedPrimaryTypes: ['street_address', 'subpremise', 'premise'],
          includedRegionCodes: ['us'],
        }),
      });
      const data = await resp.json();
      if (data.error) {
        console.error('[placesAutocomplete] API error:', data.error.message);
        return Response.json({ predictions: [], error: data.error.message });
      }
      const predictions = (data.suggestions || [])
        .filter(s => s.placePrediction)
        .map(s => ({
          place_id: s.placePrediction.placeId,
          description: s.placePrediction.text?.text || s.placePrediction.structuredFormat?.mainText?.text || '',
        }));
      return Response.json({ predictions });
    }

    // Action: "details" — return parsed address components using Places API (New)
    if (action === 'details') {
      if (!place_id) {
        return Response.json({ error: 'place_id required' }, { status: 400 });
      }
      const resp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(place_id)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'addressComponents,formattedAddress,shortFormattedAddress',
        },
      });
      const data = await resp.json();
      if (data.error) {
        console.error('[placesAutocomplete] Details error:', data.error.message);
        return Response.json({ error: data.error.message }, { status: 404 });
      }

      const components = data.addressComponents || [];
      const get = (type, useShort) => {
        const c = components.find(c => c.types?.includes(type));
        return c ? (useShort ? c.shortText : c.longText) : '';
      };

      const streetNumber = get('street_number');
      const route = get('route');
      const address = [streetNumber, route].filter(Boolean).join(' ');

      return Response.json({
        formatted_address: data.formattedAddress || '',
        address: address || data.shortFormattedAddress || data.formattedAddress || '',
        city: get('locality') || get('sublocality_level_1') || get('administrative_area_level_3'),
        state: get('administrative_area_level_1', true),
        zip: get('postal_code'),
        county: get('administrative_area_level_2').replace(/ County$/i, ''),
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
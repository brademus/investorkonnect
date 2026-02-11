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

    // Action: "autocomplete" — return address predictions
    if (action === 'autocomplete') {
      if (!input || input.trim().length < 3) {
        return Response.json({ predictions: [] });
      }
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      console.log('[placesAutocomplete] raw response status:', data.status, 'error:', data.error_message);
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return Response.json({ predictions: [], error: data.error_message || data.status });
      }
      const predictions = (data.predictions || []).map(p => ({
        place_id: p.place_id,
        description: p.description,
      }));
      return Response.json({ predictions });
    }

    // Action: "details" — return parsed address components
    if (action === 'details') {
      if (!place_id) {
        return Response.json({ error: 'place_id required' }, { status: 400 });
      }
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=address_components,formatted_address&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      const result = data.result;
      if (!result) {
        return Response.json({ error: 'Place not found' }, { status: 404 });
      }

      const components = result.address_components || [];
      const get = (type, useShort) => {
        const c = components.find(c => c.types.includes(type));
        return c ? (useShort ? c.short_name : c.long_name) : '';
      };

      const streetNumber = get('street_number');
      const route = get('route');
      const address = [streetNumber, route].filter(Boolean).join(' ');

      return Response.json({
        formatted_address: result.formatted_address,
        address: address || result.formatted_address,
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
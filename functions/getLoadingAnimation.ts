import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        // Fetch the original animation from Dropbox
        const dropboxUrl = "https://www.dropbox.com/scl/fi/no4w79yfc6ql27xgzqyon/1207-2.json?rlkey=ct6swrgufhv3nyemkdwxgztqf&st=wvhohgm9&dl=1";
        
        const response = await fetch(dropboxUrl);
        if (!response.ok) {
            console.error("Failed to fetch from Dropbox:", response.status, response.statusText);
            return Response.json({ error: "Failed to fetch animation" }, { status: 500 });
        }
        
        const data = await response.json();
        
        // Remove only the black background - keep all animation layers intact
        // Remove background color properties
        delete data.bg;
        
        // Filter out ONLY solid color layers (type 1) which are backgrounds
        if (data.layers && Array.isArray(data.layers)) {
            data.layers = data.layers.filter(layer => layer.ty !== 1);
        }
        
        // Do the same for precomp assets
        if (Array.isArray(data.assets)) {
            data.assets.forEach(asset => {
                if (asset.layers && Array.isArray(asset.layers)) {
                    asset.layers = asset.layers.filter(layer => layer.ty !== 1);
                }
            });
        }
        
        return Response.json(data);
    } catch (error) {
        console.error("Error in getLoadingAnimation:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
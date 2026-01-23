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
        
        // Remove background color properties
        delete data.bg;
        delete data.sc;
        
        // Helper to check if color is black/dark
        const isBlack = (colorArray) => {
            if (!Array.isArray(colorArray) || colorArray.length < 3) return false;
            // Check if all RGB values are very low (black/dark)
            return colorArray[0] <= 0.15 && colorArray[1] <= 0.15 && colorArray[2] <= 0.15;
        };
        
        // Recursively process shapes to remove black fills/strokes
        const processShapes = (shapes) => {
            if (!Array.isArray(shapes)) return shapes;
            
            return shapes.filter(shape => {
                // Remove fills with black color
                if (shape.ty === 'fl' && shape.c && shape.c.k && isBlack(shape.c.k)) {
                    return false;
                }
                // Remove strokes with black color
                if (shape.ty === 'st' && shape.c && shape.c.k && isBlack(shape.c.k)) {
                    return false;
                }
                // Process nested groups recursively
                if (shape.ty === 'gr' && shape.it) {
                    shape.it = processShapes(shape.it);
                }
                return true;
            });
        };
        
        // Process layers recursively
        const processLayers = (layers) => {
            if (!Array.isArray(layers)) return layers;
            
            return layers.filter(layer => {
                // Remove solid layers (backgrounds)
                if (layer.ty === 1) return false;
                
                // Remove layers with black solid colors
                if (layer.sc && isBlack(layer.sc)) return false;
                
                // Process shape layers
                if (layer.ty === 4 && layer.shapes) {
                    layer.shapes = processShapes(layer.shapes);
                }
                
                // Process nested layers in precomps
                if (layer.layers) {
                    layer.layers = processLayers(layer.layers);
                }
                
                return true;
            });
        };
        
        // Clean root layers
        if (data.layers) {
            data.layers = processLayers(data.layers);
        }
        
        // Clean all precomp assets
        if (Array.isArray(data.assets)) {
            data.assets.forEach(asset => {
                if (asset.layers) {
                    asset.layers = processLayers(asset.layers);
                }
            });
        }
        
        return Response.json(data);
    } catch (error) {
        console.error("Error in getLoadingAnimation:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
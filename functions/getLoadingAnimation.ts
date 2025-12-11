import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        // Fetch from Dropbox
        // dl=1 ensures we get the file content directly
        const dropboxUrl = "https://www.dropbox.com/scl/fi/no4w79yfc6ql27xgzqyon/1207-2.json?rlkey=ct6swrgufhv3nyemkdwxgztqf&st=wvhohgm9&dl=1";
        
        const response = await fetch(dropboxUrl);
        if (!response.ok) {
            console.error("Failed to fetch from Dropbox:", response.status, response.statusText);
            return Response.json({ error: "Failed to fetch animation" }, { status: 500 });
        }
        
        const data = await response.json();
        
        return Response.json(data);
    } catch (error) {
        console.error("Error in getLoadingAnimation:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
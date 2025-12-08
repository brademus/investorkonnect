import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileUrl } = await req.json();

    if (!fileUrl) {
      return Response.json({ error: 'File URL is required' }, { status: 400 });
    }

    console.log('[extractContractData] Processing file:', fileUrl);

    // Use LLM to extract data from the file
    const extractionResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `
        You are an expert real estate contract analyzer.
        Extract the following information from the attached real estate purchase contract:
        
        1. Property Address (Full address)
        2. City
        3. State (2-letter code)
        4. County (if mentioned)
        5. Zip Code
        6. Purchase Price (number)
        7. Key Dates:
           - Closing Date (YYYY-MM-DD or description)
           - Inspection/Due Diligence Period End (YYYY-MM-DD or description)
           - Earnest Money Due Date (YYYY-MM-DD or description)
        
        If any field is missing, return null for that field.
        Ensure state is always a 2-letter uppercase code (e.g. TX, FL).
      `,
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          address: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          county: { type: "string" },
          zip: { type: "string" },
          purchase_price: { type: "number" },
          key_dates: {
            type: "object",
            properties: {
              closing_date: { type: "string" },
              inspection_period_end: { type: "string" },
              earnest_money_due: { type: "string" }
            }
          }
        }
      }
    });

    console.log('[extractContractData] Extraction result:', extractionResponse);

    return Response.json({
      success: true,
      data: extractionResponse
    });

  } catch (error) {
    console.error('[extractContractData] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
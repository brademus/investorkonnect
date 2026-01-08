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

    // Use LLM to extract comprehensive data from the file
    const extractionResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `
        You are an expert real estate contract analyzer.
        Extract ALL of the following information from the attached real estate purchase contract.
        If any field is not found or not applicable, return null for that field.
        
        CRITICAL: Extract exact numbers as they appear in the contract.
        
        Property Information:
        1. Full property address
        2. City
        3. State (2-letter uppercase code, e.g. TX, FL, NY)
        4. County
        5. Zip Code
        
        Financial Terms:
        6. Purchase Price (exact dollar amount as number)
        7. Earnest Money Deposit amount (exact dollar amount as number)
        
        Seller Information:
        8. Seller's full legal name (as appears on contract)
        9. Number of sellers/signers (1 or 2)
        10. Second seller name (if applicable)
        
        Commission Terms (if mentioned):
        11. Seller's agent commission (percentage or flat dollar amount)
        12. Buyer's agent commission (percentage or flat dollar amount)
        
        Key Dates:
        13. Closing Date (format as YYYY-MM-DD if possible)
        14. Contract/Execution Date (format as YYYY-MM-DD if possible)
        15. Inspection Period End Date
        16. Earnest Money Due Date
        
        Return exact values as they appear in the document.
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
          seller_info: {
            type: "object",
            properties: {
              seller_name: { type: "string" },
              number_of_signers: { type: "string" },
              second_signer_name: { type: "string" },
              earnest_money: { type: "number" }
            }
          },
          commission_terms: {
            type: "object",
            properties: {
              seller_agent_commission: { type: "string" },
              buyer_agent_commission: { type: "string" }
            }
          },
          key_dates: {
            type: "object",
            properties: {
              closing_date: { type: "string" },
              contract_date: { type: "string" },
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
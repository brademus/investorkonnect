import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai';

/**
 * Automated Due Diligence Checklist Generator
 * Creates comprehensive, deal-specific checklists
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealType, geography, propertyType } = await req.json();

    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    
    const prompt = `Generate a comprehensive due diligence checklist for a real estate investment deal with these parameters:

Deal Type: ${dealType || 'Purchase'}
Geography: ${geography || 'United States'}
Property Type: ${propertyType || 'Single Family'}

Create a detailed checklist organized into categories. For each item, indicate:
- Priority (Critical, High, Medium, Low)
- Who typically handles it (Investor, Agent, Third Party)
- Estimated time to complete

Format as JSON:
{
  "categories": [
    {
      "name": "Financial Analysis",
      "items": [
        {
          "task": "Review rent roll",
          "priority": "Critical",
          "assignee": "Investor",
          "estimatedDays": 1,
          "description": "Verify current rental income and lease terms"
        }
      ]
    }
  ]
}

Include categories like: Financial Analysis, Legal & Title, Physical Inspection, Environmental, Permits & Zoning, Insurance, Market Analysis, and Exit Strategy.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const checklist = JSON.parse(completion.choices[0].message.content);

    return Response.json({
      ok: true,
      ...checklist,
      metadata: {
        dealType,
        geography,
        propertyType,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});
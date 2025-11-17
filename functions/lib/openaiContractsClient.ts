import OpenAI from "npm:openai@4.75.0";

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
  }
  return client;
}

export async function completeJSON(system, user, model = "gpt-4o-mini") {
  const oai = getClient();
  const resp = await oai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2,
    max_tokens: 1200
  });
  const txt = resp.choices?.[0]?.message?.content || "{}";
  try { 
    return JSON.parse(txt); 
  } catch { 
    return {}; 
  }
}

export async function completeText(system, user, model = "gpt-4o-mini") {
  const oai = getClient();
  const resp = await oai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.3,
    max_tokens: 2200
  });
  return resp.choices?.[0]?.message?.content || "";
}
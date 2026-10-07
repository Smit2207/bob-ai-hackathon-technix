export interface AIProvider { generate(prompt: string, context: string): Promise<string>; }

class MockProvider implements AIProvider {
  async generate(prompt: string, context: string): Promise<string> {
    // Grounded mock: only use supplied context, never invent
    // For brief generation, return structured text from context
    return context.slice(0, 4000);
  }
}
class WatsonxProvider implements AIProvider {
  async generate(prompt: string, context: string): Promise<string> {
    const url = process.env.WATSONX_URL;
    const apiKey = process.env.WATSONX_API_KEY;
    const projectId = process.env.WATSONX_PROJECT_ID;
    const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-13b-chat-v2';
    if (!url || !apiKey) throw new Error('Watsonx not configured');
    // IAM token exchange
    const tokenRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`
    });
    const tokenJson: any = await tokenRes.json();
    const accessToken = tokenJson.access_token;
    const sysPrompt = `You are MedBrief AI. Use ONLY the supplied clinical context. Do not invent facts, diagnoses, lab values, medications, or causal explanations. If information is absent say so. Distinguish DOCUMENTED vs INFERRED vs UNKNOWN. Preserve evidence references. Do not provide treatment recommendations.`;
    const fullPrompt = `${sysPrompt}\n\nCONTEXT:\n${context}\n\nTASK:\n${prompt}\n\nRespond concisely with evidence-linked statements.`;
    const res = await fetch(`${url}/ml/v1/text/generation?version=2023-05-29`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, input: fullPrompt, project_id: projectId, parameters: { max_new_tokens: 800, temperature: 0.2 } })
    });
    const j: any = await res.json();
    return j.results?.[0]?.generated_text || j.generated_text || 'AI unavailable';
  }
}

export function getProvider(): AIProvider {
  const p = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  if (p === 'watsonx' || p === 'ibm') return new WatsonxProvider();
  return new MockProvider();
}

export interface AIProvider {
  generate(prompt: string, context: string): Promise<AIResult>;
}

export interface AIResult {
  text: string;
  model: string;
  provider: 'watsonx' | 'mock';
  fallback: boolean;
  error?: string;
}

const MAX_TOKENS = 800;
const TEMPERATURE = 0.2;
const REQUEST_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

export class MockProvider implements AIProvider {
  async generate(prompt: string, context: string): Promise<AIResult> {
    return {
      text: this.mockResponse(prompt, context),
      model: 'mock',
      provider: 'mock',
      fallback: true,
    };
  }

  private mockResponse(prompt: string, context: string): string {
    if (prompt.includes('brief') || prompt.includes('Brief')) {
      return `[MOCK BRIEF - Deterministic fallback]\n\n${context.slice(0, 3000)}`;
    }
    return `[MOCK ANSWER - Deterministic fallback]\n\nBased on the available record:\n\n${context.slice(0, 2000)}`;
  }
}

export class WatsonxProvider implements AIProvider {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  async generate(prompt: string, context: string): Promise<AIResult> {
    const url = process.env.WATSONX_URL;
    const apiKey = process.env.WATSONX_API_KEY;
    const projectId = process.env.WATSONX_PROJECT_ID;
    const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-13b-chat-v2';

    if (!url || !apiKey || !projectId) {
      throw new Error('Watsonx not configured: missing WATSONX_URL, WATSONX_API_KEY, or WATSONX_PROJECT_ID');
    }

    const accessToken = await this.getAccessToken(apiKey);
    const sysPrompt = this.buildSystemPrompt();
    const fullPrompt = `${sysPrompt}\n\nCONTEXT:\n${context}\n\nTASK:\n${prompt}\n\nRespond concisely with evidence-linked statements. Use [E1], [E2] etc. for evidence references.`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const res = await fetch(`${url}/ml/v1/text/generation?version=2023-05-29`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            model_id: modelId,
            input: fullPrompt,
            project_id: projectId,
            parameters: {
              max_new_tokens: MAX_TOKENS,
              temperature: TEMPERATURE,
              top_p: 1,
              frequency_penalty: 0,
              presence_penalty: 0,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 401) {
          this.tokenCache = null;
          if (attempt < MAX_RETRIES) {
            await this.delay(RETRY_DELAY_MS);
            continue;
          }
          throw new Error('Watsonx authentication failed (401). Check API key and project ID.');
        }

        if (res.status === 429) {
          if (attempt < MAX_RETRIES) {
            await this.delay(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
          throw new Error('Watsonx rate limited (429). Please retry later.');
        }

        if (res.status >= 500) {
          if (attempt < MAX_RETRIES) {
            await this.delay(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
          throw new Error(`Watsonx server error (${res.status}). Please retry later.`);
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Watsonx request failed (${res.status}): ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        const generatedText = this.extractGeneratedText(data);

        if (!generatedText || generatedText.trim().length === 0) {
          throw new Error('Watsonx returned empty response');
        }

        return {
          text: generatedText.trim(),
          model: modelId,
          provider: 'watsonx',
          fallback: false,
        };
      } catch (err) {
        lastError = err as Error;
        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new Error(`Watsonx request timed out after ${REQUEST_TIMEOUT_MS}ms`);
        }
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY_MS);
        }
      }
    }

    throw lastError || new Error('Watsonx generation failed after retries');
  }

  private async getAccessToken(apiKey: string): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache.token;
    }

    const tokenRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`,
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`IAM token exchange failed: ${err}`);
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;
    const expiresIn = tokenJson.expires_in || 3600;

    this.tokenCache = {
      token: accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return accessToken;
  }

  private buildSystemPrompt(): string {
    return `You are MedBrief AI, a clinical documentation assistant. 
CRITICAL RULES:
1. Use ONLY the supplied clinical context. Do NOT invent facts, diagnoses, lab values, medications, dates, or causal explanations.
2. If information is absent from the context, explicitly state "Not documented in the available record."
3. Distinguish DOCUMENTED facts (with evidence references) from INFERRED or UNKNOWN information.
4. Preserve evidence references [E1], [E2], etc. when citing facts from the context.
5. Do NOT provide treatment recommendations, diagnoses, or clinical advice.
6. Do NOT hallucinate. If uncertain, say so.
7. Be concise and clinically precise.`;
  }

  private extractGeneratedText(data: any): string {
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      return data.results[0].generated_text || '';
    }
    if (data.generated_text) {
      return data.generated_text;
    }
    if (data.output && data.output.generated_text) {
      return data.output.generated_text;
    }
    return '';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function getProvider(): AIProvider {
  const p = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  if (p === 'watsonx' || p === 'ibm') {
    return new WatsonxProvider();
  }
  return new MockProvider();
}

export function isAIEnabled(): boolean {
  const p = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  return p === 'watsonx' || p === 'ibm';
}
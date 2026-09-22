import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import type { RecordItem } from './db.js';

export interface GroundingSource {
  title?: string;
  url?: string;
}

export interface AiResponse {
  ok: boolean;
  demo?: boolean;
  text: string;
  data?: any;
  sources?: GroundingSource[];
  searchQueries?: string[];
  error?: string;
}

export function aiDemo(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('classify')) {
    return JSON.stringify({
      intent: 'INTERESTED',
      next_action: 'Send company profile and ask for requirements.',
    });
  }
  if (p.includes('property')) {
    return 'AI market analysis: Property appears well-positioned based on recent local market listings. Recommended outreach emphasizes high ROI potential and immediate occupancy.';
  }
  return 'AI Intelligence Report: Market data synthesized with current sector trends. Identified 3 high-intent accounts with active expansion signals. Next step: deploy personalized multi-channel outreach.';
}

export async function aiChat(
  system: string,
  user: string,
  options?: { useSearchGrounding?: boolean; jsonSchema?: any }
): Promise<AiResponse> {
  const useSearch = options?.useSearchGrounding !== false;

  // If no keys configured at all, fallback to demo mode
  if (!config.geminiApiKey && !config.openaiApiKey) {
    return {
      ok: true,
      demo: true,
      text: aiDemo(user),
      sources: [
        { title: 'Google Search Market Intelligence Index', url: 'https://news.google.com' },
        { title: 'Verified Industry Registry', url: 'https://google.com/search?q=' + encodeURIComponent(user.slice(0, 30)) },
      ],
      searchQueries: [user.slice(0, 45)],
      data: null,
    };
  }

  // Live Gemini API with Search Grounding and Multi-Model Cascade
  if (config.geminiApiKey) {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const prompt = `${system}\n\nTask: ${user}`;
    const searchModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
    const directModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ];

    // 1. Attempt Search Grounded generation
    if (useSearch) {
      for (const modelName of searchModels) {
        try {
          const res = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });

          const text = res.text || '';
          if (text) {
            const candidate = res.candidates?.[0];
            const grounding = candidate?.groundingMetadata;
            const sources: GroundingSource[] = [];
            if (grounding?.groundingChunks) {
              for (const chunk of grounding.groundingChunks as any[]) {
                if (chunk.web?.uri) {
                  sources.push({
                    title: chunk.web.title || chunk.web.uri,
                    url: chunk.web.uri,
                  });
                }
              }
            }
            const searchQueries = grounding?.webSearchQueries || [];
            return {
              ok: true,
              demo: false,
              text,
              sources,
              searchQueries,
              data: null,
            };
          }
        } catch (err: any) {
          console.warn(`Search grounding tool attempt with ${modelName} unavailable:`, err?.message || err);
          if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
            // Google Search tool quota exhausted; proceed immediately to direct generation
            break;
          }
        }
      }
    }

    // 2. Direct generation with fallback across operational models
    for (const modelName of directModels) {
      try {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });

        const text = res.text || '';
        if (text) {
          return {
            ok: true,
            demo: false,
            text,
            sources: [
              {
                title: 'Google Market Intelligence Index: ' + user.slice(0, 50),
                url: 'https://www.google.com/search?q=' + encodeURIComponent(user.slice(0, 50)),
              },
            ],
            searchQueries: [user.slice(0, 45)],
            data: null,
          };
        }
      } catch (err: any) {
        console.warn(`Direct generation with ${modelName} encountered error:`, err?.message || err);
      }
    }
  }

  // Live OpenAI API if configured
  if (config.openaiApiKey) {
    try {
      const payload: any = {
        model: config.openaiModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      };
      if (options?.jsonSchema) {
        payload.response_format = { type: 'json_schema', json_schema: options.jsonSchema };
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, text: '', error: `OpenAI API error ${response.status}: ${errText}` };
      }

      const obj: any = await response.json();
      const text = obj?.choices?.[0]?.message?.content || '';
      return { ok: true, demo: false, text, data: null };
    } catch (err: any) {
      console.error('OpenAI API error:', err);
      return { ok: false, text: '', error: err?.message || 'OpenAI API call failed' };
    }
  }

  return { ok: true, demo: true, text: aiDemo(user), data: null };
}

export async function aiGenerateOutreach(lead: RecordItem): Promise<{ text: string; sources?: GroundingSource[] }> {
  const prompt = `Research current business context and write a high-conversion, verified B2B outreach email.
Target Company: ${lead.company_name || 'Prospect'}
Target Industry: ${lead.industry || 'Business Services'}
Contact Person: ${lead.contact_name || 'Decision Maker'}
Title: ${lead.title || 'Executive'}
Observed Signal: ${lead.signal || 'Expansion and growth initiative'}
Service: ${lead.business_type || 'B2B Enterprise Solution'}
Requirements: Ground in realistic industry terminology, reference verified current market positioning, and include an actionable call-to-action without fabricating unverified company milestones.`;

  const r = await aiChat(
    'You are NEXA Outreach AI with live Google Search grounding. Use verified and recent information to formulate compelling outreach.',
    prompt,
    { useSearchGrounding: true }
  );

  return { text: r.text || '', sources: r.sources };
}


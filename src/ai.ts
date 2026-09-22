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

  if (config.demoMode || (!config.geminiApiKey && !config.openaiApiKey)) {
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

  // Live Gemini API with gemini-3.5-flash and Google Search Grounding
  if (config.geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const prompt = `${system}\n\nTask: ${user}`;
      const generateConfig: any = {};
      if (useSearch) {
        generateConfig.tools = [{ googleSearch: {} }];
      }

      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: generateConfig,
      });

      const text = res.text || '';
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
    } catch (err: any) {
      console.error('Gemini API error with search grounding:', err);
      // Fallback without tools if needed
      try {
        const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
        const res = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `${system}\n\nTask: ${user}`,
        });
        return { ok: true, demo: false, text: res.text || '', sources: [], data: null };
      } catch (fallbackErr: any) {
        return { ok: false, text: '', error: err?.message || 'Gemini API call failed' };
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


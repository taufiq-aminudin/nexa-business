import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import type { RecordItem } from './db.js';

export interface AiResponse {
  ok: boolean;
  demo?: boolean;
  text: string;
  data?: any;
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
    return 'AI demo: property appears suitable for agent outreach; prepare seller approach and marketing draft.';
  }
  return 'AI demo response generated from the configured business mission. Add GEMINI_API_KEY or OPENAI_API_KEY and set DEMO_MODE=false for live AI.';
}

export async function aiChat(system: string, user: string, jsonSchema?: any): Promise<AiResponse> {
  if (config.demoMode || (!config.geminiApiKey && !config.openaiApiKey)) {
    return {
      ok: true,
      demo: true,
      text: aiDemo(user),
      data: null,
    };
  }

  // Live Gemini API first if configured
  if (config.geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const prompt = `${system}\n\nTask: ${user}`;
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = res.text || '';
      return { ok: true, demo: false, text, data: null };
    } catch (err: any) {
      console.error('Gemini API error:', err);
      return { ok: false, text: '', error: err?.message || 'Gemini API call failed' };
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
      if (jsonSchema) {
        payload.response_format = { type: 'json_schema', json_schema: jsonSchema };
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

export async function aiGenerateOutreach(lead: RecordItem): Promise<string> {
  const prompt = `Create a concise professional B2B outreach email. Company: ${lead.company_name}. Industry: ${lead.industry}. Contact: ${lead.contact_name}. Title: ${lead.title}. Detected signal: ${lead.signal}. Service: ${lead.business_type}. Do not invent facts. Include clear CTA.`;
  const r = await aiChat('You are a B2B sales assistant. Use only provided facts.', prompt);
  return r.text || '';
}

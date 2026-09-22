import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  appName: string;
  appUrl: string;
  dataPath: string;
  timezone: string;
  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  fromEmail: string;
  adminEmail: string;
  adminPassword: string;
  demoMode: boolean;
  port: number;
}

export const config: AppConfig = {
  appName: 'NEXA Business AI',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  dataPath: path.resolve(process.cwd(), 'storage/data.json'),
  timezone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5-mini',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.API_KEY || '',
  fromEmail: process.env.MAIL_FROM || 'noreply@example.com',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  demoMode: false,
  port: 3000,
};

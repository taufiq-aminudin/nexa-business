# NEXA Business AI

AI Business Acquisition & Automation Platform.

**Find opportunities. Start conversations. Follow up. Close business.**

## What is included

- AI Mission / business mission orchestration
- Company, contact, lead and opportunity CRM
- Recruitment playbook-ready data model
- Property agent workflow and property listings
- Vendor directory and RFQ-ready workflow
- AI outreach draft generation
- Follow-up-ready CRM timestamps
- Proposals, quotations, contracts, invoices, receipts
- Content AI draft calendar
- Automations, integrations, suppression list and audit log
- CSV import
- Demo data
- Modern Node.js + TypeScript stack

## Safety / platform compliance

This repository **does not implement unauthorized scraping** of LinkedIn, Facebook, Instagram, OLX, or other marketplaces. Use official APIs, licensed data providers, permitted public sources, or user-provided imports. For unsupported channels, use the draft/task workflow.

## Stack & Architecture

- Node.js 22 + TypeScript + Express
- Fast server-side layout and component rendering with pure dark CSS styling (`assets/app.css`)
- JSON database store in `storage/data.json` with in-memory persistence and automatic initial seed
- Multi-provider AI orchestration supporting Google Gemini (`@google/genai`) and OpenAI with built-in Demo Mode

## Run locally

```bash
npm install
npm run dev
```

App runs on: `http://localhost:3000`

Default demo credentials:
- Email: `admin@example.com`
- Password: `ChangeMe123!`

## Configuration & Live AI

Copy `.env.example` to `.env`:

```env
APP_URL=http://localhost:3000
APP_TIMEZONE=Asia/Jakarta
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5-mini
DEMO_MODE=true
MAIL_FROM=noreply@example.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
```

## Hosting

Works on a typical PHP 8.2/8.3 hosting environment with writable `storage/` and SQLite support. For higher traffic, move the database layer to PostgreSQL/MySQL and use a queue worker + Redis.

## GitHub

```bash
git init
git add .
git commit -m "Initial NEXA Business AI platform"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## Important next integrations

Configure official/authorized connectors for:

- OpenAI
- SMTP / transactional email
- Google Calendar
- WhatsApp Cloud API
- Meta Graph API where available
- Approved business data providers

The architecture is intentionally connector-based so a platform policy/API change does not require rewriting the CRM and AI core.

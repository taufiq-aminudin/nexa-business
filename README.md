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
- Lightweight PHP + SQLite stack

## Safety / platform compliance

This repository **does not implement unauthorized scraping** of LinkedIn, Facebook, Instagram, OLX, or other marketplaces. Use official APIs, licensed data providers, permitted public sources, or user-provided imports. For unsupported channels, use the draft/task workflow.

## Requirements

- PHP 8.2+ (PHP 8.3 recommended)
- PDO SQLite
- cURL extension for live OpenAI API
- Git

## Run locally

```bash
php -S 127.0.0.1:8080 -t .
```

Open: `http://127.0.0.1:8080`

SQLite is created automatically at `storage/nexa.sqlite`.

## Live AI

Copy `.env.example` to `.env` and configure environment variables in your hosting/runtime. This project reads environment variables directly; no .env parser is required for PHP execution.

```text
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5-mini
DEMO_MODE=false
APP_URL=https://your-domain.example
APP_TIMEZONE=Asia/Jakarta
MAIL_FROM=noreply@your-domain.example
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

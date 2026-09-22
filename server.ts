import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

import { config } from './src/config.js';
import {
  db,
  dbAll,
  dbFind,
  dbInsert,
  dbUpdate,
  dbWhere,
  findLeadJoined,
  nextDocNumber,
  audit,
  RecordItem,
} from './src/db.js';
import { aiChat, aiGenerateOutreach } from './src/ai.js';
import { renderAppLayout, renderLoginLayout } from './src/views.js';

declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    email?: string;
    csrf?: string;
    flash?: Array<[string, string]>;
  }
}

const app = express();
const PORT = 3000;
const upload = multer({ dest: '/tmp/uploads' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: 'nexa-business-session-secret-salt-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }) as any
);

// Serve static assets
app.use('/assets', express.static(path.resolve(process.cwd(), 'assets')));
app.get('/assets/app.css', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'assets/app.css'));
});

// CSRF and flash helpers
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(16).toString('hex');
  }
  if (!req.session.flash) {
    req.session.flash = [];
  }
  next();
});

function flash(req: Request, type: string, message: string) {
  if (!req.session.flash) req.session.flash = [];
  req.session.flash.push([type, message]);
}

function pullFlashes(req: Request): Array<[string, string]> {
  const flashes = req.session.flash || [];
  req.session.flash = [];
  return flashes;
}

function verifyCsrf(req: Request, res: Response): boolean {
  const token = req.body?.csrf || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrf) {
    res.status(419).send('CSRF validation failed');
    return false;
  }
  return true;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: config.appName, demoMode: config.demoMode, firebase: true });
});

// Google Sign-in with Firebase Auth session sync
app.post('/api/auth/google', (req: Request, res: Response) => {
  const { uid, email, displayName, photoURL } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  req.session.authenticated = true;
  req.session.email = email;
  (req.session as any).uid = uid || 'google-user';
  (req.session as any).displayName = displayName || email;
  (req.session as any).photoURL = photoURL || '';

  res.cookie('nexa_auth', '1', { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
  res.cookie('nexa_user_email', email, { sameSite: 'lax', maxAge: 86400000 });
  res.json({ ok: true, email });
});

// JSON export endpoint (matches export.php)
const handleExport = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    exported_at: new Date().toISOString(),
    data: db(),
  });
};
app.get('/export', handleExport);
app.get('/export.php', handleExport);

// Cron endpoint (matches cron.php)
const handleCron = (req: Request, res: Response) => {
  const now = new Date().getTime();
  const leads = dbWhere('leads', (r) => {
    if (!r.next_follow_up_at) return false;
    const dueTime = new Date(r.next_follow_up_at).getTime();
    const status = r.status || '';
    return dueTime <= now && !['WON', 'LOST', 'UNSUBSCRIBED'].includes(status);
  });

  let count = 0;
  const targetLeads = leads.slice(0, 100);
  for (const lead of targetLeads) {
    dbInsert('tasks', {
      title: 'AI follow-up: lead #' + lead.id,
      due_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'OPEN',
      priority: 'HIGH',
      entity_type: 'lead',
      entity_id: lead.id,
      notes: 'Review reply/engagement and send next approved step.',
    });

    const nextDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const nextFollowUp = nextDate.toISOString().replace('T', ' ').slice(0, 19);

    dbUpdate('leads', Number(lead.id), (x) => ({
      ...x,
      next_follow_up_at: nextFollowUp,
    }));

    audit(req.session.email || 'cron', 'followup.task_created', 'lead', Number(lead.id));
    count++;
  }

  res.type('text/plain').send(`Processed ${count} follow-up tasks\n`);
};
app.get('/cron', handleCron);
app.get('/cron.php', handleCron);

// Action handler router (matches actions.php)
app.post('/', upload.single('csv') as any, async (req: Request, res: Response) => {
  const action = String(req.query.action || req.body.action || '');
  if (!action) {
    return res.redirect('/?page=dashboard');
  }

  if (action === 'login') {
    if (!verifyCsrf(req, res)) return;
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '').trim();

    if (email === config.adminEmail && password === config.adminPassword) {
      req.session.authenticated = true;
      req.session.email = email;
      flash(req, 'success', 'Signed in.');
      return res.redirect('/?page=dashboard');
    }
    flash(req, 'error', 'Invalid credentials.');
    return res.redirect('/?page=login');
  }

  // All other actions require authentication
  if (!req.session.authenticated) {
    return res.redirect('/?page=login');
  }

  if (!verifyCsrf(req, res)) return;

  const actor = req.session.email || 'system';

  switch (action) {
    case 'logout': {
      req.session.destroy(() => {
        res.redirect('/?page=login');
      });
      return;
    }

    case 'create_mission': {
      const title = String(req.body.title || '').trim();
      const instruction = String(req.body.instruction || '').trim();
      const id = dbInsert('missions', {
        title,
        instruction,
        status: 'DRAFT',
      });
      audit(actor, 'mission.created', 'mission', id, { instruction });
      flash(req, 'success', 'Mission created.');
      return res.redirect('/?page=missions');
    }

    case 'run_mission': {
      const id = Number(req.body.id || 0);
      const m = dbFind('missions', id);
      if (!m) return res.redirect('/?page=missions');

      const systemPrompt =
        'You are the NEXA Business Intelligence & Outreach Orchestrator with live Google Search grounding. Convert the business mission into a structured execution plan grounded in verified, real-time market data. Discover active industry signals, relevant companies, executive profiles, and recommended actions.';
      const r = await aiChat(systemPrompt, m.instruction || '', { useSearchGrounding: true });

      dbUpdate('missions', id, (x) => ({
        ...x,
        status: 'COMPLETED',
        result_json: JSON.stringify({
          result: r.text,
          demo: r.demo ?? false,
          sources: r.sources || [],
          searchQueries: r.searchQueries || [],
        }),
      }));
      audit(actor, 'mission.executed', 'mission', id, r);
      flash(req, 'success', 'Mission executed with Google Search Grounding.');
      return res.redirect('/?page=missions');
    }

    case 'create_company': {
      const name = String(req.body.name || '').trim();
      const industry = String(req.body.industry || '').trim();
      const location = String(req.body.location || '').trim();
      const website = String(req.body.website || '').trim();
      const size = String(req.body.size || '').trim();
      const description = String(req.body.description || '').trim();
      const source_url = String(req.body.source_url || '').trim();

      const id = dbInsert('companies', {
        name,
        industry,
        location,
        website,
        size,
        description,
        source_type: 'manual',
        source_url,
        confidence: 0.9,
      });
      audit(actor, 'company.created', 'company', id);
      flash(req, 'success', 'Company added.');
      return res.redirect('/?page=companies');
    }

    case 'import_csv': {
      const file = req.file;
      if (!file) {
        flash(req, 'error', 'CSV upload failed.');
        return res.redirect('/?page=companies');
      }

      try {
        const fileContent = fs.readFileSync(file.path, 'utf-8');
        const records: any[] = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });

        let n = 0;
        for (const record of records) {
          const lowerRecord: Record<string, string> = {};
          for (const k of Object.keys(record)) {
            lowerRecord[k.toLowerCase().trim()] = String(record[k] ?? '').trim();
          }

          const name = lowerRecord['name'] || '';
          if (name) {
            dbInsert('companies', {
              name,
              industry: lowerRecord['industry'] || '',
              location: lowerRecord['location'] || '',
              website: lowerRecord['website'] || '',
              description: lowerRecord['description'] || '',
              source_type: 'csv_import',
              source_url: lowerRecord['source_url'] || '',
              confidence: 0.85,
            });
            n++;
          }
        }
        fs.unlinkSync(file.path);
        audit(actor, 'company.csv_import', 'company', null, { count: n });
        flash(req, 'success', `Imported ${n} companies.`);
      } catch (err: any) {
        console.error('CSV import error:', err);
        flash(req, 'error', 'CSV import error: ' + (err?.message || 'unknown'));
      }
      return res.redirect('/?page=companies');
    }

    case 'create_contact': {
      const company_id = Number(req.body.company_id || 0);
      const name = String(req.body.name || '').trim();
      const title = String(req.body.title || '').trim();
      const email = String(req.body.email || '').trim();
      const phone = String(req.body.phone || '').trim();
      const linkedin_url = String(req.body.linkedin_url || '').trim();
      const source_url = String(req.body.source_url || '').trim();
      const consent_status = String(req.body.consent_status || 'unknown').trim();

      const id = dbInsert('contacts', {
        company_id,
        name,
        title,
        email,
        phone,
        linkedin_url,
        source_url,
        consent_status,
      });
      audit(actor, 'contact.created', 'contact', id);
      flash(req, 'success', 'Contact added.');
      return res.redirect('/?page=contacts');
    }

    case 'create_lead': {
      const company_id = Number(req.body.company_id || 0);
      const contact_id = Number(req.body.contact_id || 0);
      const business_type = String(req.body.business_type || '').trim();
      const status = String(req.body.status || 'NEW').trim();
      const signal = String(req.body.signal || '').trim();
      const score = Number(req.body.score || 0);
      const score_explanation = String(req.body.score_explanation || '').trim();
      const source_url = String(req.body.source_url || '').trim();
      const notes = String(req.body.notes || '').trim();

      const id = dbInsert('leads', {
        company_id,
        contact_id,
        business_type,
        status,
        signal,
        score,
        score_explanation,
        source_type: 'manual',
        source_url,
        notes,
      });
      audit(actor, 'lead.created', 'lead', id);
      flash(req, 'success', 'Lead added.');
      return res.redirect('/?page=leads');
    }

    case 'generate_outreach': {
      const leadId = Number(req.body.id || 0);
      const lead = findLeadJoined(leadId);
      if (!lead) return res.redirect('/?page=leads');

      const outreachResult = await aiGenerateOutreach(lead);
      const id = dbInsert('messages', {
        lead_id: lead.id,
        direction: 'outbound',
        channel: 'email',
        subject: 'Partnership opportunity for ' + lead.company_name,
        body: outreachResult.text,
        status: 'DRAFT',
      });
      audit(actor, 'outreach.generated', 'message', id, { lead_id: lead.id, sources: outreachResult.sources });
      flash(req, 'success', 'Outreach draft generated with Search Grounding.');
      return res.redirect('/?page=inbox');
    }

    case 'send_message': {
      const id = Number(req.body.id || 0);
      const msg = dbFind('messages', id);
      if (!msg) return res.redirect('/?page=inbox');

      const lead = findLeadJoined(Number(msg.lead_id));
      const email = String(lead?.email || '').trim();

      const blocked =
        dbWhere(
          'suppression_list',
          (r) => String(r.value || '').toLowerCase() === email.toLowerCase()
        ).length > 0;

      if (blocked || lead?.consent_status === 'blocked') {
        flash(req, 'error', 'Blocked by suppression/compliance rule.');
        return res.redirect('/?page=inbox');
      }

      const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const followUp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);

      dbUpdate('messages', id, (x) => ({
        ...x,
        status: 'SENT',
        sent_at: nowFormatted,
      }));

      if (lead?.id) {
        dbUpdate('leads', Number(lead.id), (x) => ({
          ...x,
          status: 'CONTACTED',
          last_contact_at: nowFormatted,
          next_follow_up_at: followUp,
        }));
      }

      audit(actor, 'message.sent', 'message', id);
      flash(req, 'success', 'Message marked SENT. Configure your mail provider for real delivery.');
      return res.redirect('/?page=inbox');
    }

    case 'create_document': {
      const type = String(req.body.doc_type || 'QUOTATION').trim();
      const company_id = Number(req.body.company_id || 0);
      const lead_id = Number(req.body.lead_id || 0);
      const total = Number(req.body.total || 0);
      const description = String(req.body.description || '').trim();
      const payment_terms = String(req.body.payment_terms || '').trim();
      const validity_days = Number(req.body.validity_days || 14);

      const id = dbInsert('documents', {
        doc_type: type,
        number: nextDocNumber(type),
        company_id,
        lead_id,
        status: 'DRAFT',
        payload: JSON.stringify({
          description,
          payment_terms,
          validity_days,
        }),
        total,
      });
      audit(actor, 'document.created', 'document', id);
      flash(req, 'success', `${type} created.`);
      return res.redirect('/?page=documents');
    }

    case 'create_property': {
      const title = String(req.body.title || '').trim();
      const property_type = String(req.body.property_type || '').trim();
      const location = String(req.body.location || '').trim();
      const price = Number(req.body.price || 0);
      const land_size = Number(req.body.land_size || 0);
      const building_size = Number(req.body.building_size || 0);
      const seller_type = String(req.body.seller_type || '').trim();
      const source = String(req.body.source || 'manual').trim();
      const source_url = String(req.body.source_url || '').trim();
      const description = String(req.body.description || '').trim();

      const id = dbInsert('properties', {
        title,
        property_type,
        location,
        price,
        land_size,
        building_size,
        seller_type,
        source,
        source_url,
        status: 'NEW',
        description,
      });
      audit(actor, 'property.created', 'property', id);
      flash(req, 'success', 'Property added.');
      return res.redirect('/?page=properties');
    }

    case 'create_vendor': {
      const name = String(req.body.name || '').trim();
      const category = String(req.body.category || '').trim();
      const location = String(req.body.location || '').trim();
      const website = String(req.body.website || '').trim();
      const contact = String(req.body.contact || '').trim();
      const source = String(req.body.source || 'manual').trim();
      const notes = String(req.body.notes || '').trim();

      const id = dbInsert('vendors', {
        name,
        category,
        location,
        website,
        contact,
        source,
        notes,
      });
      audit(actor, 'vendor.created', 'vendor', id);
      flash(req, 'success', 'Vendor added.');
      return res.redirect('/?page=vendors');
    }

    case 'create_content': {
      const entity_type = String(req.body.entity_type || '').trim();
      const entity_id = Number(req.body.entity_id || 0);
      const channel = String(req.body.channel || '').trim();
      const title = String(req.body.title || '').trim();
      const body = String(req.body.body || '').trim();
      const scheduled_at = String(req.body.scheduled_at || '').trim();

      const id = dbInsert('content_items', {
        entity_type,
        entity_id,
        channel,
        title,
        body,
        status: 'DRAFT',
        scheduled_at,
      });
      audit(actor, 'content.created', 'content', id);
      flash(req, 'success', 'Content draft created.');
      return res.redirect('/?page=content');
    }

    case 'add_suppression': {
      const value = String(req.body.value || '').trim();
      const reason = String(req.body.reason || '').trim();
      if (value) {
        const exists = dbWhere(
          'suppression_list',
          (r) => String(r.value || '').toLowerCase() === value.toLowerCase()
        );
        if (exists.length === 0) {
          dbInsert('suppression_list', { value, reason });
        }
      }
      audit(actor, 'suppression.added', 'suppression');
      flash(req, 'success', 'Suppression rule saved.');
      return res.redirect('/?page=settings');
    }

    case 'save_integration': {
      const provider = String(req.body.provider || '').trim();
      const enabled = Boolean(req.body.enabled);
      const notes = String(req.body.notes || '').trim();

      const rows = dbWhere('integrations', (r) => (r.provider || '') === provider);
      if (rows.length > 0) {
        dbUpdate('integrations', Number(rows[0].id), (x) => ({
          ...x,
          status: enabled ? 'CONFIGURED' : 'NOT_CONNECTED',
          config_json: JSON.stringify({ notes }),
        }));
      } else {
        dbInsert('integrations', {
          provider,
          status: enabled ? 'CONFIGURED' : 'NOT_CONNECTED',
          config_json: JSON.stringify({ notes }),
        });
      }
      audit(actor, 'integration.updated', 'integration', null, { provider });
      flash(req, 'success', 'Integration saved.');
      return res.redirect('/?page=integrations');
    }

    default:
      return res.redirect('/?page=dashboard');
  }
});

// Main UI page handler (supports ?page=xyz and clean /:page paths)
const allowedPages = [
  'dashboard',
  'missions',
  'companies',
  'contacts',
  'leads',
  'opportunities',
  'campaigns',
  'inbox',
  'tasks',
  'documents',
  'properties',
  'vendors',
  'content',
  'automations',
  'integrations',
  'settings',
  'audit',
];

const renderPage = (req: Request, res: Response) => {
  let page = String(req.query.page || req.params.page || 'dashboard');

  if (page === 'login') {
    const flashes = pullFlashes(req);
    const html = renderLoginLayout(flashes, req.session.csrf || '');
    return res.send(html);
  }

  if (page === 'logout') {
    req.session.destroy(() => {
      res.redirect('/?page=login');
    });
    return;
  }

  if (page === 'export' || page === 'export.php') {
    return handleExport(req, res);
  }

  if (page === 'cron' || page === 'cron.php') {
    return handleCron(req, res);
  }

  if (!allowedPages.includes(page)) {
    page = 'dashboard';
  }

  if (!req.session.authenticated) {
    return res.redirect('/?page=login');
  }

  const flashes = pullFlashes(req);
  const html = renderAppLayout({
    page,
    userEmail: req.session.email || 'admin@example.com',
    flashes,
    csrfToken: req.session.csrf || '',
  });

  res.send(html);
};

app.get('/', renderPage);
app.get('/:page', (req: Request, res: Response, next: NextFunction) => {
  if (req.params.page === 'assets' || req.params.page === 'api') return next();
  renderPage(req, res);
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error: ' + (err?.message || 'unknown'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`NEXA Business AI server listening on http://0.0.0.0:${PORT}`);
});

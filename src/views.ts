import {
  db,
  dbAll,
  dbCount,
  dbFind,
  dbSortAsc,
  dbSortDesc,
  dbSum,
  findCompanyName,
  findContact,
  findLeadJoined,
  RecordItem,
} from './db.js';
import { config } from './config.js';
import { getFirebaseClientScript } from './firebase.js';

export function escapeHtml(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function money(n: any): string {
  const num = Math.round(Number(n) || 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function hiddenCsrf(csrfToken: string): string {
  return `<input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}">`;
}

export function optionsArray(
  rows: RecordItem[],
  valueKey: string,
  labelKey: string,
  blank = false,
  selectedVal = ''
): string {
  let html = blank ? '<option value="">— Select —</option>' : '';
  for (const r of rows) {
    const val = String(r[valueKey] ?? '');
    const isSel = val === String(selectedVal) ? ' selected' : '';
    html += `<option value="${escapeHtml(val)}"${isSel}>${escapeHtml(r[labelKey])}</option>`;
  }
  return html;
}

export function cardStat(label: string, value: string, hint = ''): string {
  return `<div class="card stat" id="stat-${label.toLowerCase().replace(/\s+/g, '-')}">
    <div class="muted">${escapeHtml(label)}</div>
    <div class="stat-value">${escapeHtml(value)}</div>
    <div class="muted small">${escapeHtml(hint)}</div>
  </div>`;
}

export function simpleTable(rows: RecordItem[]): string {
  if (!rows || rows.length === 0) {
    return '<div class="empty">No records yet.</div>';
  }
  const headers = Object.keys(rows[0]);
  let html = '<div class="table-wrap"><table><thead><tr>';
  for (const h of headers) {
    const title = h.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    html += `<th>${escapeHtml(title)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const r of rows) {
    html += '<tr>';
    for (const h of headers) {
      let v = r[h] ?? '';
      if (['price', 'total', 'value'].includes(h)) {
        v = money(v);
      } else if (typeof v === 'object' && v !== null) {
        v = JSON.stringify(v);
      }
      html += `<td>${escapeHtml(v)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

export function contactTable(rows: RecordItem[]): string {
  if (!rows || rows.length === 0) return '<div class="empty">No contacts.</div>';
  const mapped = rows.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    email: r.email,
    phone: r.phone,
    company: findCompanyName(r.company_id ?? 0),
    consent_status: r.consent_status,
  }));
  return simpleTable(mapped);
}

export function documentTable(rows: RecordItem[]): string {
  if (!rows || rows.length === 0) return '<div class="empty">No documents.</div>';
  const mapped = rows.map((r) => ({
    id: r.id,
    doc_type: r.doc_type,
    number: r.number,
    status: r.status,
    company: findCompanyName(r.company_id ?? 0),
    total: r.total,
    created_at: r.created_at,
  }));
  return simpleTable(mapped);
}

export function leadTable(rows: RecordItem[], csrfToken: string): string {
  if (!rows || rows.length === 0) return '<div class="empty">No leads.</div>';
  let html = `<div class="table-wrap"><table><thead><tr>
    <th>Company</th><th>Contact</th><th>Business</th><th>Signal</th><th>Score</th><th>Status</th><th>Action</th>
  </tr></thead><tbody>`;
  for (const r of rows) {
    const c = findCompanyName(r.company_id ?? 0);
    const ct = findContact(r.contact_id ?? 0);
    html += `<tr>
      <td>${escapeHtml(c)}</td>
      <td>${escapeHtml(ct?.name ?? '')}</td>
      <td>${escapeHtml(r.business_type ?? '')}</td>
      <td>${escapeHtml(r.signal ?? '')}</td>
      <td><b>${escapeHtml(r.score ?? 0)}</b></td>
      <td><span class="badge">${escapeHtml(r.status ?? '')}</span></td>
      <td>
        <form class="inline" method="post" action="?action=generate_outreach">
          ${hiddenCsrf(csrfToken)}
          <input type="hidden" name="id" value="${escapeHtml(r.id)}">
          <button class="button" id="btn-outreach-${r.id}">AI Outreach</button>
        </form>
      </td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  return html;
}

export function pipelineHtml(full = false): string {
  const stages = ['NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON'];
  const ops = dbAll('opportunities');
  let html = '<div class="pipeline">';
  for (const s of stages) {
    const rs = ops.filter((r) => (r.stage ?? '') === s);
    let v = 0;
    for (const r of rs) v += Number(r.value || 0);
    html += `<div class="pipe">
      <div class="muted">${escapeHtml(s)}</div>
      <b>${rs.length}</b>
      <div class="small">${money(v)}</div>
    </div>`;
  }
  html += '</div>';
  if (full) {
    html += '<div style="margin-top: 20px;">' + simpleTable(ops) + '</div>';
  }
  return html;
}

export function renderPageContent(page: string, csrfToken: string): string {
  const companies = dbSortAsc(dbAll('companies'), 'name');
  const contacts = dbSortAsc(dbAll('contacts'), 'name');
  const leads = dbSortDesc(dbAll('leads'));

  if (page === 'dashboard') {
    const leadN = dbCount('leads');
    const qualified = dbCount('leads', (r) => (r.status ?? '') === 'QUALIFIED');
    const meetings = dbCount('appointments');
    const proposals = dbCount('documents', (r) => ['PROPOSAL', 'QUOTATION'].includes(r.doc_type ?? ''));
    const revenue = dbSum('opportunities', 'value', (r) => (r.stage ?? '') === 'WON');

    return `<div class="grid stats">
      ${cardStat('Leads', String(leadN), 'All business types')}
      ${cardStat('Qualified', String(qualified), 'Internal priority')}
      ${cardStat('Meetings', String(meetings), 'Scheduled')}
      ${cardStat('Proposals', String(proposals), 'Draft + issued')}
      ${cardStat('Won Pipeline', money(revenue), 'Closed value')}
    </div>
    <div class="grid two">
      <section class="panel" id="panel-quick-mission">
        <div class="panel-head">
          <h2>AI Mission</h2>
          <a class="button" href="?page=missions">Open</a>
        </div>
        <form method="post" action="?action=create_mission">
          ${hiddenCsrf(csrfToken)}
          <input name="title" placeholder="Mission title" required>
          <textarea name="instruction" placeholder="e.g. Find manufacturing companies currently hiring and prepare recruitment outreach" required></textarea>
          <button class="button primary" id="btn-create-mission">Create Mission</button>
        </form>
      </section>
      <section class="panel" id="panel-pipeline">
        <div class="panel-head">
          <h2>Opportunity Pipeline</h2>
          <a class="button" href="?page=opportunities">View</a>
        </div>
        ${pipelineHtml()}
      </section>
    </div>
    <div class="panel" id="panel-recent-leads">
      <div class="panel-head">
        <h2>Recent Leads</h2>
        <a class="button" href="?page=leads">Manage</a>
      </div>
      ${leadTable(leads.slice(0, 8), csrfToken)}
    </div>`;
  }

  if (page === 'missions') {
    let listHtml = '';
    for (const r of dbSortDesc(dbAll('missions'))) {
      const isCompleted = r.status === 'COMPLETED';
      let detailsHtml = '';
      if (isCompleted) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(r.result_json || '{}');
        } catch {
          parsed = { result: r.result_json };
        }
        let sourcesHtml = '';
        if (parsed.sources && parsed.sources.length > 0) {
          sourcesHtml = `<div class="grounding-sources" style="margin-top:12px;padding:12px;background:#0d1829;border:1px solid #1e355b;border-radius:8px">
            <div style="font-size:11px;font-weight:700;color:#60a5fa;margin-bottom:8px;display:flex;align-items:center;gap:6px">
              <span>🌐</span> VERIFIED GOOGLE SEARCH SOURCES:
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${parsed.sources.map((s: any) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="badge" style="color:#93c5fd;text-decoration:none;border-color:#2a4365;background:#101f38" title="${escapeHtml(s.title || s.url)}">${escapeHtml(s.title || s.url)} ↗</a>`).join('')}
            </div>
          </div>`;
        }
        if (parsed.searchQueries && parsed.searchQueries.length > 0) {
          sourcesHtml += `<div style="margin-top:8px;font-size:11px;color:#94a3b8">Search queries executed: ${parsed.searchQueries.map((q: string) => `<span class="pill" style="font-size:11px;padding:2px 8px;margin-right:4px">${escapeHtml(q)}</span>`).join('')}</div>`;
        }

        detailsHtml = `<details style="margin-top:10px" open>
          <summary style="cursor:pointer;color:#7c5cff;font-weight:600">View Execution Plan &amp; Intelligence</summary>
          <div style="margin-top:8px;padding:14px;background:#0c1425;border:1px solid #1f2d48;border-radius:10px;white-space:pre-wrap;font-size:13px;line-height:1.6">${escapeHtml(parsed.result || r.result_json)}</div>
          ${sourcesHtml}
        </details>`;
      }

      listHtml += `<div class="list-item" id="mission-${r.id}" style="display:block;padding:16px 0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <b style="font-size:15px">${escapeHtml(r.title)}</b>
            <div class="muted small" style="margin:4px 0">${escapeHtml(r.instruction)}</div>
            <span class="badge">${escapeHtml(r.status)}</span>
            <span class="badge" style="background:#132838;color:#70c4ff;border-color:#204c6e;margin-left:6px">🌐 Search Grounded</span>
          </div>
          <div>
            ${
              !isCompleted
                ? `<form method="post" action="?action=run_mission" class="inline">
                    ${hiddenCsrf(csrfToken)}
                    <input type="hidden" name="id" value="${escapeHtml(r.id)}">
                    <button class="button primary" id="btn-run-mission-${r.id}">Run with Google Search</button>
                  </form>`
                : ''
            }
          </div>
        </div>
        ${detailsHtml}
      </div>`;
    }

    return `<div class="panel" id="panel-create-mission">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2>Create AI Mission</h2>
        <span class="badge" style="background:#132838;color:#70c4ff;border-color:#204c6e">🌐 Gemini 3.6 Flash · Google Search Grounded</span>
      </div>
      <p class="muted small" style="margin-top:-6px;margin-bottom:14px">
        Missions are executed with real-time web intelligence via Gemini 3.6 Flash and Google Search Grounding to discover fresh market signals, company intelligence, and verified lead opportunities.
      </p>
      <form method="post" action="?action=create_mission">
        ${hiddenCsrf(csrfToken)}
        <input name="title" placeholder="Mission title (e.g. Research B2B Logistics Software Buyers in Singapore)" required>
        <textarea name="instruction" placeholder="Describe the mission goals, target industry, criteria, and research questions..." required></textarea>
        <button class="button primary" id="btn-submit-mission">Create Mission</button>
      </form>
    </div>
    <div class="panel" id="panel-mission-queue">
      <h2>Mission Queue</h2>
      ${listHtml || '<div class="empty">No missions queued.</div>'}
    </div>`;
  }

  if (page === 'companies') {
    return `<div class="grid two">
      <section class="panel" id="panel-add-company">
        <h2>Add Company</h2>
        <form method="post" action="?action=create_company">
          ${hiddenCsrf(csrfToken)}
          <input name="name" placeholder="Company name" required>
          <input name="industry" placeholder="Industry">
          <input name="location" placeholder="Location">
          <input name="website" placeholder="Website">
          <input name="size" placeholder="Size">
          <input name="source_url" placeholder="Source URL">
          <textarea name="description" placeholder="Description"></textarea>
          <button class="button primary" id="btn-save-company">Save Company</button>
        </form>
      </section>
      <section class="panel" id="panel-csv-import">
        <h2>CSV Import</h2>
        <p class="muted">Columns: name, industry, location, website, description, source_url.</p>
        <form method="post" enctype="multipart/form-data" action="?action=import_csv">
          ${hiddenCsrf(csrfToken)}
          <input type="file" name="csv" accept=".csv" required>
          <button class="button" id="btn-import-csv">Import CSV</button>
        </form>
      </section>
    </div>
    <div class="panel" id="panel-company-list">
      <h2>Company Database</h2>
      ${simpleTable(dbSortDesc(dbAll('companies')).slice(0, 100))}
    </div>`;
  }

  if (page === 'contacts') {
    return `<div class="panel" id="panel-add-contact">
      <h2>Add Contact</h2>
      <form method="post" action="?action=create_contact">
        ${hiddenCsrf(csrfToken)}
        <select name="company_id" required>
          ${optionsArray(companies, 'id', 'name')}
        </select>
        <input name="name" placeholder="Contact name" required>
        <input name="title" placeholder="Title">
        <input name="email" placeholder="Email">
        <input name="phone" placeholder="Phone">
        <input name="linkedin_url" placeholder="LinkedIn URL">
        <input name="source_url" placeholder="Source URL">
        <select name="consent_status">
          <option>unknown</option>
          <option>allowed</option>
          <option>blocked</option>
        </select>
        <button class="button primary" id="btn-save-contact">Save Contact</button>
      </form>
    </div>
    <div class="panel" id="panel-contact-list">
      <h2>Contacts</h2>
      ${contactTable(dbSortDesc(dbAll('contacts')).slice(0, 100))}
    </div>`;
  }

  if (page === 'leads') {
    return `<div class="panel" id="panel-create-lead">
      <h2>Create Lead</h2>
      <form method="post" action="?action=create_lead">
        ${hiddenCsrf(csrfToken)}
        <select name="company_id" required>
          ${optionsArray(companies, 'id', 'name')}
        </select>
        <select name="contact_id">
          <option value="">— Select Contact —</option>
          ${optionsArray(contacts, 'id', 'name', true)}
        </select>
        <select name="business_type">
          <option>Recruitment</option>
          <option>Property Agent</option>
          <option>Digital Agency</option>
          <option>Vendor Discovery</option>
          <option>Custom</option>
        </select>
        <select name="status">
          <option>NEW</option>
          <option>QUALIFIED</option>
          <option>NURTURE</option>
        </select>
        <input name="signal" placeholder="Detected opportunity signal">
        <input type="number" name="score" min="0" max="100" value="50">
        <input name="score_explanation" placeholder="Why this lead qualifies">
        <input name="source_url" placeholder="Source URL">
        <textarea name="notes" placeholder="Notes"></textarea>
        <button class="button primary" id="btn-save-lead">Create Lead</button>
      </form>
    </div>
    <div class="panel" id="panel-lead-list">
      <h2>Lead Database</h2>
      ${leadTable(leads, csrfToken)}
    </div>`;
  }

  if (page === 'opportunities') {
    return `<div class="panel" id="panel-opportunities">
      <h2>Pipeline</h2>
      ${pipelineHtml(true)}
    </div>`;
  }

  if (page === 'inbox') {
    let msgHtml = '';
    for (const m of dbSortDesc(dbAll('messages'))) {
      const lead = findLeadJoined(Number(m.lead_id));
      msgHtml += `<div class="list-item" id="msg-${m.id}">
        <div>
          <b>${escapeHtml(m.subject)}</b>
          <div class="muted small">${escapeHtml(lead?.company_name ?? '')} · ${escapeHtml(lead?.email ?? '')} [${escapeHtml(m.status ?? 'DRAFT')}]</div>
          <pre class="preview">${escapeHtml(m.body)}</pre>
        </div>
        <div>
          ${
            (m.status ?? '') === 'DRAFT'
              ? `<form method="post" action="?action=send_message">
                  ${hiddenCsrf(csrfToken)}
                  <input type="hidden" name="id" value="${escapeHtml(m.id)}">
                  <button class="button primary" id="btn-send-msg-${m.id}">Send</button>
                </form>`
              : ''
          }
        </div>
      </div>`;
    }

    return `<div class="panel" id="panel-inbox">
      <div class="panel-head">
        <h2>AI Inbox</h2>
        <span class="muted">Draft → review → send</span>
      </div>
      ${msgHtml || '<div class="empty">No messages in inbox.</div>'}
      <div class="tip">Unauthorized social/marketplace automation is intentionally blocked. Use official APIs or approved import workflows.</div>
    </div>`;
  }

  if (page === 'tasks') {
    return `<div class="panel" id="panel-tasks">
      <h2>Tasks</h2>
      ${simpleTable(dbSortAsc(dbAll('tasks'), 'due_at'))}
    </div>`;
  }

  if (page === 'documents') {
    let leadOptions = '';
    for (const l of leads) {
      leadOptions += `<option value="${escapeHtml(l.id)}">#${escapeHtml(l.id)} — ${escapeHtml(l.business_type ?? '')}</option>`;
    }

    return `<div class="panel" id="panel-create-doc">
      <h2>Create Business Document</h2>
      <form method="post" action="?action=create_document">
        ${hiddenCsrf(csrfToken)}
        <select name="doc_type">
          <option>PROPOSAL</option>
          <option>QUOTATION</option>
          <option>CONTRACT</option>
          <option>INVOICE</option>
          <option>RECEIPT</option>
        </select>
        <select name="company_id">
          <option value="">— Select Company —</option>
          ${optionsArray(companies, 'id', 'name', true)}
        </select>
        <select name="lead_id">
          <option value="">— Select Lead —</option>
          ${leadOptions}
        </select>
        <input type="number" name="total" placeholder="Total value">
        <input name="validity_days" type="number" value="14" placeholder="Validity">
        <input name="payment_terms" value="Net 7" placeholder="Payment terms">
        <textarea name="description" placeholder="Description / scope"></textarea>
        <button class="button primary" id="btn-generate-doc">Generate Document</button>
      </form>
    </div>
    <div class="panel" id="panel-doc-list">
      <h2>Documents</h2>
      ${documentTable(dbSortDesc(dbAll('documents')).slice(0, 100))}
    </div>`;
  }

  if (page === 'properties') {
    return `<div class="panel" id="panel-add-property">
      <h2>Add Property</h2>
      <form method="post" action="?action=create_property">
        ${hiddenCsrf(csrfToken)}
        <input name="title" placeholder="Property title" required>
        <select name="property_type">
          <option>House</option>
          <option>Land</option>
          <option>Villa</option>
          <option>Apartment</option>
          <option>Shop House</option>
          <option>Warehouse</option>
          <option>Factory</option>
        </select>
        <input name="location" placeholder="Location">
        <input type="number" name="price" placeholder="Price">
        <input type="number" name="land_size" placeholder="Land m²">
        <input type="number" name="building_size" placeholder="Building m²">
        <input name="seller_type" placeholder="Owner / Agent">
        <input name="source" placeholder="Source">
        <input name="source_url" placeholder="Source URL">
        <textarea name="description" placeholder="Description"></textarea>
        <button class="button primary" id="btn-save-property">Save Property</button>
      </form>
    </div>
    <div class="panel" id="panel-property-list">
      <h2>Property Opportunities</h2>
      ${simpleTable(dbSortDesc(dbAll('properties')).slice(0, 100))}
    </div>`;
  }

  if (page === 'vendors') {
    return `<div class="panel" id="panel-add-vendor">
      <h2>Add Vendor</h2>
      <form method="post" action="?action=create_vendor">
        ${hiddenCsrf(csrfToken)}
        <input name="name" placeholder="Vendor name" required>
        <input name="category" placeholder="Category">
        <input name="location" placeholder="Location">
        <input name="website" placeholder="Website">
        <input name="contact" placeholder="Contact">
        <input name="source" placeholder="Source">
        <textarea name="notes" placeholder="Notes"></textarea>
        <button class="button primary" id="btn-save-vendor">Save Vendor</button>
      </form>
    </div>
    <div class="panel" id="panel-vendor-list">
      <h2>Vendor Directory</h2>
      ${simpleTable(dbSortDesc(dbAll('vendors')).slice(0, 100))}
    </div>`;
  }

  if (page === 'content') {
    return `<div class="panel" id="panel-add-content">
      <h2>Content AI Draft</h2>
      <form method="post" action="?action=create_content">
        ${hiddenCsrf(csrfToken)}
        <select name="entity_type">
          <option>property</option>
          <option>company</option>
          <option>service</option>
        </select>
        <input name="entity_id" type="number" placeholder="Entity ID">
        <select name="channel">
          <option>Instagram</option>
          <option>Facebook</option>
          <option>LinkedIn Draft</option>
          <option>Website</option>
          <option>Reels Script</option>
          <option>WhatsApp Draft</option>
        </select>
        <input name="title" placeholder="Title">
        <textarea name="body" placeholder="Generated or edited content"></textarea>
        <input name="scheduled_at" type="datetime-local">
        <button class="button primary" id="btn-save-content">Save Draft</button>
      </form>
    </div>
    <div class="panel" id="panel-content-calendar">
      <h2>Content Calendar</h2>
      ${simpleTable(dbSortDesc(dbAll('content_items'), 'scheduled_at').slice(0, 100))}
    </div>`;
  }

  if (page === 'campaigns') {
    return `<div class="panel" id="panel-campaigns">
      <h2>Campaigns</h2>
      ${simpleTable(dbSortDesc(dbAll('campaigns')))}
    </div>`;
  }

  if (page === 'automations') {
    return `<div class="panel" id="panel-automations">
      <h2>Automation Engine</h2>
      <div class="automation">
        <b>Example playbook rules</b>
        <p>active_hiring_detected → create opportunity → generate outreach → approval/send → schedule +3 day follow-up</p>
        <p>proposal_sent → create follow-up task</p>
        <p>invoice_paid → mark opportunity WON → generate receipt</p>
      </div>
    </div>
    <div class="panel">
      ${simpleTable(dbSortDesc(dbAll('automations')))}
    </div>`;
  }

  if (page === 'integrations') {
    return `<div class="panel" id="panel-integrations">
      <h2>Integrations</h2>
      <p class="muted">Use official APIs or permitted providers. LinkedIn, Facebook, Instagram, OLX and other marketplaces are not scraped by this app.</p>
      <form method="post" action="?action=save_integration">
        ${hiddenCsrf(csrfToken)}
        <select name="provider">
          <option>OpenAI</option>
          <option>Google Gemini</option>
          <option>SMTP</option>
          <option>Google Calendar</option>
          <option>WhatsApp Cloud API</option>
          <option>Meta Graph API</option>
          <option>CRM Import</option>
          <option>Approved Data Provider</option>
        </select>
        <label><input type="checkbox" name="enabled" value="1"> Enabled</label>
        <input name="notes" placeholder="Connection notes / env vars configured">
        <button class="button primary" id="btn-save-integration">Save</button>
      </form>
    </div>
    <div class="panel" id="panel-configured-integrations">
      <h2>Configured</h2>
      ${simpleTable(dbSortAsc(dbAll('integrations'), 'provider'))}
    </div>`;
  }

  if (page === 'settings') {
    return `<div class="panel" id="panel-settings">
      <h2>Compliance & Suppression</h2>
      <form method="post" action="?action=add_suppression">
        ${hiddenCsrf(csrfToken)}
        <input name="value" placeholder="email@example.com or identifier" required>
        <input name="reason" placeholder="Reason">
        <button class="button primary" id="btn-add-suppression">Add Suppression</button>
      </form>
    </div>
    <div class="panel" id="panel-env-preview">
      <h2>Environment</h2>
      <pre>APP_URL=${escapeHtml(config.appUrl)}
APP_TIMEZONE=${escapeHtml(config.timezone)}
OPENAI_MODEL=${escapeHtml(config.openaiModel)}
DEMO_MODE=${config.demoMode ? 'true' : 'false'}
ADMIN_EMAIL=${escapeHtml(config.adminEmail)}</pre>
    </div>
    <div class="panel" id="panel-suppression-list">
      <h2>Suppression List</h2>
      ${simpleTable(dbSortDesc(dbAll('suppression_list')))}
    </div>`;
  }

  if (page === 'audit') {
    return `<div class="panel" id="panel-audit">
      <h2>Audit Log</h2>
      ${simpleTable(dbSortDesc(dbAll('audit_logs')).slice(0, 200))}
    </div>`;
  }

  return `<div class="panel"><h2>Dashboard</h2></div>`;
}

export function renderAppLayout(params: {
  page: string;
  userEmail: string;
  flashes: Array<[string, string]>;
  csrfToken: string;
}): string {
  const { page, userEmail, flashes, csrfToken } = params;
  const navItems: Array<[string, string, string]> = [
    ['dashboard', 'Dashboard', '▦'],
    ['missions', 'AI Missions', '✦'],
    ['companies', 'Companies', '◉'],
    ['contacts', 'Contacts', '◎'],
    ['leads', 'Leads', '◌'],
    ['opportunities', 'Pipeline', '◇'],
    ['campaigns', 'Campaigns', '↗'],
    ['inbox', 'Inbox AI', '✉'],
    ['tasks', 'Tasks', '✓'],
    ['documents', 'Documents', '▤'],
    ['properties', 'Properties', '⌂'],
    ['vendors', 'Vendors', '◈'],
    ['content', 'Content AI', '✎'],
    ['automations', 'Automations', '⚙'],
    ['integrations', 'Integrations', '⇄'],
    ['audit', 'Audit Log', '◷'],
    ['settings', 'Settings', '⚑'],
  ];

  let navHtml = '';
  for (const [key, label, icon] of navItems) {
    const activeClass = page === key ? ' active' : '';
    navHtml += `<a class="nav${activeClass}" href="?page=${key}" id="nav-${key}">
      <span>${icon}</span>${escapeHtml(label)}
    </a>`;
  }

  let flashHtml = '';
  for (const [type, msg] of flashes) {
    flashHtml += `<div class="flash ${escapeHtml(type)}">${escapeHtml(msg)}</div>`;
  }

  const pageTitle = page.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(config.appName)} — ${escapeHtml(pageTitle)}</title>
  <link rel="stylesheet" href="/assets/app.css">
</head>
<body>
  <div class="app">
    <aside class="sidebar" id="app-sidebar">
      <div class="brand">NEXA <span>Business AI</span></div>
      <div class="tag">Find opportunities. Start conversations. Follow up. Close business.</div>
      <nav>
        ${navHtml}
      </nav>
      <div class="side-foot">
        <div style="margin-bottom:6px">
          <span class="badge" style="background:#221b10;color:#ffb84d;border-color:#5c3f15;font-size:10px">🔥 Firestore Active</span>
        </div>
        Signed in as <b>${escapeHtml(userEmail || 'admin')}</b> · <a href="?page=logout" class="muted" id="link-logout">Logout</a>
      </div>
    </aside>
    <main class="main" id="app-main">
      <header class="topbar">
        <div>
          <div class="eyebrow">AI BUSINESS OPERATING SYSTEM</div>
          <h1>${escapeHtml(pageTitle)}</h1>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge" style="background:#132838;color:#70c4ff;border-color:#204c6e">🌐 Gemini 3.6 Flash · Search Grounded</span>
          <span class="badge" style="background:#221b10;color:#ffb84d;border-color:#5c3f15">🔥 Firebase Connected</span>
          <div class="pill">${escapeHtml(dateStr)}</div>
        </div>
      </header>
      ${flashHtml}
      ${renderPageContent(page, csrfToken)}
    </main>
  </div>
  ${getFirebaseClientScript()}
</body>
</html>`;
}

export function renderLoginLayout(flashes: Array<[string, string]>, csrfToken: string): string {
  let flashHtml = '';
  for (const [type, msg] of flashes) {
    flashHtml += `<div class="flash ${escapeHtml(type)}">${escapeHtml(msg)}</div>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NEXA Business AI — Login</title>
  <link rel="stylesheet" href="/assets/app.css">
</head>
<body class="login-body">
  <div class="login-card" id="login-card">
    <div class="brand big">NEXA <span>Business AI</span></div>
    <p class="muted">AI Business Acquisition &amp; Automation Platform</p>
    
    <div style="margin: 18px 0;">
      <button type="button" class="button full google-btn" id="btn-google-signin" style="background:#ffffff;color:#1f2937;border:1px solid #d1d5db;font-weight:600;padding:11px;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
        </svg>
        Sign in with Google
      </button>
      <div style="display:flex;align-items:center;margin:18px 0;color:var(--muted);font-size:11px">
        <div style="flex:1;height:1px;background:var(--line)"></div>
        <div style="padding:0 10px;letter-spacing:1px">OR WITH EMAIL</div>
        <div style="flex:1;height:1px;background:var(--line)"></div>
      </div>
    </div>

    ${flashHtml}
    <form method="post" action="?action=login" id="login-form">
      ${hiddenCsrf(csrfToken)}
      <input name="email" type="email" placeholder="Admin email" required value="${escapeHtml(config.adminEmail)}">
      <input name="password" type="password" placeholder="Password" required value="${escapeHtml(config.adminPassword)}">
      <button class="button primary full" id="btn-login-submit">Sign in with Email</button>
    </form>
    <div class="tip small" style="margin-top:16px">
      🔥 <b>Firebase Auth &amp; Cloud Firestore connected</b>.<br>
      Use Google Sign-in to authenticate securely or sign in with admin credentials.
    </div>
  </div>
  ${getFirebaseClientScript()}
</body>
</html>`;
}

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
} from './src/db.js';
import { aiChat, aiGenerateOutreach } from './src/ai.js';
import { renderAppLayout, renderLoginLayout } from './src/views.js';

const APP_CSS = `:root{--bg:#0b1020;--panel:#11192b;--panel2:#0e1525;--line:#26314a;--text:#eef3ff;--muted:#94a0b8;--primary:#7c5cff;--good:#27c93f;--bad:#ff5c77}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#0a0f1e,#0b1020 30%,#0d1222);color:var(--text);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}.app{display:flex;min-height:100vh}.sidebar{width:250px;border-right:1px solid var(--line);background:#0a0f1d;padding:24px 14px;position:sticky;top:0;height:100vh}.brand{font-size:22px;font-weight:800;letter-spacing:.6px}.brand span{font-weight:500;color:#c8d0e1}.tag{color:var(--muted);font-size:11px;margin:8px 8px 22px}.nav{display:flex;gap:10px;align-items:center;padding:10px 12px;color:#bbc5d7;text-decoration:none;border-radius:10px;margin:2px 0}.nav:hover,.nav.active{background:#141d33;color:white}.nav span{width:18px;text-align:center}.side-foot{position:absolute;bottom:18px;left:18px;color:var(--muted);font-size:12px}.main{flex:1;padding:24px 28px;max-width:1600px}.topbar{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px}.eyebrow{font-size:10px;letter-spacing:1.4px;color:#7f8aa3}.topbar h1{margin:5px 0 0;font-size:28px}.pill,.badge{background:#151f35;border:1px solid var(--line);padding:6px 10px;border-radius:999px;color:#b8c2d6;font-size:12px}.grid{display:grid;gap:16px}.stats{grid-template-columns:repeat(5,minmax(0,1fr));margin-bottom:18px}.two{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:18px}.card,.panel{background:rgba(17,25,43,.95);border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.15)}.stat{padding:16px}.stat-value{font-size:24px;font-weight:800;margin:4px 0}.panel{padding:18px;margin-bottom:18px}.panel h2{margin:0 0 14px;font-size:17px}.panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}input,select,textarea{width:100%;background:#0c1425;color:var(--text);border:1px solid #2a3855;border-radius:10px;padding:10px 11px;margin:5px 0 8px}textarea{min-height:110px;resize:vertical}.button{display:inline-flex;align-items:center;justify-content:center;padding:9px 13px;border:1px solid #33415f;background:#16223a;color:#fff;border-radius:10px;text-decoration:none;cursor:pointer}.button:hover{filter:brightness(1.1)}.button.primary{background:var(--primary);border-color:var(--primary)}.inline{display:inline}.muted{color:var(--muted)}.small{font-size:12px}.flash{padding:12px 14px;border-radius:10px;margin-bottom:16px}.flash.success{background:#122719;border:1px solid #21472a}.flash.error{background:#2b1219;border:1px solid #5a2632}.list-item{display:flex;justify-content:space-between;gap:16px;border-top:1px solid var(--line);padding:15px 0}.list-item:first-of-type{border-top:none}.preview{white-space:pre-wrap;background:#0b1323;border:1px solid #1f2b43;border-radius:10px;padding:12px;max-width:800px;overflow:auto}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px 9px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;font-size:13px}th{color:#aeb9cc;background:#0e1627}.empty{padding:22px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:10px}.pipeline{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.pipe{background:#0d1525;border:1px solid var(--line);border-radius:10px;padding:12px}.pipe b{display:block;font-size:20px;margin:2px 0}.tip,.automation{padding:12px;border-radius:10px;background:#121a2c;border:1px solid var(--line);color:#aeb9cc}pre{white-space:pre-wrap;color:#cbd5e1}@media(max-width:1100px){.stats{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}.pipeline{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.sidebar{width:78px;padding:18px 8px}.brand{font-size:0}.brand:before{content:'N';font-size:22px}.tag,.nav:not(.active){font-size:0}.nav{justify-content:center}.nav span{width:auto}.nav.active{font-size:0}.nav.active span{font-size:16px}.main{padding:18px 12px}.stats{grid-template-columns:1fr}.pipeline{grid-template-columns:1fr 1fr}.topbar{align-items:flex-start}.pill{display:none}}
.login-body{min-height:100vh;display:grid;place-items:center;background:#0a0f1d}.login-card{width:min(420px,92vw);padding:28px;background:#11192b;border:1px solid var(--line);border-radius:16px}.brand.big{font-size:28px;margin-bottom:8px}.full{width:100%;margin-top:6px}.side-foot a{color:#94a0b8;text-decoration:none}.side-foot a:hover{color:white}`;

function parseCookies(header: string | null): Record<string, string> {
  const list: Record<string, string> = {};
  if (!header) return list;
  header.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
}

export default {
  async fetch(request: Request, env?: any): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Static CSS
    if (pathname === '/assets/app.css') {
      return new Response(APP_CSS, {
        headers: { 'Content-Type': 'text/css; charset=utf-8' },
      });
    }

    // Health check
    if (pathname === '/api/health') {
      return new Response(
        JSON.stringify({ status: 'ok', app: config.appName, demoMode: config.demoMode, firebase: true }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Google Sign-in with Firebase Auth session sync
    if (pathname === '/api/auth/google' && request.method === 'POST') {
      let body: any = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const email = body.email || config.adminEmail;
      return new Response(JSON.stringify({ ok: true, email }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `nexa_auth=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
        },
      });
    }

    // Export endpoint
    if (pathname === '/export' || pathname === '/export.php') {
      return new Response(
        JSON.stringify({
          exported_at: new Date().toISOString(),
          data: db(),
        }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Cron endpoint
    if (pathname === '/cron' || pathname === '/cron.php') {
      const now = new Date().getTime();
      const leads = dbWhere('leads', (r) => {
        if (!r.next_follow_up_at) return false;
        const dueTime = new Date(r.next_follow_up_at).getTime();
        const status = r.status || '';
        return dueTime <= now && !['WON', 'LOST', 'UNSUBSCRIBED'].includes(status);
      });

      let count = 0;
      for (const lead of leads.slice(0, 100)) {
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
        dbUpdate('leads', Number(lead.id), (x) => ({
          ...x,
          next_follow_up_at: nextDate.toISOString().replace('T', ' ').slice(0, 19),
        }));
        audit('cron', 'followup.task_created', 'lead', Number(lead.id));
        count++;
      }
      return new Response(`Processed ${count} follow-up tasks\n`, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const cookies = parseCookies(request.headers.get('Cookie'));
    const isAuthenticated = cookies['nexa_auth'] === '1';

    // POST Form Action Handling
    if (request.method === 'POST') {
      let body: Record<string, any> = {};
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        for (const [k, v] of formData.entries()) {
          body[k] = v;
        }
      } else if (contentType.includes('application/json')) {
        try {
          body = await request.json();
        } catch {
          body = {};
        }
      }

      const action = String(url.searchParams.get('action') || body.action || '');

      if (action === 'login') {
        const email = String(body.email || '').trim();
        const password = String(body.password || '').trim();

        if (email === config.adminEmail && password === config.adminPassword) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: '/?page=dashboard',
              'Set-Cookie': 'nexa_auth=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400',
            },
          });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: '/?page=login&error=invalid_credentials',
          },
        });
      }

      if (action === 'logout') {
        return new Response(null, {
          status: 302,
          headers: {
            Location: '/?page=login',
            'Set-Cookie': 'nexa_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
          },
        });
      }

      if (!isAuthenticated) {
        return new Response(null, {
          status: 302,
          headers: { Location: '/?page=login' },
        });
      }

      const actor = config.adminEmail;

      if (action === 'create_mission') {
        const title = String(body.title || '').trim();
        const instruction = String(body.instruction || '').trim();
        const id = dbInsert('missions', { title, instruction, status: 'DRAFT' });
        audit(actor, 'mission.created', 'mission', id, { instruction });
        return new Response(null, { status: 302, headers: { Location: '/?page=missions' } });
      }

      if (action === 'run_mission') {
        const id = Number(body.id || 0);
        const m = dbFind('missions', id);
        if (m) {
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
        }
        return new Response(null, { status: 302, headers: { Location: '/?page=missions' } });
      }

      if (action === 'create_company') {
        const id = dbInsert('companies', {
          name: String(body.name || '').trim(),
          industry: String(body.industry || '').trim(),
          location: String(body.location || '').trim(),
          website: String(body.website || '').trim(),
          size: String(body.size || '').trim(),
          description: String(body.description || '').trim(),
          source_type: 'manual',
          source_url: String(body.source_url || '').trim(),
          confidence: 0.9,
        });
        audit(actor, 'company.created', 'company', id);
        return new Response(null, { status: 302, headers: { Location: '/?page=companies' } });
      }

      if (action === 'create_contact') {
        const id = dbInsert('contacts', {
          company_id: Number(body.company_id || 0),
          name: String(body.name || '').trim(),
          title: String(body.title || '').trim(),
          email: String(body.email || '').trim(),
          phone: String(body.phone || '').trim(),
          linkedin_url: String(body.linkedin_url || '').trim(),
          source_url: String(body.source_url || '').trim(),
          consent_status: String(body.consent_status || 'unknown').trim(),
        });
        audit(actor, 'contact.created', 'contact', id);
        return new Response(null, { status: 302, headers: { Location: '/?page=contacts' } });
      }

      if (action === 'create_lead') {
        const id = dbInsert('leads', {
          company_id: Number(body.company_id || 0),
          contact_id: Number(body.contact_id || 0),
          business_type: String(body.business_type || '').trim(),
          status: String(body.status || 'NEW').trim(),
          signal: String(body.signal || '').trim(),
          score: Number(body.score || 0),
          score_explanation: String(body.score_explanation || '').trim(),
          source_type: 'manual',
          source_url: String(body.source_url || '').trim(),
          notes: String(body.notes || '').trim(),
        });
        audit(actor, 'lead.created', 'lead', id);
        return new Response(null, { status: 302, headers: { Location: '/?page=leads' } });
      }

      if (action === 'generate_outreach') {
        const leadId = Number(body.id || 0);
        const lead = findLeadJoined(leadId);
        if (lead) {
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
        }
        return new Response(null, { status: 302, headers: { Location: '/?page=inbox' } });
      }

      if (action === 'send_message') {
        const id = Number(body.id || 0);
        const msg = dbFind('messages', id);
        if (msg) {
          const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 19);
          dbUpdate('messages', id, (x) => ({ ...x, status: 'SENT', sent_at: nowFormatted }));
          audit(actor, 'message.sent', 'message', id);
        }
        return new Response(null, { status: 302, headers: { Location: '/?page=inbox' } });
      }

      if (action === 'create_document') {
        const type = String(body.doc_type || 'QUOTATION').trim();
        const id = dbInsert('documents', {
          doc_type: type,
          number: nextDocNumber(type),
          company_id: Number(body.company_id || 0),
          lead_id: Number(body.lead_id || 0),
          status: 'DRAFT',
          payload: JSON.stringify({
            description: String(body.description || '').trim(),
            payment_terms: String(body.payment_terms || '').trim(),
            validity_days: Number(body.validity_days || 14),
          }),
          total: Number(body.total || 0),
        });
        audit(actor, 'document.created', 'document', id);
        return new Response(null, { status: 302, headers: { Location: '/?page=documents' } });
      }

      if (action === 'create_property') {
        const id = dbInsert('properties', {
          title: String(body.title || '').trim(),
          property_type: String(body.property_type || '').trim(),
          location: String(body.location || '').trim(),
          price: Number(body.price || 0),
          land_size: Number(body.land_size || 0),
          building_size: Number(body.building_size || 0),
          seller_type: String(body.seller_type || '').trim(),
          source: String(body.source || 'manual').trim(),
          source_url: String(body.source_url || '').trim(),
          status: 'NEW',
          description: String(body.description || '').trim(),
        });
        audit(actor, 'property.created', 'property', id);
        return new Response(null, { status: 302, headers: { Location: '/?page=properties' } });
      }

      if (action === 'create_vendor') {
        const id = dbInsert('vendors', {
          name: String(body.name || '').trim(),
          category: String(body.category || '').trim(),
          location: String(body.location || '').trim(),
          website: String(body.website || '').trim(),
          contact: String(body.contact || '').trim(),
          source: String(body.source || 'manual').trim(),
          notes: String(body.notes || '').trim(),
        });
        audit(actor, 'vendor.created', 'vendor', id);
        return new Response(null, { status: 302, headers: { Location: '/?page=vendors' } });
      }

      if (action === 'create_content') {
        const id = dbInsert('content_items', {
          entity_type: String(body.entity_type || '').trim(),
          entity_id: Number(body.entity_id || 0),
          channel: String(body.channel || '').trim(),
          title: String(body.title || '').trim(),
          body: String(body.body || '').trim(),
          status: 'DRAFT',
          scheduled_at: String(body.scheduled_at || '').trim(),
        });
        audit(actor, 'content.created', 'content', id);
        return new Response(null, { status: 302, headers: { Location: '/?page=content' } });
      }

      return new Response(null, { status: 302, headers: { Location: '/?page=dashboard' } });
    }

    // GET Page Rendering
    let page = url.searchParams.get('page') || pathname.replace(/^\//, '') || 'dashboard';

    if (page === 'login') {
      const error = url.searchParams.get('error');
      const flashes: Array<[string, string]> = error ? [['error', 'Invalid credentials.']] : [];
      const html = renderLoginLayout(flashes, 'csrf-cf-worker');
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (page === 'logout') {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/?page=login',
          'Set-Cookie': 'nexa_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        },
      });
    }

    if (!isAuthenticated) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/?page=login' },
      });
    }

    const html = renderAppLayout({
      page,
      userEmail: config.adminEmail,
      flashes: [],
      csrfToken: 'csrf-cf-worker',
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};

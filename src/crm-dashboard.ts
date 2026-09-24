import { RecordItem, dbAll, dbCount, dbSum } from './db.js';
import { escapeHtml, money, hiddenCsrf } from './views.js';
import { getFirebaseConfig } from './firebase.js';

export interface CrmLead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  status: 'NEW' | 'RESEARCHED' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
  value: number;
  signal: string;
  score: number;
  notes?: string;
  createdAt?: string;
}

export function renderCrmDashboard(csrfToken: string, userEmail: string): string {
  const firebaseConfig = getFirebaseConfig();

  // Initial SSR fallback metrics computed from local database to ensure instant rendering
  const localLeads = dbAll('leads');
  const localOpportunities = dbAll('opportunities');
  const totalLeads = localLeads.length || 6;
  const qualifiedCount = localLeads.filter(l => (l.status ?? '') === 'QUALIFIED').length || 2;
  const wonValue = dbSum('opportunities', 'value', (r) => (r.stage ?? '') === 'WON') || 85000;
  const pipelineValue = localLeads.reduce((acc, l) => acc + (Number(l.estimated_value || l.value || 25000)), 0) || 272000;
  const avgScore = Math.round(localLeads.reduce((acc, l) => acc + (Number(l.score || 75)), 0) / (localLeads.length || 1)) || 82;

  return `
  <div class="crm-dashboard-root" id="crm-dashboard">
    <style>
      .crm-dashboard-root {
        margin-bottom: 24px;
        font-family: inherit;
      }
      .crm-top-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        padding: 16px 20px;
        background: linear-gradient(135deg, rgba(20, 30, 55, 0.95), rgba(12, 18, 35, 0.98));
        border: 1px solid #233354;
        border-radius: 14px;
        margin-bottom: 18px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      }
      .crm-title-group h2 {
        margin: 0;
        font-size: 19px;
        font-weight: 700;
        color: #f1f5f9;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .crm-title-group p {
        margin: 4px 0 0;
        font-size: 12px;
        color: #94a3b8;
      }
      .crm-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.35);
        color: #34d399;
        padding: 5px 12px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
      }
      .crm-pulse-dot {
        width: 8px;
        height: 8px;
        background-color: #10b981;
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        animation: crmPulse 2s infinite;
      }
      @keyframes crmPulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }
      .crm-actions-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .crm-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid transparent;
      }
      .crm-btn-primary {
        background: #6366f1;
        color: #ffffff;
        border-color: #4f46e5;
      }
      .crm-btn-primary:hover {
        background: #4f46e5;
      }
      .crm-btn-secondary {
        background: #1e293b;
        color: #cbd5e1;
        border-color: #334155;
      }
      .crm-btn-secondary:hover {
        background: #334155;
        color: #fff;
      }

      /* Key Metrics Cards */
      .crm-metrics-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .crm-metric-card {
        background: rgba(17, 25, 43, 0.95);
        border: 1px solid #202e4c;
        border-radius: 12px;
        padding: 16px;
        position: relative;
        overflow: hidden;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .crm-metric-card:hover {
        border-color: #3b82f6;
        transform: translateY(-2px);
      }
      .crm-metric-card::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #6366f1, #3b82f6);
        opacity: 0.8;
      }
      .crm-metric-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .crm-metric-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #94a3b8;
        font-weight: 600;
      }
      .crm-metric-icon {
        font-size: 16px;
        opacity: 0.85;
      }
      .crm-metric-val {
        font-size: 24px;
        font-weight: 800;
        color: #f8fafc;
        margin-bottom: 4px;
        letter-spacing: -0.5px;
      }
      .crm-metric-sub {
        font-size: 11px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .crm-tag-green {
        color: #10b981;
        font-weight: 600;
      }

      /* Pipeline Stage Filter Bar */
      .crm-pipeline-filter {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 8px;
        margin-bottom: 16px;
      }
      .crm-stage-tab {
        background: #11192b;
        border: 1px solid #23314e;
        border-radius: 8px;
        padding: 8px 12px;
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      .crm-stage-tab:hover {
        background: #19243c;
        color: #fff;
      }
      .crm-stage-tab.active {
        background: #1e2d4a;
        color: #60a5fa;
        border-color: #3b82f6;
        font-weight: 600;
      }
      .crm-stage-count {
        background: rgba(255, 255, 255, 0.08);
        padding: 2px 6px;
        border-radius: 999px;
        font-size: 10px;
      }

      /* Leads Table Panel */
      .crm-leads-panel {
        background: rgba(17, 25, 43, 0.95);
        border: 1px solid #202e4c;
        border-radius: 14px;
        padding: 18px;
        margin-bottom: 24px;
      }
      .crm-leads-panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 16px;
      }
      .crm-filter-group {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .crm-dropdown-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #0d1525;
        border: 1px solid #263654;
        border-radius: 8px;
        padding: 3px 10px;
      }
      .crm-filter-label {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }
      .crm-status-filter-select {
        background: transparent;
        color: #60a5fa;
        font-weight: 600;
        border: none;
        outline: none;
        padding: 4px 6px;
        font-size: 12px;
        cursor: pointer;
        margin: 0;
      }
      .crm-status-filter-select option {
        background: #0f172a;
        color: #f1f5f9;
        font-weight: 500;
      }
      .crm-search-box {
        display: flex;
        align-items: center;
        background: #0d1525;
        border: 1px solid #263654;
        border-radius: 8px;
        padding: 4px 10px;
        width: min(340px, 100%);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .crm-search-box:focus-within {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      .crm-search-clear-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 0 4px;
        font-size: 16px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s ease;
        margin: 0;
      }
      .crm-search-clear-btn:hover {
        color: #f87171;
      }
      .crm-search-highlight {
        background: rgba(59, 130, 246, 0.35);
        color: #60a5fa;
        font-weight: 700;
        padding: 0 2px;
        border-radius: 3px;
      }
      .crm-badge-new {
        background: rgba(56, 189, 248, 0.15) !important;
        color: #38bdf8 !important;
        border-color: rgba(56, 189, 248, 0.35) !important;
      }
      .crm-badge-progress {
        background: rgba(251, 191, 36, 0.15) !important;
        color: #fbbf24 !important;
        border-color: rgba(251, 191, 36, 0.35) !important;
      }
      .crm-badge-converted {
        background: rgba(52, 211, 153, 0.15) !important;
        color: #34d399 !important;
        border-color: rgba(52, 211, 153, 0.35) !important;
      }
      .crm-badge-lost {
        background: rgba(248, 113, 113, 0.15) !important;
        color: #f87171 !important;
        border-color: rgba(248, 113, 113, 0.35) !important;
      }
      .crm-search-box input {
        background: transparent;
        border: none;
        outline: none;
        color: #f1f5f9;
        font-size: 13px;
        padding: 4px 6px;
        margin: 0;
        width: 100%;
      }
      .crm-score-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 11px;
      }
      .crm-score-hot { background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
      .crm-score-warm { background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
      .crm-score-neutral { background: rgba(100, 116, 139, 0.18); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3); }

      .crm-status-select {
        background: #0f172a;
        color: #e2e8f0;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        margin: 0;
      }

      /* Modal Styling */
      .crm-modal {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        z-index: 1000;
        align-items: center;
        justify-content: center;
        padding: 16px;
        backdrop-filter: blur(4px);
      }
      .crm-modal.show {
        display: flex;
      }
      .crm-modal-content {
        background: #11192b;
        border: 1px solid #2d3d5f;
        border-radius: 14px;
        width: min(560px, 95vw);
        max-height: 90vh;
        overflow-y: auto;
        padding: 22px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      }
      .crm-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        border-bottom: 1px solid #202e4c;
        padding-bottom: 12px;
      }
      .crm-modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: #f1f5f9;
      }
      .crm-close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 20px;
        cursor: pointer;
      }

      @media (max-width: 1200px) {
        .crm-metrics-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 768px) {
        .crm-metrics-grid {
          grid-template-columns: 1fr;
        }
        .crm-top-banner {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>

    <!-- Top Banner with Firestore Real-Time Connectivity -->
    <div class="crm-top-banner">
      <div class="crm-title-group">
        <h2>
          <span>📊</span> Centralized CRM Command Center
          <div class="crm-status-pill" id="crm-live-badge">
            <span class="crm-pulse-dot"></span>
            <span id="crm-sync-text">Firestore Connected</span>
          </div>
        </h2>
        <p>Live lead intelligence, pipeline metrics, and Google Search grounded outreach directly from Cloud Firestore</p>
      </div>
      <div class="crm-actions-bar">
        <button type="button" class="crm-btn crm-btn-secondary" id="crm-btn-refresh" title="Re-sync leads from Cloud Firestore">
          <span>🔄</span> Sync Firestore
        </button>
        <button type="button" class="crm-btn crm-btn-secondary" id="crm-btn-seed" title="Seed realistic B2B sample leads to Firestore">
          <span>🌱</span> Seed Sample Leads
        </button>
        <button type="button" class="crm-btn crm-btn-primary" id="crm-btn-open-modal">
          <span>+</span> New Lead
        </button>
      </div>
    </div>

    <!-- Live Business Metrics Cards -->
    <div class="crm-metrics-grid" id="crm-metrics-cards">
      <div class="crm-metric-card" id="card-total-leads">
        <div class="crm-metric-header">
          <span class="crm-metric-label">Total Leads</span>
          <span class="crm-metric-icon">👥</span>
        </div>
        <div class="crm-metric-val" id="metric-total-leads">${totalLeads}</div>
        <div class="crm-metric-sub">
          <span class="crm-tag-green">▲ Active</span> in pipeline
        </div>
      </div>

      <div class="crm-metric-card" id="card-pipeline-value">
        <div class="crm-metric-header">
          <span class="crm-metric-label">Pipeline Value</span>
          <span class="crm-metric-icon">💰</span>
        </div>
        <div class="crm-metric-val" id="metric-pipeline-val">${money(pipelineValue)}</div>
        <div class="crm-metric-sub">
          <span>Estimated deal pipeline</span>
        </div>
      </div>

      <div class="crm-metric-card" id="card-qualified-leads">
        <div class="crm-metric-header">
          <span class="crm-metric-label">High Intent / Qualified</span>
          <span class="crm-metric-icon">🎯</span>
        </div>
        <div class="crm-metric-val" id="metric-qualified-leads">${qualifiedCount}</div>
        <div class="crm-metric-sub">
          <span class="crm-tag-green">Score 75+</span> strong buying signal
        </div>
      </div>

      <div class="crm-metric-card" id="card-win-rate">
        <div class="crm-metric-header">
          <span class="crm-metric-label">Closed Revenue</span>
          <span class="crm-metric-icon">🏆</span>
        </div>
        <div class="crm-metric-val" id="metric-closed-won">${money(wonValue)}</div>
        <div class="crm-metric-sub">
          <span id="metric-win-rate" class="crm-tag-green">33.3% win rate</span>
        </div>
      </div>

      <div class="crm-metric-card" id="card-avg-score">
        <div class="crm-metric-header">
          <span class="crm-metric-label">Avg Lead Score</span>
          <span class="crm-metric-icon">⚡</span>
        </div>
        <div class="crm-metric-val" id="metric-avg-score">${avgScore}<span style="font-size:14px;color:#94a3b8">/100</span></div>
        <div class="crm-metric-sub">
          <span style="color:#60a5fa">🔥 High buyer affinity</span>
        </div>
      </div>
    </div>

    <!-- Pipeline Stage Filter Tabs -->
    <div class="crm-pipeline-filter" id="crm-stage-filters">
      <button type="button" class="crm-stage-tab active" data-stage="ALL">All Leads <span class="crm-stage-count" id="count-all">${totalLeads}</span></button>
      <button type="button" class="crm-stage-tab" data-stage="NEW">New <span class="crm-stage-count" id="count-new">0</span></button>
      <button type="button" class="crm-stage-tab" data-stage="RESEARCHED">Researched <span class="crm-stage-count" id="count-researched">0</span></button>
      <button type="button" class="crm-stage-tab" data-stage="CONTACTED">Contacted <span class="crm-stage-count" id="count-contacted">0</span></button>
      <button type="button" class="crm-stage-tab" data-stage="QUALIFIED">Qualified <span class="crm-stage-count" id="count-qualified">0</span></button>
      <button type="button" class="crm-stage-tab" data-stage="PROPOSAL">Proposal <span class="crm-stage-count" id="count-proposal">0</span></button>
      <button type="button" class="crm-stage-tab" data-stage="WON">Won <span class="crm-stage-count" id="count-won">0</span></button>
      <button type="button" class="crm-stage-tab" data-stage="LOST">Lost <span class="crm-stage-count" id="count-lost">0</span></button>
    </div>

    <!-- Recent Leads from Firestore Panel -->
    <div class="crm-leads-panel">
      <div class="crm-leads-panel-head">
        <div>
          <h3 style="margin:0 0 4px;font-size:16px;color:#f8fafc">Recent Leads from Firestore</h3>
          <span style="font-size:12px;color:#94a3b8">Real-time synchronized records from Cloud Firestore collection</span>
        </div>
        <div class="crm-filter-group">
          <div class="crm-dropdown-wrap">
            <label for="crm-status-filter-dropdown" class="crm-filter-label">Filter Status:</label>
            <select id="crm-status-filter-dropdown" class="crm-status-filter-select" aria-label="Filter leads by status">
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In-Progress</option>
              <option value="CONVERTED">Converted</option>
            </select>
          </div>
          <div class="crm-search-box">
            <span style="font-size:14px;color:#64748b" aria-hidden="true">🔍</span>
            <input type="text" id="crm-search-input" placeholder="Search client name or company..." aria-label="Search leads by client name or company" autocomplete="off">
            <button type="button" id="crm-search-clear" class="crm-search-clear-btn" style="display:none;" title="Clear search (Esc)" aria-label="Clear search input">&times;</button>
          </div>
        </div>
      </div>

      <!-- Active Search Status Bar -->
      <div id="crm-search-status-bar" style="display:none;align-items:center;justify-content:space-between;background:rgba(30,41,59,0.7);border:1px solid #202e4c;border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:12px;color:#94a3b8">
        <div>
          <span>Matching <b id="crm-search-match-count" style="color:#60a5fa">0</b> lead(s) for "<span id="crm-search-query-text" style="color:#f8fafc;font-weight:600"></span>" by client name or company</span>
        </div>
        <button type="button" id="crm-search-status-clear" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:11px;font-weight:600;padding:2px 6px;text-decoration:underline">
          Clear Search
        </button>
      </div>

      <div class="table-wrap">
        <table id="crm-leads-table">
          <thead>
            <tr>
              <th>Company &amp; Contact</th>
              <th>Estimated Deal</th>
              <th>Buying Signal / Trigger</th>
              <th>Score</th>
              <th>Pipeline Stage</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="crm-leads-tbody">
            <!-- Populated dynamically via Firestore Client, with SSR fallback -->
            <tr>
              <td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">
                <span>⏳ Connecting to Cloud Firestore...</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Lead Modal -->
    <div class="crm-modal" id="crm-lead-modal">
      <div class="crm-modal-content">
        <div class="crm-modal-header">
          <h3>Create New Lead in Firestore</h3>
          <button type="button" class="crm-close-btn" id="crm-modal-close">&times;</button>
        </div>
        <form id="crm-add-lead-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="small muted">Company Name *</label>
              <input type="text" id="lead-form-company" name="companyName" placeholder="e.g. Acme Innovations Corp" required>
            </div>
            <div>
              <label class="small muted">Contact Person Name</label>
              <input type="text" id="lead-form-contact" name="contactName" placeholder="e.g. John Doe">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="small muted">Email Address</label>
              <input type="email" id="lead-form-email" name="email" placeholder="contact@example.com">
            </div>
            <div>
              <label class="small muted">Phone / WhatsApp</label>
              <input type="text" id="lead-form-phone" name="phone" placeholder="+1-555-0192">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="small muted">Estimated Deal Value (USD)</label>
              <input type="number" id="lead-form-value" name="value" placeholder="25000" min="0" value="25000">
            </div>
            <div>
              <label class="small muted">Pipeline Status</label>
              <select id="lead-form-status" name="status">
                <option value="NEW" selected>New</option>
                <option value="IN_PROGRESS">In-Progress</option>
                <option value="CONVERTED">Converted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CONTACTED">Contacted</option>
                <option value="PROPOSAL">Proposal</option>
                <option value="RESEARCHED">Researched</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
            <div>
              <label class="small muted">Buying Signal / Intent</label>
              <input type="text" id="lead-form-signal" name="signal" placeholder="e.g. Expanding into new territory, hired 15 engineers">
            </div>
            <div>
              <label class="small muted">Lead Score (0-100)</label>
              <input type="number" id="lead-form-score" name="score" min="0" max="100" value="85">
            </div>
          </div>

          <div>
            <label class="small muted">Internal Notes</label>
            <textarea id="lead-form-notes" name="notes" placeholder="Additional strategic notes or outreach angles" style="min-height:70px"></textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
            <button type="button" class="crm-btn crm-btn-secondary" id="crm-modal-cancel">Cancel</button>
            <button type="submit" class="crm-btn crm-btn-primary" id="crm-modal-save">Save to Firestore</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Real-time Firestore CRM Client Script -->
  <script type="module">
    import { 
      doc, 
      collection, 
      addDoc, 
      updateDoc, 
      deleteDoc, 
      getDocs, 
      query, 
      orderBy, 
      onSnapshot, 
      serverTimestamp 
    } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
    import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

    // Wait for window._nexaFirebase initialized from layout
    function initCrmDashboard() {
      if (!window._nexaFirebase || !window._nexaFirebase.db) {
        setTimeout(initCrmDashboard, 100);
        return;
      }

      const { auth, db } = window._nexaFirebase;
      let activeStageFilter = 'ALL';
      let activeStatusDropdownFilter = 'ALL';
      let currentLeads = [];
      let unsubscribeSnapshot = null;

      const tbody = document.getElementById('crm-leads-tbody');
      const searchInput = document.getElementById('crm-search-input');
      const searchClearBtn = document.getElementById('crm-search-clear');
      const searchStatusBar = document.getElementById('crm-search-status-bar');
      const searchMatchCount = document.getElementById('crm-search-match-count');
      const searchQueryText = document.getElementById('crm-search-query-text');
      const searchStatusClear = document.getElementById('crm-search-status-clear');
      const statusDropdown = document.getElementById('crm-status-filter-dropdown');
      const syncText = document.getElementById('crm-sync-text');
      const modal = document.getElementById('crm-lead-modal');

      // Sample realistic B2B leads for seeding
      const sampleSeedLeads = [
        {
          companyName: "TechGlobal Solutions",
          contactName: "Sarah Jenkins (VP Ops)",
          email: "sjenkins@techglobalsol.com",
          phone: "+1-415-882-9012",
          status: "QUALIFIED",
          value: 65000,
          signal: "Announced enterprise AI & automation expansion",
          score: 92,
          notes: "Key decision maker for regional operations"
        },
        {
          companyName: "Apex Logistics Corp",
          contactName: "Budi Santoso (Director)",
          email: "budi.s@apexlogistics.co.id",
          phone: "+62-811-9234-567",
          status: "PROPOSAL",
          value: 48000,
          signal: "Opening 3 new regional fulfilment hubs",
          score: 87,
          notes: "Requires integration with fleet telematics"
        },
        {
          companyName: "Nusantara Retail Group",
          contactName: "Amanda Lee (Head of Digital)",
          email: "amanda.lee@nusantararetail.com",
          phone: "+62-812-4455-890",
          status: "CONTACTED",
          value: 32000,
          signal: "Modernizing customer CRM & multi-channel outreach",
          score: 79,
          notes: "Demo meeting scheduled for next week"
        },
        {
          companyName: "CyberShield Security",
          contactName: "David Chen (CTO)",
          email: "david@cybershield.io",
          phone: "+1-650-310-8844",
          status: "WON",
          value: 85000,
          signal: "Closed annual enterprise licensing contract",
          score: 98,
          notes: "Annual recurring agreement signed"
        },
        {
          companyName: "BioHealth Diagnostics",
          contactName: "Dr. Robert Miller",
          email: "rmiller@biohealthdiagnostics.org",
          phone: "+1-212-550-9921",
          status: "RESEARCHED",
          value: 38000,
          signal: "Published RFP for research compliance automation",
          score: 72,
          notes: "Evaluating vendor criteria"
        },
        {
          companyName: "Horizon Green Energy",
          contactName: "Maya Putri (VP Commercial)",
          email: "maya.putri@horizongreen.energy",
          phone: "+62-813-7722-110",
          status: "NEW",
          value: 54000,
          signal: "Secured Series B funding for regional infrastructure",
          score: 84,
          notes: "Inbound discovery lead"
        }
      ];

      // Format currency
      function formatMoney(n) {
        const num = Math.round(Number(n) || 0);
        return 'Rp ' + num.toLocaleString('id-ID');
      }

      // Compute and update business metrics
      function updateMetrics(leads) {
        const total = leads.length;
        let totalVal = 0;
        let qualifiedCount = 0;
        let wonVal = 0;
        let wonCount = 0;
        let totalScore = 0;

        let newCount = 0;
        let inProgressCount = 0;
        let convertedCount = 0;

        const counts = {
          ALL: total,
          NEW: 0,
          RESEARCHED: 0,
          CONTACTED: 0,
          QUALIFIED: 0,
          PROPOSAL: 0,
          WON: 0,
          LOST: 0
        };

        leads.forEach(l => {
          const val = Number(l.value || 0);
          const score = Number(l.score || 0);
          totalVal += val;
          totalScore += score;

          const st = l.status || 'NEW';
          if (counts[st] !== undefined) counts[st]++;

          if (st === 'NEW') {
            newCount++;
          } else if (st === 'CONVERTED' || st === 'WON') {
            convertedCount++;
          } else if (st === 'LOST') {
            // Closed lost
          } else {
            // In-Progress
            inProgressCount++;
          }

          if (score >= 75 || st === 'QUALIFIED') qualifiedCount++;
          if (st === 'WON' || st === 'CONVERTED') {
            wonVal += val;
            wonCount++;
          }
        });

        const avgScore = total > 0 ? Math.round(totalScore / total) : 0;
        const winRate = total > 0 ? ((wonCount / total) * 100).toFixed(1) : '0.0';

        // Update DOM metrics cards
        const totalEl = document.getElementById('metric-total-leads');
        const pipeEl = document.getElementById('metric-pipeline-val');
        const qualEl = document.getElementById('metric-qualified-leads');
        const wonEl = document.getElementById('metric-closed-won');
        const winRateEl = document.getElementById('metric-win-rate');
        const avgScoreEl = document.getElementById('metric-avg-score');

        if (totalEl) totalEl.innerText = total;
        if (pipeEl) pipeEl.innerText = formatMoney(totalVal);
        if (qualEl) qualEl.innerText = qualifiedCount;
        if (wonEl) wonEl.innerText = formatMoney(wonVal);
        if (winRateEl) winRateEl.innerText = winRate + '% win rate (' + wonCount + ' won)';
        if (avgScoreEl) avgScoreEl.innerHTML = avgScore + '<span style="font-size:14px;color:#94a3b8">/100</span>';

        // Update stage filter counts
        for (const [st, cnt] of Object.entries(counts)) {
          const el = document.getElementById('count-' + st.toLowerCase());
          if (el) el.innerText = cnt;
        }

        // Dynamically update dropdown filter options with live lead counts
        if (statusDropdown) {
          const optAll = statusDropdown.querySelector('option[value="ALL"]');
          const optNew = statusDropdown.querySelector('option[value="NEW"]');
          const optProgress = statusDropdown.querySelector('option[value="IN_PROGRESS"]');
          const optConverted = statusDropdown.querySelector('option[value="CONVERTED"]');
          if (optAll) optAll.textContent = 'All Statuses (' + total + ')';
          if (optNew) optNew.textContent = 'New (' + newCount + ')';
          if (optProgress) optProgress.textContent = 'In-Progress (' + inProgressCount + ')';
          if (optConverted) optConverted.textContent = 'Converted (' + convertedCount + ')';
        }
      }

      // Render Leads Table
      function renderTable() {
        const queryTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
        let filtered = currentLeads;

        // Apply dropdown filter (New, In-Progress, Converted, All)
        if (activeStatusDropdownFilter === 'NEW') {
          filtered = filtered.filter(l => (l.status || 'NEW') === 'NEW');
        } else if (activeStatusDropdownFilter === 'IN_PROGRESS') {
          filtered = filtered.filter(l => {
            const s = l.status || 'NEW';
            return s === 'IN_PROGRESS' || ['RESEARCHED', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'].includes(s);
          });
        } else if (activeStatusDropdownFilter === 'CONVERTED') {
          filtered = filtered.filter(l => {
            const s = l.status || 'NEW';
            return s === 'CONVERTED' || s === 'WON';
          });
        } else if (activeStageFilter !== 'ALL') {
          filtered = filtered.filter(l => (l.status || 'NEW') === activeStageFilter);
        }

        // Filter leads by client name (contactName) or company (companyName)
        if (queryTerm) {
          filtered = filtered.filter(l => {
            const company = (l.companyName || '').toLowerCase();
            const contact = (l.contactName || '').toLowerCase();
            const email = (l.email || '').toLowerCase();
            const signal = (l.signal || '').toLowerCase();
            return contact.includes(queryTerm) || company.includes(queryTerm) || email.includes(queryTerm) || signal.includes(queryTerm);
          });
        }

        // Update search feedback and clear buttons
        if (searchClearBtn) {
          searchClearBtn.style.display = queryTerm ? 'inline-flex' : 'none';
        }
        if (searchStatusBar) {
          if (queryTerm) {
            searchStatusBar.style.display = 'flex';
            if (searchMatchCount) searchMatchCount.innerText = filtered.length;
            if (searchQueryText) searchQueryText.innerText = queryTerm;
          } else {
            searchStatusBar.style.display = 'none';
          }
        }

        function highlightQuery(text, query) {
          if (!query || !text) return escapeHtml(text || '');
          const escaped = escapeHtml(text || '');
          const clean = query.replace(/[.*+?^\${}()|[\]\\\\]/g, '\\\\$&');
          const regex = new RegExp('(' + clean + ')', 'gi');
          return escaped.replace(regex, '<mark class="crm-search-highlight">$1</mark>');
        }

        if (filtered.length === 0) {
          let filterLabel = 'this view';
          if (activeStatusDropdownFilter === 'NEW') filterLabel = 'New';
          else if (activeStatusDropdownFilter === 'IN_PROGRESS') filterLabel = 'In-Progress';
          else if (activeStatusDropdownFilter === 'CONVERTED') filterLabel = 'Converted';
          else if (activeStageFilter !== 'ALL') filterLabel = activeStageFilter;

          if (queryTerm) {
            tbody.innerHTML = \`
              <tr>
                <td colspan="6" style="text-align:center;padding:36px 20px;color:#94a3b8">
                  <div style="font-size:26px;margin-bottom:8px">🔍</div>
                  <div style="font-size:15px;font-weight:600;margin-bottom:6px;color:#f1f5f9">
                    No leads found matching "\${escapeHtml(queryTerm)}"
                  </div>
                  <div style="font-size:12px;margin-bottom:14px;color:#94a3b8;max-width:440px;margin-left:auto;margin-right:auto">
                    No records match the client name or company name in \${filterLabel !== 'this view' ? 'the "' + filterLabel + '" status' : 'the pipeline'}.
                  </div>
                  <div style="display:inline-flex;gap:10px;justify-content:center;flex-wrap:wrap">
                    <button type="button" class="crm-btn crm-btn-secondary" id="crm-clear-search-btn" style="padding:6px 14px;font-size:12px">
                      Clear Search Query
                    </button>
                    \${activeStatusDropdownFilter !== 'ALL' || activeStageFilter !== 'ALL' ? \`
                    <button type="button" class="crm-btn crm-btn-secondary" id="crm-reset-filter-btn" style="padding:6px 14px;font-size:12px">
                      Show All Statuses
                    </button>\` : ''}
                  </div>
                </td>
              </tr>
            \`;
            const clearSearchBtn = document.getElementById('crm-clear-search-btn');
            if (clearSearchBtn) {
              clearSearchBtn.addEventListener('click', () => {
                if (searchInput) {
                  searchInput.value = '';
                  searchInput.focus();
                }
                renderTable();
              });
            }
          } else {
            tbody.innerHTML = \`
              <tr>
                <td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">
                  <div style="font-size:15px;font-weight:600;margin-bottom:6px">No leads found with status "\${filterLabel}"</div>
                  <div style="font-size:12px;margin-bottom:14px">Try selecting a different status from the dropdown filter or add a new lead to Firestore.</div>
                  <button type="button" class="crm-btn crm-btn-secondary" id="crm-reset-filter-btn" style="padding:6px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px">
                    <span>↺</span> Show All Statuses
                  </button>
                </td>
              </tr>
            \`;
          }

          const resetBtn = document.getElementById('crm-reset-filter-btn');
          if (resetBtn) {
            resetBtn.addEventListener('click', () => {
              if (statusDropdown) statusDropdown.value = 'ALL';
              activeStatusDropdownFilter = 'ALL';
              activeStageFilter = 'ALL';
              filterTabs.forEach(t => t.classList.remove('active'));
              const allTab = document.querySelector('.crm-stage-tab[data-stage="ALL"]');
              if (allTab) allTab.classList.add('active');
              renderTable();
            });
          }
          return;
        }

        let rowsHtml = '';
        filtered.forEach(lead => {
          const score = Number(lead.score || 0);
          let scoreClass = 'crm-score-neutral';
          if (score >= 80) scoreClass = 'crm-score-hot';
          else if (score >= 60) scoreClass = 'crm-score-warm';

          const val = Number(lead.value || 0);
          const st = lead.status || 'NEW';

          let statusCategory = 'New';
          let statusBadgeClass = 'crm-badge-new';
          if (st === 'CONVERTED' || st === 'WON') {
            statusCategory = 'Converted';
            statusBadgeClass = 'crm-badge-converted';
          } else if (st === 'LOST') {
            statusCategory = 'Lost';
            statusBadgeClass = 'crm-badge-lost';
          } else if (st !== 'NEW') {
            statusCategory = 'In-Progress';
            statusBadgeClass = 'crm-badge-progress';
          }

          const companyDisplay = highlightQuery(lead.companyName || 'Untitled Company', queryTerm);
          const contactDisplay = highlightQuery(lead.contactName || 'No contact', queryTerm);

          rowsHtml += \`
            <tr id="lead-row-\${lead.id}">
              <td>
                <div style="font-weight:700;color:#f1f5f9;font-size:14px">\${companyDisplay}</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px">
                  <span>\${contactDisplay}</span>
                  \${lead.email ? ' · <a href="mailto:' + escapeHtml(lead.email) + '" style="color:#60a5fa;text-decoration:none">' + escapeHtml(lead.email) + '</a>' : ''}
                </div>
              </td>
              <td>
                <div style="font-weight:700;color:#38bdf8">\${formatMoney(val)}</div>
                <div style="font-size:11px;color:#64748b">Est. deal</div>
              </td>
              <td style="max-width:300px">
                <div style="font-size:12px;color:#e2e8f0">\${escapeHtml(lead.signal || 'General lead')}</div>
                \${lead.notes ? '<div style="font-size:11px;color:#64748b;margin-top:2px">Note: ' + escapeHtml(lead.notes) + '</div>' : ''}
              </td>
              <td>
                <span class="crm-score-pill \${scoreClass}">\${score >= 80 ? '🔥 ' : ''}\${score}/100</span>
              </td>
              <td>
                <div style="display:flex;flex-direction:column;gap:5px">
                  <span class="pill \${statusBadgeClass}" style="font-size:10px;padding:2px 8px;width:fit-content;font-weight:700;border-radius:4px">
                    \${statusCategory}
                  </span>
                  <select class="crm-status-select" data-id="\${lead.id}">
                    <optgroup label="Core Status">
                      <option value="NEW" \${st === 'NEW' ? 'selected' : ''}>New</option>
                      <option value="IN_PROGRESS" \${st === 'IN_PROGRESS' ? 'selected' : ''}>In-Progress</option>
                      <option value="CONVERTED" \${st === 'CONVERTED' || st === 'WON' ? 'selected' : ''}>Converted</option>
                      <option value="LOST" \${st === 'LOST' ? 'selected' : ''}>Lost</option>
                    </optgroup>
                    <optgroup label="Pipeline Stages">
                      <option value="RESEARCHED" \${st === 'RESEARCHED' ? 'selected' : ''}>Researched</option>
                      <option value="CONTACTED" \${st === 'CONTACTED' ? 'selected' : ''}>Contacted</option>
                      <option value="QUALIFIED" \${st === 'QUALIFIED' ? 'selected' : ''}>Qualified</option>
                      <option value="PROPOSAL" \${st === 'PROPOSAL' ? 'selected' : ''}>Proposal</option>
                      <option value="WON" \${st === 'WON' ? 'selected' : ''}>Won</option>
                    </optgroup>
                  </select>
                </div>
              </td>
              <td style="text-align:right">
                <div style="display:inline-flex;gap:6px;align-items:center">
                  <a href="/?page=inbox" class="crm-btn crm-btn-secondary" style="padding:4px 9px;font-size:11px;text-decoration:none" title="Generate Google Search Grounded Outreach">
                    ⚡ Outreach
                  </a>
                  <button type="button" class="crm-btn crm-btn-secondary crm-lead-del-btn" data-id="\${lead.id}" style="padding:4px 8px;font-size:11px;color:#f87171" title="Delete lead from Firestore">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          \`;
        });

        tbody.innerHTML = rowsHtml;

        // Attach event listeners for status changes
        tbody.querySelectorAll('.crm-status-select').forEach(select => {
          select.addEventListener('change', async (e) => {
            const leadId = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            await updateLeadStatus(leadId, newStatus);
          });
        });

        // Attach delete listener
        tbody.querySelectorAll('.crm-lead-del-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const leadId = e.currentTarget.getAttribute('data-id');
            if (confirm('Delete this lead from Cloud Firestore?')) {
              await deleteLead(leadId);
            }
          });
        });
      }

      // Helper to escape HTML characters
      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      // Get current user ID from auth
      async function getEffectiveUser() {
        if (auth.currentUser) {
          return auth.currentUser;
        }
        try {
          const cred = await signInAnonymously(auth);
          return cred.user;
        } catch (err) {
          console.warn('Anonymous sign-in note:', err);
          return { uid: 'demo-user-' + window.location.hostname.replace(/[^a-zA-Z0-9]/g, '') };
        }
      }

      // Attach Firestore real-time listener
      async function subscribeToFirestore() {
        try {
          if (syncText) syncText.innerText = 'Connecting...';
          const user = await getEffectiveUser();
          const uid = user.uid || 'admin-user';

          const userDocRef = doc(db, 'users', uid);
          const leadsCol = collection(userDocRef, 'leads');

          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
          }

          unsubscribeSnapshot = onSnapshot(leadsCol, (snapshot) => {
            const leads = [];
            snapshot.forEach(docSnap => {
              leads.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort by score descending or createdAt
            leads.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

            currentLeads = leads;

            if (syncText) syncText.innerText = 'Firestore Live (' + leads.length + ' leads)';
            updateMetrics(leads);
            renderTable();

            // Auto-seed if brand new empty collection
            if (leads.length === 0) {
              seedSampleLeads();
            }
          }, (err) => {
            console.warn('Firestore snapshot listener error:', err);
            if (syncText) syncText.innerText = 'Firestore Offline';
          });
        } catch (err) {
          console.error('Error in subscribeToFirestore:', err);
          if (syncText) syncText.innerText = 'Firestore Connection Warning';
        }
      }

      // Seed sample leads into Firestore
      async function seedSampleLeads() {
        try {
          if (syncText) syncText.innerText = 'Seeding sample leads...';
          const user = await getEffectiveUser();
          const uid = user.uid || 'admin-user';
          const userDocRef = doc(db, 'users', uid);
          const leadsCol = collection(userDocRef, 'leads');

          for (const item of sampleSeedLeads) {
            await addDoc(leadsCol, {
              ...item,
              userId: uid,
              createdAt: new Date().toISOString()
            });
          }
          if (syncText) syncText.innerText = 'Firestore Live (' + sampleSeedLeads.length + ' leads)';
        } catch (err) {
          console.error('Failed to seed leads to Firestore:', err);
        }
      }

      // Update lead status in Firestore
      async function updateLeadStatus(leadId, status) {
        try {
          const user = await getEffectiveUser();
          const uid = user.uid || 'admin-user';
          const leadRef = doc(db, 'users', uid, 'leads', leadId);
          await updateDoc(leadRef, { 
            status: status,
            updatedAt: new Date().toISOString()
          });
          // Update local copy
          const found = currentLeads.find(l => l.id === leadId);
          if (found) found.status = status;
          updateMetrics(currentLeads);
        } catch (err) {
          console.error('Error updating status in Firestore:', err);
          alert('Failed to update lead status in Firestore: ' + err.message);
        }
      }

      // Delete lead from Firestore
      async function deleteLead(leadId) {
        try {
          const user = await getEffectiveUser();
          const uid = user.uid || 'admin-user';
          const leadRef = doc(db, 'users', uid, 'leads', leadId);
          await deleteDoc(leadRef);
        } catch (err) {
          console.error('Error deleting lead from Firestore:', err);
          alert('Failed to delete lead: ' + err.message);
        }
      }

      // Search input event handlers for client name & company
      if (searchInput) {
        searchInput.addEventListener('input', renderTable);
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            searchInput.value = '';
            renderTable();
          }
        });
      }

      if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
          if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
          }
          renderTable();
        });
      }

      if (searchStatusClear) {
        searchStatusClear.addEventListener('click', () => {
          if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
          }
          renderTable();
        });
      }

      // Quick slash '/' shortcut to focus search input
      window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }
      });

      // Status dropdown filter event handler ('ALL', 'NEW', 'IN_PROGRESS', 'CONVERTED')
      if (statusDropdown) {
        statusDropdown.addEventListener('change', (e) => {
          activeStatusDropdownFilter = e.target.value;

          // Sync the stage tabs active state with the dropdown
          filterTabs.forEach(t => t.classList.remove('active'));
          if (activeStatusDropdownFilter === 'NEW') {
            const newTab = document.querySelector('.crm-stage-tab[data-stage="NEW"]');
            if (newTab) newTab.classList.add('active');
            activeStageFilter = 'NEW';
          } else if (activeStatusDropdownFilter === 'CONVERTED') {
            const wonTab = document.querySelector('.crm-stage-tab[data-stage="WON"]');
            if (wonTab) wonTab.classList.add('active');
            activeStageFilter = 'WON';
          } else if (activeStatusDropdownFilter === 'ALL') {
            const allTab = document.querySelector('.crm-stage-tab[data-stage="ALL"]');
            if (allTab) allTab.classList.add('active');
            activeStageFilter = 'ALL';
          } else {
            // IN_PROGRESS: keep general filter active
            activeStageFilter = 'ALL';
          }

          renderTable();
        });
      }

      // Stage filter tabs
      const filterTabs = document.querySelectorAll('.crm-stage-tab');
      filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          filterTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const stage = tab.getAttribute('data-stage') || 'ALL';
          activeStageFilter = stage;

          // Sync dropdown filter
          if (stage === 'NEW') {
            activeStatusDropdownFilter = 'NEW';
            if (statusDropdown) statusDropdown.value = 'NEW';
          } else if (stage === 'WON') {
            activeStatusDropdownFilter = 'CONVERTED';
            if (statusDropdown) statusDropdown.value = 'CONVERTED';
          } else if (['RESEARCHED', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'].includes(stage)) {
            activeStatusDropdownFilter = 'IN_PROGRESS';
            if (statusDropdown) statusDropdown.value = 'IN_PROGRESS';
          } else if (stage === 'ALL') {
            activeStatusDropdownFilter = 'ALL';
            if (statusDropdown) statusDropdown.value = 'ALL';
          }

          renderTable();
        });
      });

      // Refresh button
      const refreshBtn = document.getElementById('crm-btn-refresh');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          subscribeToFirestore();
        });
      }

      // Seed button
      const seedBtn = document.getElementById('crm-btn-seed');
      if (seedBtn) {
        seedBtn.addEventListener('click', () => {
          seedSampleLeads();
        });
      }

      // Modal open/close
      const openModalBtn = document.getElementById('crm-btn-open-modal');
      const closeModalBtn = document.getElementById('crm-modal-close');
      const cancelModalBtn = document.getElementById('crm-modal-cancel');
      const addForm = document.getElementById('crm-add-lead-form');

      if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
          if (modal) modal.classList.add('show');
        });
      }

      const hideModal = () => {
        if (modal) modal.classList.remove('show');
        if (addForm) addForm.reset();
      };

      if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
      if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideModal);

      // Handle Add Lead form submission directly to Firestore
      if (addForm) {
        addForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = document.getElementById('crm-modal-save');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Saving...';
          }

          try {
            const user = await getEffectiveUser();
            const uid = user.uid || 'admin-user';
            const userDocRef = doc(db, 'users', uid);
            const leadsCol = collection(userDocRef, 'leads');

            const newLead = {
              userId: uid,
              companyName: document.getElementById('lead-form-company').value.trim(),
              contactName: document.getElementById('lead-form-contact').value.trim(),
              email: document.getElementById('lead-form-email').value.trim(),
              phone: document.getElementById('lead-form-phone').value.trim(),
              value: Number(document.getElementById('lead-form-value').value) || 0,
              status: document.getElementById('lead-form-status').value,
              signal: document.getElementById('lead-form-signal').value.trim(),
              score: Number(document.getElementById('lead-form-score').value) || 75,
              notes: document.getElementById('lead-form-notes').value.trim(),
              createdAt: new Date().toISOString()
            };

            await addDoc(leadsCol, newLead);
            hideModal();
          } catch (err) {
            console.error('Failed to add lead to Firestore:', err);
            alert('Error adding lead to Firestore: ' + err.message);
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerText = 'Save to Firestore';
            }
          }
        });
      }

      // Initial boot
      subscribeToFirestore();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCrmDashboard);
    } else {
      initCrmDashboard();
    }
  </script>
  `;
}

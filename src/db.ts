import fs from 'fs';
import path from 'path';
import { config } from './config.js';

export type TableName =
  | 'companies'
  | 'contacts'
  | 'leads'
  | 'opportunities'
  | 'campaigns'
  | 'campaign_steps'
  | 'messages'
  | 'tasks'
  | 'appointments'
  | 'documents'
  | 'properties'
  | 'vendors'
  | 'content_items'
  | 'automations'
  | 'missions'
  | 'integrations'
  | 'audit_logs'
  | 'suppression_list';

export type RecordItem = Record<string, any>;
export type DatabaseStore = Record<TableName, RecordItem[]>;

export function blankStore(): DatabaseStore {
  return {
    companies: [],
    contacts: [],
    leads: [],
    opportunities: [],
    campaigns: [],
    campaign_steps: [],
    messages: [],
    tasks: [],
    appointments: [],
    documents: [],
    properties: [],
    vendors: [],
    content_items: [],
    automations: [],
    missions: [],
    integrations: [],
    audit_logs: [],
    suppression_list: [],
  };
}

let dbStore: DatabaseStore | null = null;

function formatDate(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const Y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const H = pad(d.getHours());
  const i = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${Y}-${m}-${day} ${H}:${i}:${s}`;
}

export function saveDb(data?: DatabaseStore): void {
  if (data) dbStore = data;
  const store = dbStore || blankStore();
  try {
    const dir = path.dirname(config.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(config.dataPath, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }
}

export function db(): DatabaseStore {
  if (dbStore) return dbStore;

  const file = config.dataPath;
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(file)) {
    dbStore = blankStore();
    seedDefaults();
    saveDb(dbStore);
    return dbStore;
  }

  try {
    const content = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(content);
    const store = blankStore();
    for (const key of Object.keys(store) as TableName[]) {
      store[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
    }
    dbStore = store;
    if (dbStore.companies.length === 0) {
      seedDefaults();
      saveDb(dbStore);
    }
    return dbStore;
  } catch (e) {
    console.warn('Could not read or parse data file, initializing blank store');
    dbStore = blankStore();
    seedDefaults();
    saveDb(dbStore);
    return dbStore;
  }
}

export function nextId(table: TableName): number {
  const d = db();
  let max = 0;
  for (const r of d[table]) {
    const id = Number(r.id || 0);
    if (id > max) max = id;
  }
  return max + 1;
}

export function dbInsert(table: TableName, row: RecordItem): number {
  const d = db();
  const id = nextId(table);
  const newRow = {
    id,
    created_at: row.created_at || formatDate(),
    ...row,
  };
  d[table].push(newRow);
  saveDb(d);
  return id;
}

export function dbAll(table: TableName): RecordItem[] {
  const d = db();
  return d[table] || [];
}

export function dbFind(table: TableName, id: number): RecordItem | null {
  for (const r of dbAll(table)) {
    if (Number(r.id || 0) === id) return r;
  }
  return null;
}

export function dbWhere(table: TableName, predicate: (r: RecordItem) => boolean): RecordItem[] {
  const out: RecordItem[] = [];
  for (const r of dbAll(table)) {
    if (predicate(r)) out.push(r);
  }
  return out;
}

export function dbUpdate(table: TableName, id: number, mutator: (r: RecordItem) => RecordItem): boolean {
  const d = db();
  const rows = d[table];
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i].id) === id) {
      const updated = mutator(rows[i]);
      updated.updated_at = formatDate();
      rows[i] = updated;
      saveDb(d);
      return true;
    }
  }
  return false;
}

export function dbDelete(table: TableName, id: number): boolean {
  const d = db();
  const before = d[table].length;
  d[table] = d[table].filter((r) => Number(r.id) !== id);
  if (d[table].length < before) {
    saveDb(d);
    return true;
  }
  return false;
}

export function dbCount(table: TableName, predicate?: (r: RecordItem) => boolean): number {
  return predicate ? dbWhere(table, predicate).length : dbAll(table).length;
}

export function dbSum(table: TableName, field: string, predicate?: (r: RecordItem) => boolean): number {
  const rows = predicate ? dbWhere(table, predicate) : dbAll(table);
  let s = 0;
  for (const r of rows) {
    s += Number(r[field] || 0);
  }
  return s;
}

export function dbSortDesc(rows: RecordItem[], field = 'id'): RecordItem[] {
  return [...rows].sort((a, b) => String(b[field] ?? '').localeCompare(String(a[field] ?? '')));
}

export function dbSortAsc(rows: RecordItem[], field = 'id'): RecordItem[] {
  return [...rows].sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')));
}

export function seedDefaults(): void {
  dbInsert('companies', {
    name: 'PT Example Manufacturing',
    industry: 'Manufacturing',
    location: 'Semarang, Central Java',
    website: 'https://example.com',
    size: '500-1000',
    description: 'Example production company for demo.',
    source_type: 'demo',
    source_url: 'https://example.com',
    confidence: 0.95,
  });
  dbInsert('companies', {
    name: 'PT Example Plantation',
    industry: 'Plantation',
    location: 'Central Kalimantan',
    website: 'https://example.org',
    size: '1000+',
    description: 'Example plantation company for demo.',
    source_type: 'demo',
    source_url: 'https://example.org',
    confidence: 0.92,
  });
  dbInsert('companies', {
    name: 'ABC Property Owner',
    industry: 'Property',
    location: 'Bandung, West Java',
    website: '',
    size: '1',
    description: 'House listing owner demo.',
    source_type: 'user_import',
    source_url: '',
    confidence: 0.9,
  });

  dbInsert('contacts', {
    company_id: 1,
    name: 'Sarah HR',
    title: 'HR Manager',
    email: 'hr@example.com',
    phone: '+628120000001',
    source_url: 'https://example.com/careers',
    consent_status: 'unknown',
  });
  dbInsert('contacts', {
    company_id: 2,
    name: 'Budi Talent',
    title: 'Recruitment Manager',
    email: 'talent@example.org',
    phone: '+628120000002',
    source_url: 'https://example.org/careers',
    consent_status: 'unknown',
  });

  dbInsert('leads', {
    company_id: 1,
    contact_id: 1,
    business_type: 'Recruitment',
    status: 'QUALIFIED',
    signal: '8 open positions and expansion signal',
    score: 89,
    score_explanation: 'Strong company fit and active hiring signal.',
    source_type: 'demo',
    source_url: 'https://example.com/careers',
    notes: 'Demo lead',
  });
  dbInsert('leads', {
    company_id: 2,
    contact_id: 2,
    business_type: 'Recruitment',
    status: 'NEW',
    signal: 'Multiple engineering and operator vacancies',
    score: 76,
    score_explanation: 'Relevant hiring demand detected.',
    source_type: 'demo',
    source_url: 'https://example.org/careers',
    notes: 'Demo lead',
  });

  dbInsert('opportunities', {
    lead_id: 1,
    title: 'Recruitment Support - PT Example Manufacturing',
    value: 25000000,
    stage: 'PROPOSAL',
    probability: 60,
  });
  dbInsert('opportunities', {
    lead_id: 2,
    title: 'Recruitment Support - PT Example Plantation',
    value: 15000000,
    stage: 'QUALIFIED',
    probability: 25,
  });

  dbInsert('properties', {
    title: 'Rumah Strategis Bandung',
    property_type: 'House',
    location: 'Bandung, West Java',
    price: 950000000,
    land_size: 120,
    building_size: 90,
    seller_type: 'Owner Direct',
    source: 'demo',
    source_url: '',
    status: 'NEW',
    description: '3 bedroom house demo listing suitable for agent outreach.',
  });

  dbInsert('vendors', {
    name: 'Demo Printing Vendor',
    category: 'Printing',
    location: 'Semarang, Central Java',
    website: 'https://example.net',
    contact: 'sales@example.net',
    source: 'demo',
    notes: 'Demo vendor record.',
  });
}

export function findCompanyName(id: number | string): string {
  const r = dbFind('companies', Number(id));
  return (r?.name as string) || '—';
}

export function findContact(id: number | string): RecordItem | null {
  return dbFind('contacts', Number(id));
}

export function findLeadJoined(id: number): RecordItem | null {
  const l = dbFind('leads', id);
  if (!l) return null;
  const c = dbFind('companies', Number(l.company_id));
  const ct = findContact(Number(l.contact_id || 0));
  return {
    ...l,
    company_name: c?.name || '',
    industry: c?.industry || '',
    contact_name: ct?.name || '',
    title: ct?.title || '',
    email: ct?.email || '',
    consent_status: ct?.consent_status || 'unknown',
  };
}

export function nextDocNumber(type: string): string {
  const prefix = type.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const n = dbCount('documents', (r) => (r.doc_type || '') === type) + 1;
  return `${prefix}-${ym}-${String(n).padStart(4, '0')}`;
}

export function audit(actor: string, action: string, entity: string, id: number | null = null, details: any = null): void {
  dbInsert('audit_logs', {
    actor: actor || 'system',
    action,
    entity_type: entity,
    entity_id: id,
    details: details !== null ? JSON.stringify(details) : null,
  });
}

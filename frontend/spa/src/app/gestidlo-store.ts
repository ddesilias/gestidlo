// ─────────────────────────────────────────────────────────────────
//  GestiDLO – Connexions persistantes (C1–C8)
//  Toutes les opérations passent par ce module ; le localStorage
//  est la seule source de vérité pour les connexions.
// ─────────────────────────────────────────────────────────────────

export type ConnType = 'C1'|'C2'|'C3'|'C4'|'C5'|'C6'|'C7'|'C8';

export interface GConnection {
  id: string;
  type: ConnType;
  fromKind: string; fromId: string; fromLabel?: string;
  toKind:   string; toId:   string; toLabel?:   string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

const STORE_KEY  = 'gestidlo_connections_v1';
const SEEDED_KEY = 'gestidlo_connections_seeded_v2';   // v2 — upgraded from v1

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Seed data ────────────────────────────────────────────────────

const SEED: Array<Omit<GConnection, 'id'|'createdAt'>> = [

  // ════════════════════════════════════════════════════════════════
  //  C1 — Exploitation : Ressource naturelle → premier captage  (1→N)
  // ════════════════════════════════════════════════════════════════
  { type:'C1', fromKind:'resource', fromId:'rs-01', fromLabel:'Source Bassin Bleu',
    toKind:'infra', toId:'if-01', toLabel:'Captage Bassin Bleu',
    meta:{ code:'CAP-BBLEU-01', status:'operationnel' } },

  { type:'C1', fromKind:'resource', fromId:'rs-02', fromLabel:'Source Fermathe',
    toKind:'infra', toId:'if-05', toLabel:'Captage Fermathe',
    meta:{ code:'CAP-FERM-01', status:'operationnel' } },

  { type:'C1', fromKind:'resource', fromId:'rs-11', fromLabel:'Rivière Momance',
    toKind:'infra', toId:'if-09', toLabel:'Prise Momance',
    meta:{ code:'CAP-MOM-01', status:'operationnel' } },

  { type:'C1', fromKind:'resource', fromId:'rs-05', fromLabel:'Source La Plaine',
    toKind:'infra', toId:'if-11', toLabel:'Captage La Plaine',
    meta:{ code:'CAP-CAP-01', status:'operationnel' } },

  { type:'C1', fromKind:'resource', fromId:'rs-12', fromLabel:'Rivière Artibonite',
    toKind:'infra', toId:'if-13', toLabel:'Station Péligre',
    meta:{ code:'STA-PEL-01', status:'degrade' } },

  // ════════════════════════════════════════════════════════════════
  //  C2 — Acheminement : Infra → Infra (N→N, chaînes d'exploitation)
  // ════════════════════════════════════════════════════════════════
  // Chaîne Jacmel
  { type:'C2', fromKind:'infra', fromId:'if-01', fromLabel:'Captage Bassin Bleu',
    toKind:'infra', toId:'if-02', toLabel:'Station Pompage Jacmel' },
  { type:'C2', fromKind:'infra', fromId:'if-02', fromLabel:'Station Pompage Jacmel',
    toKind:'infra', toId:'if-03', toLabel:'Station Traitement Jacmel' },
  { type:'C2', fromKind:'infra', fromId:'if-03', fromLabel:'Station Traitement Jacmel',
    toKind:'infra', toId:'if-04', toLabel:'Réservoir Jacmel R02' },
  // Chaîne Pétion-Ville
  { type:'C2', fromKind:'infra', fromId:'if-05', fromLabel:'Captage Fermathe',
    toKind:'infra', toId:'if-06', toLabel:"Château d'eau Pétion-Ville" },
  // Chaîne Léogâne
  { type:'C2', fromKind:'infra', fromId:'if-09', fromLabel:'Prise Momance',
    toKind:'infra', toId:'if-14', toLabel:'Réseau AEP Léogâne' },
  // Chaîne Cap-Haïtien
  { type:'C2', fromKind:'infra', fromId:'if-11', fromLabel:'Captage La Plaine',
    toKind:'infra', toId:'if-12', toLabel:'Réservoir Cap-Haïtien' },
  { type:'C2', fromKind:'infra', fromId:'if-12', fromLabel:'Réservoir Cap-Haïtien',
    toKind:'infra', toId:'if-16', toLabel:'Bornes-fontaines Cap-Haïtien' },

  // ════════════════════════════════════════════════════════════════
  //  C3 — Desserte : Infrastructure finale → Zone usagers  (1→N)
  //  meta: households (foyers), persons (personnes)
  // ════════════════════════════════════════════════════════════════
  { type:'C3', fromKind:'infra', fromId:'if-04', fromLabel:'Réservoir Jacmel R02',
    toKind:'zone', toId:'z-jac-01', toLabel:'Zone Jacmel centre',
    meta:{ households:247, persons:1247 } },

  { type:'C3', fromKind:'infra', fromId:'if-06', fromLabel:"Château d'eau Pétion-Ville",
    toKind:'zone', toId:'z-pv-01', toLabel:'Zone Pétion-Ville nord',
    meta:{ households:420, persons:2100 } },

  { type:'C3', fromKind:'infra', fromId:'if-14', fromLabel:'Réseau AEP Léogâne',
    toKind:'zone', toId:'z-leo-01', toLabel:'Zone Léogâne',
    meta:{ households:312, persons:1560 } },

  { type:'C3', fromKind:'infra', fromId:'if-16', fromLabel:'Bornes-fontaines Cap-Haïtien',
    toKind:'zone', toId:'z-cap-01', toLabel:'Zone Cap-Haïtien nord',
    meta:{ households:380, persons:1900 } },

  { type:'C3', fromKind:'infra', fromId:'if-13', fromLabel:'Station Péligre',
    toKind:'zone', toId:'z-arti-01', toLabel:'Plaine Artibonite',
    meta:{ households:1200, persons:6000 } },

  { type:'C3', fromKind:'infra', fromId:'if-07', fromLabel:'Forage Cité-Soleil F-12',
    toKind:'zone', toId:'z-citsol-01', toLabel:'Cité-Soleil sect. 5',
    meta:{ households:85, persons:425 } },

  { type:'C3', fromKind:'infra', fromId:'if-08', fromLabel:'Forage Carrefour F-08',
    toKind:'zone', toId:'z-car-01', toLabel:'Carrefour sect. 3',
    meta:{ households:110, persons:550 } },

  { type:'C3', fromKind:'infra', fromId:'if-10', fromLabel:'Puits Bel-Air',
    toKind:'zone', toId:'z-belair-01', toLabel:'Bel-Air Jacmel',
    meta:{ households:45, persons:225 } },

  { type:'C3', fromKind:'infra', fromId:'if-15', fromLabel:'Puits Arcahaie',
    toKind:'zone', toId:'z-arc-01', toLabel:'Arcahaie bourg',
    meta:{ households:28, persons:140 } },

  // ════════════════════════════════════════════════════════════════
  //  C4 — Tutelle : Institution → Ressources + Infrastructures  (1→N)
  //  meta: role ('owner' | 'operator' | 'regulator' | 'funder')
  // ════════════════════════════════════════════════════════════════
  // DINEPA — propriétaire de l'ensemble des infras AEP
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-01', toLabel:'Captage Bassin Bleu',   meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-02', toLabel:'Station Pompage Jacmel', meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-03', toLabel:'Station Traitement Jacmel', meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-04', toLabel:'Réservoir Jacmel R02',  meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-05', toLabel:'Captage Fermathe',      meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-06', toLabel:"Château d'eau PV",      meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-07', toLabel:'Forage Cité-Soleil',    meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-08', toLabel:'Forage Carrefour',      meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-09', toLabel:'Prise Momance',         meta:{ role:'owner' } },
  { type:'C4', fromKind:'institution', fromId:'inst-dinepa', fromLabel:'DINEPA',
    toKind:'infra', toId:'if-13', toLabel:'Station Péligre',       meta:{ role:'owner' } },

  // OREPA Sud — exploitant Sud-Est
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-sud', fromLabel:'OREPA Sud',
    toKind:'infra', toId:'if-01', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-sud', fromLabel:'OREPA Sud',
    toKind:'infra', toId:'if-02', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-sud', fromLabel:'OREPA Sud',
    toKind:'infra', toId:'if-03', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-sud', fromLabel:'OREPA Sud',
    toKind:'infra', toId:'if-04', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-sud', fromLabel:'OREPA Sud',
    toKind:'infra', toId:'if-10', meta:{ role:'operator' } },

  // OREPA Ouest — exploitant Ouest
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-ouest', fromLabel:'OREPA Ouest',
    toKind:'infra', toId:'if-05', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-ouest', fromLabel:'OREPA Ouest',
    toKind:'infra', toId:'if-06', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-ouest', fromLabel:'OREPA Ouest',
    toKind:'infra', toId:'if-07', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-ouest', fromLabel:'OREPA Ouest',
    toKind:'infra', toId:'if-08', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-ouest', fromLabel:'OREPA Ouest',
    toKind:'infra', toId:'if-09', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-ouest', fromLabel:'OREPA Ouest',
    toKind:'infra', toId:'if-14', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-ouest', fromLabel:'OREPA Ouest',
    toKind:'infra', toId:'if-15', meta:{ role:'operator' } },

  // OREPA Nord — exploitant Nord
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-nord', fromLabel:'OREPA Nord',
    toKind:'infra', toId:'if-11', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-nord', fromLabel:'OREPA Nord',
    toKind:'infra', toId:'if-12', meta:{ role:'operator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-nord', fromLabel:'OREPA Nord',
    toKind:'infra', toId:'if-16', meta:{ role:'operator' } },

  // OREPA Artibonite
  { type:'C4', fromKind:'institution', fromId:'inst-orepa-arti', fromLabel:'OREPA Artibonite',
    toKind:'infra', toId:'if-13', meta:{ role:'operator' } },

  // MARNDR — tutelle ressources naturelles
  { type:'C4', fromKind:'institution', fromId:'inst-marndr', fromLabel:'MARNDR',
    toKind:'resource', toId:'rs-01', meta:{ role:'regulator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-marndr', fromLabel:'MARNDR',
    toKind:'resource', toId:'rs-02', meta:{ role:'regulator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-marndr', fromLabel:'MARNDR',
    toKind:'resource', toId:'rs-05', meta:{ role:'regulator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-marndr', fromLabel:'MARNDR',
    toKind:'resource', toId:'rs-11', meta:{ role:'regulator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-marndr', fromLabel:'MARNDR',
    toKind:'resource', toId:'rs-12', meta:{ role:'regulator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-marndr', fromLabel:'MARNDR',
    toKind:'resource', toId:'rs-14', meta:{ role:'regulator' } },
  { type:'C4', fromKind:'institution', fromId:'inst-marndr', fromLabel:'MARNDR',
    toKind:'resource', toId:'rs-15', meta:{ role:'regulator' } },

  // ════════════════════════════════════════════════════════════════
  //  C5 — Surveillance : Capteur IoT → Entité surveillée  (N→1)
  //  meta: label, value, unit, sub, color, warn
  // ════════════════════════════════════════════════════════════════
  // Capteurs sur Station de Pompage Jacmel (if-02)
  { type:'C5', fromKind:'capteur', fromId:'CPT-DEB-JAC-007', fromLabel:'Débit en sortie',
    toKind:'infra', toId:'if-02', toLabel:'Station Pompage Jacmel',
    meta:{ value:'42', unit:'m³/h', sub:'Danfoss FH010', color:'#34D399' } },
  { type:'C5', fromKind:'capteur', fromId:'CPT-PRE-JAC-008', fromLabel:'Pression conduite',
    toKind:'infra', toId:'if-02', toLabel:'Station Pompage Jacmel',
    meta:{ value:'3.8', unit:'bar', sub:'Keller PR-33X', color:'#34D399' } },
  { type:'C5', fromKind:'capteur', fromId:'CPT-ELC-JAC-009', fromLabel:'Conso. électrique',
    toKind:'infra', toId:'if-02', toLabel:'Station Pompage Jacmel',
    meta:{ value:'12.4', unit:'kW', sub:'+8% anormal', color:'#FBBF24', warn:true } },

  // Capteurs sur Prise Momance (if-09)
  { type:'C5', fromKind:'capteur', fromId:'CPT-DEB-LEO-002', fromLabel:'Débit prise',
    toKind:'infra', toId:'if-09', toLabel:'Prise Momance',
    meta:{ value:'140', unit:'m³/h', sub:'Débitmètre électromag.', color:'#34D399' } },
  { type:'C5', fromKind:'capteur', fromId:'CPT-TUR-LEO-003', fromLabel:'Turbidité eau',
    toKind:'infra', toId:'if-09', toLabel:'Prise Momance',
    meta:{ value:'4.2', unit:'NTU', sub:'Valeur normale < 5', color:'#34D399' } },

  // Capteurs sur Source Bassin Bleu (rs-01)
  { type:'C5', fromKind:'capteur', fromId:'CPT-DEB-BBL-001', fromLabel:'Débit source',
    toKind:'resource', toId:'rs-01', toLabel:'Source Bassin Bleu',
    meta:{ value:'31', unit:'m³/h', sub:'Sonique KROHNE', color:'#60A5FA' } },

  // Capteurs sur Rivière Artibonite (rs-12)
  { type:'C5', fromKind:'capteur', fromId:'CPT-NIV-ARTI-010', fromLabel:'Niveau rivière',
    toKind:'resource', toId:'rs-12', toLabel:'Rivière Artibonite',
    meta:{ value:'2.4', unit:'m', sub:'Limnimètre OTT', color:'#60A5FA' } },
  { type:'C5', fromKind:'capteur', fromId:'CPT-TUR-ARTI-011', fromLabel:'Turbidité amont',
    toKind:'resource', toId:'rs-12', toLabel:'Rivière Artibonite',
    meta:{ value:'18', unit:'NTU', sub:'↑ Hausse post-pluie', color:'#FBBF24', warn:true } },

  // ════════════════════════════════════════════════════════════════
  //  C6 — Appartenance : Ressource → Bassin versant  (N→1)
  //  meta: areaKm2, role ('surface' | 'souterrain' | 'principale')
  // ════════════════════════════════════════════════════════════════
  { type:'C6', fromKind:'resource', fromId:'rs-01', fromLabel:'Source Bassin Bleu',
    toKind:'bassin', toId:'bv-jacmel', toLabel:'Bassin de Jacmel',
    meta:{ areaKm2:620, role:'surface' } },

  { type:'C6', fromKind:'resource', fromId:'rs-02', fromLabel:'Source Fermathe',
    toKind:'bassin', toId:'rs-14', toLabel:'Bassin Cul-de-Sac',
    meta:{ areaKm2:850, role:'surface' } },
  { type:'C6', fromKind:'resource', fromId:'rs-04', fromLabel:'Source Laboule',
    toKind:'bassin', toId:'rs-15', toLabel:'Bassin Versant Grise',
    meta:{ areaKm2:220, role:'surface' } },
  { type:'C6', fromKind:'resource', fromId:'rs-10', fromLabel:'Source Bois-Pin',
    toKind:'bassin', toId:'rs-15', toLabel:'Bassin Versant Grise',
    meta:{ areaKm2:220, role:'surface' } },
  { type:'C6', fromKind:'resource', fromId:'rs-11', fromLabel:'Rivière Momance',
    toKind:'bassin', toId:'rs-14', toLabel:'Bassin Cul-de-Sac',
    meta:{ areaKm2:850, role:'principale' } },
  { type:'C6', fromKind:'resource', fromId:'rs-12', fromLabel:'Rivière Artibonite',
    toKind:'bassin', toId:'bv-artibonite', toLabel:'Bassin versant Artibonite',
    meta:{ areaKm2:9000, role:'principale' } },
  { type:'C6', fromKind:'resource', fromId:'rs-05', fromLabel:'Source La Plaine',
    toKind:'bassin', toId:'bv-nord', toLabel:'Bassin versant Nord',
    meta:{ areaKm2:1100, role:'surface' } },
  { type:'C6', fromKind:'resource', fromId:'rs-13', fromLabel:'Rivière Grand-Rivière',
    toKind:'bassin', toId:'bv-nord', toLabel:'Bassin versant Nord',
    meta:{ areaKm2:1100, role:'principale' } },

  // ════════════════════════════════════════════════════════════════
  //  C7 — Alerte propagée : Anomalie → Chaîne aval  (1→N)
  //  meta: alertId, severity ('critical'|'warning'), triggeredAt, status
  // ════════════════════════════════════════════════════════════════
  // Anomalie Source Bassin Bleu → cascade Jacmel
  { type:'C7', fromKind:'resource', fromId:'rs-01', fromLabel:'Source Bassin Bleu [menacée]',
    toKind:'infra', toId:'if-01', toLabel:'Captage Bassin Bleu',
    meta:{ alertId:'ALT-2026-001', severity:'warning', triggeredAt:'2026-03-14', status:'active' } },
  { type:'C7', fromKind:'resource', fromId:'rs-01', fromLabel:'Source Bassin Bleu [menacée]',
    toKind:'infra', toId:'if-02',
    meta:{ alertId:'ALT-2026-001', severity:'warning', triggeredAt:'2026-03-14', status:'active' } },
  { type:'C7', fromKind:'resource', fromId:'rs-01', fromLabel:'Source Bassin Bleu [menacée]',
    toKind:'infra', toId:'if-03',
    meta:{ alertId:'ALT-2026-001', severity:'warning', triggeredAt:'2026-03-14', status:'active' } },
  { type:'C7', fromKind:'resource', fromId:'rs-01', fromLabel:'Source Bassin Bleu [menacée]',
    toKind:'zone', toId:'z-jac-01', toLabel:'Zone Jacmel (247 foyers)',
    meta:{ alertId:'ALT-2026-001', severity:'warning', triggeredAt:'2026-03-14', status:'active' } },

  // Panne Forage Carrefour → usagers sans eau
  { type:'C7', fromKind:'infra', fromId:'if-08', fromLabel:'Forage Carrefour [en panne]',
    toKind:'zone', toId:'z-car-01', toLabel:'Carrefour sect. 3',
    meta:{ alertId:'ALT-2026-002', severity:'critical', triggeredAt:'2026-04-22', status:'active' } },

  // ════════════════════════════════════════════════════════════════
  //  C8 — Intervention : Technicien → Infra ou Ressource  (N→N)
  //  meta: date, action, durationH, status ('done'|'planned'|'in-progress')
  // ════════════════════════════════════════════════════════════════
  { type:'C8', fromKind:'tech', fromId:'tech-jonas-pierre', fromLabel:'Jonas Pierre',
    toKind:'infra', toId:'if-01', toLabel:'Captage Bassin Bleu',
    meta:{ date:'2026-01-12', action:'Nettoyage grille', durationH:3, status:'done' } },
  { type:'C8', fromKind:'tech', fromId:'tech-marie-joseph', fromLabel:'Marie Joseph',
    toKind:'infra', toId:'if-01', toLabel:'Captage Bassin Bleu',
    meta:{ date:'2025-09-04', action:'Réparation joint', durationH:5, status:'done' } },
  { type:'C8', fromKind:'tech', fromId:'tech-pierre-lubin', fromLabel:'Pierre Lubin',
    toKind:'infra', toId:'if-02', toLabel:'Station Pompage Jacmel',
    meta:{ date:'2026-04-15', action:'Vidange filtre', durationH:4, status:'done' } },
  { type:'C8', fromKind:'tech', fromId:'tech-marie-charles', fromLabel:'Marie Charles',
    toKind:'infra', toId:'if-02', toLabel:'Station Pompage Jacmel',
    meta:{ date:'2026-02-02', action:'Remplacement garniture', durationH:8, status:'done' } },
  { type:'C8', fromKind:'tech', fromId:'tech-jm-louis', fromLabel:'Jean-Marc Louis',
    toKind:'infra', toId:'if-09', toLabel:'Prise Momance',
    meta:{ date:'2026-05-02', action:'Nettoyage dessableur', durationH:6, status:'done' } },
  { type:'C8', fromKind:'tech', fromId:'tech-jm-louis', fromLabel:'Jean-Marc Louis',
    toKind:'infra', toId:'if-14', toLabel:'Réseau AEP Léogâne',
    meta:{ date:'2025-11-10', action:'Réparation grille', durationH:16, status:'done' } },
  { type:'C8', fromKind:'tech', fromId:'tech-orepa-arti', fromLabel:'Équipe OREPA Artibonite',
    toKind:'infra', toId:'if-13', toLabel:'Station Péligre',
    meta:{ date:'2026-04-01', action:'Maintenance turbines', durationH:72, status:'in-progress' } },
];

// ─────────────────────────────────────────────────────────────────
//  Store public API
// ─────────────────────────────────────────────────────────────────

export const GestidloStore = {

  // ── Storage primitives ────────────────────────────────────────

  getAll(): GConnection[] {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? (JSON.parse(raw) as GConnection[]) : [];
    } catch { return []; }
  },

  _save(conns: GConnection[]): void {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(conns)); } catch { }
  },

  /** Seeds all static connections once per profile. Merges — never drops user data. */
  seed(): void {
    if (localStorage.getItem(SEEDED_KEY)) return;
    const existing = this.getAll();
    const now = new Date().toISOString();
    const toAdd: GConnection[] = [];
    for (const s of SEED) {
      const dup = existing.find(
        c => c.type === s.type && c.fromId === s.fromId && c.toId === s.toId
      );
      if (!dup) toAdd.push({ ...s, id: uid(), createdAt: now });
    }
    this._save([...existing, ...toAdd]);
    localStorage.setItem(SEEDED_KEY, '1');
  },

  /**
   * Adds a connection. Silently deduplicates on (type + fromId + toId).
   */
  addConnection(conn: Omit<GConnection, 'id'|'createdAt'>): GConnection {
    const all = this.getAll();
    const dup = all.find(c =>
      c.type === conn.type && c.fromId === conn.fromId && c.toId === conn.toId
    );
    if (dup) return dup;
    const next: GConnection = { ...conn, id: uid(), createdAt: new Date().toISOString() };
    this._save([...all, next]);
    return next;
  },

  removeConnection(id: string): void {
    this._save(this.getAll().filter(c => c.id !== id));
  },

  getByType(type: ConnType): GConnection[] {
    return this.getAll().filter(c => c.type === type);
  },

  // ── C1 : Ressource → Captage ──────────────────────────────────

  /** Retourne les ouvrages de captage qui exploitent cette ressource. */
  getC1ForResource(resourceId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C1' && c.fromId === resourceId);
  },
  /** Retourne la ressource source d'un captage (inverse C1). */
  getC1SourceOfInfra(infraId: string): GConnection | undefined {
    return this.getAll().find(c => c.type === 'C1' && c.toId === infraId);
  },

  // ── C2 : Infra ↔ Infra ───────────────────────────────────────

  /** Retourne tous les liens amont/aval d'une infrastructure. */
  getC2For(infraId: string): GConnection[] {
    return this.getAll().filter(
      c => c.type === 'C2' && (c.fromId === infraId || c.toId === infraId)
    );
  },

  // ── C3 : Infra → Zone de desserte ────────────────────────────

  /** Retourne les zones desservies par une infrastructure. */
  getC3ForInfra(infraId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C3' && c.fromId === infraId);
  },
  /** Total foyers desservis en aval d'une infra (somme C3). */
  getTotalHouseholds(infraId: string): number {
    return this.getC3ForInfra(infraId)
      .reduce((s, c) => s + (Number(c.meta?.['households']) || 0), 0);
  },

  // ── C4 : Institution → entités ───────────────────────────────

  /** Retourne les entités sous tutelle d'une institution. */
  getC4ForInstitution(instId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C4' && c.fromId === instId);
  },
  /** Retourne les institutions qui supervisent une entité (resource ou infra). */
  getC4ForEntity(entityId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C4' && c.toId === entityId);
  },
  /** Retourne l'exploitant (role='operator') d'une infra/ressource. */
  getOperatorOf(entityId: string): GConnection | undefined {
    return this.getAll().find(
      c => c.type === 'C4' && c.toId === entityId && c.meta?.['role'] === 'operator'
    );
  },

  // ── C5 : Capteur → entité surveillée ─────────────────────────

  /** Retourne les capteurs qui surveillent une entité. */
  getC5ForEntity(entityId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C5' && c.toId === entityId);
  },
  /** Retourne l'entité surveillée par un capteur (inverse C5). */
  getC5Target(capteurId: string): GConnection | undefined {
    return this.getAll().find(c => c.type === 'C5' && c.fromId === capteurId);
  },

  // ── C6 : Ressource → Bassin versant ──────────────────────────

  /** Retourne le bassin versant auquel appartient une ressource. */
  getC6ForResource(resourceId: string): GConnection | undefined {
    return this.getAll().find(c => c.type === 'C6' && c.fromId === resourceId);
  },
  /** Retourne toutes les ressources d'un bassin versant. */
  getC6ResourcesInBassin(bassinId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C6' && c.toId === bassinId);
  },

  // ── C7 : Alerte propagée ──────────────────────────────────────

  /** Retourne les entités impactées en aval d'une anomalie. */
  getC7DownstreamOf(sourceId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C7' && c.fromId === sourceId);
  },
  /** Retourne les alertes actives qui impactent une entité. */
  getC7AlertsOn(entityId: string): GConnection[] {
    return this.getAll().filter(
      c => c.type === 'C7' && c.toId === entityId && c.meta?.['status'] === 'active'
    );
  },

  // ── C8 : Technicien ↔ entités ────────────────────────────────

  /** Retourne l'historique des interventions d'un technicien. */
  getC8ForTech(techId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C8' && c.fromId === techId);
  },
  /** Retourne les techniciens ayant travaillé sur une entité. */
  getC8TechsForEntity(entityId: string): GConnection[] {
    return this.getAll().filter(c => c.type === 'C8' && c.toId === entityId);
  },
};

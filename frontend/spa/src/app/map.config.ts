/**
 * GEstiDlo — Configuration cartographique centrale
 *
 * Toutes les pages doivent utiliser ces constantes.
 * Ne jamais déclarer des couleurs ou URLs de tuiles localement dans une page.
 */

// ─── Fond de carte hydrologique ───────────────────────────────────────────
export const HYDRO_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export const HYDRO_TILE_OPTS = {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

// ─── Centre par défaut (Haïti) ─────────────────────────────────────────────
export const HAITI_CENTER: [number, number] = [18.97, -72.29];
export const HAITI_ZOOM = 8;
export const HAITI_ZONE_ZOOM = 11;

// ─── Couleurs unifiées des statuts ─────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  // Service / infrastructure
  normal:          '#16a34a',
  intermittent:    '#ca8a04',
  degrade:         '#f97316',
  coupure:         '#dc2626',
  retablissement:  '#8b5cf6',
  non_desservi:    '#94a3b8',
  inconnu:         '#94a3b8',
  // Infrastructure
  'en-service':    '#16a34a',
  'a-inspecter':   '#f97316',
  maintenance:     '#ca8a04',
  'hors-service':  '#dc2626',
  critique:        '#b91c1c',
  archive:         '#94a3b8',
  // IoT
  connecte:        '#16a34a',
  deconnecte:      '#dc2626',
  'signal-faible': '#f97316',
  'batterie-faible':'#ca8a04',
  'non-equipe':    '#94a3b8',
  // Alerte
  ouverte:         '#dc2626',
  assignee:        '#f97316',
  'en-cours':      '#2563eb',
  resolue:         '#16a34a',
  ignoree:         '#94a3b8',
  archivee:        '#64748b',
  // Intervention
  creee:           '#94a3b8',
  terminee:        '#16a34a',
  validee:         '#0d9488',
  cloturee:        '#475569',
  annulee:         '#dc2626',
  // Planification
  planifie:        '#8b5cf6',
  actif:           '#2563eb',
  // Ressources
  high:            '#16a34a',
  medium:          '#ca8a04',
  low:             '#f97316',
  unknown:         '#94a3b8',
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#94a3b8';
}

// ─── Sévérité / gravité ────────────────────────────────────────────────────
export const SEVERITY_COLORS: Record<string, string> = {
  critique: '#7c3aed',
  haute:    '#dc2626',
  moyenne:  '#f97316',
  basse:    '#16a34a',
  CRIT:     '#7c3aed',
  WARN:     '#f97316',
  INFO:     '#2563eb',
};

export function severityColor(s: string): string {
  return SEVERITY_COLORS[s] ?? '#94a3b8';
}

// ─── Couleurs par type d'infrastructure ───────────────────────────────────
export const INFRA_TYPE_COLORS: Record<string, string> = {
  captage:     '#2563eb',
  reservoir:   '#0d9488',
  pompe:       '#7c3aed',
  traitement:  '#8b5cf6',
  conduite:    '#64748b',
  'point-eau': '#16a34a',
  borne:       '#22c55e',
  kiosque:     '#86efac',
  passerelle:  '#94a3b8',
  energie:     '#ca8a04',
};

export function infraTypeColor(type: string): string {
  return INFRA_TYPE_COLORS[type] ?? '#94a3b8';
}

// ─── Couleurs des ressources naturelles ───────────────────────────────────
export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  river:     '#2563eb',
  spring:    '#0ea5e9',
  lake:      '#0891b2',
  wetland:   '#16a34a',
  aquifer:   '#0d9488',
  watershed: '#8b5cf6',
};

export function resourceTypeColor(type: string): string {
  return RESOURCE_TYPE_COLORS[type] ?? '#94a3b8';
}

// ─── Types d'icônes disponibles ───────────────────────────────────────────
export type MapIconType =
  | 'dot'          // simple cercle coloré
  | 'alert'        // triangle alerte
  | 'reservoir'    // carré arrondi
  | 'institution'  // bâtiment
  | 'sensor'       // antenne signal
  | 'tech'         // personne
  | 'label';       // texte seul

// ─── Items cartographiques génériques ─────────────────────────────────────
export interface GeoMapItem {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
  tooltip?: string;
  shape: 'dot' | 'zone';   // dot = marker, zone = cercle de zone
  radius?: number;          // mètres, pour shape='zone'
  size?: number;            // pixels, pour shape='dot'
  fillOpacity?: number;     // pour zone, défaut 0.22
  weight?: number;          // épaisseur contour, défaut 2
  pulse?: boolean;          // animation pulsation (alertes)
  selected?: boolean;
  zIndexOffset?: number;
}

export interface GeoLegendItem {
  color: string;
  label: string;
  shape?: 'dot' | 'square' | 'line';
}

// ─── Légendes prédéfinies par mode ────────────────────────────────────────
export const SERVICE_LEGEND: GeoLegendItem[] = [
  { color: STATUS_COLORS['normal'],       label: 'Service normal',       shape: 'dot' },
  { color: STATUS_COLORS['intermittent'], label: 'Intermittent',          shape: 'dot' },
  { color: STATUS_COLORS['degrade'],      label: 'Service dégradé',       shape: 'dot' },
  { color: STATUS_COLORS['coupure'],      label: 'En coupure',            shape: 'dot' },
  { color: STATUS_COLORS['non_desservi'], label: 'Non desservi',          shape: 'dot' },
  { color: '#0d9488',                     label: 'Réservoir',             shape: 'square' },
];

export const INFRA_LEGEND: GeoLegendItem[] = [
  { color: INFRA_TYPE_COLORS['captage'],    label: 'Captage',       shape: 'dot' },
  { color: INFRA_TYPE_COLORS['reservoir'],  label: 'Réservoir',     shape: 'square' },
  { color: INFRA_TYPE_COLORS['pompe'],      label: 'Pompe',         shape: 'dot' },
  { color: INFRA_TYPE_COLORS['point-eau'],  label: "Point d'eau",   shape: 'dot' },
  { color: INFRA_TYPE_COLORS['borne'],      label: 'Borne-fontaine',shape: 'dot' },
];

export const ALERT_LEGEND: GeoLegendItem[] = [
  { color: SEVERITY_COLORS['critique'],  label: 'Critique',  shape: 'dot' },
  { color: SEVERITY_COLORS['haute'],     label: 'Haute',     shape: 'dot' },
  { color: SEVERITY_COLORS['moyenne'],   label: 'Moyenne',   shape: 'dot' },
  { color: SEVERITY_COLORS['basse'],     label: 'Basse',     shape: 'dot' },
];

export const RESOURCE_LEGEND: GeoLegendItem[] = [
  { color: RESOURCE_TYPE_COLORS['river'],     label: 'Rivière',         shape: 'line' },
  { color: RESOURCE_TYPE_COLORS['spring'],    label: 'Source',           shape: 'dot' },
  { color: RESOURCE_TYPE_COLORS['lake'],      label: 'Lac / Étang',      shape: 'dot' },
  { color: RESOURCE_TYPE_COLORS['aquifer'],   label: 'Aquifère',         shape: 'dot' },
  { color: RESOURCE_TYPE_COLORS['watershed'], label: 'Bassin versant',   shape: 'square' },
];

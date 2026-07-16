/**
 * Modèle NORMALISÉ de l'aperçu A4 officiel — la source unique que consomme
 * `ReportA4PreviewComponent`. Les deux univers du système s'y projettent via un
 * adaptateur, pour qu'il n'existe qu'UN SEUL rendu A4 partout :
 *   - le catalogue mock (`ReportEntry`)        → `fromReportEntry`
 *   - le circuit réel BFF (`RapportDto`)        → `fromRapportDto`
 *
 * Règle : le composant A4 ne connaît NI `ReportEntry` NI `RapportDto`. Il ne voit
 * que `ReportPreviewData`. Tout mapping vit ici.
 */

import { ReportEntry, TYPE_COLOR, TYPE_LABELS_SHORT } from '../rapport.types';
import type { RapportDto } from '../../../rapports.store';

/** Rôle du lecteur — pilote les actions offertes dans la barre d'outils A4. */
export type ReportViewerRole = 'ADMIN' | 'DINEPA' | 'URD' | 'TECHNICIEN' | 'LECTURE';

/** Actions possibles dans l'aperçu. `imprimer`/`fermer` sont gérées en interne. */
export type ReportActionKey = 'imprimer' | 'exporter' | 'signer' | 'renvoyer' | 'archiver' | 'fermer';

export interface ReportPreviewKpi { label: string; value: string; }

/** Une section numérotée de la feuille A4. `body` = prose réelle ; `facts` = clé/valeur. */
export interface ReportPreviewSection {
  title: string;
  body?: string;
  facts?: { k: string; v: string }[];
}

export interface ReportPreviewSignature { name: string; role: string; date?: string | null; }

export interface ReportPreviewData {
  id: string;
  refCode: string;          // « Réf : … »
  version: string;
  emittedAt: string;        // date d'émission déjà formatée
  typeBadge: string;        // ex. « RAPPORT MENSUEL — SERVICE »
  accent: string;           // couleur d'accent (hex) dérivée du type
  title: string;
  subtitle?: string;
  periodLabel?: string;
  zone?: string;
  urd?: string | null;
  author?: string;
  institution?: string;
  statusKey: string;        // clé normalisée (pour dériver les actions)
  statusLabel: string;
  kpis?: ReportPreviewKpi[];
  sections: ReportPreviewSection[];
  signatureUrd?: ReportPreviewSignature | null;
  signatureDinepa?: ReportPreviewSignature | null;
  motifRenvoi?: string | null;
}

// ── Adaptateur 1 : catalogue mock (ReportEntry) ──────────────────────────────
// Les sections mock n'ont pas de corps → placeholders (préserve exactement le
// rendu actuel de /admin/rapports).
export function fromReportEntry(e: ReportEntry): ReportPreviewData {
  return {
    id: e.id,
    refCode: e.id,
    version: e.version,
    emittedAt: e.createdAt,
    typeBadge: `RAPPORT — ${e.module.toUpperCase()}`,
    accent: TYPE_COLOR[e.type] ?? '#2563eb',
    title: e.title,
    subtitle: e.subtitle,
    periodLabel: e.periodLabel,
    zone: e.zone,
    urd: e.departement ?? null,
    author: e.author,
    institution: e.institution,
    statusKey: e.status.toUpperCase(),
    statusLabel: STATUS_LABELS_ENTRY[e.status] ?? e.status,
    kpis: [
      { label: 'Indicateur 1', value: '—' }, { label: 'Indicateur 2', value: '—' },
      { label: 'Indicateur 3', value: '—' }, { label: 'Indicateur 4', value: '—' },
    ],
    sections: e.sections.map(title => ({ title })),
    signatureUrd: e.status === 'valide' || e.status === 'transmis' || e.status === 'archive'
      ? { name: e.author, role: `Responsable URD ${e.departement ?? ''}`.trim(), date: e.createdAt }
      : null,
  };
}

const STATUS_LABELS_ENTRY: Record<string, string> = {
  brouillon: 'Brouillon', genere: 'Généré', valide: 'Validé',
  transmis: 'Transmis', archive: 'Archivé', echec: 'Échec',
};

// ── Adaptateur 2 : circuit réel (RapportDto) ─────────────────────────────────
const ACCENT_BY_TYPE: Record<string, string> = {
  service: '#2563eb', mensuel: '#2563eb', trimestriel: '#2563eb',
  intervention: '#0d9488', interventions: '#0d9488',
  incident: '#ea580c', alerte: '#ea580c', alertes: '#ea580c',
  iot: '#9333ea', capteur: '#9333ea',
  infrastructure: '#475569', infrastructures: '#475569',
  ressource: '#0891b2', qualite: '#0891b2',
  journalier: '#4f46e5', traceabilite: '#4f46e5',
};

const STATUS_LABELS_DTO: Record<string, string> = {
  BROUILLON: 'Brouillon', GENERE: 'Généré', TRANSMIS: 'Soumis à l’URD',
  VALIDE: 'Validé URD', TRANSMIS_ADMIN: 'Reçu DINEPA', ARCHIVE: 'Archivé',
};

export function fromRapportDto(r: RapportDto): ReportPreviewData {
  const typeKey = (r.type || 'service').toLowerCase();
  const accent = ACCENT_BY_TYPE[typeKey] ?? '#2563eb';
  const zone = r.commune ? `Commune ${r.commune}`
             : r.departementId ? `Département ${r.departementId}`
             : 'National';

  const sections: ReportPreviewSection[] = [];

  // 1. Résumé exécutif — le VRAI texte pro dérivé par le serveur.
  sections.push({ title: 'Résumé exécutif', body: r.resumeAuto || '' });

  // 2. Informations générales.
  sections.push({
    title: 'Informations générales',
    facts: [
      { k: 'Type de rapport', v: labelType(r.type) },
      { k: 'Auteur', v: r.auteur || '—' },
      { k: 'Zone', v: zone },
      { k: 'URD / Département', v: r.departementId || '—' },
      ...(r.pages ? [{ k: 'Pages', v: String(r.pages) }] : []),
    ],
  });

  // 3-4. Contenu guidé (contenuJson) → détails + localisation.
  const detail = parseContenu(r.contenuJson);
  if (detail.facts.length) sections.push({ title: 'Constat et données techniques', facts: detail.facts });
  if (detail.ouvrage || detail.gps) {
    sections.push({
      title: 'Localisation de l’ouvrage',
      facts: [
        ...(detail.ouvrage ? [{ k: 'Ouvrage', v: detail.ouvrage }] : []),
        ...(detail.gps ? [{ k: 'Coordonnées GPS', v: detail.gps }] : []),
      ],
    });
  }

  // 5. Validation URD.
  sections.push({
    title: 'Validation et signature URD',
    facts: [
      { k: 'Validé par', v: r.validePar || r.signataire || 'En attente de validation' },
      { k: 'Date de validation', v: fmtDate(r.valideLe || r.signeLe) },
    ],
  });

  // 6. Motif de renvoi éventuel — tracé sur la feuille elle-même.
  if (r.motifRenvoi) sections.push({ title: 'Motif de renvoi', body: r.motifRenvoi });

  return {
    id: r.id,
    refCode: refCode(r),
    version: '1.0',
    emittedAt: fmtDate(r.signeLe || r.transmisLe || r.createdAt),
    typeBadge: `RAPPORT — ${labelType(r.type).toUpperCase()}`,
    accent,
    title: r.titre,
    subtitle: undefined,
    periodLabel: detail.periode || fmtDateOnly(r.createdAt),
    zone,
    urd: r.departementId,
    author: r.auteur || '—',
    institution: r.departementId ? `DINEPA ${r.departementId}` : 'DINEPA',
    statusKey: r.status,
    statusLabel: STATUS_LABELS_DTO[r.status] ?? r.status,
    sections,
    signatureUrd: r.signataire
      ? { name: r.signataire, role: `Responsable URD ${r.departementId ?? ''}`.trim(), date: r.signeLe }
      : null,
    signatureDinepa: null,
    motifRenvoi: r.motifRenvoi,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function refCode(r: RapportDto): string {
  const t = (r.type || 'RPT').slice(0, 3).toUpperCase();
  return `RPT-${t}-${r.id.slice(0, 8).toUpperCase()}`;
}

function labelType(type: string | null): string {
  const key = (type || '').toLowerCase();
  return TYPE_LABELS_SHORT[key as keyof typeof TYPE_LABELS_SHORT]
    ?? (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Rapport');
}

interface Contenu { facts: { k: string; v: string }[]; gps?: string; ouvrage?: string; periode?: string; }

function parseContenu(json: string | null): Contenu {
  const out: Contenu = { facts: [] };
  if (!json) return out;
  try {
    const c = JSON.parse(json);
    if (!c || typeof c !== 'object') return out;
    if (c.infrastructure) out.ouvrage = String(c.infrastructure);
    if (c.gps && c.gps.latitude != null) out.gps = `${c.gps.latitude}, ${c.gps.longitude}`;
    if (c.periode) out.periode = String(c.periode);
    for (const [k, v] of Object.entries(c)) {
      if (k === 'infrastructure' || k === 'gps' || k === 'periode') continue;
      if (v == null || typeof v === 'object') continue;
      out.facts.push({ k: humanize(k), v: String(v) });
    }
  } catch { /* contenu libre non-JSON : ignoré, le résumé auto porte le fond */ }
  return out;
}

function humanize(key: string): string {
  const s = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

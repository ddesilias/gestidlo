export type ReportStatus = 'brouillon' | 'genere' | 'valide' | 'transmis' | 'archive' | 'echec';
export type ReportType   = 'service' | 'alertes' | 'interventions' | 'infrastructures' | 'iot' | 'qualite' | 'traceabilite' | 'executif';
export type TemplateType = 'inspection' | 'mensuel' | 'incident_grave' | 'audit';

export interface ReportVersion { version: string; createdBy: string; createdAt: string; changes: string; }

export interface ReportEntry {
  id: string; title: string; subtitle: string; type: ReportType; module: string;
  periodLabel: string; zone: string; author: string; status: ReportStatus;
  format: 'pdf' | 'docx' | 'xlsx'; createdAt: string; institution: string;
  fileSize: string; version: string; sections: string[]; versions: ReportVersion[];
  interventionId?: string; interventionCode?: string;
  /** Dérivé de la zone au moment de la création. null = rapport national (DINEPA seulement). */
  departement?: string | null;
}

/** Types producibles par une URD (départementaux). */
export const TYPES_URD: ReportType[] = ['service', 'alertes', 'interventions', 'infrastructures', 'iot', 'qualite'];
/** Types réservés à la DINEPA nationale. */
export const TYPES_NATIONAUX: ReportType[] = ['traceabilite', 'executif'];

export interface FiltresRapport {
  recherche: string; statuts: ReportStatus[]; types: ReportType[];
  auteurs: string[]; institutions: string[]; formats: string[];
  dateFrom: string; dateTo: string;
}

export interface DonneesRapportPreRemplies {
  sourceInterventionId: string; sourceInterventionCode: string;
  titre: string; description: string; type: ReportType;
  technicien: string; institution: string;
  commune: string; section: string; departement: string;
}

export const FILTRES_VIDES_RAPPORT: FiltresRapport = {
  recherche: '', statuts: [], types: [], auteurs: [], institutions: [], formats: '',
  dateFrom: '', dateTo: '',
} as unknown as FiltresRapport;

export const TYPE_TO_TEMPLATE: Record<ReportType, TemplateType> = {
  interventions:   'inspection',
  infrastructures: 'inspection',
  service:         'mensuel',
  qualite:         'mensuel',
  executif:        'mensuel',
  alertes:         'incident_grave',
  iot:             'incident_grave',
  traceabilite:    'audit',
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  brouillon: 'Brouillon', genere: 'Généré', valide: 'Validé',
  transmis: 'Transmis', archive: 'Archivé', echec: 'Échec',
};

export const TYPE_LABELS: Record<ReportType, string> = {
  service: 'Rapport de service', alertes: "Rapport d'incidents",
  interventions: "Rapport d'interventions", infrastructures: "Rapport d'infrastructures",
  iot: 'Rapport IoT', qualite: "Rapport de qualité",
  traceabilite: "Rapport d'audit", executif: 'Résumé exécutif',
};

export const TYPE_LABELS_SHORT: Record<ReportType, string> = {
  service: 'Service', alertes: 'Alertes', interventions: 'Interventions',
  infrastructures: 'Infrastructures', iot: 'IoT', qualite: 'Qualité',
  traceabilite: 'Traçabilité', executif: 'Exécutif',
};

export const TYPE_COLOR: Record<ReportType, string> = {
  service: '#2563eb', alertes: '#ea580c', interventions: '#0d9488',
  infrastructures: '#475569', iot: '#9333ea', qualite: '#0891b2',
  traceabilite: '#4f46e5', executif: '#d97706',
};

export const TYPE_BG: Record<ReportType, string> = {
  service: '#eff6ff', alertes: '#fff7ed', interventions: '#f0fdfa',
  infrastructures: '#f8fafc', iot: '#fdf4ff', qualite: '#ecfeff',
  traceabilite: '#eef2ff', executif: '#fffbeb',
};

export const STATUS_DOT: Record<ReportStatus, string> = {
  brouillon: '#94a3b8', genere: '#60a5fa', valide: '#4ade80',
  transmis: '#a78bfa', archive: '#64748b', echec: '#f87171',
};

export const STATUS_BG: Record<ReportStatus, string> = {
  brouillon: 'rgba(148,163,184,.12)', genere: 'rgba(96,165,250,.12)', valide: 'rgba(74,222,128,.12)',
  transmis: 'rgba(167,139,250,.12)', archive: 'rgba(100,116,139,.12)', echec: 'rgba(248,113,113,.12)',
};

export const RAPPORTS_MOCK: ReportEntry[] = [
  {
    id: 'rpt-001', title: 'Rapport de service Léogâne - Avril 2026',
    subtitle: 'Desserte, continuité et incidents', type: 'service', module: 'Service',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'Commune Léogâne', departement: 'Ouest',
    author: 'Admin', status: 'valide', format: 'pdf',
    createdAt: '29/04/2026 09:35', institution: 'DINEPA Ouest', fileSize: '2.4 Mo', version: '1.0',
    sections: ['Résumé exécutif', 'Carte du service', 'Zones desservies', "Points d'eau", 'Coupures et incidents', 'Interventions réalisées', 'Données IoT', 'Annexes'],
    versions: [{ version: 'v1.0', createdBy: 'Admin', createdAt: '29/04/2026 09:35', changes: 'Version initiale validée' }],
  },
  {
    id: 'rpt-002', title: 'Incidents critiques - 7 derniers jours',
    subtitle: 'Alertes et incidents', type: 'alertes', module: 'Alertes',
    periodLabel: '22/04/2026 – 29/04/2026', zone: 'Département Ouest', departement: 'Ouest',
    author: 'DINEPA Ouest', status: 'genere', format: 'pdf',
    createdAt: '29/04/2026 08:20', institution: 'DINEPA', fileSize: '1.1 Mo', version: '1.0',
    sections: ['Résumé des alertes', 'Incidents critiques', 'Zones affectées', 'Interventions déclenchées', 'Statuts de résolution'],
    versions: [{ version: 'v1.0', createdBy: 'Système', createdAt: '29/04/2026 08:20', changes: 'Génération automatique' }],
  },
  {
    id: 'rpt-003', title: 'Interventions réalisées Avril 2026',
    subtitle: 'Travaux et visites terrain', type: 'interventions', module: 'Interventions',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'Section Dessources', departement: 'Ouest',
    author: 'Marc Étienne', status: 'transmis', format: 'pdf',
    createdAt: '28/04/2026 16:40', institution: 'DINEPA Ouest', fileSize: '3.2 Mo', version: '1.0',
    sections: ['Résumé des interventions', 'Tâches réalisées', 'Mesures relevées', 'Anomalies constatées', 'Photos terrain', 'Résultats et recommandations'],
    versions: [{ version: 'v1.0', createdBy: 'Marc Étienne', createdAt: '28/04/2026 16:40', changes: 'Validé par superviseur' }],
  },
  {
    id: 'rpt-004', title: 'État des infrastructures Ouest',
    subtitle: 'Réservoirs, pompes, captages...', type: 'infrastructures', module: 'Infrastructures',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'Département Ouest', departement: 'Ouest',
    author: 'Admin', status: 'brouillon', format: 'docx',
    createdAt: '28/04/2026 11:15', institution: 'DINEPA', fileSize: '—', version: '0.1',
    sections: ['Identification des ouvrages', 'État de fonctionnement', 'Alertes associées', 'Maintenance récente', 'Recommandations'],
    versions: [{ version: 'v0.1', createdBy: 'Admin', createdAt: '28/04/2026 11:15', changes: 'Brouillon en cours' }],
  },
  {
    id: 'rpt-005', title: 'Rapport IoT - Capteurs',
    subtitle: 'Données et alertes IoT', type: 'iot', module: 'IoT',
    periodLabel: '22/04/2026 – 29/04/2026', zone: 'National',
    author: 'Système', status: 'valide', format: 'pdf',
    createdAt: '27/04/2026 17:05', institution: 'DINEPA', fileSize: '0.8 Mo', version: '1.0',
    sections: ['Liste des capteurs', 'Dernières transmissions', 'Capteurs hors ligne', 'Batterie faible', 'Mesures hors seuil', 'Recommandations techniques'],
    versions: [{ version: 'v1.0', createdBy: 'Système', createdAt: '27/04/2026 17:05', changes: 'Génération automatique validée' }],
  },
  {
    id: 'rpt-006', title: "Qualité de l'eau - Avril",
    subtitle: 'Analyses et conformité', type: 'qualite', module: 'Qualité',
    periodLabel: '02/04/2026 – 29/04/2026', zone: 'Toutes zones',
    author: 'Lab. DINEPA', status: 'valide', format: 'pdf',
    createdAt: '27/04/2026 14:10', institution: 'DINEPA', fileSize: '1.6 Mo', version: '1.0',
    sections: ['Résultats pH', 'Turbidité', 'Chlore résiduel', 'Conformité réglementaire', 'Points hors normes', 'Recommandations'],
    versions: [{ version: 'v1.0', createdBy: 'Lab. DINEPA', createdAt: '27/04/2026 14:10', changes: 'Validé par laboratoire' }],
  },
  {
    id: 'rpt-007', title: 'Audit système - Avril',
    subtitle: 'Journal des actions et modifications', type: 'traceabilite', module: 'Traçabilité',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'National',
    author: 'Admin', status: 'valide', format: 'pdf',
    createdAt: '26/04/2026 20:30', institution: 'DINEPA', fileSize: '2.1 Mo', version: '1.0',
    sections: ["Période d'audit", 'Utilisateurs actifs', 'Actions sensibles', 'Modifications critiques', 'Journal détaillé', "Observations d'audit"],
    versions: [{ version: 'v1.0', createdBy: 'Admin', createdAt: '26/04/2026 20:30', changes: 'Audit mensuel validé' }],
  },
  {
    id: 'rpt-008', title: 'Résumé exécutif - Avril 2026',
    subtitle: 'Synthèse pour les décideurs', type: 'executif', module: 'Exécutif',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'National',
    author: 'Admin', status: 'transmis', format: 'pdf',
    createdAt: '26/04/2026 15:45', institution: 'DINEPA', fileSize: '0.5 Mo', version: '1.0',
    sections: ['Résumé exécutif', 'Points clés du mois', 'Indicateurs de performance', 'Incidents critiques', 'Recommandations stratégiques'],
    versions: [{ version: 'v1.0', createdBy: 'Admin', createdAt: '26/04/2026 15:45', changes: 'Transmis aux décideurs' }],
  },
];

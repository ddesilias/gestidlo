// Types partagés entre TerritoireComponent et RecensementComponent

export type AccessType = 'Bonne · route' | 'Moyenne · piste' | 'Difficile · chemin';
export type ZoneStatus  = 'deploying' | 'recensement-en-cours' | 'supervised' | 'archivee';
export type JournalEntryType = 'sync' | 'add' | 'update' | 'activate';

export interface JournalEntry {
  date: string;
  label: string;
  author: string;
  type: JournalEntryType;
}

export interface ZoneFiche {
  id: string; code: string; codeIhsi: string;
  nom: string; dept: string; commune: string;
  superficie: number; population: number; foyers: number; densiteHabKm2: number;
  coverageAep: number; continuiteService: number; accessibilite: AccessType; localites: number;
  activeLe?: string;
  resources: number; infras: number; capteurs: number; alertes: number;
  responsable?: string; responsableInitiales?: string;
  caepa?: string; orepa?: string; mairie?: string; tepac?: string;
  status?: ZoneStatus; // undefined → supervised (rétrocompat)
  // Données opérationnelles
  typeSource?: string; debitSourceLs?: number;
  typeReservoir?: string; reservoirM3?: number;
  typeReseau?: string; reseauKm?: number;
  qmj?: number; qpj?: number; horizonRef?: number;
  journal: JournalEntry[];
  lat: number; lon: number;
  snapshots?: RecensementSnapshot[];
}

export interface SectionNode { id: string; nom: string; ficheId?: string; }
export interface CommuneNode {
  id: string; nom: string; active: boolean;
  ficheId?: string; lat: number; lon: number;
  sections: SectionNode[];
}
export interface DepartmentNode {
  id: string; nom: string; lat: number; lon: number;
  totalCommunes: number; communes: CommuneNode[];
}

export interface PerimPoint {
  id: string;
  lat: number;
  lng: number;
  cote?: number;
  type: 'sommet' | 'intermédiaire';
}

// ── Phase 3 : Enquête ──────────────────────────────────────────
export interface EchantillonSZ {
  sousZoneId: string;
  nomSousZone: string;
  maisonsCorrigees: number;
  taille: number;          // ceil(maisonsCorrigees × 10%)
  collectees: number;
  geolocalisees: number;
  derogation?: string;     // justification si collectees < taille
}

export interface RatiosEnquete {
  menagesParMaison: number;    // ex: 1.63
  personnesParMenage: number;  // ex: 6.1
  niveauVie?: string;          // ex: "53% pauvre · 47% moyen"
  tarifGallon?: number;        // ex: 7 (Gdes/gallon)
}

export interface ParamsMethodo {
  tauxCroissanceAn: number;  // %/an
  horizonAns: number;
  dotationLjHab: number;     // l/j/hab — dotation nette livrée à l'usager
  pertesPercent: number;     // % pertes réseau
  cpj: number;               // coef pointe journalière
  cph: number;               // coef pointe horaire
}

export type MethodeComptage = 'satellite' | 'terrain' | 'mixte';

export interface SousZone {
  id: string;
  nom: string;
  methode: MethodeComptage;
  maisonsComptees: number;
  coefMajorateur: number;
}

export type NodeType = 'sommet' | 'noeud-interne' | 'piquage' | 'alimentation';
export type TronconNature = 'maille' | 'antenne' | 'ramification';

export interface ReseauNoeud {
  id: string;
  lat: number;
  lng: number;
  cote?: number;
  type: NodeType;
}

export interface ReseauTroncon {
  id: string;
  deNoeudId: string;
  aNoeudId: string;
  longueur?: number;    // undefined = auto-calculée
  longueurAuto: boolean;
  nature: TronconNature;
}

// ── Phase 4 : Demande par tronçon ─────────────────────────────────

export interface CategorieUsager {
  id: string;
  label: string;
  domestique: boolean;
}

export const CATEGORIES_PAR_DEFAUT: CategorieUsager[] = [
  { id: 'bp',     label: 'BP',     domestique: true  },
  { id: 'bf',     label: 'BF',     domestique: true  },
  { id: 'eglise', label: 'Église', domestique: false },
  { id: 'resto',  label: 'Resto',  domestique: false },
  { id: 'ecole',  label: 'École',  domestique: false },
  { id: 'bureau', label: 'Bureau', domestique: false },
];

export interface DemandeTroncon {
  tronconId: string;
  demande: Record<string, number>; // catId → l/s
}

export interface PointConso {
  id: string;
  nom: string;
  type: string;
  lat: number;
  lng: number;
  tronconId: string;
  debitLs: number;
}

// ── Phase 5 : Snapshot immuable ───────────────────────────────────

// ── Escalade alertes ──────────────────────────────────────────────

export const SLA_HOURS: Record<string, number> = {
  critique: 4,
  haute:    24,
  moyenne:  72,
  basse:    168,
};

export type EscaladeType = 'automatique' | 'manuelle';

export interface EscaladeEvent {
  id: string;
  alerteId: string;
  type: EscaladeType;
  palierDepart: 0 | 1 | 2;
  palierArrive: 1 | 2;
  auteur: string;
  date: string;
  motif: string;
}

// ── Liaisons zone–infrastructure (N-N) ───────────────────────────

export type LienRole = 'alimente' | 'stocke' | 'dessert';

export interface ZoneInfrastructureLien {
  id: string;
  zoneId: string;
  infrastructureId: string;
  role: LienRole;
  noeudAncrageId?: string;  // nœud d'alimentation dans le réseau de la zone
  quotePartDebit?: number;  // % (0-100) ; undefined = 100 %
  dateLien: string;
  statut: 'actif' | 'suspendu';
}

export interface ZoneRessourceLien {
  zoneId: string;
  ressourceId: string;
  dateLien: string;
}

// ── zone_acteur (N-N) ─────────────────────────────────────────────

export type LienActeurRole = 'orepa' | 'caepa' | 'tepac' | 'mairie' | 'operateur' | 'ong' | 'bailleur';

export interface ZoneActeurLien {
  id: string;
  zoneId: string;
  institutionId: string;
  role: LienActeurRole;
  dateLien: string;
  statut: 'actif' | 'suspendu';
}

// ── zone_utilisateur (N-N) ────────────────────────────────────────

export type LienUserRole = 'consultation' | 'edition' | 'validation';

export interface ZoneUtilisateurLien {
  id: string;
  zoneId: string;
  userId: string;
  role: LienUserRole;
  perimetreVisible: 'zone' | 'commune' | 'national';
  dateLien: string;
}

export interface RecensementSnapshot {
  version: string;
  date: string;
  resultats: {
    maisonsCorrigees: number;
    popActuelle: number;
    popHorizon: number;
    anneeHorizon: number;
    qmjLs: number; qpjLs: number; qphLs: number;
    demandeTotal: number;
    domestique: number;
    institutionnel: number;
  };
  derogations: string[];
}

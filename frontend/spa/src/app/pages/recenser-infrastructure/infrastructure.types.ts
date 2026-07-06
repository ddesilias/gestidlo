import type { InfraType } from '../../infrastructure.store';

export type InfraFamille =
  | 'captage'
  | 'stockage'
  | 'pompage'
  | 'traitement'
  | 'distribution'
  | 'forage'
  | 'supervision';

export interface FamilleConfig {
  label: string;
  prefix: string;
  types: { value: string; label: string }[];
}

// ── Lightweight form-side types (stores hold the canonical versions) ──────────

export interface InfrastructureExistante {
  id: string;
  code: string;
  nom: string;
  famille: InfraFamille;
}

export interface RessourceNaturelle {
  id: string;
  nom: string;
  type: string;
}

export interface Technicien {
  id: string;
  prenom: string;
  nom: string;
  telephone?: string;
}

export interface InfrastructureFormData {
  code: string;
  nom: string;
  famille: InfraFamille;
  type: string;
  departement: string;
  commune: string;
  section: string;
  localite: string;
  systemeAep: string;
  ressourceId: string;
  ressourceNom: string;
  ouvragesAmont: string[];
  ouvragesAval: string[];
  description: string;
  technicienId: string;
  lat: number | null;
  lon: number | null;
}

// ── Famille catalogue ─────────────────────────────────────────────────────────

export const FAMILLES: Record<InfraFamille, FamilleConfig> = {
  captage: {
    label: 'Captage',
    prefix: 'CAP',
    types: [
      { value: 'source-captee',   label: 'Source captée' },
      { value: 'prise-riviere',   label: 'Prise en rivière' },
      { value: 'derivation',      label: 'Dérivation' },
      { value: 'barrage-prise',   label: 'Barrage prise' },
    ],
  },
  stockage: {
    label: 'Stockage',
    prefix: 'RES',
    types: [
      { value: 'reservoir-beton',    label: 'Réservoir béton armé' },
      { value: 'reservoir-plastique',label: 'Réservoir polyéthylène' },
      { value: 'chateau-eau',        label: "Château d'eau" },
      { value: 'bassin-ouvert',      label: 'Bassin ouvert' },
    ],
  },
  pompage: {
    label: 'Pompage',
    prefix: 'PMP',
    types: [
      { value: 'groupe-electropompe', label: 'Groupe électropompe' },
      { value: 'pompe-solaire',       label: 'Pompe solaire' },
      { value: 'pompe-main',          label: 'Pompe à main' },
      { value: 'motopompe',           label: 'Motopompe thermique' },
    ],
  },
  traitement: {
    label: 'Traitement',
    prefix: 'TRT',
    types: [
      { value: 'chloration',         label: 'Station de chloration' },
      { value: 'filtre-sable',       label: 'Filtre à sable lent' },
      { value: 'filtre-uv',          label: 'Désinfection UV' },
      { value: 'traitement-complet', label: 'Station de traitement complète' },
    ],
  },
  distribution: {
    label: 'Distribution',
    prefix: 'DIS',
    types: [
      { value: 'borne-fontaine', label: 'Borne-fontaine' },
      { value: 'kiosque-eau',    label: "Kiosque eau" },
      { value: 'branchement',    label: 'Branchement privé' },
      { value: 'conduite',       label: 'Réseau de conduite' },
    ],
  },
  forage: {
    label: 'Forage',
    prefix: 'FOR',
    types: [
      { value: 'forage-profond',    label: 'Forage profond' },
      { value: 'puits-traditionnel',label: 'Puits traditionnel' },
      { value: 'puits-moderne',     label: 'Puits moderne' },
      { value: 'puits-fore',        label: 'Puits foré mécanisé' },
    ],
  },
  supervision: {
    label: 'Supervision',
    prefix: 'SUP',
    types: [
      { value: 'station-mesure', label: 'Station de mesure' },
      { value: 'compteur-vol',   label: 'Compteur volumétrique' },
      { value: 'capteur-multi',  label: 'Capteur multi-paramètre' },
      { value: 'poste-controle', label: 'Poste de contrôle' },
    ],
  },
};

// ── Géographie haïtienne ──────────────────────────────────────────────────────

export const DEPARTEMENTS: Record<string, string[]> = {
  'Ouest': [
    'Port-au-Prince', 'Carrefour', 'Delmas', 'Pétion-Ville', 'Tabarre',
    'Léogâne', 'Grand-Goâve', 'Petit-Goâve', 'Gressier', 'Croix-des-Bouquets',
    'Kenscoff', 'Ganthier', 'Cité Soleil',
  ],
  'Nord': [
    'Cap-Haïtien', 'Acul-du-Nord', 'Borgne', 'Dondon', 'Grande-Rivière-du-Nord',
    'Limonade', 'Milot', 'Pignon', 'Plaisance', 'Ranquitte', 'Saint-Raphaël',
  ],
  'Nord-Est': [
    'Fort-Liberté', 'Ouanaminthe', 'Trou-du-Nord', 'Caracol',
    'Capotille', 'Mont-Organisé', 'Sainte-Suzanne', 'Vallières',
  ],
  'Nord-Ouest': [
    'Port-de-Paix', 'Bassin Bleu', 'Bombardopolis', 'Chansolme',
    'Jean-Rabel', 'Môle-Saint-Nicolas', 'Saint-Louis-du-Nord',
  ],
  'Artibonite': [
    'Gonaïves', 'Desdunes', 'Dessalines', 'Ennery', 'Gros-Morne',
    "L'Estère", 'Marmelade', 'Montrouis', "Petite-Rivière-de-l'Artibonite",
    'Saint-Marc', 'Terre-Neuve', 'Verrettes',
  ],
  'Centre': [
    'Hinche', 'Boucan-Carré', 'Cerca-Carvajal', 'Cerca-la-Source',
    'Lascahobas', 'Mirebalais', 'Savanette', 'Thomassique', 'Thomonde',
  ],
  'Sud': [
    'Les Cayes', 'Aquin', 'Arniquet', 'Camp-Perrin', 'Cavaillon',
    'Chantal', 'Côteaux', 'Île-à-Vache', 'Port-Salut',
    'Saint-Louis-du-Sud', 'Torbeck',
  ],
  'Sud-Est': [
    'Jacmel', 'Anse-à-Pitres', 'Bainet', 'Belle-Anse', 'Cayes-Jacmel',
    'Côtes-de-Fer', 'Grand-Gosier', 'La Vallée', 'Marigot', 'Thiotte',
  ],
  'Nippes': [
    'Miragoâne', 'Anse-à-Veau', 'Arnaud', 'Baradères', 'Fond-des-Nègres',
    'Grand-Boucan', 'Latibolière', 'Pailhant', 'Petit-Trou-de-Nippes',
    'Plaisance-du-Sud',
  ],
  "Grand'Anse": [
    'Jérémie', 'Abricots', "Anse-d'Hainault", 'Bonbon', 'Chambellan',
    'Corail', 'Dame-Marie', 'Les Irois', 'Moron', 'Roseaux',
  ],
};

export const DEPT_CODES: Record<string, string> = {
  'Ouest':       'OUE',
  'Nord':        'NOR',
  'Nord-Est':    'NNE',
  'Nord-Ouest':  'NNO',
  'Artibonite':  'ART',
  'Centre':      'CEN',
  'Sud':         'SUD',
  'Sud-Est':     'SSE',
  'Nippes':      'NIP',
  "Grand'Anse":  'GAN',
};

// ── Mapping famille → InfraType (store) ──────────────────────────────────────

export const FAMILLE_TO_INFRA_TYPE: Record<InfraFamille, InfraType> = {
  captage:      'captage',
  stockage:     'reservoir',
  pompage:      'pompe',
  traitement:   'traitement',
  distribution: 'point-eau',
  forage:       'captage',
  supervision:  'passerelle',
};

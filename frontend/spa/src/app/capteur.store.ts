import { Injectable, signal, computed } from '@angular/core';

export type CapteurType   = 'pression' | 'debit' | 'niveau' | 'qualite';
export type CapteurStatut =
  'en-ligne' | 'hors-ligne' | 'critique' | 'attention' |
  'maintenance' | 'signal-faible' | 'batterie-faible';

export interface Capteur {
  id: string;
  code: string;
  type: CapteurType;
  infraCode: string;
  infraNom: string;
  commune: string;
  section?: string;
  department: string;
  valeur?: number;
  unite: string;
  statut: CapteurStatut;
  batterie?: number;
  signalBars: number;
  derniereTransmission: string;
  technicienNom: string;
  technicienInitiales: string;
  technicienBg: string;
  technicienCouleur: string;
}

const SEED: Capteur[] = [
  // Critiques
  { id:'c001', code:'CPT-PR-018', type:'pression', infraCode:'C-127', infraNom:'Conduite C-127',
    commune:'Léogâne', section:'Dessources', department:'Ouest',
    valeur:0.6, unite:'bar', statut:'critique', batterie:76, signalBars:4,
    derniereTransmission:"à l'instant",
    technicienNom:'Jean P.', technicienInitiales:'JP', technicienBg:'#FAEEDA', technicienCouleur:'#854F0B' },

  { id:'c002', code:'CPT-PR-019', type:'pression', infraCode:'C-128', infraNom:'Conduite C-128',
    commune:'Léogâne', section:'Dessources', department:'Ouest',
    valeur:0.3, unite:'bar', statut:'critique', batterie:68, signalBars:3,
    derniereTransmission:'2 s',
    technicienNom:'Gérald B.', technicienInitiales:'GB', technicienBg:'#E6F1FB', technicienCouleur:'#0C447C' },

  // Attention
  { id:'c003', code:'CPT-NV-008', type:'niveau', infraCode:'R-01', infraNom:'Réservoir R-01',
    commune:'Léogâne', section:'Dessources', department:'Ouest',
    valeur:21, unite:'%', statut:'attention', batterie:82, signalBars:4,
    derniereTransmission:'6 s',
    technicienNom:'Gérald B.', technicienInitiales:'GB', technicienBg:'#E6F1FB', technicienCouleur:'#0C447C' },

  { id:'c004', code:'CPT-DB-031', type:'debit', infraCode:'C-132', infraNom:'Conduite C-132',
    commune:'Léogâne', section:'Centre', department:'Ouest',
    valeur:4.2, unite:'L/min', statut:'attention', batterie:71, signalBars:3,
    derniereTransmission:'30 s',
    technicienNom:'Marc D.', technicienInitiales:'MD', technicienBg:'#E1F5EE', technicienCouleur:'#085041' },

  // En ligne — normal
  { id:'c005', code:'CPT-PR-001', type:'pression', infraCode:'RMC', infraNom:'Réservoir Morne Calvaire',
    commune:'Léogâne', section:'Centre', department:'Ouest',
    valeur:3.2, unite:'bar', statut:'en-ligne', batterie:82, signalBars:4,
    derniereTransmission:'2 min',
    technicienNom:'Jean Robert', technicienInitiales:'JR', technicienBg:'#E1F5EE', technicienCouleur:'#085041' },

  { id:'c006', code:'CPT-NV-004', type:'niveau', infraCode:'R-03', infraNom:'Réservoir R-03',
    commune:'Léogâne', section:'Centre', department:'Ouest',
    valeur:72, unite:'%', statut:'en-ligne', batterie:85, signalBars:4,
    derniereTransmission:'12 s',
    technicienNom:'Jean Robert', technicienInitiales:'JR', technicienBg:'#E1F5EE', technicienCouleur:'#085041' },

  { id:'c007', code:'CPT-PR-002', type:'pression', infraCode:'C-001', infraNom:'Conduite C-001',
    commune:'Léogâne', section:'Dessources', department:'Ouest',
    valeur:2.8, unite:'bar', statut:'en-ligne', batterie:73, signalBars:3,
    derniereTransmission:'1 min',
    technicienNom:'Gérald B.', technicienInitiales:'GB', technicienBg:'#E6F1FB', technicienCouleur:'#0C447C' },

  { id:'c008', code:'CPT-QA-001', type:'qualite', infraCode:'SRC-01', infraNom:'Source Momance',
    commune:'Léogâne', section:'Dessources', department:'Ouest',
    valeur:7.2, unite:'pH', statut:'en-ligne', batterie:90, signalBars:4,
    derniereTransmission:'8 min',
    technicienNom:'Marc D.', technicienInitiales:'MD', technicienBg:'#E1F5EE', technicienCouleur:'#085041' },

  { id:'c009', code:'CPT-DB-009', type:'debit', infraCode:'C-200', infraNom:'Conduite C-200',
    commune:'Petit-Goâve', section:'Centre', department:'Nippes',
    valeur:11.4, unite:'L/min', statut:'en-ligne', batterie:78, signalBars:3,
    derniereTransmission:'22 s',
    technicienNom:'Pierre L.', technicienInitiales:'PL', technicienBg:'#EEEDFE', technicienCouleur:'#3C3489' },

  { id:'c010', code:'CPT-NV-021', type:'niveau', infraCode:'R-05', infraNom:'Réservoir R-05',
    commune:'Petit-Goâve', section:'Centre', department:'Nippes',
    valeur:60, unite:'%', statut:'en-ligne', batterie:80, signalBars:4,
    derniereTransmission:'45 s',
    technicienNom:'Pierre L.', technicienInitiales:'PL', technicienBg:'#EEEDFE', technicienCouleur:'#3C3489' },

  // Batterie faible (< 20%)
  { id:'c011', code:'CPT-DB-014', type:'debit', infraCode:'C-118', infraNom:'Conduite C-118',
    commune:'Léogâne', section:'Centre', department:'Ouest',
    valeur:18.7, unite:'L/min', statut:'batterie-faible', batterie:18, signalBars:4,
    derniereTransmission:'18 s',
    technicienNom:'Marc D.', technicienInitiales:'MD', technicienBg:'#E1F5EE', technicienCouleur:'#085041' },

  { id:'c012', code:'CPT-NV-012', type:'niveau', infraCode:'R-04', infraNom:'Réservoir R-04',
    commune:'Petit-Goâve', section:'Centre', department:'Nippes',
    valeur:55, unite:'%', statut:'batterie-faible', batterie:14, signalBars:3,
    derniereTransmission:'5 min',
    technicienNom:'Pierre L.', technicienInitiales:'PL', technicienBg:'#EEEDFE', technicienCouleur:'#3C3489' },

  { id:'c013', code:'CPT-PR-003', type:'pression', infraCode:'C-050', infraNom:'Conduite C-050',
    commune:'Léogâne', section:'Dessources', department:'Ouest',
    valeur:1.9, unite:'bar', statut:'batterie-faible', batterie:12, signalBars:2,
    derniereTransmission:'3 min',
    technicienNom:'Jean P.', technicienInitiales:'JP', technicienBg:'#FAEEDA', technicienCouleur:'#854F0B' },

  // Signal faible
  { id:'c014', code:'CPT-DB-005', type:'debit', infraCode:'SP-01', infraNom:'Station pompage SP-01',
    commune:'Léogâne', section:'Dessources', department:'Ouest',
    valeur:3.2, unite:'L/s', statut:'signal-faible', batterie:61, signalBars:2,
    derniereTransmission:'15 min',
    technicienNom:'Jean P.', technicienInitiales:'JP', technicienBg:'#FAEEDA', technicienCouleur:'#854F0B' },

  { id:'c015', code:'CPT-NV-020', type:'niveau', infraCode:'R-06', infraNom:'Réservoir R-06',
    commune:'Léogâne', section:'Centre', department:'Ouest',
    valeur:48, unite:'%', statut:'signal-faible', batterie:55, signalBars:1,
    derniereTransmission:'18 min',
    technicienNom:'Jean Robert', technicienInitiales:'JR', technicienBg:'#E1F5EE', technicienCouleur:'#085041' },

  // Maintenance
  { id:'c016', code:'CPT-NV-001', type:'niveau', infraCode:'R-02', infraNom:'Réservoir R-02',
    commune:'Petit-Goâve', section:'Centre', department:'Nippes',
    valeur:68, unite:'%', statut:'maintenance', batterie:60, signalBars:4,
    derniereTransmission:'3 min',
    technicienNom:'Jean P.', technicienInitiales:'JP', technicienBg:'#FAEEDA', technicienCouleur:'#854F0B' },

  { id:'c017', code:'CPT-PR-007', type:'pression', infraCode:'C-080', infraNom:'Conduite C-080',
    commune:'Léogâne', section:'Centre', department:'Ouest',
    valeur:undefined, unite:'bar', statut:'maintenance', batterie:72, signalBars:3,
    derniereTransmission:'En cours',
    technicienNom:'Marc D.', technicienInitiales:'MD', technicienBg:'#E1F5EE', technicienCouleur:'#085041' },

  // Hors ligne
  { id:'c018', code:'CPT-DB-022', type:'debit', infraCode:'SP-02', infraNom:'Pompe SP-02',
    commune:'Petit-Goâve', section:'Centre', department:'Nippes',
    valeur:undefined, unite:'L/min', statut:'hors-ligne', batterie:undefined, signalBars:0,
    derniereTransmission:'12 min',
    technicienNom:'Pierre L.', technicienInitiales:'PL', technicienBg:'#EEEDFE', technicienCouleur:'#3C3489' },

  { id:'c019', code:'CPT-NV-015', type:'niveau', infraCode:'R-07', infraNom:'Réservoir R-07',
    commune:'Petit-Goâve', section:'Lacombe', department:'Nippes',
    valeur:undefined, unite:'%', statut:'hors-ligne', batterie:undefined, signalBars:0,
    derniereTransmission:'2 h',
    technicienNom:'Pierre L.', technicienInitiales:'PL', technicienBg:'#EEEDFE', technicienCouleur:'#3C3489' },

  { id:'c020', code:'CPT-DB-030', type:'debit', infraCode:'C-210', infraNom:'Conduite C-210',
    commune:'Léogâne', section:'Centre', department:'Ouest',
    valeur:22.1, unite:'L/min', statut:'en-ligne', batterie:88, signalBars:4,
    derniereTransmission:'9 s',
    technicienNom:'Gérald B.', technicienInitiales:'GB', technicienBg:'#E6F1FB', technicienCouleur:'#0C447C' },
];

@Injectable({ providedIn: 'root' })
export class CapteurStore {
  private readonly _all = signal<Capteur[]>(SEED);

  readonly all = this._all.asReadonly();

  // "En ligne" = tout capteur qui transmet (tout sauf hors-ligne)
  readonly enLigne      = computed(() => this._all().filter(c => c.statut !== 'hors-ligne'));
  readonly horsLigne    = computed(() => this._all().filter(c => c.statut === 'hors-ligne'));
  readonly enAlerte     = computed(() => this._all().filter(c => ['critique','attention'].includes(c.statut)));
  readonly critiques    = computed(() => this._all().filter(c => c.statut === 'critique'));
  readonly batterieFaible = computed(() => this._all().filter(c => (c.batterie ?? 100) < 20 && c.statut !== 'hors-ligne'));
  readonly maintenance  = computed(() => this._all().filter(c => c.statut === 'maintenance'));

  readonly fluxTempsReel = computed(() =>
    [...this._all()]
      .filter(c => c.statut !== 'maintenance')
      .sort((a, b) => {
        const order: Record<CapteurStatut, number> = {
          'critique': 0, 'attention': 1, 'hors-ligne': 2,
          'batterie-faible': 3, 'signal-faible': 4, 'en-ligne': 5, 'maintenance': 6,
        };
        return order[a.statut] - order[b.statut];
      })
      .slice(0, 8)
  );
}

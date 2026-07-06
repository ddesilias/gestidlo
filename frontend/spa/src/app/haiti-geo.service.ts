import { Injectable, signal, computed } from '@angular/core';

// ── Haiti administrative reference data ──────────────────────────────────────
// Single source of truth for all pages. Import from here, never duplicate.

export const HAITI_DEPARTMENTS: string[] = [
  'Artibonite', 'Centre', "Grand'Anse", 'Nippes',
  'Nord', 'Nord-Est', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Est',
];

export const HAITI_COMMUNES: Record<string, string[]> = {
  'Artibonite': ['Desdunes','Dessalines','Ennery','Gonaïves','Grande-Saline','Gros-Morne',"L'Estère",'La Chapelle','Marchand-Dessalines',"Petite-Rivière-de-l'Artibonite",'Pont-Sondé','Saint-Marc','Verrettes'],
  'Centre': ['Boucan-Carré','Cerca Carvajal','Cerca La Source','Hinche','Lascahobas','Maïssade','Mirebalais','Sainte-Croix-de-la-Vallée','Thomassique','Thomonde'],
  "Grand'Anse": ['Abricots',"Anse-d'Hainault",'Beaumont','Bonbon','Chambellan','Corail','Dame-Marie','Duchity','Jérémie','Latibolière','Marfranc','Moron','Pestel','Roseaux','Sainte-Hélène'],
  'Nippes': ['Anse-à-Veau','Arnaud','Baradères','Fond-des-Nègres',"L'Asile",'Miragoâne','Paillant','Petit-Trou-de-Nippes','Petite-Rivière-de-Nippes','Plaisance-du-Sud'],
  'Nord': ['Acul-du-Nord','Bahon','Bas-Limbé','Borgne','Camp-Coq','Cap-Haïtien','Dondon','Grande-Rivière-du-Nord','Limonade','Limbé','Milot','Pignon','Pilate','Plaisance','Quartier-Morin','Ranquitte','Saint-Raphaël'],
  'Nord-Est': ['Capotille','Carice','Ferrier','Fort-Liberté','Mombin-Crochu','Mont-Organisé','Ouanaminthe','Perches','Sainte-Suzanne','Trou-du-Nord','Vallières','Wanament'],
  'Nord-Ouest': ['Anse-à-Foleur','Baie-de-Henne','Bassin-Bleu','Bombardopolis','Chansolme','Jean-Rabel','Môle-Saint-Nicolas','Port-de-Paix','Saint-Louis-du-Nord','Terre-Neuve'],
  'Ouest': ['Anse-à-Galets','Arcahaie','Carrefour','Cité Soleil','Cornillon','Croix-des-Bouquets','Fonds-Verrettes','Ganthier','Grand-Goâve','Gressier','Kenscoff','Léogâne','Pétion-Ville','Pointe-à-Raquette','Port-au-Prince','Tabarre','Thomazeau'],
  'Sud': ['Aquin','Arniquet','Camp-Perrin','Chantal','Côteaux','Les Anglais','Les Cayes','Port-Salut','Roche-à-Bateau','Saint-Jean-du-Sud','Saint-Louis-du-Sud','Torbeck'],
  'Sud-Est': ['Anse-à-Pitre','Bainet','Belle-Anse','Cayes-Jacmel','Grand-Gosier','Jacmel','La Vallée','Marigot','Thiotte'],
};

export const HAITI_SECTIONS: Record<string, string[]> = {
  'Gonaïves':                         ['1ère section Gonaïves','2ème section Gonaïves','3ème section Gonaïves','4ème section Gonaïves'],
  'Saint-Marc':                       ['1ère section Saint-Marc','2ème section Saint-Marc','3ème section Saint-Marc'],
  "Petite-Rivière-de-l'Artibonite":  ["1ère section Petite-Rivière","2ème section Petite-Rivière"],
  'Ennery':                           ['1ère section Ennery','2ème section Ennery'],
  'Desdunes':                         ['1ère section Desdunes','2ème section Desdunes'],
  'Dessalines':                       ['1ère section Dessalines','2ème section Dessalines','3ème section Dessalines'],
  'Hinche':                           ['1ère section Hinche','2ème section Hinche','3ème section Hinche','4ème section Hinche'],
  'Mirebalais':                       ['1ère section Mirebalais','2ème section Mirebalais','3ème section Mirebalais'],
  'Thomonde':                         ['1ère section Thomonde','2ème section Thomonde'],
  'Lascahobas':                       ['1ère section Lascahobas','2ème section Lascahobas'],
  'Boucan-Carré':                     ['1ère section Boucan-Carré','2ème section Boucan-Carré'],
  'Jérémie':                          ['1ère section Jérémie','2ème section Jérémie','3ème section Jérémie'],
  "Anse-d'Hainault":                  ["1ère section Anse-d'Hainault","2ème section Anse-d'Hainault"],
  'Corail':                           ['1ère section Corail','2ème section Corail'],
  'Miragoâne':                        ['1ère section Miragoâne','2ème section Miragoâne'],
  'Baradères':                        ['1ère section Baradères','2ème section Baradères'],
  'Cap-Haïtien':                      ['1ère section Cap-Haïtien','2ème section Cap-Haïtien'],
  'Limbé':                            ['1ère section Limbé','2ème section Limbé','3ème section Limbé'],
  'Grande-Rivière-du-Nord':           ['1ère section Grande-Rivière','2ème section Grande-Rivière'],
  'Dondon':                           ['1ère section Dondon','2ème section Dondon'],
  'Plaisance':                        ['1ère section Plaisance','2ème section Plaisance'],
  'Pilate':                           ['1ère section Pilate','2ème section Pilate'],
  'Saint-Raphaël':                    ['1ère section Saint-Raphaël','2ème section Saint-Raphaël','3ème section Saint-Raphaël'],
  'Ouanaminthe':                      ['1ère section Ouanaminthe','2ème section Ouanaminthe'],
  'Capotille':                        ['1ère section Capotille','2ème section Capotille'],
  'Trou-du-Nord':                     ['1ère section Trou-du-Nord','2ème section Trou-du-Nord'],
  'Port-de-Paix':                     ['1ère section Port-de-Paix','2ème section Port-de-Paix','3ème section Port-de-Paix'],
  'Jean-Rabel':                       ['1ère section Jean-Rabel','2ème section Jean-Rabel','3ème section Jean-Rabel'],
  'Port-au-Prince':                   ['1ère section PAP','2ème section PAP','3ème section PAP'],
  'Tabarre':                          ['1ère section Tabarre','2ème section Tabarre'],
  'Croix-des-Bouquets':               ['1ère section Croix-des-Bouquets','2ème section Croix-des-Bouquets','3ème section Croix-des-Bouquets'],
  'Ganthier':                         ['1ère section Ganthier','2ème section Ganthier','3ème section Ganthier'],
  'Léogâne':                          ['1ère section Léogâne','2ème section Léogâne','3ème section Léogâne','4ème section Léogâne'],
  'Kenscoff':                         ['1ère section Kenscoff','2ème section Kenscoff','3ème section Kenscoff'],
  'Gressier':                         ['1ère section Gressier','2ème section Gressier'],
  'Grand-Goâve':                      ['1ère section Grand-Goâve','2ème section Grand-Goâve','3ème section Grand-Goâve'],
  'Les Cayes':                        ['1ère section Cayes','2ème section Cayes','3ème section Cayes'],
  'Aquin':                            ['1ère section Aquin','2ème section Aquin','3ème section Aquin'],
  'Côteaux':                          ['1ère section Côteaux','2ème section Côteaux'],
  'Torbeck':                          ['1ère section Torbeck','2ème section Torbeck'],
  'Jacmel':                           ['1ère section Jacmel','2ème section Jacmel','3ème section Jacmel'],
  'Marigot':                          ['1ère section Marigot','2ème section Marigot'],
  'Cayes-Jacmel':                     ['1ère section Cayes-Jacmel','2ème section Cayes-Jacmel'],
  'Belle-Anse':                       ['1ère section Belle-Anse','2ème section Belle-Anse','3ème section Belle-Anse'],
};

// ── OREPA territorial mapping ─────────────────────────────────────────────────
// Each of Haiti's 10 departments maps to its regional water authority (OREPA).
export const OREPA_PAR_DEPT: Record<string, string> = {
  'Artibonite': 'OREPA Artibonite',
  'Centre':     'OREPA Centre',
  "Grand'Anse": "OREPA Grand'Anse",
  'Nippes':     'OREPA Nippes',
  'Nord':       'OREPA Nord',
  'Nord-Est':   'OREPA Nord-Est',
  'Nord-Ouest': 'OREPA Nord-Ouest',
  'Ouest':      'OREPA Ouest',
  'Sud':        'OREPA Sud',
  'Sud-Est':    'OREPA Sud-Est',
};

export function orepaForDept(dept: string): string {
  return OREPA_PAR_DEPT[dept] ?? dept;
}

export const DEPT_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  'Artibonite': [[19.00, -73.30], [19.90, -72.20]],
  'Centre':     [[18.70, -72.30], [19.40, -71.50]],
  "Grand'Anse": [[18.10, -74.50], [18.90, -73.50]],
  'Nippes':     [[18.10, -73.70], [18.80, -73.00]],
  'Nord':       [[19.40, -72.90], [19.90, -72.00]],
  'Nord-Est':   [[19.40, -72.10], [19.90, -71.60]],
  'Nord-Ouest': [[19.50, -73.50], [20.10, -72.80]],
  'Ouest':      [[18.00, -73.00], [18.90, -71.90]],
  'Sud':        [[18.00, -74.40], [18.60, -73.20]],
  'Sud-Est':    [[18.00, -73.30], [18.70, -72.10]],
};

export const DEPT_CENTERS: Record<string, [number, number]> = {
  'Artibonite': [19.45, -72.69],
  'Centre':     [19.05, -71.85],
  "Grand'Anse": [18.55, -74.00],
  'Nippes':     [18.45, -73.40],
  'Nord':       [19.70, -72.35],
  'Nord-Est':   [19.65, -71.80],
  'Nord-Ouest': [19.80, -73.10],
  'Ouest':      [18.50, -72.50],
  'Sud':        [18.30, -73.70],
  'Sud-Est':    [18.30, -72.70],
};

// ── Territory filter state ────────────────────────────────────────────────────
// Signals are providedIn:'root' — the selection persists across page navigation.
// A user who filters by Léogâne in Ressources sees Léogâne pre-selected in Alertes.

@Injectable({ providedIn: 'root' })
export class HaitiGeoService {
  readonly dept    = signal('');
  readonly commune = signal('');
  readonly section = signal('');

  readonly activeCount = computed(() =>
    [this.dept(), this.commune(), this.section()].filter(Boolean).length
  );

  communesForDept(dept: string): string[] {
    if (!dept) return Object.values(HAITI_COMMUNES).flat().sort((a, b) => a.localeCompare(b));
    return (HAITI_COMMUNES[dept] ?? []).slice().sort((a, b) => a.localeCompare(b));
  }

  sectionsForScope(commune: string, dept: string): string[] {
    if (commune) return HAITI_SECTIONS[commune] ?? [];
    if (dept) {
      const communes = HAITI_COMMUNES[dept] ?? [];
      return [...new Set(communes.flatMap(c => HAITI_SECTIONS[c] ?? []))].sort((a, b) => a.localeCompare(b));
    }
    return Object.values(HAITI_SECTIONS).flat().sort((a, b) => a.localeCompare(b));
  }

  setDept(v: string): void {
    this.dept.set(v);
    this.commune.set('');
    this.section.set('');
  }

  setCommune(v: string): void {
    this.commune.set(v);
    this.section.set('');
  }

  setSection(v: string): void { this.section.set(v); }

  reset(): void {
    this.dept.set('');
    this.commune.set('');
    this.section.set('');
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { ZoneRegistreService } from './zone-registre.service';
import { ZonesBackendStore, ZoneDto } from './zones-backend.store';
import { ActeurStore } from './acteur.store';
import { TEPAC_MAP } from './tepac.data';

/**
 * SOURCE UNIQUE DE VÉRITÉ par département (cahier « cohérence » §3.1). Toutes les pages
 * (Vue d'ensemble, Territoire, Institutions, Ressources, Infrastructures) doivent lire CE store —
 * aucune page ne recopie une donnée d'une autre.
 *
 * `deploye` n'est PAS stocké : il est DÉRIVÉ (§3.3) → un département est « déployé » ssi son URD est
 * active, a un responsable désigné, et a au moins une zone active. La donnée décide du statut,
 * plus aucun flag mock → fin des 3/4/8 divergents entre pages.
 *
 * ⚠️ Les chiffres `couverture` sont des exemples COHÉRENTS entre eux (population → Ouest 20 %,
 * Nord 5,3 %, Sud-Est 10 %, national ~5 %). À remplacer par les vraies valeurs IHSI ; le calcul, lui,
 * ne changera pas.
 */
export type UrdStatut = 'active' | 'a_deployer' | 'suspendue';

export interface DeptUrd {
  nom: string; statut: UrdStatut; responsableId: string | null; responsableNom?: string;
  tepac: number; communes: number; slaPct?: number | null;
}
export interface DeptSource { code: string; nom: string; commune: string; debitM3h: number; etat: string; }
export interface DeptInfra { code: string; nom: string; type: string; commune: string; etat: string; }
export interface DeptCouverture { sectionsTotal: number; sectionsCouvertes: number; populationCible: number; populationDesservie: number; }

export interface Departement {
  code: string; nom: string; chefLieu: string;
  urd: DeptUrd;
  rivieres: string[];
  sources: DeptSource[];
  infrastructures: DeptInfra[];
  zonesActives: number;
  couverture: DeptCouverture;
}

const SEED: Departement[] = [
  {
    code: 'HT-OU', nom: 'Ouest', chefLieu: 'Port-au-Prince',
    urd: { nom: 'URD Ouest', statut: 'active', responsableId: 'usr-sandra-sewell', responsableNom: 'Sandra Sewell', tepac: 7, communes: 20, slaPct: 92 },
    rivieres: ['Rivière Grise', 'Rivière Momance'],
    sources: [
      { code: 'SRC-FERM-002', nom: 'Source Fermathe', commune: 'Pétion-Ville', debitM3h: 42, etat: 'saine' },
      { code: 'SRC-LAB-004', nom: 'Source Laboule', commune: 'Pétion-Ville', debitM3h: 87, etat: 'saine' },
      { code: 'SRC-NANB-003', nom: 'Source Nan Bwa', commune: 'Kenscoff', debitM3h: 12, etat: 'polluee' },
    ],
    infrastructures: [
      { code: 'CAP-FERM-01', nom: 'Captage Fermathe', type: 'captage', commune: 'Pétion-Ville', etat: 'operationnel' },
    ],
    zonesActives: 5,
    couverture: { sectionsTotal: 92, sectionsCouvertes: 18, populationCible: 430000, populationDesservie: 86000 },
  },
  {
    code: 'HT-ND', nom: 'Nord', chefLieu: 'Cap-Haïtien',
    urd: { nom: 'URD Nord', statut: 'active', responsableId: 'usr-maria-romain', responsableNom: 'Maria Romain', tepac: 3, communes: 19, slaPct: null },
    rivieres: ['Grande Rivière du Nord'],
    sources: [
      { code: 'SRC-PLAI-005', nom: 'Source La Plaine', commune: 'Cap-Haïtien', debitM3h: 30, etat: 'saine' },
    ],
    infrastructures: [
      { code: 'STA-CAP-01', nom: 'Station Cap-Haïtien', type: 'station', commune: 'Cap-Haïtien', etat: 'operationnel' },
    ],
    zonesActives: 1,
    couverture: { sectionsTotal: 82, sectionsCouvertes: 4, populationCible: 260000, populationDesservie: 14000 },
  },
  {
    code: 'HT-SE', nom: 'Sud-Est', chefLieu: 'Jacmel',
    urd: { nom: 'URD Sud-Est', statut: 'active', responsableId: 'usr-kelly-joseph', responsableNom: 'Kelly Joseph', tepac: 2, communes: 12, slaPct: null },
    rivieres: ['Grande Rivière de Jacmel'],
    sources: [
      { code: 'SRC-BBLEU-001', nom: 'Source Bassin Bleu', commune: 'Jacmel', debitM3h: 18, etat: 'menacee' },
    ],
    infrastructures: [
      { code: 'CAP-BBLEU-01', nom: 'Captage Bassin Bleu', type: 'captage', commune: 'Jacmel', etat: 'operationnel' },
      { code: 'PUMP-JAC-02', nom: 'Station Pompage Jacmel', type: 'station', commune: 'Jacmel', etat: 'operationnel' },
      { code: 'STA-JAC-T01', nom: 'Station Traitement Jacmel', type: 'station', commune: 'Jacmel', etat: 'operationnel' },
      { code: 'TANK-JAC-R02', nom: 'Réservoir Jacmel R02', type: 'reservoir', commune: 'Jacmel', etat: 'operationnel' },
    ],
    zonesActives: 2,
    couverture: { sectionsTotal: 49, sectionsCouvertes: 5, populationCible: 130000, populationDesservie: 13000 },
  },
  {
    code: 'HT-AR', nom: 'Artibonite', chefLieu: 'Gonaïves',
    urd: { nom: 'URD Artibonite', statut: 'a_deployer', responsableId: null, tepac: 0, communes: 15 },
    rivieres: ['Fleuve Artibonite'], sources: [], infrastructures: [], zonesActives: 0,
    couverture: { sectionsTotal: 82, sectionsCouvertes: 0, populationCible: 400000, populationDesservie: 0 },
  },
  {
    code: 'HT-CE', nom: 'Centre', chefLieu: 'Hinche',
    urd: { nom: 'URD Centre', statut: 'a_deployer', responsableId: null, tepac: 0, communes: 12 },
    rivieres: ['Rivière Guayamouc', 'Fleuve Artibonite (haut)'], sources: [], infrastructures: [], zonesActives: 0,
    couverture: { sectionsTotal: 45, sectionsCouvertes: 0, populationCible: 220000, populationDesservie: 0 },
  },
  {
    code: 'HT-SD', nom: 'Sud', chefLieu: 'Les Cayes',
    urd: { nom: 'URD Sud', statut: 'a_deployer', responsableId: null, tepac: 0, communes: 18 },
    rivieres: ['Ravine du Sud', 'Rivière de Cavaillon'], sources: [], infrastructures: [], zonesActives: 0,
    couverture: { sectionsTotal: 68, sectionsCouvertes: 0, populationCible: 320000, populationDesservie: 0 },
  },
  {
    code: 'HT-NE', nom: 'Nord-Est', chefLieu: 'Fort-Liberté',
    urd: { nom: 'URD Nord-Est', statut: 'a_deployer', responsableId: null, tepac: 0, communes: 13 },
    rivieres: ['Rivière Massacre', 'Rivière Marion'], sources: [], infrastructures: [], zonesActives: 0,
    couverture: { sectionsTotal: 40, sectionsCouvertes: 0, populationCible: 150000, populationDesservie: 0 },
  },
  {
    code: 'HT-NO', nom: 'Nord-Ouest', chefLieu: 'Port-de-Paix',
    urd: { nom: 'URD Nord-Ouest', statut: 'a_deployer', responsableId: null, tepac: 0, communes: 10 },
    rivieres: ['Trois Rivières'], sources: [], infrastructures: [], zonesActives: 0,
    couverture: { sectionsTotal: 35, sectionsCouvertes: 0, populationCible: 170000, populationDesservie: 0 },
  },
  {
    code: 'HT-NI', nom: 'Nippes', chefLieu: 'Miragoâne',
    urd: { nom: 'URD Nippes', statut: 'a_deployer', responsableId: null, tepac: 0, communes: 11 },
    rivieres: ['Rivière des Baradères'], sources: [], infrastructures: [], zonesActives: 0,
    couverture: { sectionsTotal: 38, sectionsCouvertes: 0, populationCible: 130000, populationDesservie: 0 },
  },
  {
    code: 'HT-GA', nom: "Grand'Anse", chefLieu: 'Jérémie',
    urd: { nom: "URD Grand'Anse", statut: 'a_deployer', responsableId: null, tepac: 0, communes: 12 },
    rivieres: ["Rivière Grand'Anse"], sources: [], infrastructures: [], zonesActives: 0,
    couverture: { sectionsTotal: 40, sectionsCouvertes: 0, populationCible: 160000, populationDesservie: 0 },
  },
];

@Injectable({ providedIn: 'root' })
export class DepartementsStore {
  private readonly backendZones = inject(ZonesBackendStore);   // ZONES = source unique (backend)
  private readonly communesRef  = inject(ZoneRegistreService); // uniquement pour les NOMS de communes (référence)
  private readonly acteurs      = inject(ActeurStore);

  private readonly _list = signal<Departement[]>(SEED);
  /**
   * Le seed n'est PLUS propriétaire des chiffres opérationnels — seulement de la STRUCTURE
   * territoriale : noms, codes, communes, populationCible, sections, URD/responsable. Les valeurs
   * OPÉRATIONNELLES (zones, TEPAC, desservie, statut, couverture) sont DÉRIVÉES du live ci-dessous
   * (ZoneRegistreService + ActeurStore) → dashboard, fiche URD et superviseur racontent la même histoire.
   */
  readonly list = this._list.asReadonly();

  byNom(nom: string): Departement | undefined {
    const k = norm(nom);
    return this._list().find(d => norm(d.nom) === k);
  }

  // ── Live par département : ZONES = backend (statut ACTIVE), TEPAC = ActeurStore ──────────────
  /** Zones ACTIVE du département (source backend). Réactif via le signal du store backend. */
  private zonesActivesLive(nom: string): ZoneDto[] {
    const k = norm(nom);
    return this.backendZones.zones().filter(z => norm(z.departementId) === k && z.statut === 'ACTIVE');
  }

  zonesActivesDe(d: Departement): number { return this.zonesActivesLive(d.nom).length; }
  /**
   * Pop. desservie = Σ populationCible des zones ACTIVE (live backend, même définition que la page
   * superviseur). REPLI : si aucune zone active n'est encore remontée du backend pour ce département
   * (URD active mais zones non seedées côté API), on retombe sur la valeur structurelle du seed
   * (`couverture.populationDesservie`) plutôt que d'afficher un faux 0. Le live prime dès qu'il existe ;
   * le seed n'est qu'un filet quand le live est vide. `?? 0` protège contre les valeurs nulles.
   */
  desservieDe(d: Departement): number {
    const live = this.zonesActivesLive(d.nom).reduce((s, z) => s + (z.populationCible ?? 0), 0);
    return live > 0 ? live : (d.couverture.populationDesservie ?? 0);
  }
  communesCouvertesDe(d: Departement): number {
    return new Set(this.zonesActivesLive(d.nom).map(z => norm(z.commune ?? ''))).size;
  }
  /** Communes du département dotées d'un TEPAC (acteur LIVE, sinon démo TEPAC_MAP) — noms normalisés. */
  tepacDe(d: Departement): number {
    const k = norm(d.nom);
    const live = new Set(
      this.acteurs.items()
        .filter(a => a.type === 'TEPAC' && norm(a.departementId ?? '') === k && (a.statut ?? '').toLowerCase() !== 'suspendu')
        .map(a => norm(a.commune ?? '')),
    );
    let count = 0;
    for (const c of this.communesRef.getCommunesForDept(d.nom)) {
      if (live.has(norm(c)) || TEPAC_MAP[c]) count++;
    }
    return count;
  }

  /** Statut DÉRIVÉ (jamais un flag figé) : zone + TEPAC → déployée · l'un des deux → en déploiement. */
  statutDe(d: Departement): 'deployee' | 'en-deploiement' | 'adeployer' {
    const zones = this.zonesActivesDe(d);
    const tepac = this.tepacDe(d);
    if (zones > 0 && tepac > 0) return 'deployee';
    if (zones > 0 || tepac > 0) return 'en-deploiement';
    return 'adeployer';
  }
  /** « Déployé » = au moins une activité (zone ou TEPAC) → coloré sur la carte, présent au classement. */
  deploye = (d: Departement): boolean => this.statutDe(d) !== 'adeployer';

  /** Couverture population d'un département (%) — desservie backend / cible structurelle (seed). */
  couverturePct(d: Departement): number {
    const cible = d.couverture.populationCible;
    return cible ? Math.round((this.desservieDe(d) / cible) * 1000) / 10 : 0;
  }

  readonly deployes = computed(() => this._list().filter(d => this.deploye(d)));
  readonly nbDeployes = computed(() => this.deployes().length);

  // ── Agrégats NATIONAUX (Vue d'ensemble) — desservie/zones LIVE, cible/sections STRUCTURELS ──
  readonly populationDesservie = computed(() => this._list().reduce((s, d) => s + this.desservieDe(d), 0));
  readonly populationCible = computed(() => this._list().reduce((s, d) => s + d.couverture.populationCible, 0));
  readonly couvertureNationale = computed(() => {
    const cible = this.populationCible();
    return cible ? Math.round((this.populationDesservie() / cible) * 1000) / 10 : 0;
  });
  readonly sectionsTotal = computed(() => this._list().reduce((s, d) => s + d.couverture.sectionsTotal, 0));
  readonly sectionsCouvertes = computed(() => this._list().reduce((s, d) => s + this.communesCouvertesDe(d), 0));

  // ── Agrégats PÉRIMÈTRE SUPERVISÉ (Territoire) — même desservie, dénominateur = déployés ──
  readonly populationCiblePerimetre = computed(() => this.deployes().reduce((s, d) => s + d.couverture.populationCible, 0));
  readonly couverturePerimetrePct = computed(() => {
    const c = this.populationCiblePerimetre();
    return c ? Math.round((this.populationDesservie() / c) * 100) : 0;
  });
  readonly communesTotal = computed(() => this._list().reduce((s, d) => s + d.urd.communes, 0));
  readonly zonesActivesTotal = computed(() => this.deployes().reduce((s, d) => s + this.zonesActivesDe(d), 0));

  readonly zonesCritiques = computed(() =>
    this.deployes().filter(d => this.couverturePct(d) < SEUIL_ZONE_CRITIQUE_PCT).length,
  );
}

/** Seuil « zone critique » de Territoire (<40 % de couverture) — distinct des seuils de statut couleur. */
export const SEUIL_ZONE_CRITIQUE_PCT = 40;

export function norm(nom: string): string {
  return (nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['\s-]/g, '');
}

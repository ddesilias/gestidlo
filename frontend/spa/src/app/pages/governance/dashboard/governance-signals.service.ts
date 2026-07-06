import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { RapportsStore, RapportDto } from '../../../rapports.store';
import { UserRegistryService } from '../../../user-registry.service';
import { AlerteStateService } from '../../alertes/alerte-state.service';
import { CapteurStore, Capteur } from '../../../capteur.store';
import { AuthService } from '../../../auth.service';
import { DepartementsStore, Departement, norm } from '../../../departements.store';
import { ZonesBackendStore, ZoneDto } from '../../../zones-backend.store';
import { ActeurStore } from '../../../acteur.store';
import { InterventionStore, Intervention, InterventionPriority } from '../../../intervention.store';
import {
  SLA_HEURES_INT, slaElapsedInt, estResolue, mttrHeures, slaRespectePct, InterventionResolue,
  prioriteLabel, statutLabel,
} from '../../interventions/intervention.types';
import { Statut, statutHaut, scoreSante, bandeSante } from './governance-status.util';

/**
 * ESTIMATIONS SANS SOURCE BACKEND — seule la conformité réglementaire n'a PAS encore de store réel
 * (la page /conformite est un catalogue statique). Ces valeurs sont affichées comme ESTIMATIONS
 * dans l'UI (marqueur « est. »), jamais présentées comme mesurées. À brancher sur un vrai indicateur
 * conformité le jour venu — le calcul aval ne changera pas.
 *
 * Tout le reste (SLA, MTTR, interventions en retard, santé services, activité, tendance couverture)
 * est désormais DÉRIVÉ des vrais stores plus bas → le dashboard AGRÈGE, il n'invente plus.
 */
const ESTIM = {
  conformiteScore: 92,
  conformiteCible: 95,
  conformiteTendance: 3,
  conformiteSerie30j: [
    83, 84, 84, 85, 86, 86, 87, 87, 88, 88, 88, 89, 89, 89, 90,
    90, 90, 90, 91, 91, 91, 91, 92, 92, 92, 91, 92, 92, 92, 92,
  ],
};

export interface SignalTile {
  key: string; label: string; value: string; sub: string;
  statut: Statut | 'neutre'; route: string;
}

/**
 * Carte du « Résumé exécutif » (§ wireframe) — plus riche qu'une tuile-signal : tag de gravité,
 * grande valeur, deux sous-lignes, action. `route` → RouterLink ; `scopeDept` → bouton qui pilote
 * le scope (carte « URD la plus critique »). Chaque carte est branchée sur un signal RÉEL.
 */
export interface ExecCard {
  key: string; label: string; tag?: string; tagStatut?: Statut;
  value: string; sub1: string; sub2: string;
  statut: Statut | 'neutre'; actionLabel: string;
  route?: string; scopeDept?: string;
}

/** Ligne du tableau « URD les plus en difficulté » — métriques PAR département (drill = scope). */
export interface DeptLigne {
  nom: string; score: number; statut: Statut;
  alertesCrit: number; rapportsRetard: number; intervRetard: number; popAffectee: number;
}

/** Ligne du tableau « Rapports à valider ». */
export interface RapportRow {
  titre: string; urd: string; commune: string; type: string; delaiH: number; statut: string; route: string;
}

/** Ligne du tableau « Interventions urgentes ». */
export interface InterventionRow {
  code: string; urd: string; ouvrage: string; priorite: string; priStatut: Statut;
  assignee: string; delaiH: number; statut: string; enRetard: boolean;
}

/** Santé d'un département — indice UNIQUE (carte + classement), dérivé du store partagé. */
export interface DeptSante {
  id: string; nom: string; couverture: number; alertes: number;
  actif: boolean; statut: Statut; delta: number;
}

export interface PointAttention { icon: string; couleur: string; texte: string; sub: string; }
export interface HealthService { name: string; uptime: string; statut: Statut; }
export interface ActivityEntry { id: string; icon: string; text: string; detail: string; time: string; }

// ── Section « Pilotage » (suit le scope : national OU URD sélectionnée) ─────────
export interface PilotageStat { cle: string; label: string; valeur: number; couleur: string; route: string; }
export interface PilotageBar { label: string; valeur: number; couleur: string; }
export interface PilotageCommune { commune: string; valeur: number; pct: number; }
export interface PilotageAlerte { titre: string; lieu: string; temps: string; }
export interface PilotageRapport { titre: string; lieu: string; }
export interface PilotageJournal { icon: string; texte: string; detail: string; temps: string; }
export interface PilotageVue {
  titre: string;
  national: boolean;
  synthese: {
    responsable: string; statut: string; communes: string;
    zones: number; tepac: number; infra: number; desservie: string; conformite: number;
  };
  aTraiter: PilotageStat[];
  alertes: PilotageAlerte[];
  interventions: PilotageBar[];
  rapports: PilotageRapport[];
  graphes: { alertes: PilotageBar[]; interventions: PilotageBar[]; rapports: PilotageBar[]; couverture: PilotageCommune[]; };
  journal: PilotageJournal[];
}

/** Temps relatif compact (« 20 min », « 2 h », « 3 j ») pour le journal du pilotage. */
function tempsRelatif(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

const SEV_COULEUR: Record<string, string> = {
  critique: 'var(--text-danger)', haute: 'var(--text-warning)',
  moyenne: 'var(--text-accent)', basse: 'var(--text-muted)',
};

const SEVERITE: Record<Statut, number> = { critique: 0, attention: 1, ok: 2 };
const pireStatut = (a: Statut, b: Statut): Statut => (SEVERITE[a] <= SEVERITE[b] ? a : b);

/**
 * Façade des signaux de gouvernance — « command center national ». Tout est `computed()` AGRÉGÉ
 * depuis les stores partagés (DepartementsStore en tête). L'indice de santé départemental est calculé
 * UNE fois et alimente carte + classement + synthèse ; la couverture nationale EST l'agrégat des
 * départements (même valeur que Territoire une fois Territoire branché sur le même store).
 */
@Injectable({ providedIn: 'root' })
export class GovernanceSignalsService {
  private readonly deps     = inject(DepartementsStore);
  private readonly rapports = inject(RapportsStore);
  private readonly users    = inject(UserRegistryService);
  private readonly alertes  = inject(AlerteStateService);
  private readonly capteurs = inject(CapteurStore);
  private readonly zonesStore = inject(ZonesBackendStore);
  private readonly acteurs  = inject(ActeurStore);
  private readonly interv   = inject(InterventionStore);
  private readonly auth     = inject(AuthService);

  private readonly _interventions = toSignal(this.interv.items$, { initialValue: [] as Intervention[] });

  private readonly _user = toSignal(this.auth.userStream(), { initialValue: this.auth.userSnapshot() });

  // ── Scope commutable ───────────────────────────────────────────────────────
  private readonly _scopeOverride = signal<string | null>(null);
  readonly effectiveDept = computed(() => this._scopeOverride() ?? this._user()?.dept ?? null);
  readonly scope = computed<'national' | 'urd'>(() => (this.effectiveDept() ? 'urd' : 'national'));
  readonly scopeLabel = computed(() => {
    const d = this.effectiveDept();
    return d ? `URD ${d}` : 'DINEPA · National';
  });
  readonly departements = computed(() => this.deps.list().map(d => d.nom));
  setScope(deptNom: string | null): void {
    this._scopeOverride.set(deptNom && deptNom !== 'National' ? deptNom : null);
  }

  /** Clé de scope normalisée (nom du département) ou `null` = national → filtre TOUT sauf carte/classement. */
  private readonly scopeKey = computed(() => {
    const d = this.effectiveDept();
    return d ? norm(d) : null;
  });

  // ── Lanceur « Domaines » (état partagé bouton d'en-tête ↔ tiroir du shell) ──
  readonly drawerOpen = signal(false);
  toggleDrawer(): void { this.drawerOpen.update(v => !v); }
  closeDrawer(): void { this.drawerOpen.set(false); }

  /**
   * Charge en NATIONAL (le token admin le permet). Décision d'archi (§ carte reste nationale) :
   * on ne recharge PAS les données scopées au drill-down, sinon la carte et le classement perdraient
   * les chiffres des autres départements. On charge tout Haïti UNE fois → la carte + le classement
   * lisent l'agrégat national, et la section Pilotage filtre `scopeKey` côté client. Zéro aller-retour
   * au clic : basculer d'URD est instantané.
   */
  charger(): void {
    this.rapports.charger();
    this.alertes.charger();
  }

  // ── Territoire / couverture (RÉEL, agrégé du DepartementsStore) ─────────────
  private readonly scopedDepts = computed<Departement[]>(() => {
    const d = this.effectiveDept();
    return d ? this.deps.list().filter(x => norm(x.nom) === norm(d)) : this.deps.list();
  });
  // Desservie + sections couvertes = LIVE (dérivées des zones réelles via le store), scopées.
  readonly populationDesservie = computed(() => this.scopedDepts().reduce((s, d) => s + this.deps.desservieDe(d), 0));
  private readonly populationCible = computed(() => this.scopedDepts().reduce((s, d) => s + d.couverture.populationCible, 0));
  readonly sectionsTotal = computed(() => this.scopedDepts().reduce((s, d) => s + d.couverture.sectionsTotal, 0));
  readonly sectionsCouvertes = computed(() => this.scopedDepts().reduce((s, d) => s + this.deps.communesCouvertesDe(d), 0));
  readonly couvertureNationale = computed(() => {
    const cible = this.populationCible();
    return cible ? Math.round((this.populationDesservie() / cible) * 1000) / 10 : 0;
  });
  readonly populationDesservieLabel = computed(() => {
    const v = this.populationDesservie();
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)} k`;
    return `${v}`;
  });

  // ── Alertes (RÉEL) ─────────────────────────────────────────────────────────
  private readonly alertesActivesListe = computed(() => {
    const d = this.effectiveDept();
    return this.alertes.toutesLesAlertes()
      .filter(a => this.alertes.isActive(a.status))
      .filter(a => !d || norm(a.department ?? '') === norm(d));
  });
  readonly alertesActives = computed(() => this.alertesActivesListe().length);

  // ── Rapports à valider (RÉEL, scopé côté client) ───────────────────────────
  private readonly rapportsScope = computed<RapportDto[]>(() => {
    const k = this.scopeKey();
    return this.rapports.items().filter(r => !k || norm(r.departementId ?? '') === k);
  });
  readonly nbAValider = computed(() => this.rapportsScope().filter(r => r.status === 'TRANSMIS').length);
  private readonly rapportsAValider = computed(() => this.rapportsScope().filter(r => r.status === 'TRANSMIS'));
  private ageMs(r: RapportDto): number {
    const t = r.transmisLe ?? r.createdAt;
    return t ? new Date(t).getTime() : 0;
  }
  private nbAValiderVieux = computed(() => this.rapportsAValider().filter(r => {
    const ms = this.ageMs(r); return ms && (Date.now() - ms) / 3_600_000 > 48;
  }).length);

  // ── Indice de santé par département (UNIQUE — carte + classement + synthèse) ─
  readonly deptSante = computed<DeptSante[]>(() => {
    const alertes = this.alertes.toutesLesAlertes().filter(a => this.alertes.isActive(a.status));
    return this.deps.list().map(d => {
      const pct = this.deps.couverturePct(d);
      const actif = this.deps.deploye(d);
      const deptAlertes = alertes.filter(a => norm(a.department ?? '') === norm(d.nom));
      const critAlerte = deptAlertes.some(a => a.severity === 'critique');
      const covStatut: Statut = statutHaut(pct, 15, 7);           // Nord 5,3→crit · Sud-Est 10→att · Ouest 20→ok
      const alerteStatut: Statut = critAlerte ? 'critique' : deptAlertes.length ? 'attention' : 'ok';
      const statut = actif ? pireStatut(covStatut, alerteStatut) : 'critique';
      // delta = tendance couverture : 0 (« — » à l'affichage) tant qu'il n'y a pas d'historique réel.
      return { id: d.code, nom: d.nom, couverture: pct, alertes: deptAlertes.length, actif, statut, delta: 0 };
    });
  });

  /** Classement pire-en-premier — uniquement les départements DÉPLOYÉS (deploye() dérivé). */
  readonly classement = computed<DeptSante[]>(() =>
    this.deptSante().filter(d => d.actif).sort((a, b) => a.couverture - b.couverture),
  );
  readonly nbNonDeployes = computed(() => this.deptSante().filter(d => !d.actif).length);
  private readonly nbSousSurveillance = computed(() => this.deptSante().filter(d => d.actif && d.statut !== 'ok').length);

  // ── Ligne de synthèse dynamique ────────────────────────────────────────────
  readonly synthese = computed(() => {
    const surv = this.nbSousSurveillance();
    return {
      conformite: `${ESTIM.conformiteScore}% conforme (est.)`,
      surveillance: `${surv} département${surv > 1 ? 's' : ''} sous surveillance`,
      tendance: `conformité ${ESTIM.conformiteTendance >= 0 ? 'en hausse' : 'en baisse'}`,
      tendanceUp: ESTIM.conformiteTendance >= 0,
    };
  });

  // ── Zone A : 6 tuiles-signal ───────────────────────────────────────────────
  /**
   * Rangée « structurelle » — uniquement les 3 KPI absents du Résumé exécutif (Couverture, Conformité,
   * Pop. desservie). Alertes / SLA / À valider ont été RETIRÉS d'ici : ils vivent dans le Résumé exécutif
   * (Alertes critiques, Interventions/SLA, Rapports) → fin du doublon.
   */
  readonly tiles = computed<SignalTile[]>(() => {
    const cov = this.couvertureNationale();
    return [
      { key: 'couverture', label: 'Couverture', value: `${cov}%`,
        sub: `${this.sectionsCouvertes()}/${this.sectionsTotal()} sections`, statut: statutHaut(cov, 25, 10), route: '/admin/governance/territoire' },
      { key: 'conformite', label: 'Conformité', value: `${ESTIM.conformiteScore}%`,
        sub: `cible ${ESTIM.conformiteCible} · est.`, statut: statutHaut(ESTIM.conformiteScore, 90, 75), route: '/admin/governance/conformite' },
      { key: 'population', label: 'Pop. desservie', value: this.populationDesservieLabel(),
        sub: 'habitants', statut: 'neutre', route: '/admin/governance/territoire' },
    ];
  });

  /**
   * Santé réseau (0–100) — composite OPÉRATIONNEL, moyenne pondérée de sous-scores RÉELS, scopée.
   * Poids validés : 35 % alertes · 30 % interventions · 20 % rapports · 15 % capteurs (couverture
   * volontairement exclue : structurelle, pas un indicateur de santé). Zéro valeur inventée.
   */
  readonly santeReseau = computed<number>(() => {
    const caps = this.capteursScope();
    return scoreSante({
      alertesCritiques: this.alertesCritiquesScope().length,
      slaRespectePct: this.slaRespectePct(),
      interventionsEnRetard: this.interventionsEnRetardCount(),
      rapportsEnRetard: this.nbAValiderVieux(),
      capteursTotal: caps.length,
      capteursEnLigne: caps.filter(c => c.statut !== 'hors-ligne').length,
    });
  });

  // ── Résumé exécutif (§ wireframe) — cartes riches, chacune sur un signal RÉEL ──────────────────
  readonly resumeExecutif = computed<ExecCard[]>(() => {
    const sante = this.santeReseau();
    const santeStatut = statutHaut(sante, 90, 75);
    const santeBande = bandeSante(sante);

    const nbCrit = this.alertesCritiquesScope().length;
    const nonAss = this.alertesCritNonAssignees();
    const critVieilles = this.alertesCritVieilles();
    const aValider = this.nbAValider();
    const rapVieux = this.nbAValiderVieux();
    const retard = this.interventionsEnRetardCount();
    const mttr = this.mttrHeures();
    const sla = this.slaRespectePct();
    const pop = this.popAffectee();
    const nbComm = this.nbCommunesAffectees();
    const pire = this.classement()[0];

    return [
      { key: 'sante', label: 'Santé réseau', tag: santeBande, tagStatut: santeStatut,
        value: `${sante}%`, sub1: 'composite opérationnel', sub2: 'alertes · interv · rapports · capteurs',
        statut: santeStatut, actionLabel: 'Voir le détail', route: '/admin/governance/territoire' },

      { key: 'alertes-crit', label: 'Alertes critiques', tag: nbCrit ? 'Critique' : undefined, tagStatut: 'critique',
        value: `${nbCrit}`,
        sub1: nonAss ? `${nonAss} non assignée${nonAss > 1 ? 's' : ''}` : 'toutes prises en charge',
        sub2: critVieilles ? `${critVieilles} > 48 h` : '',
        statut: nbCrit ? 'critique' : 'ok', actionLabel: 'Voir les alertes', route: '/admin/alertes' },

      { key: 'rapports', label: 'Rapports à valider',
        value: `${aValider}`,
        sub1: rapVieux ? `${rapVieux} > 48 h` : 'aucun en retard',
        sub2: 'file de validation',
        statut: rapVieux ? 'attention' : aValider ? 'neutre' : 'ok', actionLabel: 'Valider les rapports', route: '/admin/rapports' },

      { key: 'interventions', label: 'Interventions en retard',
        value: `${retard}`,
        sub1: mttr !== null ? `MTTR ${mttr} h` : 'MTTR n/d',
        sub2: sla !== null ? `SLA respecté ${sla}%` : 'aucune résolue',
        statut: retard ? 'attention' : 'ok', actionLabel: 'Voir interventions', route: '/admin/interventions' },

      { key: 'pop-affectee', label: 'Pop. potentiellement affectée',
        value: pop ? pop.toLocaleString('fr-FR') : '0',
        sub1: nbComm ? `${nbComm} commune${nbComm > 1 ? 's' : ''} concernée${nbComm > 1 ? 's' : ''}` : 'aucune',
        sub2: 'alerte critique active',
        statut: pop ? 'attention' : 'ok', actionLabel: 'Voir la carte', route: '/admin/alertes' },

      { key: 'urd-critique', label: 'URD la plus critique',
        value: pire ? pire.nom : '—',
        sub1: pire ? `couverture ${pire.couverture}%` : 'aucune déployée',
        sub2: pire ? `${pire.alertes} alerte${pire.alertes > 1 ? 's' : ''} active${pire.alertes > 1 ? 's' : ''}` : '',
        statut: pire ? pire.statut : 'neutre', actionLabel: "Analyser l'URD", scopeDept: pire?.nom },
    ];
  });

  // ════════ TABLES ENRICHIES (§ wireframe) — toutes dérivées du réel ════════

  /** Âge d'un rapport (h) depuis sa transmission (repli createdAt). */
  private rapportAgeH(r: RapportDto): number {
    const t = r.transmisLe ?? r.createdAt;
    return t ? (Date.now() - new Date(t).getTime()) / 3_600_000 : 0;
  }
  /** Nom propre d'un département depuis sa clé normalisée (pour l'affichage des tables). */
  private deptNomFromKey(k: string | undefined | null): string {
    if (!k) return '—';
    return this.deps.list().find(x => norm(x.nom) === k)?.nom ?? '—';
  }

  /**
   * « URD les plus en difficulté » — une ligne PAR département déployé, métriques dérivées par dept
   * (mêmes définitions que les compteurs scopés), score = même composite `scoreSante`. Pire en premier.
   * NATIONAL par nature (comme la carte + le classement) : ce tableau ne suit pas le scope.
   */
  readonly classementEnrichi = computed<DeptLigne[]>(() => {
    const alertesActives = this.alertes.toutesLesAlertes().filter(a => this.alertes.isActive(a.status));
    const interventions = this._interventions();
    const cd = this.communeDept();
    const rapports = this.rapports.items();
    const zones = this.zonesStore.zones();
    const capteurs = this.capteurs.all();

    return this.deps.deployes().map(d => {
      const k = norm(d.nom);
      const alCrit = alertesActives.filter(a => norm(a.department ?? '') === k && a.severity === 'critique');
      const rapRetard = rapports.filter(r => r.status === 'TRANSMIS' && norm(r.departementId ?? '') === k && this.rapportAgeH(r) > 48).length;

      const inDept = (i: Intervention) => (i.department ? norm(i.department) : cd.get(norm(i.commune ?? ''))) === k;
      const intActives = interventions.filter(i => !['cloturee', 'annulee', 'rejetee'].includes(i.status) && inDept(i));
      const intRetard = intActives.filter(i => !['terminee', 'validee'].includes(i.status) && slaElapsedInt(i.createdAt) > SLA_HEURES_INT[i.priority]).length;
      const resolvedDept = interventions.filter(i => inDept(i) && estResolue(i)).map(i => ({ createdAt: i.createdAt, closedAt: i.closedAt!, priority: i.priority }));

      const communesCrit = new Set(alCrit.map(a => norm(a.commune ?? '')).filter(Boolean));
      const popAff = zones
        .filter(z => norm(z.departementId ?? '') === k && z.statut === 'ACTIVE' && communesCrit.has(norm(z.commune ?? '')))
        .reduce((s, z) => s + (z.populationCible ?? 0), 0);

      const capsDept = capteurs.filter(c => norm(c.department ?? '') === k);
      const score = scoreSante({
        alertesCritiques: alCrit.length, slaRespectePct: slaRespectePct(resolvedDept),
        interventionsEnRetard: intRetard, rapportsEnRetard: rapRetard,
        capteursTotal: capsDept.length, capteursEnLigne: capsDept.filter(c => c.statut !== 'hors-ligne').length,
      });
      return { nom: d.nom, score, statut: statutHaut(score, 90, 75), alertesCrit: alCrit.length, rapportsRetard: rapRetard, intervRetard: intRetard, popAffectee: popAff };
    }).sort((a, b) => a.score - b.score);
  });

  /** « Rapports à valider » (scopé) — 6 max, délai réel, statut dérivé du délai. */
  readonly rapportsAValiderTable = computed<RapportRow[]>(() =>
    this.rapportsAValider().slice(0, 6).map(r => {
      const age = Math.round(this.rapportAgeH(r));
      return {
        titre: r.titre, urd: r.national ? 'National' : this.deptNomFromKey(r.departementId),
        commune: r.commune ?? '—', type: r.type, delaiH: age,
        statut: age > 48 ? 'En retard' : 'À valider', route: '/admin/rapports',
      };
    }),
  );

  /** « Interventions urgentes » (scopé) — en retard OU priorité haute/critique ; retard en premier. */
  readonly interventionsUrgentesTable = computed<InterventionRow[]>(() => {
    const priStatut = (p: InterventionPriority): Statut => (p === 'critique' ? 'critique' : p === 'haute' ? 'attention' : 'ok');
    const cd = this.communeDept();
    const enRetardDe = (i: Intervention) => !['terminee', 'validee'].includes(i.status) && slaElapsedInt(i.createdAt) > SLA_HEURES_INT[i.priority];
    const poids = (i: Intervention) => (enRetardDe(i) ? 0 : i.priority === 'critique' ? 1 : i.priority === 'haute' ? 2 : 3);

    return this.interventionsScope()
      .filter(i => enRetardDe(i) || i.priority === 'critique' || i.priority === 'haute')
      .sort((a, b) => poids(a) - poids(b) || slaElapsedInt(b.createdAt) - slaElapsedInt(a.createdAt))
      .slice(0, 6)
      .map(i => ({
        code: i.code, urd: this.deptNomFromKey(i.department ? norm(i.department) : cd.get(norm(i.commune ?? ''))),
        ouvrage: i.infrastructureName || i.commune || '—', priorite: prioriteLabel(i.priority), priStatut: priStatut(i.priority),
        assignee: i.technicianName || 'Non assignée', delaiH: Math.round(slaElapsedInt(i.createdAt)),
        statut: statutLabel(i.status), enRetard: enRetardDe(i),
      }));
  });

  // ── Zone C : tendance + points d'attention (3 max, dérivés) ────────────────
  readonly conformiteScore = computed(() => ESTIM.conformiteScore);
  readonly conformiteCible = ESTIM.conformiteCible;
  readonly serie30jPoints = computed(() => ESTIM.conformiteSerie30j.map((value, i) => ({ timestamp: `J-${29 - i}`, value })));

  readonly pointsAttention = computed<PointAttention[]>(() => {
    const pts: PointAttention[] = [];
    const pire = this.classement()[0];
    if (pire && pire.statut !== 'ok') {
      pts.push({ icon: 'ti-map-pin-exclamation', couleur: 'var(--text-danger)', texte: `${pire.nom} — couverture critique`, sub: `${pire.couverture}%` });
    }
    const alerteSup = this.alertesActivesListe().find(a => a.source === 'supervision') ?? this.alertesActivesListe()[0];
    if (alerteSup) {
      pts.push({ icon: 'ti-alert-triangle', couleur: 'var(--text-warning)', texte: alerteSup.title, sub: alerteSup.commune || alerteSup.department || '' });
    }
    if (this.nbAValider() > 0) {
      const vieux = this.nbAValiderVieux();
      pts.push({ icon: 'ti-file-alert', couleur: 'var(--text-accent)', texte: `${this.nbAValider()} rapports en attente`, sub: vieux ? `dont ${vieux} > 48 h` : '' });
    }
    return pts.slice(0, 3);
  });

  // ── Rail bas : santé système + activité ────────────────────────────────────
  /**
   * Santé services : la parc IoT est RÉEL (ratio en-ligne / total). Les briques socle (DB, API, Auth,
   * Sync) ne sont pas encore instrumentées par un vrai monitoring — on affiche « opérationnel »
   * (inférence honnête : la session parle à ces services en direct), sans fabriquer d'uptime précis.
   */
  readonly santeServices = computed<HealthService[]>(() => {
    const enLigne = this.capteurs.enLigne().length;
    const total = this.capteurs.all().length;
    const pct = total ? Math.round((enLigne / total) * 100) : 100;
    return [
      { name: 'Base de données', uptime: 'opérationnel', statut: 'ok' },
      { name: 'API Gouvernance', uptime: 'opérationnel', statut: 'ok' },
      { name: 'Auth / SSO',      uptime: 'opérationnel', statut: 'ok' },
      { name: 'Sync DINEPA',     uptime: 'opérationnel', statut: 'ok' },
      { name: 'Capteurs IoT',    uptime: total ? `${enLigne}/${total}` : '—', statut: statutHaut(pct, 90, 70) },
    ];
  });
  readonly santePct = computed(() => {
    const s = this.santeServices();
    return Math.round((s.filter(x => x.statut === 'ok').length / s.length) * 100);
  });

  /**
   * Activité récente RÉELLE, dérivée des événements datés du scope : alertes actives + interventions
   * (créées / terminées). Fusionnées, triées par récence, 5 max. Plus de journal fabriqué.
   */
  readonly activite = computed<ActivityEntry[]>(() => {
    const evts: Array<ActivityEntry & { ts: number }> = [];
    for (const a of this.alertesActivesListe()) {
      evts.push({
        id: `al-${a.id}`, icon: 'ti-alert-triangle', text: 'Alerte active',
        detail: `${a.title} — ${a.commune || a.department || '—'}`,
        time: tempsRelatif(a.createdAt), ts: new Date(a.createdAt).getTime(),
      });
    }
    for (const i of this.interventionsScopeAll()) {
      const done = !!i.closedAt && ['terminee', 'validee', 'cloturee'].includes(i.status);
      const iso = done ? i.closedAt! : i.createdAt;
      evts.push({
        id: `int-${i.id}`, icon: done ? 'ti-checkbox' : 'ti-tool',
        text: done ? 'Intervention terminée' : 'Intervention créée',
        detail: `${i.code} — ${i.commune || '—'}`,
        time: tempsRelatif(iso), ts: new Date(iso).getTime(),
      });
    }
    return evts.sort((a, b) => b.ts - a.ts).slice(0, 5).map(({ ts, ...e }) => e);
  });

  // ════════ SECTION PILOTAGE — tout suit `scopeKey` (carte + classement, eux, l'ignorent) ════════

  /** Table commune→département (normalisées), dérivée des zones réelles — pour scoper les interventions
   *  (le ticket ne porte pas de département, seulement une commune). */
  private readonly communeDept = computed<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const z of this.zonesStore.zones()) {
      if (z.commune) m.set(norm(z.commune), norm(z.departementId ?? ''));
    }
    return m;
  });

  /** Un ticket est dans le scope si son département (direct ou dérivé de sa commune) = scopeKey.
   *  National (k=null) → tout ; commune inconnue en vue URD → exclu. */
  private inScope(i: Intervention, k: string | null, cd: Map<string, string>): boolean {
    if (!k) return true;
    const dep = i.department ? norm(i.department) : cd.get(norm(i.commune ?? ''));
    return dep === k;
  }

  private readonly interventionsScope = computed<Intervention[]>(() => {
    const k = this.scopeKey();
    const cd = this.communeDept();
    return this._interventions()
      .filter(i => !['cloturee', 'annulee', 'rejetee'].includes(i.status) && this.inScope(i, k, cd));
  });

  /** TOUTES les interventions du scope (incl. terminées/clôturées) — base des métriques rétrospectives. */
  private readonly interventionsScopeAll = computed<Intervention[]>(() => {
    const k = this.scopeKey();
    const cd = this.communeDept();
    return this._interventions().filter(i => this.inScope(i, k, cd));
  });

  private readonly zonesActivesScope = computed<ZoneDto[]>(() => {
    const k = this.scopeKey();
    return this.zonesStore.zones().filter(z => z.statut === 'ACTIVE' && (!k || norm(z.departementId ?? '') === k));
  });

  private readonly tepacCommunes = computed<Set<string>>(() => {
    const k = this.scopeKey();
    return new Set(
      this.acteurs.items()
        .filter(a => a.type === 'TEPAC' && (a.statut ?? '').toLowerCase() !== 'suspendu' && (!k || norm(a.departementId ?? '') === k))
        .map(a => norm(a.commune ?? '')),
    );
  });

  private readonly capteursScope = computed<Capteur[]>(() => {
    const k = this.scopeKey();
    return this.capteurs.all().filter(c => !k || norm(c.department ?? '') === k);
  });

  // ── Compteurs d'action (« À traiter maintenant ») ──────────────────────────
  private readonly alertesCritiquesScope = computed(() =>
    this.alertesActivesListe().filter(a => a.severity === 'critique'),
  );
  /** Alertes critiques sans prise en charge (statut ouvert ou aucune affectation). */
  private readonly alertesCritNonAssignees = computed(() =>
    this.alertesCritiquesScope().filter(a => a.status === 'ouverte' || !a.assignment).length,
  );
  /** Alertes critiques ouvertes depuis plus de 48 h. */
  private readonly alertesCritVieilles = computed(() =>
    this.alertesCritiquesScope().filter(a => (Date.now() - new Date(a.createdAt).getTime()) / 3_600_000 > 48).length,
  );
  /** Communes (normalisées) touchées par ≥1 alerte critique active, dans le scope. */
  private readonly communesAlerteCritique = computed<Set<string>>(() =>
    new Set(this.alertesCritiquesScope().map(a => norm(a.commune ?? '')).filter(Boolean)),
  );
  /** Population potentiellement affectée = Σ populationCible des zones ACTIVE des communes en alerte critique. */
  readonly popAffectee = computed(() => {
    const communes = this.communesAlerteCritique();
    return this.zonesActivesScope()
      .filter(z => communes.has(norm(z.commune ?? '')))
      .reduce((s, z) => s + (z.populationCible ?? 0), 0);
  });
  readonly nbCommunesAffectees = computed(() => this.communesAlerteCritique().size);
  private readonly interventionsNonAssignees = computed(() =>
    this.interventionsScope().filter(i => ['creee', 'envoyee'].includes(i.status) || !i.technicianId),
  );
  private readonly interventionsEnRetard = computed(() =>
    this.interventionsScope().filter(i => {
      if (['terminee', 'validee'].includes(i.status)) return false;
      return slaElapsedInt(i.createdAt) > SLA_HEURES_INT[i.priority];
    }),
  );
  readonly interventionsEnRetardCount = computed(() => this.interventionsEnRetard().length);

  // ── Métriques rétrospectives (RÉEL) — dérivées des interventions RÉSOLUES du scope ─────────────
  /** Résolues (terminée/validée/clôturée + dates), typées pour les helpers purs MTTR/SLA. */
  private readonly interventionsResolues = computed<InterventionResolue[]>(() =>
    this.interventionsScopeAll()
      .filter(estResolue)
      .map(i => ({ createdAt: i.createdAt, closedAt: i.closedAt!, priority: i.priority })),
  );
  /** MTTR moyen (h) sur le scope. `null` si aucune intervention résolue. */
  readonly mttrHeures = computed<number | null>(() => mttrHeures(this.interventionsResolues()));
  /** Taux SLA respecté (%) sur le scope. `null` si aucune intervention résolue. */
  readonly slaRespectePct = computed<number | null>(() => slaRespectePct(this.interventionsResolues()));
  private readonly zonesSansTepac = computed(() => {
    const tepac = this.tepacCommunes();
    return this.zonesActivesScope().filter(z => !tepac.has(norm(z.commune ?? '')));
  });
  private readonly capteursHorsLigne = computed(() => this.capteursScope().filter(c => c.statut === 'hors-ligne'));

  /** Vue Pilotage complète — un seul objet dérivé, consommé tel quel par le composant. */
  readonly pilotage = computed<PilotageVue>(() => {
    const national = this.scope() === 'national';
    const depts = this.scopedDepts();
    const dept = this.effectiveDept();

    // ── Synthèse
    const communesCouvertes = this.sectionsCouvertes();
    const communesTotal = depts.reduce((s, d) => s + d.urd.communes, 0);
    const zones = depts.reduce((s, d) => s + this.deps.zonesActivesDe(d), 0);
    const tepac = depts.reduce((s, d) => s + this.deps.tepacDe(d), 0);
    const infra = depts.reduce((s, d) => s + d.infrastructures.length, 0);
    const responsable = !national && depts.length === 1 ? (depts[0].urd.responsableNom ?? '—') : '—';
    const statutMap: Record<string, string> = { deployee: 'déployée', 'en-deploiement': 'en déploiement', adeployer: 'à déployer' };
    const statut = national ? 'réseau national' : depts.length === 1 ? statutMap[this.deps.statutDe(depts[0])] : '—';

    // ── Interventions par statut (colonne + graphe)
    const intBuckets: PilotageBar[] = [
      { label: 'Non assignées', valeur: this.interventionsNonAssignees().length, couleur: 'var(--text-danger)' },
      { label: 'En cours',      valeur: this.interventionsScope().filter(i => ['assignee', 'acceptee', 'en-cours'].includes(i.status)).length, couleur: 'var(--text-accent)' },
      { label: 'En retard',     valeur: this.interventionsEnRetard().length, couleur: 'var(--text-warning)' },
      { label: 'Terminées',     valeur: this.interventionsScope().filter(i => ['terminee', 'validee'].includes(i.status)).length, couleur: 'var(--text-success)' },
    ];

    // ── Alertes par sévérité (graphe)
    const parSeverite = (sev: string) => this.alertesActivesListe().filter(a => a.severity === sev).length;
    const grAlertes: PilotageBar[] = ['critique', 'haute', 'moyenne', 'basse']
      .map(s => ({ label: s, valeur: parSeverite(s), couleur: SEV_COULEUR[s] }));

    // ── Rapports par état (graphe)
    const parEtat = (st: string) => this.rapportsScope().filter(r => r.status === st).length;
    const grRapports: PilotageBar[] = [
      { label: 'Brouillon', valeur: parEtat('BROUILLON'),      couleur: 'var(--text-muted)' },
      { label: 'À valider', valeur: parEtat('TRANSMIS'),       couleur: 'var(--text-accent)' },
      { label: 'Validés',   valeur: parEtat('VALIDE'),         couleur: 'var(--text-success)' },
      { label: 'Transmis',  valeur: parEtat('TRANSMIS_ADMIN'), couleur: 'var(--text-accent)' },
    ];

    // ── Population desservie par commune (graphe) — Σ populationCible des zones ACTIVE, par commune
    const parCommune = new Map<string, number>();
    for (const z of this.zonesActivesScope()) {
      const c = z.commune || '—';
      parCommune.set(c, (parCommune.get(c) ?? 0) + (z.populationCible ?? 0));
    }
    const maxCommune = Math.max(1, ...parCommune.values());
    const couverture: PilotageCommune[] = [...parCommune.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([commune, valeur]) => ({ commune, valeur, pct: Math.round((valeur / maxCommune) * 100) }));

    // ── Journal (activité récente) — dérivé des alertes récentes en scope
    const journal: PilotageJournal[] = [...this.alertesActivesListe()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4)
      .map(a => ({ icon: 'ti-alert-triangle', texte: a.title, detail: a.commune || a.department || '', temps: tempsRelatif(a.createdAt) }));

    return {
      titre: national ? 'Pilotage · national' : `Pilotage · URD ${dept}`,
      national,
      synthese: {
        responsable, statut,
        communes: `${communesCouvertes}/${communesTotal}`,
        zones, tepac, infra,
        desservie: this.populationDesservieLabel(),
        conformite: ESTIM.conformiteScore,
      },
      aTraiter: [
        { cle: 'alertes',       label: 'Alertes critiques',      valeur: this.alertesCritiquesScope().length,     couleur: 'var(--text-danger)',  route: '/admin/alertes' },
        { cle: 'interventions', label: 'Interv. non assignées',  valeur: this.interventionsNonAssignees().length, couleur: 'var(--text-warning)', route: '/admin/interventions' },
        { cle: 'rapports',      label: 'Rapports à valider',     valeur: this.nbAValider(),                        couleur: 'var(--text-accent)',  route: '/admin/rapports' },
        { cle: 'zones',         label: 'Zones sans TEPAC',       valeur: this.zonesSansTepac().length,             couleur: 'var(--text-secondary)', route: '/admin/governance/territoire' },
        { cle: 'capteurs',      label: 'Capteurs hors ligne',    valeur: this.capteursHorsLigne().length,          couleur: 'var(--text-secondary)', route: '/admin/capteurs' },
      ],
      alertes: this.alertesCritiquesScope().slice(0, 4)
        .map(a => ({ titre: a.title, lieu: a.commune || a.department || '', temps: tempsRelatif(a.createdAt) })),
      interventions: intBuckets,
      rapports: this.rapportsAValider().slice(0, 4).map(r => ({ titre: r.titre, lieu: r.commune || '' })),
      graphes: { alertes: grAlertes, interventions: intBuckets, rapports: grRapports, couverture },
      journal,
    };
  });

  // ── Badges du strip / launcher (compteur d'attention, jamais la mesure) ─────
  readonly rolesCount   = computed(() => new Set(this.users.list().map(u => u.role)).size);
  // Pas de store réel derrière les règles SLA ni la conformité → aucun badge fabriqué (0 = masqué).
  readonly badgeRegles     = computed(() => 0);
  readonly badgeConformite = computed(() => 0);
}

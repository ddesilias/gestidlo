import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { AlertSeverity, AlertSource, AlertStatus, AlertStore, GestAlert } from '../../alert.store';
import {
  FiltresAlerte, FILTRES_VIDES_ALERTE, NEXT_STATUSES_ALERTE,
  severityDot, severityBg, statusDot, statusBg, sourceDot,
  severityLabel, statusLabel, sourceLabel, dateLabel, timeLabel, isActive,
  SUGGESTION_PAR_SEVERITE, slaElapsed, SLA_HEURES,
} from './alerte.types';

import { VueConsole, TimelineHour, KANBAN_COLONNES_ALERTES } from '../console/console.types';
import { InterventionStateService, DonneesPreremplies } from '../interventions/intervention-state.service';
import { BffApiService } from '../../api/bff-api.service';
import { NotificationService } from '../../notification.service';

export interface NouvelleAlerteData {
  titre:       string;
  description: string;
  severite:    AlertSeverity;
  source:      AlertSource;
  departement: string;
  commune:     string;
  infraId?:    string;
  infraName?:  string;
}

@Injectable({ providedIn: 'root' })
export class AlerteStateService {

  private readonly store        = inject(AlertStore);
  private readonly interventions = inject(InterventionStateService);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly bff          = inject(BffApiService);
  private readonly notif        = inject(NotificationService);

  // ── UI state ──────────────────────────────────────────────────────────────
  private readonly _filtres             = signal<FiltresAlerte>({ ...FILTRES_VIDES_ALERTE });
  private readonly _selection           = signal<GestAlert | null>(null);
  private readonly _vue                 = signal<VueConsole>('tableau');
  private readonly _lastRefresh         = signal<Date>(new Date());
  private readonly _filtresDrawerOuvert = signal(false);
  private readonly _modalCreerOuvert    = signal(false);

  readonly filtres             = this._filtres.asReadonly();
  readonly selection           = this._selection.asReadonly();
  readonly vue                 = this._vue.asReadonly();
  readonly lastRefresh         = this._lastRefresh.asReadonly();
  readonly filtresDrawerOuvert = this._filtresDrawerOuvert.asReadonly();
  readonly modalCreerOuvert    = this._modalCreerOuvert.asReadonly();

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly toutesLesAlertes = toSignal(this.store.items$, { initialValue: [] as GestAlert[] });

  readonly alertesFiltrees = computed(() => filtrer(this.toutesLesAlertes(), this._filtres()));

  readonly nombreFiltresActifs = computed(() => {
    const f = this._filtres();
    return [
      f.recherche !== '',
      f.severites.length > 0,
      f.statuts.length > 0,
      f.sources.length > 0,
      f.departements.length > 0,
      f.sansIntervention,
      f.dernieres24h,
      f.slaDepasse,
    ].filter(Boolean).length;
  });

  readonly kpis = computed(() => {
    const items = this.toutesLesAlertes();
    return {
      actives:    items.filter(a => isActive(a.status)).length,
      critiques:  items.filter(a => a.severity === 'critique' && isActive(a.status)).length,
      enCours:    items.filter(a => a.status === 'en-cours').length,
      sansAction: items.filter(a => isActive(a.status) && !a.interventionId).length,
      resolues:   items.filter(a => a.status === 'resolue').length,
      total:      items.length,
    };
  });

  readonly kpiTendances = computed(() => ({
    actives: +2, critiques: 0, enCours: -1, sansAction: +1, resolues: +3,
  }));

  // ── Compteurs de triage — TOUS dérivés de la même liste (jamais stockés à part).
  // Quand une alerte passe « ouverte → en-cours », nbATraiter décrémente et nbEnCours
  // incrémente tout seuls : le badge sidebar et les pastilles ne peuvent pas se désync.
  readonly nbATraiter = computed(() => this.toutesLesAlertes().filter(a => a.status === 'ouverte').length);
  readonly nbEnCours  = computed(() => this.toutesLesAlertes().filter(a => a.status === 'assignee' || a.status === 'en-cours').length);
  readonly nbTraitees = computed(() => this.toutesLesAlertes().filter(a => a.status === 'resolue' || a.status === 'archivee' || a.status === 'ignoree').length);
  readonly nbUrgentes = computed(() => this.toutesLesAlertes().filter(a => a.severity === 'critique' && isActive(a.status)).length);

  readonly activesFilterActif = computed(() => {
    const s = this._filtres().statuts;
    return (['ouverte', 'assignee', 'en-cours'] as AlertStatus[]).some(x => s.includes(x));
  });

  readonly departementsDisponibles = computed(() => {
    const seen = new Set<string>();
    for (const a of this.toutesLesAlertes()) if (a.department) seen.add(a.department);
    return Array.from(seen).sort();
  });

  readonly alertesCritiquesActives = computed(() =>
    this.toutesLesAlertes().filter(a => a.severity === 'critique' && isActive(a.status))
  );

  // ── Timeline 24h ──────────────────────────────────────────────────────────
  readonly timeline = computed((): TimelineHour[] => {
    const now = new Date();
    const hours: TimelineHour[] = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getTime() - (23 - i) * 3_600_000);
      return { hour: d.getHours(), label: `${d.getHours()}h`, critique: 0, haute: 0, moyenne: 0, basse: 0, total: 0 };
    });
    for (const a of this.toutesLesAlertes()) {
      const diffH = Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / 3_600_000);
      if (diffH >= 0 && diffH < 24) {
        const idx = 23 - diffH;
        hours[idx][a.severity]++;
        hours[idx].total++;
      }
    }
    return hours;
  });

  // ── Kanban ────────────────────────────────────────────────────────────────
  readonly kolonnes = KANBAN_COLONNES_ALERTES;

  cartesParColonne(statusId: AlertStatus): GestAlert[] {
    return this.alertesFiltrees().filter(a => a.status === statusId)
      .sort((a, b) => {
        const prio: Record<AlertSeverity, number> = { critique: 0, haute: 1, moyenne: 2, basse: 3 };
        return prio[a.severity] - prio[b.severity];
      });
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  severityDot   = severityDot;
  severityBg    = severityBg;
  statusDot     = statusDot;
  statusBg      = statusBg;
  sourceDot     = sourceDot;
  severityLabel = severityLabel;
  statusLabel   = statusLabel;
  sourceLabel   = sourceLabel;
  dateLabel     = dateLabel;
  timeLabel     = timeLabel;
  isActive      = isActive;

  nextStatuses(s: AlertStatus): AlertStatus[] {
    return NEXT_STATUSES_ALERTE[s] ?? [];
  }

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  constructor() {
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this._lastRefresh.set(new Date());
    });
  }

  refresh(): void { this._lastRefresh.set(new Date()); }

  /** Charge les alertes scopées au département depuis le backend (garde-fou serveur). */
  charger(departementId?: string): void { this.store.charger(departementId); }

  /** Traiter une alerte = assigner + créer l'intervention (persiste, puis bascule). */
  traiter(alerte: GestAlert, technicien: { id: string; nom: string }): void {
    this.store.traiter(alerte, technicien);
  }

  // ── View ──────────────────────────────────────────────────────────────────
  setVue(v: VueConsole): void { this._vue.set(v); }

  // ── Filters ───────────────────────────────────────────────────────────────
  modifierRecherche(q: string): void { this._filtres.update(f => ({ ...f, recherche: q })); }

  toggleSeverite(s: AlertSeverity): void {
    this._filtres.update(f => ({
      ...f, severites: f.severites.includes(s) ? f.severites.filter(x => x !== s) : [...f.severites, s],
    }));
  }

  toggleStatut(s: AlertStatus): void {
    this._filtres.update(f => ({
      ...f, statuts: f.statuts.includes(s) ? f.statuts.filter(x => x !== s) : [...f.statuts, s],
    }));
  }

  toggleSource(s: AlertSource): void {
    this._filtres.update(f => ({
      ...f, sources: f.sources.includes(s) ? f.sources.filter(x => x !== s) : [...f.sources, s],
    }));
  }

  modifierFiltre<K extends keyof FiltresAlerte>(cle: K, valeur: FiltresAlerte[K]): void {
    this._filtres.update(f => ({ ...f, [cle]: valeur }));
  }

  ouvrirFiltres(): void  { this._filtresDrawerOuvert.set(true); }
  fermerFiltres(): void  { this._filtresDrawerOuvert.set(false); }

  reinitialiserFiltres(): void {
    this._filtres.set({ ...FILTRES_VIDES_ALERTE });
    this._filtresDrawerOuvert.set(false);
  }

  filtrerActives(): void {
    const ACTIVE: AlertStatus[] = ['ouverte', 'assignee', 'en-cours'];
    const current = this._filtres().statuts;
    const allActive = ACTIVE.every(s => current.includes(s));
    this._filtres.update(f => ({ ...f, statuts: allActive ? [] : ACTIVE }));
  }

  filtrerSansIntervention(): void {
    this._filtres.update(f => ({ ...f, sansIntervention: !f.sansIntervention }));
  }

  filtrerDernieres24h(): void {
    this._filtres.update(f => ({ ...f, dernieres24h: !f.dernieres24h }));
  }

  filtrerSlaDepasse(): void {
    this._filtres.update(f => ({ ...f, slaDepasse: !f.slaDepasse }));
  }

  // ── Créer alerte ──────────────────────────────────────────────────────────
  ouvrirModalCreer(): void { this._modalCreerOuvert.set(true); }
  fermerModalCreer(): void { this._modalCreerOuvert.set(false); }

  creerAlerte(data: NouvelleAlerteData): void {
    const now  = new Date().toISOString();
    const num  = String(this.toutesLesAlertes().length + 1).padStart(3, '0');
    const code = `ALT-${new Date().getFullYear()}-${num}`;
    this.store.add({
      id:                `alt-${Date.now()}`,
      code,
      title:             data.titre,
      description:       data.description,
      severity:          data.severite,
      status:            'ouverte',
      source:            data.source,
      department:        data.departement,
      commune:           data.commune,
      infrastructureId:  data.infraId,
      infrastructureName: data.infraName,
      createdAt:         now,
      updatedAt:         now,
      escaladeNiveau:    0,
    });
    // Persiste côté serveur → déclenche le fan-out de notifications (admins + superviseurs du
    // département + TEPAC de la commune). Best-effort : l'UI locale ne dépend pas du résultat.
    this.bff.createAlert({
      titre:       data.titre,
      description: data.description,
      severite:    data.severite,
      type:        data.source,
      departement: data.departement,
      commune:     data.commune,
      infraId:     data.infraId ?? null,
    }).subscribe({ next: () => this.notif.rafraichir(), error: () => {} });
    this._modalCreerOuvert.set(false);
  }

  /** Escalade TEPAC → URD : incrémente le niveau d'escalade ; l'alerte reste « à traiter »
   * (donc visible et priorisée côté superviseur). Mutation persistée comme les autres. */
  escalader(alertId: string): void {
    const a = this.toutesLesAlertes().find(x => x.id === alertId);
    if (!a) return;
    const niveau = Math.min(2, (a.escaladeNiveau ?? 0) + 1) as 0 | 1 | 2;   // plafonné à 2
    this.store.update({ ...a, escaladeNiveau: niveau, updatedAt: new Date().toISOString() });
    if (this._selection()?.id === alertId) {
      this._selection.set({ ...a, escaladeNiveau: niveau });
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  selectionner(a: GestAlert | null): void { this._selection.set(a); }

  // ── Status mutations ──────────────────────────────────────────────────────
  setStatus(alertId: string, status: AlertStatus): void {
    this.store.setStatus(alertId, status);
    const updated = this.toutesLesAlertes().find(a => a.id === alertId);
    if (updated && this._selection()?.id === alertId) {
      this._selection.set({ ...updated, status });
    }
  }

  // ── Intervention ──────────────────────────────────────────────────────────
  ouvrirIntervention(alerte: GestAlert): void {
    const suggestion = SUGGESTION_PAR_SEVERITE[alerte.severity];
    const donnees: DonneesPreremplies = {
      sourceAlertId:   alerte.id,
      sourceAlertCode: alerte.code,
      titre:           `[${alerte.code}] ${alerte.title}`,
      description:     alerte.description,
      type:            suggestion.type,
      priorite:        suggestion.priorite,
      departement:     alerte.department ?? '',
      commune:         alerte.commune    ?? '',
      section:         alerte.section    ?? '',
      infraId:         alerte.infrastructureId ?? '',
    };
    this.interventions.ouvrirModalAvecDonnees(donnees);
  }

  // ── Liaison alerte → intervention ─────────────────────────────────────────
  lierIntervention(alertId: string, interventionId: string): void {
    const alert = this.toutesLesAlertes().find(a => a.id === alertId);
    if (!alert) return;
    this.store.update({
      ...alert,
      status:        'en-cours',
      interventionId,
      updatedAt:     new Date().toISOString(),
    });
    if (this._selection()?.id === alertId) {
      this._selection.set({ ...alert, status: 'en-cours', interventionId });
    }
  }
}

// ── Pure filter fn ────────────────────────────────────────────────────────────
export function filtrer(liste: GestAlert[], f: FiltresAlerte): GestAlert[] {
  const cutoff24h = Date.now() - 24 * 3_600_000;
  return liste.filter(a => {
    if (f.recherche) {
      const q = f.recherche.toLowerCase();
      if (
        !a.title.toLowerCase().includes(q) &&
        !a.code.toLowerCase().includes(q) &&
        !(a.commune ?? '').toLowerCase().includes(q) &&
        !(a.infrastructureName ?? '').toLowerCase().includes(q) &&
        !(a.description ?? '').toLowerCase().includes(q)
      ) return false;
    }
    if (f.severites.length    && !f.severites.includes(a.severity))      return false;
    if (f.statuts.length      && !f.statuts.includes(a.status))          return false;
    if (f.sources.length      && !f.sources.includes(a.source))          return false;
    if (f.departements.length && !f.departements.includes(a.department)) return false;
    if (f.sansIntervention    && a.interventionId)                       return false;
    if (f.dernieres24h        && new Date(a.createdAt).getTime() < cutoff24h) return false;
    if (f.slaDepasse          && slaElapsed(a.createdAt) < SLA_HEURES[a.severity]) return false;
    return true;
  });
}

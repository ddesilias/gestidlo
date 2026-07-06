import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { AlertSeverity, AlertSource, AlertStatus, AlertStore, GestAlert } from '../../alert.store';
import { InterventionStateService } from '../interventions/intervention-state.service';
import {
  FiltresAlerte, FILTRES_VIDES_ALERTE, NEXT_STATUSES_ALERTE,
  isActive, SUGGESTION_PAR_SEVERITE,
  severityDot, severityBg, statusDot, statusBg, sourceDot,
  severityLabel, statusLabel, sourceLabel, dateLabel, timeLabel,
} from '../alertes/alerte.types';
import { DonneesPreremplies } from '../interventions/intervention-state.service';
import { VueConsole, TimelineHour, KANBAN_COLONNES_ALERTES } from './console.types';

@Injectable({ providedIn: 'root' })
export class ConsoleStateService {

  private readonly store         = inject(AlertStore);
  private readonly interventions = inject(InterventionStateService);
  private readonly destroyRef    = inject(DestroyRef);

  // ── UI State ──────────────────────────────────────────────────────────────
  private readonly _vue           = signal<VueConsole>('tableau');
  private readonly _filtresOuverts = signal(false);
  private readonly _selection     = signal<GestAlert | null>(null);
  private readonly _filtres       = signal<FiltresAlerte>({ ...FILTRES_VIDES_ALERTE });
  private readonly _soundEnabled  = signal(false);
  private readonly _lastRefresh   = signal<Date>(new Date());
  private readonly _refreshCount  = signal(0);

  readonly vue            = this._vue.asReadonly();
  readonly filtresOuverts = this._filtresOuverts.asReadonly();
  readonly selection      = this._selection.asReadonly();
  readonly filtres        = this._filtres.asReadonly();
  readonly soundEnabled   = this._soundEnabled.asReadonly();
  readonly lastRefresh    = this._lastRefresh.asReadonly();
  readonly refreshCount   = this._refreshCount.asReadonly();

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly alertes = toSignal(this.store.items$, { initialValue: [] as GestAlert[] });

  readonly alertesFiltrees = computed(() => filtrer(this.alertes(), this._filtres()));

  readonly kpis = computed(() => {
    const items = this.alertes();
    return {
      ouvertes:   items.filter(a => a.status === 'ouverte').length,
      critiques:  items.filter(a => a.severity === 'critique' && isActive(a.status)).length,
      enCours:    items.filter(a => a.status === 'en-cours').length,
      sansAction: items.filter(a => isActive(a.status) && !a.interventionId).length,
      resolues:   items.filter(a => a.status === 'resolue').length,
      total:      items.length,
    };
  });

  readonly alertesCritiquesActives = computed(() =>
    this.alertes().filter(a => a.severity === 'critique' && isActive(a.status))
  );

  readonly nombreFiltresActifs = computed(() => {
    const f = this._filtres();
    return [
      f.recherche !== '',
      f.severites.length > 0,
      f.statuts.length > 0,
      f.sources.length > 0,
      f.departements.length > 0,
      f.sansIntervention,
    ].filter(Boolean).length;
  });

  readonly departementsDisponibles = computed(() => {
    const seen = new Set<string>();
    for (const a of this.alertes()) if (a.department) seen.add(a.department);
    return Array.from(seen).sort();
  });

  // ── Timeline 24h ──────────────────────────────────────────────────────────
  readonly timeline = computed((): TimelineHour[] => {
    const now = new Date();
    const hours: TimelineHour[] = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getTime() - (23 - i) * 3_600_000);
      return { hour: d.getHours(), label: `${d.getHours()}h`, critique: 0, haute: 0, moyenne: 0, basse: 0, total: 0 };
    });
    for (const a of this.alertes()) {
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

  // ── Display helpers (delegated) ───────────────────────────────────────────
  severityDot  = severityDot;
  severityBg   = severityBg;
  statusDot    = statusDot;
  statusBg     = statusBg;
  sourceDot    = sourceDot;
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
      this._refreshCount.update(n => n + 1);
    });
  }

  refresh(): void {
    this._lastRefresh.set(new Date());
    this._refreshCount.update(n => n + 1);
  }

  // ── View ──────────────────────────────────────────────────────────────────
  setVue(v: VueConsole): void { this._vue.set(v); }

  // ── Filters ───────────────────────────────────────────────────────────────
  ouvrirFiltres(): void  { this._filtresOuverts.set(true); }
  fermerFiltres(): void  { this._filtresOuverts.set(false); }

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
  modifierFiltre<K extends keyof FiltresAlerte>(k: K, v: FiltresAlerte[K]): void {
    this._filtres.update(f => ({ ...f, [k]: v }));
  }
  reinitialiserFiltres(): void {
    this._filtres.set({ ...FILTRES_VIDES_ALERTE });
    this._filtresOuverts.set(false);
  }
  filtrerSansIntervention(): void {
    this._filtres.update(f => ({ ...f, sansIntervention: !f.sansIntervention }));
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  selectionner(a: GestAlert | null): void { this._selection.set(a); }

  // ── Status mutations ──────────────────────────────────────────────────────
  setStatus(alertId: string, status: AlertStatus): void {
    this.store.setStatus(alertId, status);
    const updated = this.alertes().find(a => a.id === alertId);
    if (updated && this._selection()?.id === alertId) {
      this._selection.set({ ...updated, status });
    }
  }

  // ── Sound ─────────────────────────────────────────────────────────────────
  toggleSound(): void { this._soundEnabled.update(v => !v); }

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
}

// ── Pure filter ───────────────────────────────────────────────────────────────
function filtrer(liste: GestAlert[], f: FiltresAlerte): GestAlert[] {
  return liste.filter(a => {
    if (f.recherche) {
      const q = f.recherche.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.code.toLowerCase().includes(q) &&
          !(a.commune ?? '').toLowerCase().includes(q) &&
          !(a.infrastructureName ?? '').toLowerCase().includes(q)) return false;
    }
    if (f.severites.length    && !f.severites.includes(a.severity))      return false;
    if (f.statuts.length      && !f.statuts.includes(a.status))          return false;
    if (f.sources.length      && !f.sources.includes(a.source))          return false;
    if (f.departements.length && !f.departements.includes(a.department)) return false;
    if (f.sansIntervention    && a.interventionId)                       return false;
    return true;
  });
}

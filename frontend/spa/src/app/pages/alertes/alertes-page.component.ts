import { ChangeDetectionStrategy, Component, HostListener, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AlerteStateService, filtrer } from './alerte-state.service';
import { AlerteDetailDrawerComponent } from './alerte-detail-drawer/alerte-detail-drawer.component';
import { AlertesFiltersDrawerComponent } from './alertes-filters-drawer/alertes-filters-drawer.component';
import { NouvelleAlerteComponent } from './nouvelle-alerte/nouvelle-alerte.component';
import { NouvelleInterventionComponent } from '../interventions/nouvelle-intervention/nouvelle-intervention.component';
import { InterventionStateService } from '../interventions/intervention-state.service';
import { Timeline24hComponent } from '../console/timeline-24h.component';
import { ConsoleKanbanComponent } from '../console/console-kanban/console-kanban.component';
import { AlertSeverity, AlertStatus, AlertSource, GestAlert } from '../../alert.store';
import { FiltresAlerte, FILTRES_VIDES_ALERTE, SEVERITY_LABELS, STATUS_LABELS, SOURCE_LABELS, severityDot, severityBg, statusDot, statusBg, sourceDot, dateLabel, timeLabel, isActive, slaLabel, slaStatus } from './alerte.types';
import { VueConsole, TimelineHour } from '../console/console.types';

@Component({
  selector: 'app-alertes-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AlerteDetailDrawerComponent,
    AlertesFiltersDrawerComponent,
    NouvelleAlerteComponent,
    NouvelleInterventionComponent,
    Timeline24hComponent,
    ConsoleKanbanComponent,
  ],
  templateUrl: './alertes-page.component.html',
  styleUrls: ['./alertes-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertesPageComponent implements OnInit {
  @Input() scope?: { dept: string };

  readonly state             = inject(AlerteStateService);
  readonly interventionState = inject(InterventionStateService);

  /** En mode scopé (shell superviseur), on (re)charge la liste du backend à chaque
   *  init — donc le périmètre se restaure après un reload, il n'est jamais perdu. */
  ngOnInit(): void {
    if (this.scope) this.state.charger(this.scope.dept);
  }

  readonly SEVERITES: AlertSeverity[] = ['critique', 'haute', 'moyenne', 'basse'];
  readonly STATUTS:   AlertStatus[]   = ['ouverte', 'assignee', 'en-cours', 'resolue', 'ignoree', 'archivee'];
  readonly SOURCES:   AlertSource[]   = ['iot', 'technicien', 'citoyen', 'supervision', 'systeme'];

  // ── Local state (embedded scoped mode) ───────────────────────────
  private readonly _sFiltres          = signal<FiltresAlerte>({ ...FILTRES_VIDES_ALERTE });
  private readonly _sVue              = signal<VueConsole>('tableau');
  private readonly _sModalCreerOuvert = signal(false);

  private readonly _sBase = computed((): GestAlert[] => {
    if (!this.scope) return [];
    return this.state.toutesLesAlertes().filter(a => a.department === this.scope!.dept);
  });

  // ── Unified read computeds (delegate local vs singleton) ──────────
  readonly effAlertesF = computed(() =>
    this.scope ? filtrer(this._sBase(), this._sFiltres()) : this.state.alertesFiltrees()
  );

  readonly effKpis = computed(() => {
    if (!this.scope) return this.state.kpis();
    const base = this._sBase();
    return {
      actives:    base.filter(a => isActive(a.status)).length,
      critiques:  base.filter(a => a.severity === 'critique' && isActive(a.status)).length,
      enCours:    base.filter(a => a.status === 'en-cours').length,
      sansAction: base.filter(a => isActive(a.status) && !a.interventionId).length,
      resolues:   base.filter(a => a.status === 'resolue').length,
      total:      base.length,
    };
  });

  readonly effKpiTendances = computed(() =>
    this.scope
      ? { actives: 0, critiques: 0, enCours: 0, sansAction: 0, resolues: 0 }
      : this.state.kpiTendances()
  );

  readonly effFiltres          = computed(() => this.scope ? this._sFiltres() : this.state.filtres());
  readonly effVue              = computed(() => this.scope ? this._sVue() : this.state.vue());
  readonly effModalCreerOuvert = computed(() => this.scope ? this._sModalCreerOuvert() : this.state.modalCreerOuvert());

  readonly effNbFiltres = computed(() => {
    if (!this.scope) return this.state.nombreFiltresActifs();
    const f = this._sFiltres();
    return [f.recherche !== '', f.severites.length > 0, f.statuts.length > 0,
            f.sources.length > 0, f.sansIntervention, f.dernieres24h, f.slaDepasse]
      .filter(Boolean).length;
  });

  readonly effActives = computed(() => {
    if (!this.scope) return this.state.activesFilterActif();
    const s = this._sFiltres().statuts;
    return (['ouverte', 'assignee', 'en-cours'] as AlertStatus[]).some(x => s.includes(x));
  });

  readonly effTimeline = computed((): TimelineHour[] => {
    if (!this.scope) return this.state.timeline();
    const now = new Date();
    const hours: TimelineHour[] = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getTime() - (23 - i) * 3_600_000);
      return { hour: d.getHours(), label: `${d.getHours()}h`, critique: 0, haute: 0, moyenne: 0, basse: 0, total: 0 };
    });
    for (const a of this._sBase()) {
      const diffH = Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / 3_600_000);
      if (diffH >= 0 && diffH < 24) {
        const idx = 23 - diffH;
        hours[idx][a.severity as AlertSeverity]++;
        hours[idx].total++;
      }
    }
    return hours;
  });

  readonly effCritiquesA = computed(() =>
    this.scope
      ? this._sBase().filter(a => a.severity === 'critique' && isActive(a.status))
      : this.state.alertesCritiquesActives()
  );

  // ── Unified action methods ───────────────────────────────────────
  ouvrirCreerEff():     void { this.scope ? this._sModalCreerOuvert.set(true)  : this.state.ouvrirModalCreer(); }
  fermerCreerEff():     void { this.scope ? this._sModalCreerOuvert.set(false) : this.state.fermerModalCreer(); }
  setVueEff(v: VueConsole): void { this.scope ? this._sVue.set(v) : this.state.setVue(v); }
  ouvrirFiltresEff():   void { if (!this.scope) this.state.ouvrirFiltres(); }

  filtrerActivesEff():           void {
    if (this.scope) {
      const ACTIVE: AlertStatus[] = ['ouverte', 'assignee', 'en-cours'];
      const cur = this._sFiltres().statuts;
      this._sFiltres.update(f => ({ ...f, statuts: ACTIVE.every(s => cur.includes(s)) ? [] : ACTIVE }));
    } else { this.state.filtrerActives(); }
  }
  filtrerSansInterventionEff(): void {
    this.scope ? this._sFiltres.update(f => ({ ...f, sansIntervention: !f.sansIntervention }))
              : this.state.filtrerSansIntervention();
  }
  filtrerDernieres24hEff(): void {
    this.scope ? this._sFiltres.update(f => ({ ...f, dernieres24h: !f.dernieres24h }))
              : this.state.filtrerDernieres24h();
  }
  filtrerSlaDepasseEff(): void {
    this.scope ? this._sFiltres.update(f => ({ ...f, slaDepasse: !f.slaDepasse }))
              : this.state.filtrerSlaDepasse();
  }
  toggleSeveriteEff(s: AlertSeverity): void {
    this.scope
      ? this._sFiltres.update(f => ({ ...f, severites: f.severites.includes(s) ? f.severites.filter(x => x !== s) : [...f.severites, s] }))
      : this.state.toggleSeverite(s);
  }
  toggleStatutEff(s: AlertStatus): void {
    this.scope
      ? this._sFiltres.update(f => ({ ...f, statuts: f.statuts.includes(s) ? f.statuts.filter(x => x !== s) : [...f.statuts, s] }))
      : this.state.toggleStatut(s);
  }
  toggleSourceEff(s: AlertSource): void {
    this.scope
      ? this._sFiltres.update(f => ({ ...f, sources: f.sources.includes(s) ? f.sources.filter(x => x !== s) : [...f.sources, s] }))
      : this.state.toggleSource(s);
  }
  reinitialiserFiltresEff(): void {
    this.scope ? this._sFiltres.set({ ...FILTRES_VIDES_ALERTE }) : this.state.reinitialiserFiltres();
  }

  readonly severiteLabels = SEVERITY_LABELS;
  readonly statusLabels   = STATUS_LABELS;
  readonly sourceLabels   = SOURCE_LABELS;

  severityDot = severityDot;
  severityBg  = severityBg;
  statusDot   = statusDot;
  statusBg    = statusBg;
  sourceDot   = sourceDot;
  dateLabel   = dateLabel;
  timeLabel   = timeLabel;
  isActive    = isActive;
  slaLabel    = slaLabel;
  slaStatus   = slaStatus;

  readonly hoveredId = signal<string | null>(null);

  onRowClick(id: string): void {
    const item = this.state.toutesLesAlertes().find(a => a.id === id) ?? null;
    this.state.selectionner(this.state.selection()?.id === id ? null : item);
  }

  exporter(): void {
    const rows = this.state.alertesFiltrees();
    const headers = ['Code', 'Titre', 'Gravité', 'Statut', 'Source', 'Commune', 'Département', 'Date'];
    const csv = [
      headers.join(','),
      ...rows.map(a => [
        a.code,
        `"${(a.title ?? '').replace(/"/g, '""')}"`,
        a.severity,
        a.status,
        a.source,
        a.commune ?? '',
        a.department ?? '',
        a.createdAt.slice(0, 10),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alertes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      this.state.ouvrirModalCreer();
    }
  }
}

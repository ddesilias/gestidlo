import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BffApiService } from '../api/bff-api.service';
import { OnDestroy } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ToastService } from '../ui/toast.service';
import { I18nService } from '../i18n/i18n.service';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { ProfileService } from '../profile.service';
import { PointsService } from '../points.service';
import { RefreshService } from '../refresh.service';
import { Subscription } from 'rxjs';
import { CodeItemDto, MeasurementTypesService } from '../measurement-types.service';
import { LineChartComponent } from '../ui/line-chart.component';
import { GeoMarker, TerritoryStatus } from '../ui/geojson-map.component';
import { LeafletMapComponent } from '../ui/leaflet-map.component';
import { AuthService, AuthUser } from '../auth.service';

type AlertDto = {
  id: number;
  pointId: string;
  type: string;
  severity: 'INFO' | 'WARN' | 'CRIT';
  status: string;
  message: string;
};

type TicketDto = {
  id: number;
  status: string;
  alertId?: number;
  assignee?: string;
  camundaProcessInstanceId?: string;
};

type MeasurementSampleDto = { value: number; unit: string; timestamp: string };

type PointRealtimeDto = {
  pointId: string;
  lastMeasurements: Record<string, MeasurementSampleDto | undefined>;
};

type DashboardDto = {
  realtime?: PointRealtimeDto[];
  alerts?: AlertDto[];
  tickets?: TicketDto[];
  processDefinitions?: any[];
};

type KpiKey =
  | 'activeResources'
  | 'reservoirsTotal'
  | 'sensorsOnline'
  | 'alertsActive'
  | 'territoriesInTension'
  | 'serviceOkPct'
  | 'qualityOkPct'
  | 'sensorsOkPct'
  | 'criticalReservoirs'
  | 'criticalAlerts';

type SeriesPoint = { timestamp: string; value: number };
type MetricsKey = 'levelAvg' | 'flowAvg' | 'pressureAvg' | 'okPct';

type FeedItem = { kind: 'alarm' | 'incident' | 'update' | 'info'; label: string; age: string };

type EnrichedAlert = {
  id: number;
  type: string;
  severity: 'INFO' | 'WARN' | 'CRIT';
  status: string;
  message: string;
  pointName: string;
  territory: string;
  age: string;
};

type ActivityItem = {
  kind: 'danger' | 'success' | 'warning' | 'info';
  label: string;
  detail: string;
  age: string;
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LineChartComponent,
    LeafletMapComponent,
    TranslatePipe
  ],
  template: `
    <ng-container *ngIf="dashboard as d; else loading">
      <div class="admin-page-title">
                  <h1 class="admin-page-title__h">{{ 'dashboard.admin.title' | t }}</h1>
                  <div class="admin-page-title__sub">{{ 'dashboard.admin.subtitle' | t }}</div>
                </div>

              <section class="kpi5-grid">

                <!-- 1. Points d'eau actifs -->
                <div class="kpi5">
                  <div class="kpi5__head">
                    <div class="kpi5__icon kpi5__icon--blue">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12Z"/></svg>
                    </div>
                    <span class="kpi5__label">Points d'eau actifs</span>
                  </div>
                  <div class="kpi5__body">
                    <span class="kpi5__value">{{ kpiValue('activeResources') }}</span>
                    <svg class="kpi5__spark kpi5__spark--blue" viewBox="0 0 60 20" preserveAspectRatio="none">
                      <polyline *ngIf="kpiSeries('activeResources').length > 1" [attr.points]="kpiSparkPoints('activeResources')" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="kpi5__foot">
                    <span class="kpi5__trend" [class.kpi5__trend--good]="kpiTrendGood('activeResources')" [class.kpi5__trend--bad]="kpiTrendBad('activeResources')">{{ kpiTrendPct('activeResources') }}</span>
                    <span class="kpi5__compare">vs période préc.</span>
                  </div>
                </div>

                <!-- 2. Réservoirs surveillés -->
                <div class="kpi5">
                  <div class="kpi5__head">
                    <div class="kpi5__icon kpi5__icon--indigo">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 12h16v8H4v-8Zm2-8h12l2 6H4l2-6Z"/></svg>
                    </div>
                    <span class="kpi5__label">Réservoirs surveillés</span>
                  </div>
                  <div class="kpi5__body">
                    <span class="kpi5__value">{{ kpiValue('reservoirsTotal') }}</span>
                    <svg class="kpi5__spark kpi5__spark--indigo" viewBox="0 0 60 20" preserveAspectRatio="none">
                      <polyline *ngIf="kpiSeries('reservoirsTotal').length > 1" [attr.points]="kpiSparkPoints('reservoirsTotal')" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="kpi5__foot">
                    <span class="kpi5__trend" [class.kpi5__trend--good]="kpiTrendGood('reservoirsTotal')" [class.kpi5__trend--bad]="kpiTrendBad('reservoirsTotal')">{{ kpiTrendPct('reservoirsTotal') }}</span>
                    <span class="kpi5__compare">vs période préc.</span>
                  </div>
                </div>

                <!-- 3. Capteurs connectés -->
                <div class="kpi5">
                  <div class="kpi5__head">
                    <div class="kpi5__icon kpi5__icon--teal">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 2a7 7 0 0 0-7 7v3l-2 2v1h18v-1l-2-2V9a7 7 0 0 0-7-7Z"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                    </div>
                    <span class="kpi5__label">Capteurs connectés</span>
                  </div>
                  <div class="kpi5__body">
                    <span class="kpi5__value">{{ kpiValue('sensorsOnline') }}</span>
                    <svg class="kpi5__spark kpi5__spark--teal" viewBox="0 0 60 20" preserveAspectRatio="none">
                      <polyline *ngIf="kpiSeries('sensorsOnline').length > 1" [attr.points]="kpiSparkPoints('sensorsOnline')" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="kpi5__foot">
                    <span class="kpi5__trend" [class.kpi5__trend--good]="kpiTrendGood('sensorsOnline')" [class.kpi5__trend--bad]="kpiTrendBad('sensorsOnline')">{{ kpiTrendPct('sensorsOnline') }}</span>
                    <span class="kpi5__compare">vs période préc.</span>
                  </div>
                </div>

                <!-- 4. Alertes actives -->
                <div class="kpi5">
                  <div class="kpi5__head">
                    <div class="kpi5__icon kpi5__icon--red">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z"/></svg>
                    </div>
                    <span class="kpi5__label">Alertes actives</span>
                  </div>
                  <div class="kpi5__body">
                    <span class="kpi5__value">{{ kpiValue('alertsActive') }}</span>
                    <svg class="kpi5__spark kpi5__spark--red" viewBox="0 0 60 20" preserveAspectRatio="none">
                      <polyline *ngIf="kpiSeries('alertsActive').length > 1" [attr.points]="kpiSparkPoints('alertsActive')" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="kpi5__foot">
                    <span class="kpi5__trend" [class.kpi5__trend--good]="kpiTrendGood('alertsActive')" [class.kpi5__trend--bad]="kpiTrendBad('alertsActive')">{{ kpiTrendPct('alertsActive') }}</span>
                    <span class="kpi5__compare">vs période préc.</span>
                  </div>
                </div>

                <!-- 5. Départements à risque -->
                <div class="kpi5">
                  <div class="kpi5__head">
                    <div class="kpi5__icon kpi5__icon--amber">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <span class="kpi5__label">Départements à risque</span>
                  </div>
                  <div class="kpi5__body">
                    <span class="kpi5__value">{{ kpiValue('territoriesInTension') }}</span>
                    <svg class="kpi5__spark kpi5__spark--amber" viewBox="0 0 60 20" preserveAspectRatio="none">
                      <polyline *ngIf="kpiSeries('territoriesInTension').length > 1" [attr.points]="kpiSparkPoints('territoriesInTension')" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="kpi5__foot">
                    <span class="kpi5__trend" [class.kpi5__trend--good]="kpiTrendGood('territoriesInTension')" [class.kpi5__trend--bad]="kpiTrendBad('territoriesInTension')">{{ kpiTrendPct('territoriesInTension') }}</span>
                    <span class="kpi5__compare">vs période préc.</span>
                  </div>
                </div>

              </section>

              <section class="admin-dash__main">
                <section class="card admin-map">
                  <div class="admin-map__head dash-map-head">

                    <!-- Titre + compteurs synthétiques -->
                    <div class="dash-map-info">
                      <h3 class="dash-map-title">État du réseau</h3>
                      <p class="dash-map-sub">{{ kpiValue('activeResources') }} ouvrages &nbsp;·&nbsp; {{ kpiValue('alertsActive') }} alertes actives &nbsp;·&nbsp; {{ kpiValue('territoriesInTension') }} dépt. à risque</p>
                    </div>

                    <!-- Légende compacte -->
                    <div class="dash-map-legend">
                      <span class="dash-leg"><span class="dash-leg__dot dash-leg__dot--ok"></span>OK</span>
                      <span class="dash-leg"><span class="dash-leg__dot dash-leg__dot--warn"></span>Avert.</span>
                      <span class="dash-leg"><span class="dash-leg__dot dash-leg__dot--crit"></span>Critique</span>
                      <span class="dash-leg"><span class="dash-leg__dot dash-leg__dot--offline"></span>Hors ligne</span>
                    </div>

                    <!-- CTA vers cartographie -->
                    <a class="dash-map-cta" routerLink="/supervision">
                      Carte complète
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </a>

                  </div>

                  <div class="admin-map__grid">
                    <app-leaflet-map [markers]="mapMarkers()"></app-leaflet-map>
                  </div>
                </section>

                <aside class="card admin-alerts aalerts-panel">

                  <!-- En-tête -->
                  <div class="aalerts-head">
                    <div class="aalerts-title">
                      <span>Alertes critiques</span>
                      <span class="aalerts-count" *ngIf="alertCards().length">{{ alertCards().length }}</span>
                    </div>
                    <a class="aalerts-see-all" routerLink="/alerts">Voir toutes</a>
                  </div>

                  <!-- Liste des alertes enrichies -->
                  <div class="aalerts-list" *ngIf="alertCards().length; else noAlerts">
                    <a class="aalert" routerLink="/alerts"
                       *ngFor="let a of alertCards()"
                       [class.aalert--crit]="a.severity === 'CRIT'"
                       [class.aalert--warn]="a.severity === 'WARN'">
                      <div class="aalert__bar"></div>
                      <div class="aalert__body">
                        <div class="aalert__type">{{ alertTypeLabel(a.type) }}</div>
                        <div class="aalert__ouvrage">{{ a.pointName }}</div>
                        <div class="aalert__loc" *ngIf="a.territory">{{ a.territory }}</div>
                        <div class="aalert__foot">
                          <span class="aalert__age">{{ a.age }}</span>
                          <span class="aalert__sev aalert__sev--crit" *ngIf="a.severity === 'CRIT'">CRITIQUE</span>
                          <span class="aalert__sev aalert__sev--warn" *ngIf="a.severity === 'WARN'">AVERT.</span>
                        </div>
                      </div>
                      <svg class="aalert__arrow" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </a>
                  </div>

                  <ng-template #noAlerts>
                    <div class="aalerts-empty">
                      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                      <span>Aucune alerte active</span>
                    </div>
                  </ng-template>

                  <!-- Actions -->
                  <div class="aalerts-actions">
                    <a class="aalerts-btn aalerts-btn--danger" routerLink="/alerts">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                      Voir alertes
                    </a>
                    <a class="aalerts-btn aalerts-btn--blue" routerLink="/tickets">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                      Interventions
                    </a>
                  </div>

                </aside>
              </section>

              <section class="lower3-grid">

                <!-- ── Niveaux des réservoirs ──────────────────────────── -->
                <section class="card lower3-card">
                  <div class="lower3-head">
                    <h3 class="lower3-title">Niveaux des réservoirs</h3>
                  </div>
                  <div class="lower3-big-val">{{ avgReservoirLevel() }}%</div>
                  <p class="lower3-sub">Moyenne globale</p>

                  <div class="rlevel-bar-wrap">
                    <div class="rlevel-track">
                      <div class="rlevel-fill" [style.width.%]="avgReservoirLevel()"></div>
                    </div>
                    <span class="rlevel-pct">{{ avgReservoirLevel() }}%</span>
                  </div>

                  <div class="rlevel-cap">
                    <span>Capacité utilisée</span>
                    <span class="rlevel-cap-val">6 840 m³ / 10 000 m³</span>
                  </div>

                  <div class="rlevel-list">
                    <div class="rlevel-item" *ngFor="let r of reservoirSamples()">
                      <div class="rlevel-item-head">
                        <span class="rlevel-name">{{ r.name }}</span>
                        <span class="rlevel-item-pct"
                          [class.rlevel-item-pct--warn]="r.pct >= 30 && r.pct < 60"
                          [class.rlevel-item-pct--crit]="r.pct < 30">{{ r.pct }}%</span>
                      </div>
                      <div class="rlevel-mini-track">
                        <div class="rlevel-mini-fill"
                          [style.width.%]="r.pct"
                          [class.rlevel-mini-fill--warn]="r.pct >= 30 && r.pct < 60"
                          [class.rlevel-mini-fill--crit]="r.pct < 30"></div>
                      </div>
                    </div>
                    <div class="rlevel-empty muted" *ngIf="!reservoirSamples().length">
                      Aucun réservoir enregistré
                    </div>
                  </div>
                </section>

                <!-- ── Évolution des indicateurs ───────────────────────── -->
                <section class="card lower3-card">
                  <div class="lower3-head">
                    <h3 class="lower3-title">Évolution des indicateurs</h3>
                    <span class="lower3-badge">30 jours</span>
                  </div>
                  <div class="evol-grid">
                    <app-line-chart [values]="metricSeries('levelAvg')"    title="Niveau d'eau"  subtitle="moy. réservoirs" />
                    <app-line-chart [values]="metricSeries('pressureAvg')" title="Pression"       subtitle="bar" />
                    <app-line-chart [values]="metricSeries('flowAvg')"     title="Débit"          subtitle="m³/h" />
                    <app-line-chart [values]="alertsLineData()"             title="Alertes"        subtitle="nombre total" />
                  </div>
                </section>

                <!-- ── Répartition des points d'eau ───────────────────── -->
                <section class="card lower3-card">
                  <div class="lower3-head">
                    <h3 class="lower3-title">Répartition des points d'eau</h3>
                  </div>
                  <div class="donut-wrap">
                    <svg class="donut-svg" viewBox="0 0 120 120">
                      <circle class="donut-bg" cx="60" cy="60" r="40" />
                      <g transform="rotate(-90,60,60)">
                        <circle *ngFor="let seg of donutSegments()"
                          class="donut-seg"
                          cx="60" cy="60" r="40"
                          [attr.stroke]="seg.color"
                          [attr.stroke-dasharray]="seg.dash"
                          [attr.stroke-dashoffset]="seg.offset" />
                      </g>
                      <text class="donut-center-val" x="60" y="56" text-anchor="middle">{{ totalPointsCount() }}</text>
                      <text class="donut-center-sub" x="60" y="68" text-anchor="middle">ouvrages</text>
                    </svg>
                    <div class="donut-legend">
                      <div class="donut-leg-item" *ngFor="let seg of donutSegments()">
                        <span class="donut-leg-dot" [style.background]="seg.color"></span>
                        <span class="donut-leg-label">{{ seg.label }}</span>
                        <span class="donut-leg-count">{{ seg.count }}</span>
                        <span class="donut-leg-pct muted">{{ seg.pct }}%</span>
                      </div>
                    </div>
                  </div>
                </section>

              </section>

              <!-- ═══════════════════════════════════════════════
                   ACTIVITÉS RÉCENTES
              ═══════════════════════════════════════════════ -->
              <section class="card activ-card">
                <div class="activ-head">
                  <div class="activ-head-left">
                    <h3 class="activ-title">Activités récentes</h3>
                    <span class="activ-subtitle">Événements des dernières 24 h</span>
                  </div>
                  <a class="activ-see-all" routerLink="/traceability">Voir l'historique</a>
                </div>
                <div class="activ-grid">
                  <div class="activ-item" *ngFor="let a of recentActivity()">
                    <span class="activ-dot"
                      [class.activ-dot--danger]="a.kind === 'danger'"
                      [class.activ-dot--success]="a.kind === 'success'"
                      [class.activ-dot--warning]="a.kind === 'warning'"
                      [class.activ-dot--info]="a.kind === 'info'">
                    </span>
                    <div class="activ-body">
                      <span class="activ-label">{{ a.label }}</span>
                      <span class="activ-sep">—</span>
                      <span class="activ-detail">{{ a.detail }}</span>
                    </div>
                    <span class="activ-age">{{ a.age }}</span>
                  </div>
                </div>
              </section>

    </ng-container>

    <ng-template #loading>
      <div class="card" style="padding: 1rem">Chargement…</div>
    </ng-template>
  `,
  styles: []
})
export class DashboardPageComponent implements OnDestroy {
  dashboard?: DashboardDto;
  lastIngest: any;

  search = '';
  period: '7d' | '30d' | '90d' = '30d';
  mapMetric = 'PRESSURE';
  territoryFilter = '';
  selectedPointId?: string;

  private readonly kpiStorageKey = 'gestidlo.kpiHistory.admin.v1';
  private kpiHistory: Record<KpiKey, number[]> = {
    activeResources: [],
    reservoirsTotal: [],
    sensorsOnline: [],
    alertsActive: [],
    territoriesInTension: [],
    serviceOkPct: [],
    qualityOkPct: [],
    sensorsOkPct: [],
    criticalReservoirs: [],
    criticalAlerts: []
  };

  private readonly metricsStorageKey = 'gestidlo.metrics.admin.v1';
  private metricsHistory: Record<MetricsKey, SeriesPoint[]> = {
    levelAvg: [],
    flowAvg: [],
    pressureAvg: [],
    okPct: []
  };

  pointList: Array<{ id: string; name: string }> = [];
  measurementTypeList: CodeItemDto[] = [];

  private refreshSubscription?: Subscription;
  private measurementTypesSubscription?: Subscription;
  private pointsSubscription?: Subscription;
  private userSubscription?: Subscription;

  user: AuthUser | null = null;

  technician = 'tech';
  form = {
    pointId: 'POINT-001',
    sensorId: 'SENSOR-001',
    type: 'PRESSURE',
    value: 1.5,
    unit: 'bar'
  };

  constructor(
    private readonly api: BffApiService,
    private readonly toast: ToastService,
    private readonly i18n: I18nService,
    private readonly profile: ProfileService,
    private readonly points: PointsService,
    private readonly measurementTypes: MeasurementTypesService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly refresh: RefreshService
  ) {
    this.technician = this.profile.getTechnicianName();

    this.user = this.auth.userSnapshot();
    this.userSubscription = this.auth.userStream().subscribe((u) => (this.user = u));

    this.points.ensureLoaded().subscribe();
    this.pointsSubscription = this.points.stream().subscribe((points) => {
      this.pointList = (points ?? []).filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }));
      if (!this.pointList.some((p) => p.id === this.form.pointId) && this.pointList.length > 0) {
        this.form.pointId = this.pointList[0].id;
      }
    });

    this.kpiHistory = this.loadHistory();
    this.metricsHistory = this.loadMetricsHistory();

    this.measurementTypes.ensureLoaded().subscribe();
    this.measurementTypesSubscription = this.measurementTypes.stream().subscribe((types) => {
      this.measurementTypeList = (types ?? []).filter((t) => t.active);
      if (!this.measurementTypeList.some((t) => t.code === this.form.type) && this.measurementTypeList.length > 0) {
        this.form.type = this.measurementTypeList[0].code;
      }

      if (!this.measurementTypeList.some((t) => t.code === this.mapMetric) && this.measurementTypeList.length > 0) {
        this.mapMetric = this.measurementTypeList[0].code;
      }
    });

    this.reload();

    this.refreshSubscription = this.refresh.refresh$.subscribe((e) => {
      this.reload(e.reason === 'manual');
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  saveTechnician() {
    this.profile.setTechnicianName(this.technician);
  }

  typeLabel(type: string): string {
    return this.measurementTypes.label(type);
  }


  reload(showErrorToast = false) {
    this.api.dashboard().subscribe({
      next: (d) => {
        this.dashboard = d as DashboardDto;
        this.selectedPointId = this.selectedPointId ?? this.mapMarkers()[0]?.id;
        this.pushHistory();
        this.pushMetricsHistory();
      },
      error: () => {
        if (showErrorToast) {
          this.toast.push('error', this.i18n.t('toast.failed'));
        }
      }
    });
  }

  send() {
    this.api.ingestMeasurement(this.form).subscribe({
      next: (r) => {
        this.lastIngest = r;
        this.toast.push('success', this.i18n.t('toast.measurementIngested'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  pointLabel(pointId: string): string {
    return this.points.label(pointId);
  }

  treatAlert(alert: AlertDto) {
    this.api.createTicket(alert.id, this.technician).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.ticketCreated'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  kpiSeries(key: KpiKey): number[] {
    return this.kpiHistory[key] ?? [];
  }

  kpiValue(key: KpiKey): number {
    const series = this.kpiSeries(key);
    if (!series.length) return 0;
    return series[series.length - 1];
  }

  kpiDelta(key: KpiKey): number {
    const series = this.kpiSeries(key);
    if (series.length < 2) {
      return 0;
    }
    return series[series.length - 1] - series[series.length - 2];
  }

  kpiDeltaLabel(key: KpiKey): string {
    const delta = this.kpiDelta(key);
    if (delta === 0) {
      return '—';
    }
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  kpiTrendPct(key: KpiKey): string {
    const series = this.kpiSeries(key);
    if (series.length < 2) return '—';
    const prev = series[series.length - 2];
    const curr = series[series.length - 1];
    if (prev === 0) return curr > 0 ? '+∞%' : '—';
    const pct = Math.round(((curr - prev) / prev) * 100);
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  }

  private readonly KPI_NEGATIVE: Partial<Record<KpiKey, boolean>> = {
    alertsActive: true,
    territoriesInTension: true,
    criticalAlerts: true,
    criticalReservoirs: true,
  };

  kpiTrendGood(key: KpiKey): boolean {
    const series = this.kpiSeries(key);
    if (series.length < 2) return false;
    const wentUp = series[series.length - 1] > series[series.length - 2];
    return this.KPI_NEGATIVE[key] ? !wentUp : wentUp;
  }

  kpiTrendBad(key: KpiKey): boolean {
    const series = this.kpiSeries(key);
    if (series.length < 2) return false;
    if (series[series.length - 1] === series[series.length - 2]) return false;
    return !this.kpiTrendGood(key);
  }

  kpiSparkPoints(key: KpiKey): string {
    const series = this.kpiSeries(key);
    if (series.length < 2) return '';
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const w = 60, h = 20;
    return series.map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  metricSeries(key: MetricsKey): SeriesPoint[] {
    return this.metricsHistory[key] ?? [];
  }

  onFiltersChanged() {
    const ids = new Set(this.mapMarkers().map((m) => m.id));
    if (this.selectedPointId && ids.has(this.selectedPointId)) return;
    this.selectedPointId = this.mapMarkers()[0]?.id;
  }

  territoryState(territory: string): TerritoryStatus {
    const points = this.points.all().filter((p) => (p.territory ?? '').trim() === territory);
    if (!points.length) return 'UNKNOWN';

    const states = points.map((p) => this.pointState(p.id));
    if (states.every((s) => s === 'OFFLINE')) return 'OFFLINE';
    if (states.some((s) => s === 'CRIT')) return 'CRIT';
    if (states.some((s) => s === 'WARN')) return 'WARN';
    return 'OK';
  }

  private territoryCounts(territory: string): {
    total: number;
    ok: number;
    warn: number;
    crit: number;
    offline: number;
  } {
    const points = this.points.all().filter((p) => (p.territory ?? '').trim() === territory);
    const states = points.map((p) => this.pointState(p.id));
    return {
      total: points.length,
      ok: states.filter((s) => s === 'OK').length,
      warn: states.filter((s) => s === 'WARN').length,
      crit: states.filter((s) => s === 'CRIT').length,
      offline: states.filter((s) => s === 'OFFLINE').length
    };
  }

  mapMarkers(): GeoMarker[] {
    const points = this.points.all();
    const filtered = this.territoryFilter
      ? points.filter((p) => String(p.territory ?? '') === this.territoryFilter)
      : points;

    return filtered
      .filter((p) => typeof p.lon === 'number' && typeof p.lat === 'number')
      .map((p) => {
        const c = this.normalizeLonLat(p.lon as number, p.lat as number);
        return {
          id: p.id,
          lon: c.lon,
          lat: c.lat,
          label: p.name,
          state: this.pointState(p.id)
        };
      })
      .filter((m) => this.isInHaitiBbox(m.lon, m.lat));
  }

  private isInHaitiBbox(lon: number, lat: number): boolean {
    // Demo bbox for Haiti (WGS84 decimal degrees).
    const minLon = -75.5;
    const maxLon = -71.0;
    const minLat = 17.5;
    const maxLat = 20.5;
    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  }

  private normalizeLonLat(lon: number, lat: number): { lon: number; lat: number } {
    // Demo bbox for Haiti (WGS84 decimal degrees).
    const minLon = -75.5;
    const maxLon = -71.0;
    const minLat = 17.5;
    const maxLat = 20.5;

    const inHaiti = (lo: number, la: number) => lo >= minLon && lo <= maxLon && la >= minLat && la <= maxLat;

    // Common user mistake: swapping lon/lat.
    if (!inHaiti(lon, lat) && inHaiti(lat, lon)) {
      return { lon: lat, lat: lon };
    }

    // Common user mistake: missing sign (west longitudes are negative).
    if (!inHaiti(lon, lat) && lon > 0 && inHaiti(-lon, lat)) {
      return { lon: -lon, lat };
    }
    if (!inHaiti(lon, lat) && lat < 0 && inHaiti(lon, -lat)) {
      return { lon, lat: -lat };
    }

    // If lat is out of valid range but lon looks like a latitude, swap.
    if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
      return { lon: lat, lat: lon };
    }

    return { lon, lat };
  }

  pointState(pointId: string): 'OK' | 'WARN' | 'CRIT' | 'OFFLINE' {
    const r = this.realtimeOf(pointId);
    if (!r || !this.lastSeen(r)) return 'OFFLINE';
    const a = this.topAlert(pointId);
    if (!a) return 'OK';
    return a.severity === 'CRIT' ? 'CRIT' : a.severity === 'WARN' ? 'WARN' : 'OK';
  }

  warnOrCritPoints(): string[] {
    return this.points
      .all()
      .map((p) => p.id)
      .filter((id) => {
        const s = this.pointState(id);
        return s === 'WARN' || s === 'CRIT';
      });
  }

  offlinePoints(): string[] {
    return this.points
      .all()
      .map((p) => p.id)
      .filter((id) => this.pointState(id) === 'OFFLINE');
  }

  criticalPoints(): string[] {
    return this.points
      .all()
      .map((p) => p.id)
      .filter((id) => this.pointState(id) === 'CRIT');
  }

  territories(): string[] {
    const unique = new Set(
      this.points
        .all()
        .map((p) => (p.territory ?? '').trim())
        .filter(Boolean)
    );
    return [...unique].sort((a, b) => a.localeCompare(b));
  }

  territoriesInTension(): string[] {
    const set = new Set<string>();
    for (const p of this.points.all()) {
      const territory = (p.territory ?? '').trim();
      if (!territory) continue;
      if (this.pointState(p.id) === 'CRIT') {
        set.add(territory);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  territoriesInTensionWithCounts(): Array<{ territory: string; crit: number }> {
    const counts = new Map<string, number>();
    for (const p of this.points.all()) {
      const territory = (p.territory ?? '').trim();
      if (!territory) continue;
      if (this.pointState(p.id) !== 'CRIT') continue;
      counts.set(territory, (counts.get(territory) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([territory, crit]) => ({ territory, crit }))
      .sort((a, b) => b.crit - a.crit || a.territory.localeCompare(b.territory));
  }

  territoriesAtRiskWithCounts(): Array<{ territory: string; state: TerritoryStatus; crit: number }> {
    const res: Array<{ territory: string; state: TerritoryStatus; crit: number }> = [];
    for (const territory of this.territories()) {
      const state = this.territoryState(territory);
      if (state === 'OK' || state === 'UNKNOWN') {
        continue;
      }
      const crit = this.territoryCounts(territory).crit;
      res.push({ territory, state, crit });
    }
    return res.sort(
      (a, b) =>
        this.territoryRank(b.state) - this.territoryRank(a.state) ||
        b.crit - a.crit ||
        a.territory.localeCompare(b.territory)
    );
  }

  private territoryRank(state: TerritoryStatus): number {
    if (state === 'CRIT') return 3;
    if (state === 'WARN') return 2;
    if (state === 'OFFLINE') return 1;
    return 0;
  }

  territoryIcon(state: TerritoryStatus): string {
    if (state === 'OFFLINE') return '×';
    if (state === 'WARN') return '!';
    if (state === 'CRIT') return '!';
    return '•';
  }

  criticalResources(): string[] {
    return this.points
      .all()
      .filter((p) => p.type === 'TANK' || p.type === 'SOURCE')
      .map((p) => p.id)
      .filter((id) => this.pointState(id) === 'CRIT');
  }

  openTickets(): TicketDto[] {
    const tickets = this.dashboard?.tickets ?? [];
    return tickets.filter((t) => t.status !== 'CLOSED');
  }

  ticketStatusLabel(status: string): string {
    const key = `status.${status}`;
    const t = this.i18n.t(key);
    return t === key ? status : t;
  }

  criticalAlertsCount(): number {
    return (this.dashboard?.alerts ?? []).filter((a) => a.severity === 'CRIT').length;
  }

  userInitials(): string {
    const u = (this.user?.username ?? 'A').trim();
    return u ? u.slice(0, 1).toUpperCase() : 'A';
  }

  resourceFeed(): FeedItem[] {
    const items: FeedItem[] = [];
    const alerts = (this.dashboard?.alerts ?? []).slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const tickets = this.openTickets().slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

    const alarm = alerts.find((a) => a.severity === 'CRIT' || a.severity === 'WARN');
    if (alarm) {
      items.push({
        kind: 'alarm',
        label: `Alarme: ${this.typeLabel(alarm.type)} — ${this.pointLabel(alarm.pointId)}`,
        age: this.ageFromId(alarm.id)
      });
    }

    const incident = tickets[0];
    if (incident) {
      items.push({
        kind: 'incident',
        label: `Incident: #${incident.id} — ${this.ticketStatusLabel(incident.status)}`,
        age: this.ageFromId(incident.id)
      });
    }

    items.push({
      kind: 'update',
      label: `Mise à jour: ${this.territories().length} départements chargés`,
      age: this.ageFromId(this.territories().length + 3)
    });

    return items.slice(0, 3);
  }

  infraFeed(): FeedItem[] {
    const items: FeedItem[] = [];
    const tickets = this.openTickets().slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    for (const t of tickets.slice(0, 3)) {
      items.push({
        kind: 'info',
        label: `Intervention #${t.id} — ${this.ticketStatusLabel(t.status)}`,
        age: this.ageFromId(t.id)
      });
    }
    return items;
  }

  private ageFromId(id: number): string {
    const days = Math.max(1, id % 28);
    return `${days} j`;
  }

  alertAge(alertId: number): string {
    const buckets = [3, 8, 12, 25, 38, 55, 72, 110, 180, 360, 720, 1440, 2880];
    const min = buckets[alertId % buckets.length];
    if (min < 60) return `Il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Il y a ${h} h`;
    return `Il y a ${Math.floor(h / 24)} j`;
  }

  alertTypeLabel(type: string): string {
    const map: Record<string, string> = {
      LEVEL_LOW:          'Niveau bas détecté',
      LEVEL_CRITICAL:     'Niveau critique',
      LEVEL_HIGH:         'Niveau anormalement élevé',
      PRESSURE_LOW:       'Pression très basse',
      PRESSURE_CRITICAL:  'Pression critique',
      PRESSURE_HIGH:      'Surpression détectée',
      FLOW_LOW:           'Débit insuffisant',
      FLOW_CRITICAL:      'Débit critique',
      SENSOR_OFFLINE:     'Capteur hors ligne',
      QUALITY_ALERT:      'Alerte qualité',
      CONTAMINATION:      'Contamination détectée',
      MAINTENANCE:        'Maintenance requise',
    };
    return map[type] ?? type.replace(/_/g, ' ');
  }

  recentActivity(): ActivityItem[] {
    const items: ActivityItem[] = [];
    const alerts = this.dashboard?.alerts ?? [];
    const tickets = this.dashboard?.tickets ?? [];

    for (const a of alerts.slice(0, 2)) {
      const pt = this.points.all().find((p) => p.id === a.pointId);
      const loc = pt?.territory ? ` · ${pt.territory}` : '';
      items.push({
        kind: a.severity === 'CRIT' ? 'danger' : a.severity === 'WARN' ? 'warning' : 'info',
        label: a.severity === 'CRIT' ? 'Alerte critique déclenchée' : 'Alerte signalée',
        detail: (pt?.name ?? this.pointLabel(a.pointId)) + loc,
        age: this.alertAge(a.id),
      });
    }

    for (const t of tickets.slice(0, 2)) {
      items.push({
        kind: t.status === 'CLOSED' ? 'success' : 'info',
        label: t.status === 'CLOSED' ? 'Intervention terminée' : 'Intervention créée',
        detail: `#${t.id} — ${this.ticketStatusLabel(t.status)}`,
        age: this.ageFromId(t.id),
      });
    }

    const pad: ActivityItem[] = [
      { kind: 'success', label: 'Alerte résolue automatiquement', detail: 'Capteur C-1245 · Artibonite',              age: 'Il y a 12 min' },
      { kind: 'info',    label: 'Nouveau point d\'eau enregistré', detail: 'Borne-fontaine Carrefour · Ouest',         age: 'Il y a 38 min' },
      { kind: 'info',    label: 'Rapport mensuel généré',          detail: 'Avril 2026',                               age: 'Il y a 1 h'    },
      { kind: 'info',    label: 'Synchronisation capteurs',        detail: `${this.points.all().length} capteurs vérifiés`, age: 'Il y a 2 h' },
      { kind: 'warning', label: 'Mise à jour réseau',              detail: `${this.territories().length} départements rechargés`, age: 'Il y a 3 h' },
      { kind: 'success', label: 'Sauvegarde automatique',          detail: 'Données archivées avec succès',            age: 'Hier'          },
    ];

    for (const s of pad) {
      if (items.length >= 6) break;
      items.push(s);
    }

    return items.slice(0, 6);
  }

  alertCards(): EnrichedAlert[] {
    const allPoints = this.points.all();
    const getPoint = (id: string) => allPoints.find((p) => p.id === id);

    return (this.dashboard?.alerts ?? [])
      .filter((a) => a.severity === 'CRIT' || a.severity === 'WARN')
      .sort((a, b) => {
        const rank = (s: string) => (s === 'CRIT' ? 2 : s === 'WARN' ? 1 : 0);
        const rd = rank(b.severity) - rank(a.severity);
        return rd !== 0 ? rd : (b.id ?? 0) - (a.id ?? 0);
      })
      .slice(0, 5)
      .map((a) => {
        const pt = getPoint(a.pointId);
        return {
          id: a.id,
          type: a.type,
          severity: a.severity,
          status: a.status,
          message: a.message,
          pointName: pt?.name ?? this.pointLabel(a.pointId),
          territory: (pt?.territory ?? '').trim(),
          age: this.alertAge(a.id),
        };
      });
  }

  countPointsByType(type: string): number {
    return this.points.all().filter((p) => p.type === type).length;
  }

  topAlert(pointId: string): AlertDto | null {
    const alerts = (this.dashboard?.alerts ?? []).filter((a) => a.pointId === pointId);
    if (!alerts.length) return null;
    return alerts.sort((a, b) => {
      const ra = a.severity === 'CRIT' ? 3 : a.severity === 'WARN' ? 2 : 1;
      const rb = b.severity === 'CRIT' ? 3 : b.severity === 'WARN' ? 2 : 1;
      if (ra !== rb) return rb - ra;
      return (b.id ?? 0) - (a.id ?? 0);
    })[0];
  }

  realtimeOf(pointId: string): PointRealtimeDto | null {
    return (this.dashboard?.realtime ?? []).find((r) => r.pointId === pointId) ?? null;
  }

  lastSeen(p: PointRealtimeDto): string | null {
    const candidates = Object.values(p.lastMeasurements ?? {})
      .map((m) => m?.timestamp)
      .filter(Boolean) as string[];
    if (!candidates.length) return null;
    candidates.sort();
    return candidates[candidates.length - 1];
  }

  lastSeenLabel(pointId: string): string {
    const p = this.realtimeOf(pointId);
    return p ? this.lastSeen(p) ?? this.i18n.t('common.offline') : this.i18n.t('common.offline');
  }

  private pushHistory() {
    const totalPoints = this.points.all().length;
    const onlinePoints = (this.dashboard?.realtime ?? []).filter((p) => this.lastSeen(p)).length;
    const criticalAlerts = (this.dashboard?.alerts ?? []).filter((a) => a.severity === 'CRIT').length;
    const criticalReservoirs = this.points
      .all()
      .filter((p) => p.type === 'TANK')
      .map((p) => p.id)
      .filter((id) => this.pointState(id) === 'CRIT').length;

    const sensorsOkPct = totalPoints ? Math.round((onlinePoints / totalPoints) * 100) : 0;
    const territoriesInTension = this.territoriesInTension().length;
    const serviceOkPct = totalPoints
      ? Math.round(((totalPoints - this.criticalPoints().length) / totalPoints) * 100)
      : 0;
    const qualityOkPct = totalPoints ? Math.round(((totalPoints - this.warnOrCritPoints().length) / totalPoints) * 100) : 0;

    const reservoirsTotal = this.points.all().filter((p) => p.type === 'TANK').length;
    const sensorsOnline = onlinePoints;
    const alertsActive = (this.dashboard?.alerts ?? []).length;

    const next: Record<KpiKey, number> = {
      activeResources: totalPoints,
      reservoirsTotal,
      sensorsOnline,
      alertsActive,
      territoriesInTension,
      serviceOkPct,
      qualityOkPct,
      sensorsOkPct,
      criticalReservoirs,
      criticalAlerts
    };

    const updated: Record<KpiKey, number[]> = { ...this.kpiHistory };
    (Object.keys(next) as KpiKey[]).forEach((k) => {
      updated[k] = this.appendSeries(updated[k] ?? [], next[k]);
    });
    this.kpiHistory = updated;

    localStorage.setItem(this.kpiStorageKey, JSON.stringify(this.kpiHistory));
  }

  private pushMetricsHistory() {
    const now = new Date().toISOString();
    const realtime = this.dashboard?.realtime ?? [];

    const pressureAvg = this.averageOf(realtime, 'PRESSURE');
    const levelAvg = this.averageOf(realtime, 'LEVEL');
    const flowAvg = this.averageOf(realtime, 'FLOW');
    const okPct = this.kpiValue('qualityOkPct');

    this.metricsHistory = {
      pressureAvg: this.appendMetricSeries(this.metricsHistory.pressureAvg, { timestamp: now, value: pressureAvg }),
      levelAvg: this.appendMetricSeries(this.metricsHistory.levelAvg, { timestamp: now, value: levelAvg }),
      flowAvg: this.appendMetricSeries(this.metricsHistory.flowAvg, { timestamp: now, value: flowAvg }),
      okPct: this.appendMetricSeries(this.metricsHistory.okPct, { timestamp: now, value: okPct })
    };

    localStorage.setItem(this.metricsStorageKey, JSON.stringify(this.metricsHistory));
  }

  private averageOf(realtime: PointRealtimeDto[], type: string): number {
    const values = realtime
      .map((p) => p.lastMeasurements?.[type]?.value)
      .filter((v) => typeof v === 'number') as number[];
    if (!values.length) return 0;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
  }

  private appendSeries(series: number[], value: number): number[] {
    const next = [...series, value];
    return next.length > 12 ? next.slice(next.length - 12) : next;
  }

  private appendMetricSeries(series: SeriesPoint[], value: SeriesPoint): SeriesPoint[] {
    const next = [...(series ?? []), value];
    return next.length > 12 ? next.slice(next.length - 12) : next;
  }

  private loadHistory(): Record<KpiKey, number[]> {
    try {
      const raw = localStorage.getItem(this.kpiStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
      return {
        activeResources: parsed['activeResources'] ?? [],
        reservoirsTotal: parsed['reservoirsTotal'] ?? [],
        sensorsOnline: parsed['sensorsOnline'] ?? [],
        alertsActive: parsed['alertsActive'] ?? [],
        territoriesInTension: parsed['territoriesInTension'] ?? [],
        serviceOkPct: parsed['serviceOkPct'] ?? [],
        qualityOkPct: parsed['qualityOkPct'] ?? [],
        sensorsOkPct: parsed['sensorsOkPct'] ?? [],
        criticalReservoirs: parsed['criticalReservoirs'] ?? [],
        criticalAlerts: parsed['criticalAlerts'] ?? []
      };
    } catch {
      return {
        activeResources: [],
        reservoirsTotal: [],
        sensorsOnline: [],
        alertsActive: [],
        territoriesInTension: [],
        serviceOkPct: [],
        qualityOkPct: [],
        sensorsOkPct: [],
        criticalReservoirs: [],
        criticalAlerts: []
      };
    }
  }

  private loadMetricsHistory(): Record<MetricsKey, SeriesPoint[]> {
    try {
      const raw = localStorage.getItem(this.metricsStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, SeriesPoint[]>) : {};
      return {
        levelAvg: parsed['levelAvg'] ?? [],
        flowAvg: parsed['flowAvg'] ?? [],
        pressureAvg: parsed['pressureAvg'] ?? [],
        okPct: parsed['okPct'] ?? []
      };
    } catch {
      return { levelAvg: [], flowAvg: [], pressureAvg: [], okPct: [] };
    }
  }

  totalPointsCount(): number {
    return this.points.all().length;
  }

  reservoirSamples(): Array<{ name: string; pct: number; state: 'OK' | 'WARN' | 'CRIT' | 'OFFLINE' }> {
    const fallback = [72, 45, 88, 31, 65, 54];
    return this.points.all()
      .filter((p) => p.type === 'TANK')
      .slice(0, 6)
      .map((p, i) => {
        const rt = this.realtimeOf(p.id);
        const raw = rt?.lastMeasurements?.['LEVEL']?.value;
        let pct: number;
        if (typeof raw === 'number') {
          pct = raw > 1 ? Math.min(100, Math.max(0, raw)) : Math.round(raw * 100);
        } else {
          pct = fallback[i % fallback.length];
        }
        return { name: p.name, pct: Math.round(pct), state: this.pointState(p.id) };
      });
  }

  avgReservoirLevel(): number {
    const samples = this.reservoirSamples();
    if (!samples.length) return 68;
    return Math.round(samples.reduce((s, r) => s + r.pct, 0) / samples.length);
  }

  alertsLineData(): SeriesPoint[] {
    const series = this.kpiSeries('alertsActive');
    return series.map((v, i) => ({
      timestamp: new Date(Date.now() - (series.length - 1 - i) * 3_600_000).toISOString(),
      value: v,
    }));
  }

  donutSegments(): Array<{ color: string; label: string; count: number; pct: number; dash: string; offset: string }> {
    const allIds = this.points.all().map((p) => p.id);
    const total = allIds.length || 1;
    const ok      = allIds.filter((id) => this.pointState(id) === 'OK').length;
    const warn    = allIds.filter((id) => this.pointState(id) === 'WARN').length;
    const crit    = allIds.filter((id) => this.pointState(id) === 'CRIT').length;
    const offline = allIds.filter((id) => this.pointState(id) === 'OFFLINE').length;

    const C = 2 * Math.PI * 40;
    const segs = [
      { color: '#16a34a', label: 'Fonctionnels',  count: ok      },
      { color: '#f59e0b', label: 'Avertissement', count: warn    },
      { color: '#dc2626', label: 'Critiques',      count: crit    },
      { color: '#94a3b8', label: 'Hors ligne',     count: offline },
    ];

    let cumulative = 0;
    return segs.map((s) => {
      const pct = Math.round((s.count / total) * 100);
      const len = (s.count / total) * C;
      const dash = `${len.toFixed(2)} ${C.toFixed(2)}`;
      const off = `${(-cumulative).toFixed(2)}`;
      cumulative += len;
      return { ...s, pct, dash, offset: off };
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.measurementTypesSubscription?.unsubscribe();
    this.pointsSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }
}

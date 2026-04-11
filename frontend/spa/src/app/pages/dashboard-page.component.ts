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
  | 'criticalReservoirs'
  | 'criticalAlerts'
  | 'sensorsOkPct'
  | 'serviceOkPct'
  | 'qualityOkPct'
  | 'territoriesInTension';

type SeriesPoint = { timestamp: string; value: number };
type MetricsKey = 'levelAvg' | 'flowAvg' | 'pressureAvg' | 'okPct';

type FeedItem = { kind: 'alarm' | 'incident' | 'update' | 'info'; label: string; age: string };

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

              <section class="admin-kpi-grid">
                <div class="admin-kpi admin-kpi--blue">
                  <div class="admin-kpi__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div class="admin-kpi__meta">
                    <div class="admin-kpi__value">{{ kpiValue('activeResources') }}</div>
                    <div class="admin-kpi__label">{{ 'dashboard.admin.kpi.activeResources' | t }}</div>
                  </div>
                </div>

                <div class="admin-kpi admin-kpi--red">
                  <div class="admin-kpi__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 12h16v8H4v-8Zm2-8h12l2 6H4l2-6Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div class="admin-kpi__meta">
                    <div class="admin-kpi__value">{{ kpiValue('criticalReservoirs') }}</div>
                    <div class="admin-kpi__label">{{ 'dashboard.admin.kpi.criticalReservoirs' | t }}</div>
                  </div>
                </div>

                <div class="admin-kpi admin-kpi--red">
                  <div class="admin-kpi__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div class="admin-kpi__meta">
                    <div class="admin-kpi__value">{{ kpiValue('criticalAlerts') }}</div>
                    <div class="admin-kpi__label">{{ 'dashboard.admin.kpi.criticalAlerts' | t }}</div>
                  </div>
                </div>

                <div class="admin-kpi admin-kpi--green">
                  <div class="admin-kpi__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2a7 7 0 0 0-7 7v3l-2 2v1h18v-1l-2-2V9a7 7 0 0 0-7-7Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div class="admin-kpi__meta">
                    <div class="admin-kpi__value">{{ kpiValue('sensorsOkPct') }}%</div>
                    <div class="admin-kpi__label">{{ 'dashboard.admin.kpi.sensorsOk' | t }}</div>
                  </div>
                </div>

                <div class="admin-kpi admin-kpi--green">
                  <div class="admin-kpi__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 4h14v4H5V4Zm0 6h14v10H5V10Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div class="admin-kpi__meta">
                    <div class="admin-kpi__value">{{ kpiValue('qualityOkPct') }}%</div>
                    <div class="admin-kpi__label">{{ 'dashboard.admin.kpi.qualityOk' | t }}</div>
                  </div>
                </div>

                <div class="admin-kpi admin-kpi--blue">
                  <div class="admin-kpi__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 7h18v2H3V7Zm0 4h18v2H3v-2Zm0 4h18v2H3v-2Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div class="admin-kpi__meta">
                    <div class="admin-kpi__value">{{ kpiValue('serviceOkPct') }}%</div>
                    <div class="admin-kpi__label">{{ 'dashboard.admin.kpi.serviceOk' | t }}</div>
                  </div>
                </div>

                <div class="admin-kpi admin-kpi--orange">
                  <div class="admin-kpi__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 14a2 2 0 1 1 2-2 2 2 0 0 1-2 2Zm1-6h-2V6h2v4Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div class="admin-kpi__meta">
                    <div class="admin-kpi__value">{{ kpiValue('territoriesInTension') }}</div>
                    <div class="admin-kpi__label">{{ 'dashboard.admin.kpi.territories' | t }}</div>
                  </div>
                </div>
              </section>

              <section class="admin-dash__main">
                <section class="card admin-map">
                  <div class="admin-map__head">
                    <div>
                      <h3 style="margin: 0">{{ 'dashboard.admin.map.title' | t }}</h3>
                      <div class="muted" style="margin-top: 0.25rem">{{ 'dashboard.admin.map.subtitle' | t }}</div>
                      <div class="admin-map__legend" style="margin-top: 0.55rem">
                        <span class="legend-item"><span class="legend-swatch legend-swatch--ok"></span>{{ 'pointState.OK' | t }}</span>
                        <span class="legend-item"><span class="legend-swatch legend-swatch--warn"></span>{{ 'pointState.WARN' | t }}</span>
                        <span class="legend-item"><span class="legend-swatch legend-swatch--crit"></span>{{ 'pointState.CRIT' | t }}</span>
                        <span class="legend-item"><span class="legend-swatch legend-swatch--offline"></span>{{ 'pointState.OFFLINE' | t }}</span>
                      </div>
                    </div>

                    <label class="admin-map__metric">
                      <span class="muted">{{ 'dashboard.admin.map.metric' | t }}</span>
                      <select [(ngModel)]="mapMetric">
                        <option *ngFor="let t of measurementTypeList" [value]="t.code">{{ typeLabel(t.code) }}</option>
                      </select>
                    </label>

                    <label class="admin-map__metric">
                      <span class="muted">{{ 'dashboard.admin.map.territory' | t }}</span>
                      <select
                        [ngModel]="territoryFilter"
                        (ngModelChange)="territoryFilter = $any($event); onFiltersChanged()"
                      >
                        <option value="">{{ 'common.none' | t }}</option>
                        <option *ngFor="let t of territories()" [value]="t">{{ t }}</option>
                      </select>
                    </label>
                  </div>

                  <div class="admin-map__grid">
                    <app-leaflet-map
                      [markers]="mapMarkers()"
                      [selectedMarkerId]="selectedPointId"
                      [resetViewKey]="territoryFilter"
                      (markerSelect)="selectedPointId = $event"
                    ></app-leaflet-map>
                  </div>
                </section>

                <aside class="card admin-alerts">
                  <div class="admin-alerts__head">
                    <h3 style="margin: 0">{{ 'dashboard.admin.critical.title' | t }}</h3>
                    <div class="muted">{{ 'dashboard.admin.critical.subtitle' | t }}</div>
                  </div>

                  <div class="admin-alerts__block">
                    <div class="admin-alerts__block-title">{{ 'dashboard.admin.critical.territories' | t }}</div>
                    <div class="admin-alerts__list" *ngIf="territoriesAtRiskWithCounts().length; else emptyCritPoints">
                      <a
                        class="admin-alerts__item"
                        *ngFor="let t of territoriesAtRiskWithCounts().slice(0, 6)"
                        href="#"
                        (click)="$event.preventDefault(); territoryFilter = t.territory; onFiltersChanged()"
                      >
                        <span
                          class="pill"
                          [class.pill--crit]="t.state === 'CRIT'"
                          [class.pill--warn]="t.state === 'WARN'"
                          [class.pill--offline]="t.state === 'OFFLINE'"
                          >{{ territoryIcon(t.state) }}</span
                        >
                        <span>{{ t.territory }} ({{ t.crit }})</span>
                      </a>
                    </div>
                    <ng-template #emptyCritPoints>
                      <div class="muted">{{ 'dashboard.admin.critical.none' | t }}</div>
                    </ng-template>
                  </div>

                  <div class="admin-alerts__block">
                    <div class="admin-alerts__block-title">{{ 'dashboard.admin.critical.resources' | t }}</div>
                    <div class="admin-alerts__list" *ngIf="criticalResources().length; else emptyCritRes">
                      <a
                        class="admin-alerts__item"
                        *ngFor="let id of criticalResources().slice(0, 6)"
                        [routerLink]="['/points', id]"
                      >
                        <span class="pill pill--warn">!</span>
                        <span>{{ pointLabel(id) }}</span>
                      </a>
                    </div>
                    <ng-template #emptyCritRes>
                      <div class="muted">{{ 'dashboard.admin.critical.none' | t }}</div>
                    </ng-template>
                  </div>

                  <div class="admin-alerts__block">
                    <div class="admin-alerts__block-title">{{ 'dashboard.admin.critical.incidents' | t }}</div>
                    <div class="admin-alerts__list" *ngIf="openTickets().length; else emptyTickets">
                      <a class="admin-alerts__item" *ngFor="let t of openTickets().slice(0, 6)" routerLink="/tickets">
                        <span class="pill pill--info">•</span>
                        <span>#{{ t.id }} — {{ ticketStatusLabel(t.status) }}</span>
                      </a>
                    </div>
                    <ng-template #emptyTickets>
                      <div class="muted">{{ 'tickets.none' | t }}</div>
                    </ng-template>
                  </div>

                  <div class="actions" style="margin-top: 0.75rem">
                    <a class="btn btn--secondary" routerLink="/alerts">{{ 'dashboard.openAlerts' | t }}</a>
                    <a class="btn btn--secondary" routerLink="/tickets">{{ 'dashboard.openTickets' | t }}</a>
                  </div>
                </aside>
              </section>

              <section class="admin-lower-grid">
                <div class="admin-lower-left">
                  <section class="card admin-panel">
                    <div class="admin-panel__title">{{ 'dashboard.admin.resources.title' | t }}</div>
                    <div class="admin-panel__body">
                      <div class="admin-charts admin-charts--split">
                        <app-line-chart
                          [values]="metricSeries('levelAvg')"
                          [title]="('dashboard.admin.resources.level' | t)"
                          [subtitle]="('dashboard.admin.resources.period' | t)"
                        />
                        <app-line-chart
                          [values]="metricSeries('flowAvg')"
                          [title]="('dashboard.admin.resources.flow' | t)"
                          [subtitle]="('dashboard.admin.resources.period' | t)"
                        />
                      </div>

                      <div class="admin-feed" *ngIf="resourceFeed().length">
                        <div class="admin-feed__item" *ngFor="let e of resourceFeed()">
                          <span class="admin-feed__dot" [class.admin-feed__dot--crit]="e.kind === 'alarm'" [class.admin-feed__dot--warn]="e.kind === 'incident'" [class.admin-feed__dot--ok]="e.kind === 'update'"></span>
                          <span class="admin-feed__text">{{ e.label }}</span>
                          <span class="admin-feed__age">{{ e.age }}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section class="card admin-panel">
                    <div class="admin-panel__title">{{ 'dashboard.admin.infrastructure.title' | t }}</div>
                    <div class="admin-panel__body">
                      <div class="admin-stat-grid">
                        <div class="admin-stat">
                          <div class="admin-stat__k">{{ 'dashboard.admin.infrastructure.totalReservoirs' | t }}</div>
                          <div class="admin-stat__v">{{ countPointsByType('TANK') }}</div>
                        </div>
                        <div class="admin-stat">
                          <div class="admin-stat__k">{{ 'dashboard.admin.infrastructure.critical' | t }}</div>
                          <div class="admin-stat__v">{{ criticalPoints().length }}</div>
                        </div>
                        <div class="admin-stat">
                          <div class="admin-stat__k">{{ 'dashboard.admin.infrastructure.offline' | t }}</div>
                          <div class="admin-stat__v">{{ offlinePoints().length }}</div>
                        </div>
                        <div class="admin-stat">
                          <div class="admin-stat__k">{{ 'dashboard.admin.infrastructure.okPct' | t }}</div>
                          <div class="admin-stat__v">{{ kpiValue('serviceOkPct') }}%</div>
                        </div>
                      </div>

                      <div class="admin-activity" *ngIf="infraFeed().length">
                        <div class="admin-activity__title">{{ 'dashboard.admin.infrastructure.activity' | t }}</div>
                        <div class="admin-activity__item" *ngFor="let e of infraFeed()">
                          <span class="admin-feed__dot admin-feed__dot--info"></span>
                          <span class="admin-feed__text">{{ e.label }}</span>
                          <span class="admin-feed__age">{{ e.age }}</span>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div class="admin-lower-right">
                  <section class="card admin-panel">
                    <div class="admin-panel__title">{{ 'dashboard.admin.quality.title' | t }}</div>
                    <div class="admin-panel__body">
                      <div class="admin-stat-grid">
                        <div class="admin-stat">
                          <div class="admin-stat__k">{{ 'dashboard.admin.quality.conformity' | t }}</div>
                          <div class="admin-stat__v">{{ kpiValue('qualityOkPct') }}%</div>
                        </div>
                        <div class="admin-stat">
                          <div class="admin-stat__k">{{ 'dashboard.admin.quality.alerts' | t }}</div>
                          <div class="admin-stat__v">{{ (d.alerts?.length || 0) }}</div>
                        </div>
                        <div class="admin-stat">
                          <div class="admin-stat__k">{{ 'dashboard.admin.quality.pointsNonConforme' | t }}</div>
                          <div class="admin-stat__v">{{ warnOrCritPoints().length }}</div>
                        </div>
                      </div>

                      <div class="muted" style="margin-top: 0.5rem">{{ 'dashboard.admin.quality.note' | t }}</div>
                    </div>
                  </section>

                  <section class="card admin-panel">
                    <div class="admin-panel__title">{{ 'dashboard.admin.reports.title' | t }}</div>
                    <div class="admin-panel__body">
                      <div class="admin-reports">
                        <a class="admin-report" routerLink="/history">{{ 'dashboard.admin.reports.monthly' | t }}</a>
                        <a class="admin-report" routerLink="/history">{{ 'dashboard.admin.reports.review' | t }}</a>
                        <a class="admin-report" routerLink="/history">{{ 'dashboard.admin.reports.basin' | t }}</a>
                      </div>

                      <div class="actions" style="margin-top: 0.75rem">
                        <button class="btn btn--secondary" type="button" disabled>PDF</button>
                        <button class="btn btn--secondary" type="button" disabled>Excel</button>
                      </div>
                    </div>
                  </section>
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
    criticalReservoirs: [],
    criticalAlerts: [],
    sensorsOkPct: [],
    serviceOkPct: [],
    qualityOkPct: [],
    territoriesInTension: []
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

    const next: Record<KpiKey, number> = {
      activeResources: totalPoints,
      criticalReservoirs,
      criticalAlerts,
      sensorsOkPct,
      serviceOkPct,
      qualityOkPct,
      territoriesInTension
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
        criticalReservoirs: parsed['criticalReservoirs'] ?? [],
        criticalAlerts: parsed['criticalAlerts'] ?? [],
        sensorsOkPct: parsed['sensorsOkPct'] ?? [],
        serviceOkPct: parsed['serviceOkPct'] ?? [],
        qualityOkPct: parsed['qualityOkPct'] ?? [],
        territoriesInTension: parsed['territoriesInTension'] ?? []
      };
    } catch {
      return {
        activeResources: [],
        criticalReservoirs: [],
        criticalAlerts: [],
        sensorsOkPct: [],
        serviceOkPct: [],
        qualityOkPct: [],
        territoriesInTension: []
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

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.measurementTypesSubscription?.unsubscribe();
    this.pointsSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }
}

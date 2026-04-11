import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BffApiService } from '../api/bff-api.service';
import { SparklineComponent } from '../ui/sparkline.component';
import { OnDestroy } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ToastService } from '../ui/toast.service';
import { I18nService } from '../i18n/i18n.service';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../profile.service';
import { PointsService } from '../points.service';
import { RefreshService } from '../refresh.service';
import { Subscription } from 'rxjs';
import { CodeItemDto, MeasurementTypesService } from '../measurement-types.service';

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

type DashboardDto = {
  realtime?: any[];
  alerts?: AlertDto[];
  tickets?: TicketDto[];
  processDefinitions?: any[];
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SparklineComponent,
    TranslatePipe
  ],
  template: `
    <h2>{{ 'nav.dashboard' | t }}</h2>

    <section class="grid-1" *ngIf="dashboard">
        <section class="kpi-grid">
          <div class="kpi">
            <div class="kpi-top">
              <div class="kpi-label">{{ 'dashboard.kpi.activeAlerts' | t }}</div>
              <span class="kpi-delta" [class.kpi-delta--up]="kpiDelta('alerts') > 0" [class.kpi-delta--down]="kpiDelta('alerts') < 0">
                {{ kpiDeltaLabel('alerts') }}
              </span>
            </div>
            <div class="kpi-value">{{ dashboard.alerts?.length || 0 }}</div>
            <app-sparkline [values]="kpiSeries('alerts')" />
            <div class="kpi-sub">{{ 'dashboard.kpi.activeAlerts' | t }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-top">
              <div class="kpi-label">{{ 'dashboard.kpi.tickets' | t }}</div>
              <span class="kpi-delta" [class.kpi-delta--up]="kpiDelta('tickets') > 0" [class.kpi-delta--down]="kpiDelta('tickets') < 0">
                {{ kpiDeltaLabel('tickets') }}
              </span>
            </div>
            <div class="kpi-value">{{ dashboard.tickets?.length || 0 }}</div>
            <app-sparkline [values]="kpiSeries('tickets')" />
            <div class="kpi-sub">{{ 'dashboard.kpi.tickets' | t }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-top">
              <div class="kpi-label">{{ 'dashboard.kpi.processDeployed' | t }}</div>
              <span class="kpi-delta" [class.kpi-delta--up]="kpiDelta('process') > 0" [class.kpi-delta--down]="kpiDelta('process') < 0">
                {{ kpiDeltaLabel('process') }}
              </span>
            </div>
            <div class="kpi-value">{{ dashboard.processDefinitions?.length || 0 }}</div>
            <app-sparkline [values]="kpiSeries('process')" />
            <div class="kpi-sub">{{ 'dashboard.kpi.processDeployed' | t }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-top">
              <div class="kpi-label">{{ 'dashboard.kpi.pointsRealtime' | t }}</div>
              <span class="kpi-delta" [class.kpi-delta--up]="kpiDelta('points') > 0" [class.kpi-delta--down]="kpiDelta('points') < 0">
                {{ kpiDeltaLabel('points') }}
              </span>
            </div>
            <div class="kpi-value">{{ dashboard.realtime?.length || 0 }}</div>
            <app-sparkline [values]="kpiSeries('points')" />
            <div class="kpi-sub">{{ 'dashboard.kpi.pointsRealtime' | t }}</div>
          </div>
        </section>

        <section class="card">
          <h3>{{ 'dashboard.quickActions' | t }}</h3>
          <div class="actions">
            <a class="btn" routerLink="/alerts">{{ 'dashboard.openAlerts' | t }}</a>
            <a class="btn" routerLink="/tickets">{{ 'dashboard.openTickets' | t }}</a>
            <a class="btn btn--secondary" routerLink="/points">{{ 'dashboard.openNetwork' | t }}</a>
          </div>

          <div class="row" style="margin-top: 0.75rem">
            <label>
              {{ 'profile.technicianName' | t }}
              <input [(ngModel)]="technician" (ngModelChange)="saveTechnician()" />
            </label>
          </div>
        </section>

        <details class="card" style="overflow: hidden">
          <summary class="muted" style="cursor: pointer; font-weight: 900">
            {{ 'dashboard.tools' | t }} — {{ 'dashboard.tools.simulation' | t }}
          </summary>

          <div style="padding-top: 0.75rem">
            <h3 style="margin-top: 0">{{ 'dashboard.simulate.title' | t }}</h3>
            <div class="row">
              <label>
                {{ 'dashboard.simulate.point' | t }}
                <select [(ngModel)]="form.pointId">
                  <option *ngFor="let p of pointList" [ngValue]="p.id">{{ p.name }}</option>
                </select>
              </label>
              <label>
                {{ 'dashboard.simulate.sensor' | t }}
                <input [(ngModel)]="form.sensorId" />
              </label>
              <label>
                {{ 'dashboard.simulate.type' | t }}
                <select [(ngModel)]="form.type">
                  <option *ngFor="let t of measurementTypeList" [value]="t.code">{{ typeLabel(t.code) }}</option>
                </select>
              </label>
              <label>
                {{ 'dashboard.simulate.value' | t }}
                <input type="number" [(ngModel)]="form.value" />
              </label>
              <label>
                {{ 'dashboard.simulate.unit' | t }}
                <input [(ngModel)]="form.unit" />
              </label>
            </div>
            <div class="actions">
              <button class="btn" (click)="send()">{{ 'common.send' | t }}</button>
            </div>

            <div *ngIf="lastIngest" class="result" style="margin-top: 0.75rem">
              <strong>{{ 'dashboard.simulate.ingested' | t }}:</strong>
              <pre>{{ lastIngest | json }}</pre>
            </div>
          </div>
        </details>

        <section class="card">
          <h3>{{ 'dashboard.alerts.title' | t }}</h3>

          <div class="alert-cards" *ngIf="dashboard.alerts?.length">
            <div class="alert-card" *ngFor="let a of (dashboard.alerts || []).slice(0, 3)">
              <div class="alert-card-head">
                <div>
                  <div class="alert-card-title">{{ pointLabel(a.pointId) }}</div>
                  <div class="muted"><code>{{ a.pointId }}</code></div>
                </div>
                <span
                  class="badge"
                  [class.badge--crit]="a.severity === 'CRIT'"
                  [class.badge--warn]="a.severity === 'WARN'"
                  [class.badge--ok]="a.severity === 'INFO'"
                  >{{ ('severity.' + a.severity) | t }}</span
                >
              </div>

              <div class="muted" style="margin-top: 0.35rem">{{ typeLabel(a.type) }}</div>
              <div style="margin-top: 0.35rem">{{ a.message }}</div>

              <div class="actions" style="margin-top: 0.65rem">
                <a class="btn btn--secondary" [routerLink]="['/points', a.pointId]">{{ 'dashboard.alerts.openPoint' | t }}</a>
                <button class="btn" (click)="treatAlert(a)">{{ 'dashboard.alerts.treat' | t }}</button>
              </div>
            </div>
          </div>

          <div class="actions" style="margin-top: 0.75rem" *ngIf="(dashboard.alerts?.length || 0) > 3">
            <a class="btn btn--secondary" routerLink="/alerts">{{ 'dashboard.openAlerts' | t }}</a>
          </div>

          <p class="muted" *ngIf="!dashboard.alerts?.length">{{ 'alerts.noneActive' | t }}</p>
        </section>
    </section>
  `,
  styles: []
})
export class DashboardPageComponent implements OnDestroy {
  dashboard?: DashboardDto;
  lastIngest: any;

  private readonly kpiStorageKey = 'gestidlo.kpiHistory.v1';
  private kpiHistory: Record<'alerts' | 'tickets' | 'process' | 'points', number[]> = {
    alerts: [],
    tickets: [],
    process: [],
    points: []
  };

  pointList: Array<{ id: string; name: string }> = [];
  measurementTypeList: CodeItemDto[] = [];

  private refreshSubscription?: Subscription;
  private measurementTypesSubscription?: Subscription;
  private pointsSubscription?: Subscription;

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
    private readonly refresh: RefreshService
  ) {
    this.technician = this.profile.getTechnicianName();

    this.points.ensureLoaded().subscribe();
    this.pointsSubscription = this.points.stream().subscribe((points) => {
      this.pointList = (points ?? []).filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }));
      if (!this.pointList.some((p) => p.id === this.form.pointId) && this.pointList.length > 0) {
        this.form.pointId = this.pointList[0].id;
      }
    });

    this.kpiHistory = this.loadHistory();

    this.measurementTypes.ensureLoaded().subscribe();
    this.measurementTypesSubscription = this.measurementTypes.stream().subscribe((types) => {
      this.measurementTypeList = (types ?? []).filter((t) => t.active);
      if (!this.measurementTypeList.some((t) => t.code === this.form.type) && this.measurementTypeList.length > 0) {
        this.form.type = this.measurementTypeList[0].code;
      }
    });

    this.reload();

    this.refreshSubscription = this.refresh.refresh$.subscribe((e) => {
      this.reload(e.reason === 'manual');
    });
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
        this.pushHistory();
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

  kpiSeries(key: 'alerts' | 'tickets' | 'process' | 'points'): number[] {
    return this.kpiHistory[key];
  }

  kpiDelta(key: 'alerts' | 'tickets' | 'process' | 'points'): number {
    const series = this.kpiSeries(key);
    if (series.length < 2) {
      return 0;
    }
    return series[series.length - 1] - series[series.length - 2];
  }

  kpiDeltaLabel(key: 'alerts' | 'tickets' | 'process' | 'points'): string {
    const delta = this.kpiDelta(key);
    if (delta === 0) {
      return '—';
    }
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  private pushHistory() {
    const alerts = this.dashboard?.alerts?.length ?? 0;
    const tickets = this.dashboard?.tickets?.length ?? 0;
    const process = this.dashboard?.processDefinitions?.length ?? 0;
    const points = this.dashboard?.realtime?.length ?? 0;

    this.kpiHistory = {
      alerts: this.appendSeries(this.kpiHistory['alerts'], alerts),
      tickets: this.appendSeries(this.kpiHistory['tickets'], tickets),
      process: this.appendSeries(this.kpiHistory['process'], process),
      points: this.appendSeries(this.kpiHistory['points'], points)
    };

    localStorage.setItem(this.kpiStorageKey, JSON.stringify(this.kpiHistory));
  }

  private appendSeries(series: number[], value: number): number[] {
    const next = [...series, value];
    return next.length > 12 ? next.slice(next.length - 12) : next;
  }

  private loadHistory(): Record<'alerts' | 'tickets' | 'process' | 'points', number[]> {
    try {
      const raw = localStorage.getItem(this.kpiStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
      return {
        alerts: parsed['alerts'] ?? [],
        tickets: parsed['tickets'] ?? [],
        process: parsed['process'] ?? [],
        points: parsed['points'] ?? []
      };
    } catch {
      return { alerts: [], tickets: [], process: [], points: [] };
    }
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.measurementTypesSubscription?.unsubscribe();
    this.pointsSubscription?.unsubscribe();
  }
}

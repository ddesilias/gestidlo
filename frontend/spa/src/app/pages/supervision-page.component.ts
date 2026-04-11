import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BffApiService } from '../api/bff-api.service';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { PointsService } from '../points.service';
import { ProfileService } from '../profile.service';
import { RefreshService } from '../refresh.service';
import { ToastService } from '../ui/toast.service';
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

type MeasurementSampleDto = { value: number; unit: string; timestamp: string };

type PointRealtimeDto = {
  pointId: string;
  lastMeasurements: Record<string, MeasurementSampleDto | undefined>;
};

type DashboardDto = {
  realtime?: PointRealtimeDto[];
  alerts?: AlertDto[];
};

@Component({
  selector: 'app-supervision-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <h2>{{ 'nav.supervision' | t }}</h2>

    <section class="card" *ngIf="dashboard">
      <div class="row">
        <label>
          {{ 'profile.technicianName' | t }}
          <input [(ngModel)]="technician" (ngModelChange)="saveTechnician()" />
        </label>
      </div>
    </section>

    <section class="kpi-grid" *ngIf="dashboard">
      <div class="kpi">
        <div class="kpi-top">
          <div class="kpi-label">{{ 'dashboard.kpi.activeAlerts' | t }}</div>
        </div>
        <div class="kpi-value">{{ dashboard.alerts?.length || 0 }}</div>
        <div class="kpi-sub">{{ 'dashboard.kpi.activeAlerts' | t }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-top">
          <div class="kpi-label">{{ 'dashboard.kpi.pointsRealtime' | t }}</div>
        </div>
        <div class="kpi-value">{{ (dashboard.realtime?.length || 0) }}</div>
        <div class="kpi-sub">{{ 'dashboard.kpi.pointsRealtime' | t }}</div>
      </div>
    </section>

    <section class="scada-grid" *ngIf="dashboard">
      <div
        class="scada-card"
        *ngFor="let p of sortedPoints()"
        [class.scada-card--crit]="pointSeverity(p.pointId) === 'CRIT'"
        [class.scada-card--warn]="pointSeverity(p.pointId) === 'WARN'"
        [class.scada-card--ok]="pointSeverity(p.pointId) === 'OK'"
        [class.scada-card--offline]="isOffline(p)"
      >
        <div class="scada-head">
          <div>
            <div class="scada-title">{{ pointLabel(p.pointId) }}</div>
            <div class="muted"><code>{{ p.pointId }}</code></div>
          </div>
          <span class="badge" [class.badge--crit]="pointSeverity(p.pointId) === 'CRIT'" [class.badge--warn]="pointSeverity(p.pointId) === 'WARN'" [class.badge--ok]="pointSeverity(p.pointId) === 'OK'">
            {{ ('pointState.' + pointSeverity(p.pointId)) | t }}
          </span>
        </div>

        <div class="scada-kv">
          <div class="kv" *ngFor="let t of measurementTypeList">
            <div class="k">{{ typeLabel(t.code) }}</div>
            <div class="v" [class.v--crit]="t.code === 'PRESSURE' && pressureCrit(p)">
              {{ measurementLabel(p, t.code) }}
            </div>
          </div>
        </div>

        <div class="muted" style="margin-top: 0.5rem">
          {{ lastSeenLabel(p) }}
        </div>

        <div class="actions" style="margin-top: 0.75rem">
          <a class="btn btn--secondary" [routerLink]="['/points', p.pointId]">{{ 'points.open' | t }}</a>
          <button class="btn" (click)="treat(p.pointId)" [disabled]="!topAlertId(p.pointId)">
            {{ 'dashboard.alerts.treat' | t }}
          </button>
        </div>

        <div class="muted" style="margin-top: 0.4rem" *ngIf="topAlert(p.pointId) as a">
          {{ typeLabel(a.type) }} — {{ a.message }}
        </div>
      </div>
    </section>

    <div class="empty-state" *ngIf="dashboard && !(dashboard.realtime?.length)">
      <div>
        <div class="empty-title">{{ 'dashboard.noPoints' | t }}</div>
        <div class="muted">{{ 'empty.tip.simulation' | t }}</div>
      </div>
      <a class="btn btn--secondary" routerLink="/dashboard">{{ 'empty.openDashboard' | t }}</a>
    </div>
  `
})
export class SupervisionPageComponent implements OnDestroy {
  dashboard?: DashboardDto;

  measurementTypeList: CodeItemDto[] = [];

  technician = 'tech';

  private refreshSubscription?: Subscription;
  private measurementTypesSubscription?: Subscription;

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

    this.measurementTypes.ensureLoaded().subscribe();
    this.measurementTypesSubscription = this.measurementTypes.stream().subscribe((types) => {
      this.measurementTypeList = (types ?? []).filter((t) => t.active);
    });

    this.reload();
    this.refreshSubscription = this.refresh.refresh$.subscribe((e) => this.reload(e.reason === 'manual'));
  }

  saveTechnician() {
    this.profile.setTechnicianName(this.technician);
  }

  reload(showErrorToast = false) {
    this.api.dashboard().subscribe({
      next: (d) => {
        this.dashboard = d as DashboardDto;
      },
      error: () => {
        if (showErrorToast) {
          this.toast.push('error', this.i18n.t('toast.failed'));
        }
      }
    });
  }

  sortedPoints(): PointRealtimeDto[] {
    const points = this.dashboard?.realtime ?? [];
    return [...points].sort((a, b) => {
      const ra = this.severityRank(this.pointSeverity(a.pointId));
      const rb = this.severityRank(this.pointSeverity(b.pointId));
      if (ra !== rb) return rb - ra;
      return a.pointId.localeCompare(b.pointId);
    });
  }

  private severityRank(s: 'CRIT' | 'WARN' | 'OK' | 'OFFLINE'): number {
    if (s === 'CRIT') return 3;
    if (s === 'WARN') return 2;
    if (s === 'OK') return 1;
    return 0;
  }

  pointLabel(pointId: string): string {
    return this.points.label(pointId);
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

  topAlertId(pointId: string): number | null {
    return this.topAlert(pointId)?.id ?? null;
  }

  pointSeverity(pointId: string): 'CRIT' | 'WARN' | 'OK' | 'OFFLINE' {
    const p = (this.dashboard?.realtime ?? []).find((r) => r.pointId === pointId);
    if (!p || this.isOffline(p)) return 'OFFLINE';
    const a = this.topAlert(pointId);
    if (!a) return 'OK';
    return a.severity === 'CRIT' ? 'CRIT' : a.severity === 'WARN' ? 'WARN' : 'OK';
  }

  isOffline(p: PointRealtimeDto): boolean {
    return !this.lastSeen(p);
  }

  lastSeen(p: PointRealtimeDto): string | null {
    const candidates = Object.values(p.lastMeasurements ?? {})
      .map((m) => m?.timestamp)
      .filter(Boolean) as string[];
    if (!candidates.length) return null;
    candidates.sort();
    return candidates[candidates.length - 1];
  }

  lastSeenLabel(p: PointRealtimeDto): string {
    return this.lastSeen(p) ?? this.i18n.t('common.offline');
  }

  measurementLabel(p: PointRealtimeDto, type: string): string {
    const m = p.lastMeasurements[type];
    if (!m) return '-';
    return `${m.value} ${m.unit}`;
  }

  typeLabel(type: string): string {
    return this.measurementTypes.label(type);
  }

  pressureCrit(p: PointRealtimeDto): boolean {
    const v = p.lastMeasurements['PRESSURE']?.value;
    return typeof v === 'number' && v < 1.0;
  }

  treat(pointId: string) {
    const alertId = this.topAlertId(pointId);
    if (!alertId) return;
    this.api.createTicket(alertId, this.technician).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.ticketCreated'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.measurementTypesSubscription?.unsubscribe();
  }
}

import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../i18n/translate.pipe';
import { PointsService } from '../points.service';
import { BffApiService } from '../api/bff-api.service';
import { LineChartComponent } from '../ui/line-chart.component';
import { ToastService } from '../ui/toast.service';
import { I18nService } from '../i18n/i18n.service';
import { ProfileService } from '../profile.service';
import { RefreshService } from '../refresh.service';
import { Subscription } from 'rxjs';
import { MeasurementTypesService } from '../measurement-types.service';

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
  pointId?: string;
  assignee?: string;
  camundaProcessInstanceId?: string;
};

type RealtimePointDto = {
  pointId: string;
  lastMeasurements: Record<string, { value: number; unit: string; timestamp: string } | undefined>;
};

type HistoryRowDto = {
  timestamp: string;
  value: number;
  unit: string;
  sensorId: string;
};

@Component({
  selector: 'app-point-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslatePipe, LineChartComponent],
  template: `
    <div class="row" style="justify-content: space-between; align-items: center">
      <div>
        <h2>{{ pointName }}</h2>
        <div class="muted"><code>{{ pointId }}</code></div>
      </div>
      <a class="btn btn--secondary" routerLink="/points">{{ 'points.title' | t }}</a>
    </div>

    <section class="grid-2">
      <div>
        <section class="card">
          <h3>{{ 'dashboard.points.title' | t }}</h3>
          <div class="table-wrap" *ngIf="realtime">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'table.type' | t }}</th>
                  <th>{{ 'dashboard.simulate.value' | t }}</th>
                  <th>{{ 'dashboard.simulate.unit' | t }}</th>
                  <th>{{ 'table.timestamp' | t }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let key of measurementKeys">
                  <td>{{ typeLabel(key) }}</td>
                  <td style="font-weight: 900">{{ realtime.lastMeasurements[key]?.value ?? '-' }}</td>
                  <td>{{ realtime.lastMeasurements[key]?.unit ?? '' }}</td>
                  <td class="muted"><code>{{ realtime.lastMeasurements[key]?.timestamp ?? '' }}</code></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="muted" *ngIf="!realtime">{{ 'common.offline' | t }}</p>
        </section>

        <section class="card">
          <h3>{{ 'dashboard.trend.title' | t }}</h3>
          <div class="row">
            <label>
              {{ 'dashboard.window' | t }}
              <select [(ngModel)]="trendHours" (ngModelChange)="loadTrend()">
                <option [ngValue]="1">1h</option>
                <option [ngValue]="6">6h</option>
                <option [ngValue]="24">24h</option>
              </select>
            </label>
          </div>
          <app-line-chart [values]="pressureTrend" title="Pression (bar)" [subtitle]="pointName + ' • ' + trendHours + 'h'" />
        </section>
      </div>

      <aside>
        <section class="panel panel--scada">
          <div class="panel-title">{{ 'alerts.title' | t }}</div>
          <div class="panel-body">
            <div class="table-wrap" *ngIf="alerts.length">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'table.severity' | t }}</th>
                    <th>{{ 'table.message' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let a of alerts">
                    <td>
                      <span
                        class="badge"
                        [class.badge--crit]="a.severity === 'CRIT'"
                        [class.badge--warn]="a.severity === 'WARN'"
                        [class.badge--ok]="a.severity === 'INFO'"
                        >{{ ('severity.' + a.severity) | t }}</span
                      >
                    </td>
                    <td>{{ a.message }}</td>
                    <td class="actions-cell">
                      <div class="actions actions--table">
                        <button class="btn" (click)="createTicket(a.id)">{{ 'alerts.createTicket' | t }}</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="muted" *ngIf="!alerts.length">{{ 'alerts.noneActive' | t }}</div>
          </div>
        </section>

        <section class="panel panel--scada">
          <div class="panel-title">{{ 'tickets.title' | t }}</div>
          <div class="panel-body">
            <div class="row">
              <label>
                {{ 'profile.technicianName' | t }}
                <input [(ngModel)]="technician" (ngModelChange)="saveTechnician()" />
              </label>
            </div>

            <div class="table-wrap" *ngIf="tickets.length">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'table.id' | t }}</th>
                    <th>{{ 'table.status' | t }}</th>
                    <th>{{ 'table.technician' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let t of tickets">
                    <td>{{ t.id }}</td>
                    <td>
                      <span class="badge" [class.badge--ok]="t.status === 'CLOSED'" [class.badge--warn]="t.status !== 'CLOSED'">
                        {{ ('status.' + t.status) | t }}
                      </span>
                    </td>
                    <td>{{ t.assignee || '-' }}</td>
                    <td class="actions-cell">
                      <div class="actions actions--table">
                        <button class="btn btn--secondary" (click)="assign(t.id)">{{ 'tickets.takeOver' | t }}</button>
                        <button class="btn" [disabled]="t.status === 'CLOSED'" (click)="advance(t.id)">
                          {{ actionLabel(t.status) | t }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="muted" *ngIf="!tickets.length">{{ 'tickets.none' | t }}</div>
          </div>
        </section>
      </aside>
    </section>
  `
})
export class PointDetailsPageComponent implements OnDestroy {
  pointId = '';
  pointName = '';

  private refreshSubscription?: Subscription;
  private measurementTypesSubscription?: Subscription;
  private pointsSubscription?: Subscription;

  realtime?: RealtimePointDto;
  alerts: AlertDto[] = [];
  tickets: TicketDto[] = [];

  trendHours = 6;
  pressureTrend: Array<{ timestamp: string; value: number }> = [];

  technician = '';

  measurementKeys: string[] = [];

  constructor(
    route: ActivatedRoute,
    private readonly points: PointsService,
    private readonly api: BffApiService,
    private readonly toast: ToastService,
    private readonly i18n: I18nService,
    private readonly profile: ProfileService,
    private readonly measurementTypes: MeasurementTypesService,
    private readonly refresh: RefreshService
  ) {
    this.technician = this.profile.getTechnicianName();

    this.points.ensureLoaded().subscribe();
    this.pointsSubscription = this.points.stream().subscribe(() => {
      if (!this.pointId) {
        return;
      }
      this.pointName = this.points.label(this.pointId);
    });

    this.measurementTypes.ensureLoaded().subscribe();
    this.measurementTypesSubscription = this.measurementTypes.stream().subscribe((types) => {
      this.measurementKeys = (types ?? []).filter((t) => t.active).map((t) => t.code);
    });

    route.params.subscribe((p) => {
      this.pointId = p['id'];
      this.pointName = this.points.label(this.pointId);
      this.reload();
      this.loadTrend();
    });

    this.refreshSubscription = this.refresh.refresh$.subscribe((e) => {
      if (!this.pointId) {
        return;
      }
      const showErrorToast = e.reason === 'manual';
      this.reload(showErrorToast);
      this.loadTrend(showErrorToast);
    });
  }

  reload(showErrorToast = false) {
    let notified = false;
    const notify = () => {
      if (!showErrorToast || notified) {
        return;
      }
      notified = true;
      this.toast.push('error', this.i18n.t('toast.failed'));
    };

    this.api.realtimePoints([this.pointId]).subscribe({
      next: (rows: RealtimePointDto[]) => {
        this.realtime = rows[0];
      },
      error: () => notify()
    });

    this.api.alerts('ACTIVE').subscribe({
      next: (alerts: AlertDto[]) => {
        this.alerts = (alerts ?? []).filter((a) => a.pointId === this.pointId);
      },
      error: () => notify()
    });

    this.api.tickets().subscribe({
      next: (tickets: TicketDto[]) => {
        this.tickets = (tickets ?? []).filter((t) => t.pointId === this.pointId);
      },
      error: () => notify()
    });
  }

  loadTrend(showErrorToast = false) {
    const to = new Date();
    const from = new Date(to.getTime() - this.trendHours * 60 * 60 * 1000);
    this.api.history(this.pointId, 'PRESSURE', from.toISOString(), to.toISOString()).subscribe({
      next: (rows) => {
        const data = (rows as HistoryRowDto[])
          .filter((r) => typeof r.value === 'number')
          .map((r) => ({ timestamp: r.timestamp, value: r.value }));
        this.pressureTrend = data;
      },
      error: () => {
        if (showErrorToast) {
          this.toast.push('error', this.i18n.t('toast.failed'));
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.measurementTypesSubscription?.unsubscribe();
    this.pointsSubscription?.unsubscribe();
  }

  saveTechnician() {
    this.profile.setTechnicianName(this.technician);
  }

  createTicket(alertId: number) {
    this.api.createTicket(alertId, this.technician).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.ticketCreated'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  assign(ticketId: number) {
    this.api.assignTicket(ticketId, this.technician).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.ticketAdvanced'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  advance(ticketId: number) {
    this.api.advanceTicket(ticketId).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.ticketAdvanced'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  actionLabel(status: string): string {
    if (status === 'OPEN') return 'tickets.start';
    if (status === 'IN_PROGRESS') return 'tickets.close';
    return 'tickets.advance';
  }

  typeLabel(type: string): string {
    return this.measurementTypes.label(type);
  }
}

import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BffApiService } from '../api/bff-api.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ToastService } from '../ui/toast.service';
import { I18nService } from '../i18n/i18n.service';
import { PointsService } from '../points.service';
import { RouterLink } from '@angular/router';
import { RefreshService } from '../refresh.service';
import { Subscription } from 'rxjs';
import { MeasurementTypesService } from '../measurement-types.service';

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, RouterLink],
  template: `
    <h2>{{ 'alerts.title' | t }}</h2>

    <div class="row">
      <label>
        {{ 'alerts.assignee' | t }}
        <input [(ngModel)]="assignee" />
      </label>
    </div>

    <table class="table" *ngIf="alerts?.length">
      <thead>
        <tr>
          <th>{{ 'table.id' | t }}</th>
          <th>{{ 'table.point' | t }}</th>
          <th>{{ 'table.type' | t }}</th>
          <th>{{ 'table.severity' | t }}</th>
          <th>{{ 'table.status' | t }}</th>
          <th>{{ 'table.message' | t }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let a of alerts">
          <td>{{ a.id }}</td>
          <td>
            <a [routerLink]="['/points', a.pointId]" style="font-weight: 900; text-decoration: none">
              {{ pointLabel(a.pointId) }}
            </a>
            <div class="muted"><code>{{ a.pointId }}</code></div>
          </td>
          <td>{{ typeLabel(a.type) }}</td>
          <td>
            <span
              class="badge"
              [class.badge--crit]="a.severity === 'CRIT'"
              [class.badge--warn]="a.severity === 'WARN'"
              [class.badge--ok]="a.severity === 'INFO'"
              >{{ ('severity.' + a.severity) | t }}</span
            >
          </td>
          <td>{{ ('alertStatus.' + a.status) | t }}</td>
          <td>{{ a.message }}</td>
          <td class="actions-cell">
            <div class="actions actions--table">
              <button class="btn btn--secondary" (click)="ack(a.id)">{{ 'alerts.ack' | t }}</button>
              <button class="btn" (click)="createTicket(a.id)">{{ 'alerts.createTicket' | t }}</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="empty-state" *ngIf="alerts && alerts.length === 0">
      <div>
        <div class="empty-title">{{ 'alerts.noneActive' | t }}</div>
        <div class="muted">{{ 'empty.tip.simulation' | t }}</div>
      </div>
      <a class="btn btn--secondary" routerLink="/dashboard">{{ 'empty.openDashboard' | t }}</a>
    </div>
  `,
  styles: []
})
export class AlertsPageComponent implements OnDestroy {
  alerts: any[] = [];
  assignee = 'tech';

  private refreshSubscription?: Subscription;

  constructor(
    private readonly api: BffApiService,
    private readonly toast: ToastService,
    private readonly i18n: I18nService,
    private readonly points: PointsService,
    private readonly measurementTypes: MeasurementTypesService,
    private readonly refresh: RefreshService
  ) {
    this.measurementTypes.ensureLoaded().subscribe();
    this.reload();
    this.refreshSubscription = this.refresh.refresh$.subscribe((e) => this.reload(e.reason === 'manual'));
  }

  pointLabel(pointId: string): string {
    return this.points.label(pointId);
  }

  typeLabel(type: string): string {
    return this.measurementTypes.label(type);
  }

  reload(showErrorToast = false) {
    this.api.alerts('ACTIVE').subscribe({
      next: (a) => (this.alerts = a),
      error: () => {
        if (showErrorToast) {
          this.toast.push('error', this.i18n.t('toast.failed'));
        }
      }
    });
  }

  ack(id: number) {
    this.api.ackAlert(id).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.alertAck'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  createTicket(alertId: number) {
    this.api.createTicket(alertId, this.assignee).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.ticketCreated'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }
}

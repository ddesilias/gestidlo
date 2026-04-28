import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BffApiService } from '../api/bff-api.service';
import { I18nService } from '../i18n/i18n.service';
import { CodeItemDto, MeasurementTypesService } from '../measurement-types.service';
import { PointDefinition, PointsService } from '../points.service';
import { RefreshService } from '../refresh.service';
import { ToastService } from '../ui/toast.service';
import { LeafletMapComponent } from '../ui/leaflet-map.component';
import { GeoMarker } from '../ui/geojson-map.component';

type AlertDto = { id: number; pointId: string; type: string; severity: 'INFO' | 'WARN' | 'CRIT'; status: string; message: string; };
type MeasurementSampleDto = { value: number; unit: string; timestamp: string };
type PointRealtimeDto = { pointId: string; lastMeasurements: Record<string, MeasurementSampleDto | undefined>; };
type DashboardDto = { realtime?: PointRealtimeDto[]; alerts?: AlertDto[]; };

const _now = () => new Date(Date.now()).toISOString();
const _ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

const MOCK_POINTS: PointDefinition[] = [
  { id: 'PT-001', name: 'Réservoir Pétion-Ville',       type: 'TANK',   territory: 'Ouest',       lat: 18.5133, lon: -72.2839, active: true },
  { id: 'PT-002', name: 'Source Kenscoff',               type: 'SOURCE', territory: 'Ouest',       lat: 18.4811, lon: -72.2361, active: true },
  { id: 'PT-003', name: 'Station pompage Cap-Haïtien',   type: 'PUMP',   territory: 'Nord',        lat: 19.7573, lon: -72.2013, active: true },
  { id: 'PT-004', name: 'Réservoir Gonaïves',            type: 'TANK',   territory: 'Artibonite',  lat: 19.4500, lon: -72.6833, active: true },
  { id: 'PT-005', name: 'Capteur Les Cayes',             type: 'SENSOR', territory: 'Sud',         lat: 18.2000, lon: -73.7500, active: true },
  { id: 'PT-006', name: 'Source Jacmel',                 type: 'SOURCE', territory: 'Sud-Est',     lat: 18.2333, lon: -72.5333, active: true },
  { id: 'PT-007', name: 'Réservoir Jérémie',             type: 'TANK',   territory: "Grand'Anse",  lat: 18.6500, lon: -74.1167, active: true },
  { id: 'PT-008', name: 'Station pompage Saint-Marc',    type: 'PUMP',   territory: 'Artibonite',  lat: 19.1000, lon: -72.7000, active: true },
  { id: 'PT-009', name: 'Source Hinche',                 type: 'SOURCE', territory: 'Centre',      lat: 19.1500, lon: -72.0333, active: true },
  { id: 'PT-010', name: 'Capteur Fort-Liberté',          type: 'SENSOR', territory: 'Nord-Est',    lat: 19.6667, lon: -71.8333, active: true },
];

const MOCK_DASHBOARD: DashboardDto = {
  realtime: [
    { pointId: 'PT-001', lastMeasurements: { LEVEL: { value: 4.2, unit: 'm',   timestamp: _ago(5)  }, PRESSURE: { value: 2.8, unit: 'bar', timestamp: _ago(5)  }, FLOW: { value: 12.4, unit: 'L/s', timestamp: _ago(5)  } } },
    { pointId: 'PT-002', lastMeasurements: { LEVEL: { value: 1.1, unit: 'm',   timestamp: _ago(12) }, PRESSURE: { value: 1.5, unit: 'bar', timestamp: _ago(12) }, FLOW: { value: 15.3, unit: 'L/s', timestamp: _ago(12) } } },
    { pointId: 'PT-003', lastMeasurements: { LEVEL: { value: 2.9, unit: 'm',   timestamp: _ago(3)  }, PRESSURE: { value: 3.5, unit: 'bar', timestamp: _ago(3)  }, FLOW: { value: 32.7, unit: 'L/s', timestamp: _ago(3)  } } },
    { pointId: 'PT-004', lastMeasurements: { LEVEL: { value: 0.8, unit: 'm',   timestamp: _ago(25) }, PRESSURE: { value: 0.4, unit: 'bar', timestamp: _ago(25) }, FLOW: { value: 2.1,  unit: 'L/s', timestamp: _ago(25) } } },
    { pointId: 'PT-005', lastMeasurements: { LEVEL: { value: 3.6, unit: 'm',   timestamp: _ago(2)  }, PRESSURE: { value: 1.2, unit: 'bar', timestamp: _ago(2)  }, FLOW: { value: 9.8,  unit: 'L/s', timestamp: _ago(2)  } } },
    { pointId: 'PT-006', lastMeasurements: { LEVEL: { value: 2.1, unit: 'm',   timestamp: _ago(8)  }, PRESSURE: { value: 2.0, unit: 'bar', timestamp: _ago(8)  }, FLOW: { value: 8.4,  unit: 'L/s', timestamp: _ago(8)  } } },
    { pointId: 'PT-009', lastMeasurements: { LEVEL: { value: 5.0, unit: 'm',   timestamp: _now()   }, PRESSURE: { value: 3.1, unit: 'bar', timestamp: _now()   }, FLOW: { value: 20.0, unit: 'L/s', timestamp: _now()   } } },
    { pointId: 'PT-010', lastMeasurements: { LEVEL: { value: 1.8, unit: 'm',   timestamp: _ago(40) }, PRESSURE: { value: 1.9, unit: 'bar', timestamp: _ago(40) }, FLOW: { value: 6.5,  unit: 'L/s', timestamp: _ago(40) } } },
    // PT-007 et PT-008 intentionnellement hors ligne
  ],
  alerts: [
    { id: 1, pointId: 'PT-001', type: 'LEVEL_LOW',      severity: 'WARN', status: 'ACTIVE', message: 'Niveau bas détecté' },
    { id: 2, pointId: 'PT-004', type: 'LEVEL_CRITICAL', severity: 'CRIT', status: 'ACTIVE', message: 'Niveau critique — intervention requise' },
    { id: 3, pointId: 'PT-010', type: 'PRESSURE_LOW',   severity: 'WARN', status: 'ACTIVE', message: 'Pression en baisse' },
  ]
};

@Component({
  selector: 'app-supervision-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LeafletMapComponent],
  template: `
<div class="sv-page">

  <!-- ── TOPBAR ─────────────────────────────────────────────── -->
  <div class="sv-topbar">
    <div class="sv-search">
      <svg class="sv-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input class="sv-search__input" [(ngModel)]="searchQuery"
             placeholder="Rechercher un lieu, un ouvrage, une adresse..." />
    </div>

    <button class="sv-filter-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      Filtres avancés
      <span class="sv-filter-badge">3</span>
    </button>

    <button class="sv-refresh-btn" (click)="reload(true)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="17" height="17">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
        <path d="M8 16H3v5"/>
      </svg>
    </button>
  </div>

  <!-- ── KPI ROW ─────────────────────────────────────────────── -->
  <div class="sv-kpi-row">
    <div class="sv-kpi">
      <div class="sv-kpi__icon sv-kpi__icon--blue">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12Z" fill="currentColor"/></svg>
      </div>
      <div class="sv-kpi__body">
        <div class="sv-kpi__num sv-kpi__num--blue">{{ activePointsCount() }}</div>
        <div class="sv-kpi__label">Points d'eau actifs</div>
      </div>
    </div>

    <div class="sv-kpi">
      <div class="sv-kpi__icon sv-kpi__icon--green">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 12h16v8H4v-8Zm2-8h12l2 6H4l2-6Z" fill="currentColor"/></svg>
      </div>
      <div class="sv-kpi__body">
        <div class="sv-kpi__num sv-kpi__num--green">{{ reservoirsCount() }}</div>
        <div class="sv-kpi__label">Réservoirs surveillés</div>
      </div>
    </div>

    <div class="sv-kpi">
      <div class="sv-kpi__icon sv-kpi__icon--purple">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
        </svg>
      </div>
      <div class="sv-kpi__body">
        <div class="sv-kpi__num sv-kpi__num--purple">{{ sensorsCount() }}</div>
        <div class="sv-kpi__label">Capteurs connectés</div>
      </div>
    </div>

    <div class="sv-kpi">
      <div class="sv-kpi__icon sv-kpi__icon--red">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z" fill="currentColor"/></svg>
      </div>
      <div class="sv-kpi__body">
        <div class="sv-kpi__num sv-kpi__num--red">{{ alertsCount() }}</div>
        <div class="sv-kpi__label">Alertes actives</div>
      </div>
    </div>

    <div class="sv-kpi">
      <div class="sv-kpi__icon sv-kpi__icon--orange">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2 2 7l1.09 9.97A10 10 0 0 0 12 22a10 10 0 0 0 8.91-5.03L22 7Z"/>
        </svg>
      </div>
      <div class="sv-kpi__body">
        <div class="sv-kpi__num sv-kpi__num--orange">{{ deptAtRiskCount() }}</div>
        <div class="sv-kpi__label">Départements à risque</div>
      </div>
    </div>
  </div>

  <!-- ── CONTENT : MAP + DETAIL ─────────────────────────────── -->
  <div class="sv-content">

    <!-- MAP AREA -->
    <div class="sv-map-area">
      <app-leaflet-map
        [markers]="markers"
        [selectedMarkerId]="selectedPointId"
        (markerSelect)="onMarkerSelect($event)"
      ></app-leaflet-map>

      <!-- Couches panel -->
      <div class="sv-couches">
        <div class="sv-couches__header" (click)="couchesOpen = !couchesOpen">
          <span class="sv-couches__title">Couches</span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"
               [style.transform]="couchesOpen ? 'rotate(180deg)' : ''">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="sv-couches__body" *ngIf="couchesOpen">
          <label class="sv-layer" *ngFor="let l of layers">
            <input type="checkbox" [(ngModel)]="l.visible" class="sv-layer__check">
            <span class="sv-layer__dot" [style.background]="l.color"></span>
            {{ l.label }}
          </label>
        </div>
        <div class="sv-legend" *ngIf="couchesOpen">
          <div class="sv-legend__title">Légende (statut)</div>
          <div class="sv-legend__item"><span class="sv-dot sv-dot--ok"></span> OK</div>
          <div class="sv-legend__item"><span class="sv-dot sv-dot--warn"></span> Avertissement</div>
          <div class="sv-legend__item"><span class="sv-dot sv-dot--crit"></span> Critique</div>
          <div class="sv-legend__item"><span class="sv-dot sv-dot--offline"></span> Hors ligne</div>
        </div>
      </div>

      <!-- Bottom filter bar -->
      <div class="sv-map-footer">
        <div class="sv-map-footer__group">
          <span class="sv-map-footer__label">Mesure</span>
          <div class="sv-map-footer__select-wrap">
            <select class="sv-map-footer__select" [(ngModel)]="selectedMeasure">
              <option *ngFor="let t of measurementTypeList" [value]="t.code">{{ typeLabel(t.code) }}</option>
            </select>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" class="sv-map-footer__chevron"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="sv-map-footer__sep"></div>
        <div class="sv-map-footer__group">
          <span class="sv-map-footer__label">Période</span>
          <div class="sv-map-footer__select-wrap">
            <select class="sv-map-footer__select" [(ngModel)]="selectedPeriod">
              <option value="7d">Derniers 7 jours</option>
              <option value="30d">Derniers 30 jours</option>
              <option value="90d">Derniers 90 jours</option>
            </select>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" class="sv-map-footer__chevron"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="sv-map-footer__sep"></div>
        <div class="sv-map-footer__group">
          <span class="sv-map-footer__label">Département</span>
          <div class="sv-map-footer__select-wrap">
            <select class="sv-map-footer__select" [(ngModel)]="selectedTerritory">
              <option value="">Tous les départements</option>
              <option *ngFor="let t of territories()" [value]="t">{{ t }}</option>
            </select>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" class="sv-map-footer__chevron"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </div>
    </div>

    <!-- DETAIL PANEL -->
    <div class="sv-detail" *ngIf="selectedPointId">
      <div class="sv-detail__header">
        <div class="sv-detail__header-left">
          <div class="sv-detail__icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" style="color:#3b82f6">
              <path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12Z" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <div class="sv-detail__name">{{ pointLabel(selectedPointId) }}</div>
            <span class="sv-severity"
              [class.sv-severity--crit]="pointSeverity(selectedPointId) === 'CRIT'"
              [class.sv-severity--warn]="pointSeverity(selectedPointId) === 'WARN'"
              [class.sv-severity--ok]="pointSeverity(selectedPointId) === 'OK'">
              {{ severityLabel(selectedPointId) }}
            </span>
          </div>
        </div>
        <button class="sv-detail__close" (click)="selectedPointId = undefined">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="sv-tabs">
        <button class="sv-tab" [class.sv-tab--active]="activeTab === 'info'" (click)="activeTab = 'info'">Informations</button>
        <button class="sv-tab" [class.sv-tab--active]="activeTab === 'mesures'" (click)="activeTab = 'mesures'">Mesures</button>
        <button class="sv-tab" [class.sv-tab--active]="activeTab === 'historique'" (click)="activeTab = 'historique'">Historique</button>
        <button class="sv-tab" [class.sv-tab--active]="activeTab === 'interventions'" (click)="activeTab = 'interventions'">Interventions</button>
      </div>

      <div class="sv-detail__body">
        <ng-container *ngIf="activeTab === 'info'">

          <div class="sv-section-title">DÉTAILS</div>
          <div class="sv-detail__rows">
            <div class="sv-detail__row" *ngFor="let d of pointDetails()">
              <span class="sv-detail__key">{{ d.key }}</span>
              <span class="sv-detail__val">{{ d.value }}</span>
            </div>
          </div>

          <div class="sv-section-title">INDICATEURS EN TEMPS RÉEL</div>
          <div class="sv-metrics">
            <div class="sv-metric sv-metric--crit">
              <div class="sv-metric__label">Niveau d'eau</div>
              <div class="sv-metric__row">
                <span class="sv-metric__value">{{ measurementDisplay(selectedPointId, 'LEVEL') }}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2">
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
                  <polyline points="17 18 23 18 23 12"/>
                </svg>
              </div>
            </div>
            <div class="sv-metric sv-metric--warn">
              <div class="sv-metric__label">Pression</div>
              <div class="sv-metric__row">
                <span class="sv-metric__value">{{ measurementDisplay(selectedPointId, 'PRESSURE') }}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f97316" stroke-width="2">
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
                  <polyline points="17 18 23 18 23 12"/>
                </svg>
              </div>
            </div>
            <div class="sv-metric sv-metric--blue">
              <div class="sv-metric__label">Débit</div>
              <div class="sv-metric__row">
                <span class="sv-metric__value">{{ measurementDisplay(selectedPointId, 'FLOW') }}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              </div>
            </div>
            <div class="sv-metric sv-metric--default">
              <div class="sv-metric__label">Dernière mesure</div>
              <div class="sv-metric__row">
                <span class="sv-metric__value sv-metric__value--muted">{{ lastSeenRelative(selectedPointId) }}</span>
              </div>
            </div>
          </div>

          <div class="sv-section-title">ACTIONS RAPIDES</div>
          <div class="sv-actions">
            <a class="sv-action-btn sv-action-btn--primary" [routerLink]="['/points', selectedPointId]">Voir les détails</a>
            <button class="sv-action-btn sv-action-btn--secondary">Créer une alerte</button>
            <button class="sv-action-btn sv-action-btn--secondary">Créer une intervention</button>
          </div>
        </ng-container>

        <ng-container *ngIf="activeTab !== 'info'">
          <div class="sv-empty-tab">
            <span class="muted">Aucune donnée disponible pour cet onglet.</span>
          </div>
        </ng-container>
      </div>
    </div>

  </div>
</div>
  `,
  styles: [`
    .sv-page {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 64px - 2.5rem);
      gap: 0.85rem;
      overflow: hidden;
    }

    /* ── TOPBAR ── */
    .sv-topbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .sv-search {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: #fff;
      border: 1px solid rgba(2,6,23,.12);
      border-radius: 999px;
      padding: 0.55rem 1.1rem;
      box-shadow: 0 2px 8px rgba(2,6,23,.06);
    }
    .sv-search__icon { width:16px;height:16px;color:#94a3b8;flex-shrink:0; }
    .sv-search__input {
      flex:1;border:0;outline:none;background:transparent;
      font-size:.92rem;color:#0f172a;min-width:0;padding:0;
    }
    .sv-search__input::placeholder { color:#94a3b8; }
    .sv-filter-btn {
      display:inline-flex;align-items:center;gap:.5rem;
      padding:.55rem 1.1rem;border-radius:999px;
      border:1px solid rgba(2,6,23,.12);background:#fff;
      font-size:.88rem;font-weight:600;color:#0f172a;cursor:pointer;
      white-space:nowrap;box-shadow:0 2px 8px rgba(2,6,23,.06);
    }
    .sv-filter-badge {
      background:#1e3a5f;color:#fff;border-radius:999px;
      padding:.1rem .45rem;font-size:.72rem;font-weight:800;
    }
    .sv-refresh-btn {
      width:42px;height:42px;border-radius:999px;
      border:1px solid rgba(2,6,23,.12);background:#1e3a5f;color:#fff;
      display:inline-flex;align-items:center;justify-content:center;
      cursor:pointer;flex-shrink:0;box-shadow:0 2px 8px rgba(2,6,23,.12);
    }

    /* ── KPI ROW ── */
    .sv-kpi-row {
      display:flex;gap:.75rem;flex-shrink:0;
    }
    .sv-kpi {
      flex:1;display:flex;align-items:center;gap:.85rem;
      background:#fff;border:1px solid rgba(2,6,23,.08);
      border-radius:14px;padding:.75rem 1rem;
      box-shadow:0 4px 12px rgba(2,6,23,.06);
    }
    .sv-kpi__icon {
      width:44px;height:44px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .sv-kpi__icon--blue   { background:rgba(59,130,246,.12);  color:#3b82f6; }
    .sv-kpi__icon--green  { background:rgba(34,197,94,.12);   color:#22c55e; }
    .sv-kpi__icon--purple { background:rgba(168,85,247,.12);  color:#a855f7; }
    .sv-kpi__icon--red    { background:rgba(239,68,68,.12);   color:#ef4444; }
    .sv-kpi__icon--orange { background:rgba(249,115,22,.12);  color:#f97316; }
    .sv-kpi__num {
      font-size:1.6rem;font-weight:900;letter-spacing:-.03em;line-height:1;
    }
    .sv-kpi__num--blue   { color:#3b82f6; }
    .sv-kpi__num--green  { color:#22c55e; }
    .sv-kpi__num--purple { color:#a855f7; }
    .sv-kpi__num--red    { color:#ef4444; }
    .sv-kpi__num--orange { color:#f97316; }
    .sv-kpi__label { color:#64748b;font-size:.8rem;font-weight:500;margin-top:.1rem; }

    /* ── CONTENT ── */
    .sv-content {
      display:flex;gap:.85rem;flex:1;min-height:0;
    }

    /* ── MAP AREA ── */
    .sv-map-area {
      flex:1;position:relative;border-radius:14px;
      overflow:hidden;min-width:0;
    }
    :host ::ng-deep .sv-map-area app-leaflet-map { display:block;height:100%; }
    :host ::ng-deep .sv-map-area .leaflet-wrap   { height:100%;border-radius:0; }

    /* ── COUCHES PANEL ── */
    .sv-couches {
      position:absolute;top:1rem;left:1rem;z-index:1000;
      background:rgba(255,255,255,.97);border:1px solid rgba(2,6,23,.10);
      border-radius:12px;box-shadow:0 8px 24px rgba(2,6,23,.12);
      min-width:210px;
    }
    .sv-couches__header {
      display:flex;align-items:center;justify-content:space-between;
      padding:.6rem .85rem;cursor:pointer;user-select:none;
    }
    .sv-couches__title { font-weight:700;font-size:.88rem; }
    .sv-couches__body {
      padding:.4rem .75rem .55rem;
      border-top:1px solid rgba(2,6,23,.08);
      display:flex;flex-direction:column;gap:.32rem;
    }
    .sv-layer {
      display:flex;align-items:center;gap:.55rem;
      font-size:.84rem;cursor:pointer;
    }
    .sv-layer__check { cursor:pointer;width:14px;height:14px; }
    .sv-layer__dot { width:11px;height:11px;border-radius:3px;flex-shrink:0; }
    .sv-legend {
      padding:.5rem .75rem .65rem;
      border-top:1px solid rgba(2,6,23,.08);
    }
    .sv-legend__title {
      font-weight:700;font-size:.78rem;margin-bottom:.4rem;color:#475569;
    }
    .sv-legend__item {
      display:flex;align-items:center;gap:.5rem;font-size:.82rem;padding:.15rem 0;
    }
    .sv-dot {
      width:11px;height:11px;border-radius:999px;flex-shrink:0;
    }
    .sv-dot--ok      { background:#22c55e; }
    .sv-dot--warn    { background:#f97316; }
    .sv-dot--crit    { background:#ef4444; }
    .sv-dot--offline { background:#94a3b8; }

    /* ── MAP FOOTER ── */
    .sv-map-footer {
      position:absolute;bottom:1.25rem;left:1.25rem;z-index:1000;
      display:flex;align-items:center;gap:.75rem;
      background:rgba(255,255,255,.97);border:1px solid rgba(2,6,23,.10);
      border-radius:12px;padding:.55rem 1.1rem;
      box-shadow:0 4px 16px rgba(2,6,23,.10);
    }
    .sv-map-footer__group { display:flex;align-items:center;gap:.45rem; }
    .sv-map-footer__label {
      font-size:.8rem;color:#64748b;font-weight:600;white-space:nowrap;
    }
    .sv-map-footer__select-wrap { position:relative;display:flex;align-items:center; }
    .sv-map-footer__select {
      border:0;outline:none;background:transparent;
      font-size:.88rem;font-weight:700;color:#0f172a;
      cursor:pointer;appearance:none;padding-right:1.2rem;min-width:110px;
    }
    .sv-map-footer__chevron { position:absolute;right:0;pointer-events:none;color:#64748b; }
    .sv-map-footer__sep {
      width:1px;height:22px;background:rgba(2,6,23,.12);flex-shrink:0;
    }

    /* ── DETAIL PANEL ── */
    .sv-detail {
      width:340px;min-width:340px;background:#fff;
      border:1px solid rgba(2,6,23,.08);border-radius:14px;
      box-shadow:0 8px 24px rgba(2,6,23,.08);
      display:flex;flex-direction:column;overflow:hidden;
    }
    .sv-detail__header {
      display:flex;align-items:flex-start;justify-content:space-between;
      padding:1rem;border-bottom:1px solid rgba(2,6,23,.08);flex-shrink:0;
    }
    .sv-detail__header-left { display:flex;align-items:flex-start;gap:.75rem; }
    .sv-detail__icon-wrap {
      width:40px;height:40px;border-radius:10px;
      background:rgba(59,130,246,.10);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .sv-detail__name { font-weight:800;font-size:.98rem;color:#0f172a; }
    .sv-severity {
      display:inline-flex;align-items:center;gap:.3rem;
      font-size:.73rem;font-weight:700;padding:.15rem .5rem;
      border-radius:999px;margin-top:.2rem;
    }
    .sv-severity::before {
      content:'';width:6px;height:6px;border-radius:999px;background:currentColor;
    }
    .sv-severity--crit { background:rgba(239,68,68,.12);  color:#dc2626; }
    .sv-severity--warn { background:rgba(249,115,22,.12); color:#f97316; }
    .sv-severity--ok   { background:rgba(34,197,94,.12);  color:#16a34a; }
    .sv-detail__close {
      width:28px;height:28px;border-radius:8px;
      border:1px solid rgba(2,6,23,.10);background:rgba(2,6,23,.04);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;flex-shrink:0;color:#64748b;
    }

    /* ── TABS ── */
    .sv-tabs {
      display:flex;border-bottom:1px solid rgba(2,6,23,.08);
      padding:0 .5rem;flex-shrink:0;
    }
    .sv-tab {
      flex:1;padding:.6rem .2rem;background:transparent;
      border:0;border-bottom:2px solid transparent;
      font-size:.78rem;font-weight:600;color:#64748b;cursor:pointer;
      white-space:nowrap;margin-bottom:-1px;
      transition:color .15s,border-color .15s;
    }
    .sv-tab--active { color:#2563eb;border-bottom-color:#2563eb; }

    /* ── DETAIL BODY ── */
    .sv-detail__body { flex:1;overflow-y:auto;padding:1rem; }
    .sv-section-title {
      font-size:.7rem;font-weight:900;letter-spacing:.07em;
      color:#64748b;margin:1rem 0 .5rem;text-transform:uppercase;
    }
    .sv-section-title:first-child { margin-top:0; }
    .sv-detail__rows { display:flex;flex-direction:column; }
    .sv-detail__row {
      display:flex;justify-content:space-between;align-items:center;
      padding:.38rem 0;border-bottom:1px solid rgba(2,6,23,.06);font-size:.84rem;
    }
    .sv-detail__row:last-child { border-bottom:0; }
    .sv-detail__key { color:#64748b;font-weight:500; }
    .sv-detail__val { font-weight:600;color:#0f172a;text-align:right; }

    /* ── METRICS ── */
    .sv-metrics { display:grid;grid-template-columns:1fr 1fr;gap:.6rem; }
    .sv-metric {
      border:1px solid rgba(2,6,23,.10);border-radius:10px;
      padding:.6rem .7rem;
    }
    .sv-metric--crit    { border-color:rgba(239,68,68,.22);  background:rgba(239,68,68,.03); }
    .sv-metric--warn    { border-color:rgba(249,115,22,.22); background:rgba(249,115,22,.03); }
    .sv-metric--blue    { border-color:rgba(59,130,246,.22); background:rgba(59,130,246,.03); }
    .sv-metric--default { border-color:rgba(2,6,23,.08);     background:rgba(2,6,23,.02); }
    .sv-metric__label { font-size:.76rem;color:#64748b;font-weight:500;margin-bottom:.3rem; }
    .sv-metric__row { display:flex;align-items:center;justify-content:space-between; }
    .sv-metric__value {
      font-size:1.2rem;font-weight:900;color:#0f172a;letter-spacing:-.02em;
    }
    .sv-metric--crit .sv-metric__value { color:#ef4444; }
    .sv-metric--warn .sv-metric__value { color:#f97316; }
    .sv-metric--blue .sv-metric__value { color:#3b82f6; }
    .sv-metric__value--muted { font-size:.85rem;color:#64748b;font-weight:600; }

    /* ── ACTIONS ── */
    .sv-actions { display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem; }
    .sv-action-btn {
      display:flex;align-items:center;justify-content:center;width:100%;
      padding:.65rem;border-radius:10px;font-weight:700;font-size:.88rem;
      cursor:pointer;text-decoration:none;border:0;
      transition:opacity .15s;
    }
    .sv-action-btn:hover { opacity:.86; }
    .sv-action-btn--primary  { background:#1e3a5f;color:#fff; }
    .sv-action-btn--secondary {
      background:transparent;border:1px solid rgba(2,6,23,.15);color:#0f172a;
    }
    .sv-empty-tab {
      display:flex;align-items:center;justify-content:center;
      padding:2.5rem;font-size:.9rem;
    }
  `]
})
export class SupervisionPageComponent implements OnDestroy {
  dashboard?: DashboardDto;
  markers: GeoMarker[] = [];
  searchQuery = '';
  selectedPointId?: string;
  activeTab: 'info' | 'mesures' | 'historique' | 'interventions' = 'info';
  couchesOpen = true;
  selectedMeasure = 'LEVEL';
  selectedPeriod = '7d';
  selectedTerritory = '';
  measurementTypeList: CodeItemDto[] = [];

  layers = [
    { label: "Points d'eau",       color: '#3b82f6', visible: true  },
    { label: 'Réservoirs',         color: '#22c55e', visible: true  },
    { label: 'Sources / Captages', color: '#06b6d4', visible: true  },
    { label: 'Stations de pompage',color: '#a855f7', visible: true  },
    { label: 'Capteurs',           color: '#94a3b8', visible: true  },
    { label: 'Conduites',          color: '#64748b', visible: true  },
    { label: 'Zones desservies',   color: '#e2e8f0', visible: false },
    { label: 'Alertes',            color: '#ef4444', visible: true  },
  ];

  private subs: Subscription[] = [];

  constructor(
    private readonly api: BffApiService,
    private readonly toast: ToastService,
    private readonly i18n: I18nService,
    private readonly points: PointsService,
    private readonly measurementTypes: MeasurementTypesService,
    private readonly refresh: RefreshService
  ) {
    this.points.ensureLoaded().subscribe();
    this.measurementTypes.ensureLoaded().subscribe();
    this.subs.push(
      this.measurementTypes.stream().subscribe(types => {
        this.measurementTypeList = (types ?? []).filter(t => t.active);
        if (this.measurementTypeList.length > 0 &&
            !this.measurementTypeList.some(t => t.code === this.selectedMeasure)) {
          this.selectedMeasure = this.measurementTypeList[0].code;
        }
      })
    );
    this.subs.push(this.points.stream().subscribe(() => this._computeMarkers()));
    this.reload();
    this.subs.push(this.refresh.refresh$.subscribe(e => this.reload(e.reason === 'manual')));
    this._computeMarkers(); // initialise avec mock data immédiatement
  }

  reload(showErrorToast = false) {
    this.api.dashboard().subscribe({
      next: d => { this.dashboard = d as DashboardDto; this._computeMarkers(); },
      error: () => { if (showErrorToast) this.toast.push('error', this.i18n.t('toast.failed')); }
    });
  }

  private _computeMarkers(): void {
    this.markers = this.pts
      .filter(p => typeof p.lon === 'number' && typeof p.lat === 'number')
      .map(p => ({
        id: p.id,
        lon: p.lon as number,
        lat: p.lat as number,
        label: p.name,
        state: this.pointSeverity(p.id)
      }))
      .filter(m => this.inHaiti(m.lon, m.lat));
  }

  onMarkerSelect(id: string) {
    this.selectedPointId = id === this.selectedPointId ? undefined : id;
    this.activeTab = 'info';
  }

  // ── helpers : real data + mock fallback ───────────────────
  private get pts(): PointDefinition[] {
    const real = this.points.all();
    return real.length > 0 ? real : MOCK_POINTS;
  }

  private get dash(): DashboardDto {
    return this.dashboard ?? MOCK_DASHBOARD;
  }

  private getPoint(id: string): PointDefinition | undefined {
    return this.points.get(id) ?? MOCK_POINTS.find(p => p.id === id);
  }

  // ── KPI ────────────────────────────────────────────────────
  activePointsCount(): number { return this.pts.length; }
  reservoirsCount(): number   { return this.pts.filter(p => p.type === 'TANK').length; }
  sensorsCount(): number      { return this.dash.realtime?.length ?? 0; }
  alertsCount(): number {
    return (this.dash.alerts ?? [])
      .filter(a => a.severity === 'CRIT' || a.severity === 'WARN').length;
  }
  deptAtRiskCount(): number {
    const depts = new Set<string>();
    for (const a of this.dash.alerts ?? []) {
      const p = this.getPoint(a.pointId);
      if (p?.territory) depts.add(p.territory);
    }
    return depts.size;
  }

  // ── MAP ────────────────────────────────────────────────────
  territories(): string[] {
    const s = new Set(this.pts.map(p => (p.territory ?? '').trim()).filter(Boolean));
    return [...s].sort();
  }

  private inHaiti(lon: number, lat: number): boolean {
    return lon >= -75.5 && lon <= -71.0 && lat >= 17.5 && lat <= 20.5;
  }

  // ── POINT STATE ───────────────────────────────────────────
  pointLabel(id: string): string {
    return this.getPoint(id)?.name ?? id;
  }

  pointSeverity(pointId: string): 'OK' | 'WARN' | 'CRIT' | 'OFFLINE' {
    const r = (this.dash.realtime ?? []).find(r => r.pointId === pointId);
    if (!r) return 'OFFLINE';
    const hasTs = Object.values(r.lastMeasurements ?? {}).some(m => m?.timestamp);
    if (!hasTs) return 'OFFLINE';
    const alerts = (this.dash.alerts ?? []).filter(a => a.pointId === pointId);
    if (alerts.some(a => a.severity === 'CRIT')) return 'CRIT';
    if (alerts.some(a => a.severity === 'WARN')) return 'WARN';
    return 'OK';
  }

  severityLabel(id: string): string {
    const map: Record<string, string> = {
      CRIT: 'Critique', WARN: 'Avertissement', OK: 'OK', OFFLINE: 'Hors ligne'
    };
    return map[this.pointSeverity(id)] ?? '-';
  }

  typeLabel(code: string): string { return this.measurementTypes.label(code); }

  // ── DETAIL PANEL ──────────────────────────────────────────
  pointDetails(): { key: string; value: string }[] {
    const p = this.getPoint(this.selectedPointId!);
    if (!p) return [];
    const typeMap: Record<string, string> = {
      TANK: 'Réservoir', SOURCE: 'Source / Captage', PUMP: 'Station de pompage', SENSOR: 'Capteur'
    };
    const capacityMap: Record<string, string> = {
      'PT-001': '500 m³', 'PT-004': '300 m³', 'PT-007': '250 m³'
    };
    const mepMap: Record<string, string> = {
      'PT-001': 'Jan 2019', 'PT-002': 'Mar 2020', 'PT-003': 'Juin 2018',
      'PT-004': 'Sep 2021', 'PT-005': 'Fév 2022', 'PT-006': 'Nov 2017',
      'PT-007': 'Avr 2020', 'PT-008': 'Juil 2019', 'PT-009': 'Jan 2023', 'PT-010': 'Oct 2021',
    };
    return [
      { key: 'Type',            value: typeMap[p.type] ?? p.type },
      { key: 'Code',            value: p.id },
      { key: 'Département',     value: p.territory ?? '-' },
      { key: 'Coordonnées',     value: p.lat != null && p.lon != null
          ? `${Math.abs(p.lat!).toFixed(4)}° N, ${Math.abs(p.lon!).toFixed(4)}° W` : '-' },
      { key: 'Capacité',        value: capacityMap[p.id] ?? '-' },
      { key: 'Mise en service', value: mepMap[p.id] ?? '-' },
      { key: 'Gestionnaire',    value: 'DINEPA' },
    ];
  }

  measurementDisplay(pointId: string, type: string): string {
    const r = (this.dash.realtime ?? []).find(r => r.pointId === pointId);
    const m = r?.lastMeasurements?.[type];
    if (!m) return '-';
    return `${m.value} ${m.unit}`;
  }

  lastSeenRelative(pointId: string): string {
    const r = (this.dash.realtime ?? []).find(r => r.pointId === pointId);
    if (!r) return 'Hors ligne';
    const timestamps = Object.values(r.lastMeasurements ?? {})
      .map(m => m?.timestamp).filter(Boolean) as string[];
    if (!timestamps.length) return 'Hors ligne';
    const last = new Date([...timestamps].sort().pop()!);
    const diffMin = Math.round((Date.now() - last.getTime()) / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} h`;
    return `Il y a ${Math.round(diffH / 24)} j`;
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }
}

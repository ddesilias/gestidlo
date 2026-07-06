import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../ui/toast.service';
import { HaitiGeoService, HAITI_DEPARTMENTS } from '../haiti-geo.service';
import { GovernanceStore } from '../governance.store';
import { InfrastructureStore, Infrastructure } from '../infrastructure.store';
import { GestidloMapComponent } from '../ui/gestidlo-map.component';
import { GeoMapItem, statusColor, SERVICE_LEGEND } from '../map.config';

type ServiceStatus = 'normal' | 'intermittent' | 'degrade' | 'coupure' | 'retablissement' | 'non_desservi' | 'inconnu';
type DetailTab = 'resume' | 'disponibilite' | 'points' | 'incidents' | 'infr' | 'historique';
type EntityType = 'zone' | 'point';

interface SupplyChain { resource: string; captage: string; reservoir: string; }
interface ServiceIncident { id: string; label: string; severity: 'haute' | 'moyenne' | 'basse'; date: string; }

interface ServiceEntity {
  id: string;
  name: string;
  entityType: EntityType;
  type: string;
  commune: string;
  section: string;
  department: string;
  status: ServiceStatus;
  continuity: string;
  continuityHours: number;
  reservoirId: string;
  incidents: number;
  population?: number;
  responsable: string;
  institution: string;
  pressureMoy: string;
  flowEst: string;
  waterAvailable: boolean;
  lastUpdate: string;
  lat: number;
  lng: number;
  serviceIndex: number;
  supplyChain?: SupplyChain;
  waterPoints?: string[];
  activeIncidents?: ServiceIncident[];
  hoursService?: string;
  distributionDays?: string;
}

const ENTITIES: ServiceEntity[] = [
  {
    id: 'zone-dessources', name: 'Dessources', entityType: 'zone', type: 'Zone',
    commune: 'Léogâne', section: 'Dessources', department: 'Ouest',
    status: 'intermittent', continuity: '6 h/j', continuityHours: 6,
    reservoirId: 'R-01', incidents: 2, population: 18450,
    responsable: 'DINEPA Ouest', institution: 'DINEPA',
    pressureMoy: '0,8 bar', flowEst: '1,2 L/s',
    waterAvailable: true, lastUpdate: 'il y a 8 min',
    lat: 18.525, lng: -72.73, serviceIndex: 60,
    supplyChain: { resource: 'Rivière Momance', captage: 'Captage C-01', reservoir: 'Réservoir R-01' },
    waterPoints: ['PE-01 Dessources', 'PE-02 Dessources', 'PE-03 Dessources'],
    activeIncidents: [
      { id: 'INC-001', label: 'Pression faible au PE-02', severity: 'haute', date: '29/04/2026 08:10' },
      { id: 'INC-002', label: 'Débit insuffisant au PE-03', severity: 'moyenne', date: '29/04/2026 07:45' },
    ],
    hoursService: '06:00 – 12:00', distributionDays: 'Lun, Mer, Ven',
  },
  {
    id: 'zone-nan-palmiste', name: 'Nan Palmiste', entityType: 'zone', type: 'Zone',
    commune: 'Léogâne', section: 'Dessources', department: 'Ouest',
    status: 'normal', continuity: '12 h/j', continuityHours: 12,
    reservoirId: 'R-01', incidents: 0, population: 12300,
    responsable: 'DINEPA Ouest', institution: 'DINEPA',
    pressureMoy: '1,2 bar', flowEst: '2,4 L/s',
    waterAvailable: true, lastUpdate: 'il y a 5 min',
    lat: 18.56, lng: -72.67, serviceIndex: 90,
    supplyChain: { resource: 'Rivière Momance', captage: 'Captage C-01', reservoir: 'Réservoir R-01' },
    waterPoints: ['PE-04 Nan Palmiste', 'PE-05 Nan Palmiste'],
    activeIncidents: [],
    hoursService: '05:00 – 17:00', distributionDays: 'Lun – Sam',
  },
  {
    id: 'zone-petit-goave', name: 'Petit-Goâve Centre', entityType: 'zone', type: 'Zone',
    commune: 'Petit-Goâve', section: 'Centre', department: 'Ouest',
    status: 'degrade', continuity: '4 h/j', continuityHours: 4,
    reservoirId: 'R-02', incidents: 1, population: 25000,
    responsable: 'OREPA Ouest', institution: 'DINEPA',
    pressureMoy: '0,5 bar', flowEst: '0,8 L/s',
    waterAvailable: true, lastUpdate: 'il y a 15 min',
    lat: 18.43, lng: -72.87, serviceIndex: 40,
    supplyChain: { resource: 'Source Miragoâne', captage: 'Captage C-03', reservoir: 'Réservoir R-02' },
    waterPoints: ['PE-06 Centre', 'PE-07 Centre', 'PE-08 Centre'],
    activeIncidents: [
      { id: 'INC-003', label: 'Pression réseau basse', severity: 'haute', date: '29/04/2026 07:30' },
    ],
    hoursService: '06:00 – 10:00', distributionDays: 'Mar, Jeu',
  },
  {
    id: 'zone-grand-goave', name: 'Grand-Goâve', entityType: 'zone', type: 'Zone',
    commune: 'Grand-Goâve', section: 'Centre', department: 'Ouest',
    status: 'normal', continuity: '10 h/j', continuityHours: 10,
    reservoirId: 'R-02', incidents: 0, population: 19800,
    responsable: 'OREPA Ouest', institution: 'DINEPA',
    pressureMoy: '1,0 bar', flowEst: '1,8 L/s',
    waterAvailable: true, lastUpdate: 'il y a 3 min',
    lat: 18.43, lng: -72.80, serviceIndex: 82,
    supplyChain: { resource: 'Source Miragoâne', captage: 'Captage C-03', reservoir: 'Réservoir R-02' },
    waterPoints: ['PE-09 Grand-Goâve', 'PE-10 Grand-Goâve'],
    activeIncidents: [],
    hoursService: '06:00 – 16:00', distributionDays: 'Lun – Ven',
  },
  {
    id: 'zone-leogane', name: 'Léogâne Centre', entityType: 'zone', type: 'Zone',
    commune: 'Léogâne', section: 'Centre', department: 'Ouest',
    status: 'coupure', continuity: '0 h/j', continuityHours: 0,
    reservoirId: 'R-01', incidents: 3, population: 31500,
    responsable: 'DINEPA Ouest', institution: 'DINEPA',
    pressureMoy: '—', flowEst: '—',
    waterAvailable: false, lastUpdate: 'il y a 12 min',
    lat: 18.51, lng: -72.63, serviceIndex: 0,
    supplyChain: { resource: 'Rivière Momance', captage: 'Captage C-01', reservoir: 'Réservoir R-01' },
    waterPoints: ['PE-11 Léogâne', 'PE-12 Léogâne', 'PE-13 Léogâne'],
    activeIncidents: [
      { id: 'INC-004', label: 'Coupure générale depuis 6h', severity: 'haute', date: '29/04/2026 03:00' },
      { id: 'INC-005', label: 'Réservoir R-01 niveau bas (18 %)', severity: 'haute', date: '29/04/2026 02:45' },
      { id: 'INC-006', label: 'Pompe P-01 arrêt non planifié', severity: 'haute', date: '29/04/2026 03:15' },
    ],
    hoursService: '—', distributionDays: 'Service suspendu',
  },
  {
    id: 'pe-01', name: 'PE-01 Dessources', entityType: 'point', type: "Point d'eau",
    commune: 'Léogâne', section: 'Dessources', department: 'Ouest',
    status: 'normal', continuity: '12 h/j', continuityHours: 12,
    reservoirId: 'R-01', incidents: 0,
    responsable: 'DINEPA Ouest', institution: 'DINEPA',
    pressureMoy: '1,1 bar', flowEst: '1,5 L/s',
    waterAvailable: true, lastUpdate: 'il y a 3 min',
    lat: 18.522, lng: -72.736, serviceIndex: 92,
    hoursService: '06:00 – 18:00', distributionDays: 'Lun – Sam',
  },
  {
    id: 'pe-02', name: 'PE-02 Dessources', entityType: 'point', type: "Point d'eau",
    commune: 'Léogâne', section: 'Dessources', department: 'Ouest',
    status: 'degrade', continuity: '4 h/j', continuityHours: 4,
    reservoirId: 'R-01', incidents: 1,
    responsable: 'DINEPA Ouest', institution: 'DINEPA',
    pressureMoy: '0,4 bar', flowEst: '0,4 L/s',
    waterAvailable: true, lastUpdate: 'il y a 12 min',
    lat: 18.526, lng: -72.728, serviceIndex: 35,
    hoursService: '06:00 – 10:00', distributionDays: 'Lun, Mer',
  },
  {
    id: 'pe-03', name: 'PE-03 Dessources', entityType: 'point', type: "Point d'eau",
    commune: 'Léogâne', section: 'Dessources', department: 'Ouest',
    status: 'coupure', continuity: '0 h/j', continuityHours: 0,
    reservoirId: 'R-01', incidents: 1,
    responsable: 'DINEPA Ouest', institution: 'DINEPA',
    pressureMoy: '—', flowEst: '—',
    waterAvailable: false, lastUpdate: 'il y a 20 min',
    lat: 18.531, lng: -72.722, serviceIndex: 0,
    hoursService: '—', distributionDays: 'Service coupé',
  },
];

@Component({
  selector: 'app-service-page',
  standalone: true,
  imports: [CommonModule, FormsModule, GestidloMapComponent],
  template: `
<div class="svc-shell">

  <!-- ══════════════════════════════════════════════════
       HEADER
  ══════════════════════════════════════════════════ -->
  <div class="svc-header">
    <div class="svc-header__left">
      <h1 class="svc-header__title">Service d'eau potable</h1>
      <p class="svc-header__sub">Suivi de la disponibilité, de la continuité et de la desserte dans les zones alimentées par le réseau AEP.</p>
    </div>
    <div class="svc-header__meta">
      <span class="svc-update-time">Dernière mise à jour : 29/04/2026 09:45</span>
      <button class="svc-refresh-btn" type="button" (click)="refresh()" title="Actualiser">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      </button>
    </div>
    <div class="svc-header__actions">
      <button class="svc-btn svc-btn--ghost" type="button" (click)="filtresOuverts=true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtres
      </button>
      <button class="svc-btn svc-btn--primary" type="button" (click)="showCreateIncident = true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Créer incident
      </button>
      <button class="svc-btn svc-btn--success" type="button" (click)="showPlanifier = true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Planifier distribution
      </button>
      <button class="svc-btn svc-btn--ghost" type="button" (click)="notifyExport()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Exporter rapport
      </button>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════
       KPI BAR
  ══════════════════════════════════════════════════ -->
  <div class="svc-kpi-bar">
    <div class="svc-kpi">
      <div class="svc-kpi__icon svc-kpi__icon--gray">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M2 20h20M4 20V8l8-6 8 6v12"/><rect x="9" y="14" width="6" height="6"/></svg>
      </div>
      <div class="svc-kpi__body">
        <span class="svc-kpi__val">{{ kpiTotal }}</span>
        <span class="svc-kpi__lbl">Entités suivies</span>
      </div>
    </div>
    <div class="svc-kpi-sep"></div>
    <div class="svc-kpi">
      <div class="svc-kpi__icon svc-kpi__icon--green">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <div class="svc-kpi__body">
        <span class="svc-kpi__val svc-kpi__val--green">{{ kpiNormal }}</span>
        <span class="svc-kpi__lbl">Service normal</span>
      </div>
    </div>
    <div class="svc-kpi-sep"></div>
    <div class="svc-kpi">
      <div class="svc-kpi__icon svc-kpi__icon--orange">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
      </div>
      <div class="svc-kpi__body">
        <span class="svc-kpi__val svc-kpi__val--orange">{{ kpiDegrade }}</span>
        <span class="svc-kpi__lbl">Service dégradé</span>
      </div>
    </div>
    <div class="svc-kpi-sep"></div>
    <div class="svc-kpi">
      <div class="svc-kpi__icon svc-kpi__icon--red">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="svc-kpi__body">
        <span class="svc-kpi__val svc-kpi__val--red">{{ kpiCoupure }}</span>
        <span class="svc-kpi__lbl">En coupure</span>
      </div>
    </div>
    <div class="svc-kpi-sep"></div>
    <div class="svc-kpi">
      <div class="svc-kpi__icon svc-kpi__icon--blue">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
      </div>
      <div class="svc-kpi__body">
        <span class="svc-kpi__val svc-kpi__val--blue">{{ kpiPointsActifs }}</span>
        <span class="svc-kpi__lbl">Points d'eau actifs</span>
      </div>
    </div>
    <div class="svc-kpi-sep"></div>
    <div class="svc-kpi">
      <div class="svc-kpi__icon svc-kpi__icon--purple">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
      </div>
      <div class="svc-kpi__body">
        <span class="svc-kpi__val svc-kpi__val--purple">{{ kpiIncidents }}</span>
        <span class="svc-kpi__lbl">Incidents actifs</span>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════
       BODY — 3 columns
  ══════════════════════════════════════════════════ -->
  <div class="svc-body">

    <!-- ── FILTER DRAWER ─────────────────────────────────── -->
    <ng-container *ngIf="filtresOuverts">
      <div class="svc-filter-overlay" (click)="filtresOuverts=false"></div>
      <div class="svc-filter-drawer">
        <div class="svc-filter-drawer-head">
          <span>Filtres</span>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="svc-btn svc-btn--ghost" style="padding:3px 8px;font-size:.7rem" type="button" (click)="resetFilters()">Réinitialiser</button>
            <button class="svc-filter-drawer-close" type="button" (click)="filtresOuverts=false">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="svc-filter-drawer-body">
          <div class="svc-fg">
            <label class="svc-fl">Département</label>
            <select class="svc-fs" [(ngModel)]="filterDept" (ngModelChange)="onFilterDeptChange()">
              <option value="">Tous</option>
              <option *ngFor="let d of depts" [value]="d">{{ d }}</option>
            </select>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Commune</label>
            <select class="svc-fs" [(ngModel)]="filterCommune" (ngModelChange)="onFilterCommuneChange()" [disabled]="!filterDept">
              <option value="">Toutes</option>
              <option *ngFor="let c of communesForDept()" [value]="c">{{ c }}</option>
            </select>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Section communale</label>
            <select class="svc-fs" [(ngModel)]="filterSection" [disabled]="!filterCommune">
              <option value="">Toutes</option>
              <option *ngFor="let s of sectionsForScope()" [value]="s">{{ s }}</option>
            </select>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Statut du service</label>
            <select class="svc-fs" [(ngModel)]="filterStatus">
              <option value="">Tous les statuts</option>
              <option value="normal">Normal</option>
              <option value="intermittent">Intermittent</option>
              <option value="degrade">Dégradé</option>
              <option value="coupure">En coupure</option>
              <option value="retablissement">En rétablissement</option>
            </select>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Type de desserte</label>
            <select class="svc-fs" [(ngModel)]="filterType">
              <option value="">Tous les types</option>
              <option value="Zone">Zone</option>
              <option value="Point d'eau">Point d'eau</option>
            </select>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Réservoir lié</label>
            <select class="svc-fs" [(ngModel)]="filterReservoir">
              <option value="">Tous</option>
              <option value="R-01">R-01</option>
              <option value="R-02">R-02</option>
            </select>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Ressource liée</label>
            <select class="svc-fs" [(ngModel)]="filterResource">
              <option value="">Toutes</option>
              <option value="Rivière Momance">Rivière Momance</option>
              <option value="Source Miragoâne">Source Miragoâne</option>
            </select>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Période</label>
            <div class="svc-date-input">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" class="svc-fs" [(ngModel)]="filterPeriod" style="flex:1;border:0;background:none;padding:0;font-size:.78rem">
            </div>
          </div>
          <div class="svc-fg">
            <label class="svc-fl">Institution responsable</label>
            <select class="svc-fs" [(ngModel)]="filterInstitution">
              <option value="">Toutes</option>
              <option value="DINEPA">DINEPA</option>
              <option value="DINEPA Ouest">DINEPA Ouest</option>
              <option value="OREPA Ouest">OREPA Ouest</option>
            </select>
          </div>
        </div>
        <div class="svc-filter-drawer-foot">
          <button class="svc-btn svc-btn--ghost" type="button" (click)="filtresOuverts=false">Fermer</button>
          <button class="svc-btn svc-btn--primary" type="button" (click)="filtresOuverts=false">Appliquer</button>
        </div>
      </div>
    </ng-container>

    <!-- ── CENTER: Map + Table ─────────────────────────── -->
    <div class="svc-main">

      <!-- MAP -->
      <div class="svc-map-wrap">
        <app-gestidlo-map
          [items]="mapItems()"
          [legend]="legend"
          legendTitle="Service d'eau"
          [selectedId]="selectedId"
          (itemSelected)="selectEntity($event)"
          style="height:100%;display:block">
        </app-gestidlo-map>

        <!-- Couches toolbar (overlaid on map) -->
        <div class="svc-map-toolbar">
          <button class="svc-layers-btn" type="button" (click)="showLayers = !showLayers" [class.active]="showLayers">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            Couches
          </button>
        </div>

        <!-- Layers panel -->
        <div class="svc-layers-panel" *ngIf="showLayers">
          <div class="svc-layers-section">
            <div class="svc-layers-title">État du service (zones)</div>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.normal"> <span class="svc-dot svc-dot--green"></span> Service normal</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.intermittent"> <span class="svc-dot svc-dot--yellow"></span> Service intermittent</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.degrade"> <span class="svc-dot svc-dot--orange"></span> Service dégradé</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.coupure"> <span class="svc-dot svc-dot--red"></span> En coupure</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.inconnu"> <span class="svc-dot svc-dot--gray"></span> Donnée inconnue</label>
          </div>
          <div class="svc-layers-section">
            <div class="svc-layers-title">Points d'eau</div>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.pointsActifs"> <span class="svc-dot svc-dot--blue"></span> Actif</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.pointsFaibles"> <span class="svc-dot svc-dot--orange"></span> Pression faible</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.pointsHors"> <span class="svc-dot svc-dot--red"></span> Hors service</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.pointsPlanifies"> <span class="svc-dot svc-dot--purple"></span> Distribution planifiée</label>
          </div>
          <div class="svc-layers-section">
            <div class="svc-layers-title">Autres</div>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.reservoirs"> <span class="svc-legend-icon">&#9632;</span> Réservoir</label>
            <label class="svc-layer-row"><input type="checkbox" [(ngModel)]="layers.conduites"> <span style="border-bottom:2px dashed #3b82f6;width:18px;display:inline-block"></span> Conduite principale</label>
          </div>
        </div>
      </div>

      <!-- TABLE -->
      <div class="svc-table-wrap">
        <div class="svc-table-head">
          <span class="svc-table-title">Zones et points de service ({{ filteredEntities().length }})</span>
          <button class="svc-table-refresh" type="button" (click)="refresh()">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div class="svc-table-scroll">
          <table class="svc-table">
            <thead>
              <tr>
                <th>NOM</th>
                <th>TYPE</th>
                <th>COMMUNE</th>
                <th>SECTION</th>
                <th>STATUT</th>
                <th>CONTINUITÉ</th>
                <th>RÉSERVOIR</th>
                <th>INCIDENTS</th>
                <th>DERNIÈRE MÀJ</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of pagedEntities()"
                (click)="selectEntity(e.id)"
                [class.svc-row--selected]="selectedId === e.id"
                class="svc-row">
                <td class="svc-cell-name">
                  <span class="svc-name-link" (click)="selectEntity(e.id)">{{ e.name }}</span>
                </td>
                <td class="svc-cell-type muted">{{ e.type }}</td>
                <td>{{ e.commune }}</td>
                <td class="muted">{{ e.section }}</td>
                <td>
                  <span class="svc-status svc-status--{{ e.status }}">{{ statusLabel(e.status) }}</span>
                </td>
                <td>{{ e.continuity }}</td>
                <td class="muted">{{ e.reservoirId }}</td>
                <td>
                  <span *ngIf="e.incidents > 0" class="svc-inc-badge svc-inc-badge--warn">{{ e.incidents }}</span>
                  <span *ngIf="e.incidents === 0" class="muted">0</span>
                </td>
                <td class="muted" style="font-size:.75rem">{{ e.lastUpdate }}</td>
                <td class="svc-cell-actions" (click)="$event.stopPropagation()">
                  <button class="svc-row-btn" title="Voir" type="button" (click)="selectEntity(e.id)">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button class="svc-row-btn" title="Créer incident" type="button" (click)="showCreateIncident = true">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
                  </button>
                  <button class="svc-row-btn" title="Plus" type="button">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="svc-pagination">
          <span class="muted" style="font-size:.77rem">
            Affichage de 1 à {{ pagedEntities().length }} sur {{ filteredEntities().length }} éléments
          </span>
          <div class="svc-pages">
            <button class="svc-page-btn" [disabled]="currentPage === 1" (click)="currentPage = currentPage - 1" type="button">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button class="svc-page-num" [class.svc-page-num--active]="currentPage === 1" (click)="currentPage = 1" type="button">1</button>
            <button class="svc-page-num" *ngIf="totalPages() >= 2" [class.svc-page-num--active]="currentPage === 2" (click)="currentPage = 2" type="button">2</button>
            <span *ngIf="totalPages() > 3" class="muted">…</span>
            <button class="svc-page-num" *ngIf="totalPages() >= 3" [class.svc-page-num--active]="currentPage === totalPages()" (click)="currentPage = totalPages()" type="button">{{ totalPages() }}</button>
            <button class="svc-page-btn" [disabled]="currentPage === totalPages()" (click)="currentPage = currentPage + 1" type="button">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <select class="svc-page-size" [(ngModel)]="pageSize">
              <option [value]="5">5 / page</option>
              <option [value]="10">10 / page</option>
              <option [value]="25">25 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ── RIGHT: Detail panel ─────────────────────────────── -->
    <div class="svc-detail" *ngIf="selectedId">

      <!-- No entity selected fallback (shouldn't show) -->
      <ng-container *ngIf="!selectedEntity()">
        <div class="svc-no-sel">
          <p>Sélectionnez une zone ou un point d'eau.</p>
        </div>
      </ng-container>

      <ng-container *ngIf="selectedEntity() as e">

        <!-- Detail header -->
        <div class="svc-detail__head">
          <div class="svc-detail__head-top">
            <div>
              <div class="svc-detail__name">{{ e.name }}</div>
              <div class="svc-detail__breadcrumb muted">
                <span>{{ e.department }}</span>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                <span>{{ e.commune }}</span>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                <span>{{ e.section }}</span>
              </div>
            </div>
            <div class="svc-detail__head-right">
              <span class="svc-status svc-status--{{ e.status }}">{{ statusLabel(e.status) }}</span>
              <button class="svc-detail__close" (click)="closeDetail()" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="svc-detail__update muted">Dernière mise à jour : {{ e.lastUpdate }}</div>
        </div>

        <!-- Detail tabs -->
        <div class="svc-detail__tabs">
          <button class="svc-dtab" [class.svc-dtab--active]="detailTab === 'resume'" (click)="detailTab = 'resume'" type="button">Résumé</button>
          <button class="svc-dtab" [class.svc-dtab--active]="detailTab === 'disponibilite'" (click)="detailTab = 'disponibilite'" type="button">Disponibilité</button>
          <button class="svc-dtab" [class.svc-dtab--active]="detailTab === 'points'" (click)="detailTab = 'points'" type="button">
            Points d'eau{{ e.waterPoints ? ' (' + e.waterPoints.length + ')' : '' }}
          </button>
          <button class="svc-dtab" [class.svc-dtab--active]="detailTab === 'incidents'" (click)="detailTab = 'incidents'" type="button">
            Incidents{{ e.incidents > 0 ? ' (' + e.incidents + ')' : '' }}
          </button>
          <button class="svc-dtab" [class.svc-dtab--active]="detailTab === 'infr'" (click)="detailTab = 'infr'" type="button">Infr. liées</button>
          <button class="svc-dtab" [class.svc-dtab--active]="detailTab === 'historique'" (click)="detailTab = 'historique'" type="button">Historique</button>
        </div>

        <!-- Detail body -->
        <div class="svc-detail__body">

          <!-- RÉSUMÉ -->
          <ng-container *ngIf="detailTab === 'resume'">
            <div class="svc-d-section">
              <div class="svc-d-title">RÉSUMÉ</div>
              <div class="svc-d-row-split">
                <div class="svc-d-rows">
                  <div class="svc-drow">
                    <span class="svc-drow__k">Statut du service</span>
                    <span class="svc-status svc-status--{{ e.status }}">{{ statusLabel(e.status) }}</span>
                  </div>
                  <div class="svc-drow">
                    <span class="svc-drow__k">Eau disponible</span>
                    <span [class.svc-yes]="e.waterAvailable" [class.svc-no]="!e.waterAvailable">{{ e.waterAvailable ? 'Oui' : 'Non' }}</span>
                  </div>
                  <div class="svc-drow">
                    <span class="svc-drow__k">Continuité</span>
                    <span class="svc-drow__v">{{ e.continuity }}</span>
                  </div>
                  <div class="svc-drow">
                    <span class="svc-drow__k">Pression moyenne</span>
                    <span class="svc-drow__v">{{ e.pressureMoy }}</span>
                  </div>
                  <div class="svc-drow">
                    <span class="svc-drow__k">Débit estimé</span>
                    <span class="svc-drow__v">{{ e.flowEst }}</span>
                  </div>
                  <div class="svc-drow" *ngIf="e.population">
                    <span class="svc-drow__k">Population estimée</span>
                    <span class="svc-drow__v">{{ e.population | number }} hab.</span>
                  </div>
                  <div class="svc-drow">
                    <span class="svc-drow__k">Responsable</span>
                    <span class="svc-drow__v">{{ e.responsable }}</span>
                  </div>
                  <div class="svc-drow">
                    <span class="svc-drow__k">Institution</span>
                    <span class="svc-drow__v">{{ e.institution }}</span>
                  </div>
                </div>
                <div class="svc-gauge-wrap">
                  <svg viewBox="0 0 110 75" width="110" height="75">
                    <path d="M 15 65 A 40 40 0 0 1 95 65" fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round"/>
                    <path d="M 15 65 A 40 40 0 0 1 95 65" fill="none"
                      [attr.stroke]="gaugeColor(e.serviceIndex)"
                      stroke-width="10" stroke-linecap="round"
                      [attr.stroke-dasharray]="gaugeLength(e.serviceIndex) + ' 200'"
                      stroke-dashoffset="0"/>
                    <text x="55" y="58" text-anchor="middle" font-size="17" font-weight="800" fill="#0f172a">{{ e.serviceIndex }}%</text>
                  </svg>
                  <span class="svc-gauge-label">Indice de service</span>
                </div>
              </div>
            </div>

            <!-- Supply chain -->
            <div class="svc-d-section" *ngIf="e.supplyChain">
              <div class="svc-d-title">CHAÎNE D'ALIMENTATION</div>
              <div class="svc-chain">
                <div class="svc-chain-node">
                  <div class="svc-chain-icon svc-chain-icon--resource">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  </div>
                  <div class="svc-chain-name">{{ e.supplyChain.resource }}</div>
                  <div class="svc-chain-type muted">Ressource</div>
                </div>
                <svg class="svc-chain-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                <div class="svc-chain-node">
                  <div class="svc-chain-icon svc-chain-icon--captage">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  </div>
                  <div class="svc-chain-name">{{ e.supplyChain.captage }}</div>
                  <div class="svc-chain-type muted">Captage</div>
                </div>
                <svg class="svc-chain-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                <div class="svc-chain-node">
                  <div class="svc-chain-icon svc-chain-icon--reservoir">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M2 20h20M4 20V8l8-6 8 6v12"/><rect x="9" y="14" width="6" height="6"/></svg>
                  </div>
                  <div class="svc-chain-name">{{ e.supplyChain.reservoir }}</div>
                  <div class="svc-chain-type muted">Réservoir</div>
                </div>
                <svg class="svc-chain-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                <div class="svc-chain-node">
                  <div class="svc-chain-icon svc-chain-icon--zone">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div class="svc-chain-name">{{ e.name }}</div>
                  <div class="svc-chain-type muted">Zone</div>
                </div>
              </div>
            </div>

            <!-- Active incidents -->
            <div class="svc-d-section" *ngIf="e.activeIncidents && e.activeIncidents.length > 0">
              <div class="svc-d-title">INCIDENTS ACTIFS ({{ e.activeIncidents.length }})</div>
              <div class="svc-inc-list">
                <div class="svc-inc-item" *ngFor="let inc of e.activeIncidents">
                  <span class="svc-inc-dot svc-inc-dot--{{ inc.severity }}"></span>
                  <div class="svc-inc-body">
                    <span class="svc-inc-label">{{ inc.label }}</span>
                    <span class="svc-inc-sev svc-inc-sev--{{ inc.severity }}">{{ severityLabel(inc.severity) }}</span>
                  </div>
                  <span class="svc-inc-date muted">{{ inc.date }}</span>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="muted"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
              <button class="svc-link-btn" type="button" (click)="detailTab = 'incidents'">Voir tous les incidents</button>
            </div>

            <!-- Actions -->
            <div class="svc-d-section">
              <div class="svc-d-title">ACTIONS</div>
              <div class="svc-d-actions">
                <button class="svc-action-btn" type="button" (click)="notifyInfra()">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  Voir infrastructures liées
                </button>
                <button class="svc-action-btn" type="button" (click)="notifyInterventions()">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  Voir interventions en cours
                </button>
              </div>
            </div>
          </ng-container>

          <!-- DISPONIBILITÉ -->
          <ng-container *ngIf="detailTab === 'disponibilite'">
            <div class="svc-d-section">
              <div class="svc-d-title">HORAIRES DE SERVICE</div>
              <div class="svc-drow"><span class="svc-drow__k">Heures de service</span><span class="svc-drow__v">{{ e.hoursService }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Continuité</span><span class="svc-drow__v">{{ e.continuity }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Jours de distribution</span><span class="svc-drow__v">{{ e.distributionDays }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Eau disponible</span><span [class.svc-yes]="e.waterAvailable" [class.svc-no]="!e.waterAvailable">{{ e.waterAvailable ? 'Oui' : 'Non' }}</span></div>
            </div>
            <div class="svc-d-section">
              <div class="svc-d-title">MESURES HYDRAULIQUES</div>
              <div class="svc-drow"><span class="svc-drow__k">Pression moyenne</span><span class="svc-drow__v">{{ e.pressureMoy }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Débit estimé</span><span class="svc-drow__v">{{ e.flowEst }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Interruptions récentes</span><span class="svc-drow__v">{{ e.incidents > 0 ? e.incidents + ' signalement(s)' : 'Aucune' }}</span></div>
            </div>
            <div class="svc-d-section">
              <div class="svc-d-title">INDICE DE SERVICE</div>
              <div class="svc-gauge-center">
                <svg viewBox="0 0 110 75" width="130" height="88">
                  <path d="M 15 65 A 40 40 0 0 1 95 65" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-linecap="round"/>
                  <path d="M 15 65 A 40 40 0 0 1 95 65" fill="none"
                    [attr.stroke]="gaugeColor(e.serviceIndex)"
                    stroke-width="12" stroke-linecap="round"
                    [attr.stroke-dasharray]="gaugeLength(e.serviceIndex) + ' 200'"
                    stroke-dashoffset="0"/>
                  <text x="55" y="60" text-anchor="middle" font-size="20" font-weight="800" fill="#0f172a">{{ e.serviceIndex }}%</text>
                </svg>
                <span class="svc-gauge-label">Indice de service</span>
              </div>
            </div>
          </ng-container>

          <!-- POINTS D'EAU -->
          <ng-container *ngIf="detailTab === 'points'">
            <div class="svc-d-section">
              <div class="svc-d-title">POINTS D'EAU ASSOCIÉS ({{ (e.waterPoints || []).length }})</div>
              <div *ngIf="!e.waterPoints || e.waterPoints.length === 0" class="muted" style="font-size:.8rem;padding:.5rem 0">Aucun point d'eau associé.</div>
              <div class="svc-wp-list" *ngIf="e.waterPoints && e.waterPoints.length > 0">
                <div class="svc-wp-item" *ngFor="let wp of e.waterPoints; let i = index">
                  <div class="svc-wp-dot" [style.background]="wpStatusColor(i)"></div>
                  <span class="svc-wp-name">{{ wp }}</span>
                  <span class="svc-status svc-status--{{ wpStatus(i) }}" style="font-size:.68rem">{{ statusLabel(wpStatus(i)) }}</span>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- INCIDENTS -->
          <ng-container *ngIf="detailTab === 'incidents'">
            <div class="svc-d-section">
              <div class="svc-d-title" style="display:flex;justify-content:space-between;align-items:center">
                INCIDENTS ACTIFS ({{ (e.activeIncidents || []).length }})
                <button class="svc-btn-sm svc-btn--primary" type="button" (click)="showCreateIncident = true">+ Créer</button>
              </div>
              <div *ngIf="!e.activeIncidents || e.activeIncidents.length === 0" class="muted" style="font-size:.8rem;padding:.5rem 0">Aucun incident actif.</div>
              <div class="svc-inc-list" *ngIf="e.activeIncidents && e.activeIncidents.length > 0">
                <div class="svc-inc-item" *ngFor="let inc of e.activeIncidents">
                  <span class="svc-inc-dot svc-inc-dot--{{ inc.severity }}"></span>
                  <div class="svc-inc-body">
                    <span class="svc-inc-label">{{ inc.label }}</span>
                    <span class="svc-inc-sev svc-inc-sev--{{ inc.severity }}">{{ severityLabel(inc.severity) }}</span>
                  </div>
                  <span class="svc-inc-date muted">{{ inc.date }}</span>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- INFRASTRUCTURES LIÉES -->
          <ng-container *ngIf="detailTab === 'infr'">
            <div class="svc-d-section" *ngIf="e.supplyChain">
              <div class="svc-d-title">CHAÎNE D'ALIMENTATION</div>
              <div class="svc-drow"><span class="svc-drow__k">Ressource naturelle</span><span class="svc-drow__v">{{ e.supplyChain.resource }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Captage</span><span class="svc-drow__v">{{ e.supplyChain.captage }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Réservoir lié</span><span class="svc-drow__v">{{ e.supplyChain.reservoir }}</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Conduite principale</span><span class="svc-drow__v">CD-01</span></div>
            </div>
            <div class="svc-d-section">
              <div class="svc-d-title">CAPTEURS IoT</div>
              <div class="svc-drow"><span class="svc-drow__k">Capteur pression</span><span class="svc-yes">Connecté</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Capteur débit</span><span class="svc-yes">Connecté</span></div>
              <div class="svc-drow"><span class="svc-drow__k">Dernière transmission</span><span class="svc-drow__v">{{ e.lastUpdate }}</span></div>
            </div>
          </ng-container>

          <!-- HISTORIQUE -->
          <ng-container *ngIf="detailTab === 'historique'">
            <div class="svc-d-section">
              <div class="svc-d-title">HISTORIQUE DES STATUTS</div>
              <div class="svc-hist-item">
                <div class="svc-hist-dot svc-hist-dot--normal"></div>
                <div class="svc-hist-body">
                  <span class="svc-hist-label">Service rétabli — Normal</span>
                  <span class="muted svc-hist-date">28/04/2026 16:40</span>
                </div>
              </div>
              <div class="svc-hist-item">
                <div class="svc-hist-dot svc-hist-dot--degrade"></div>
                <div class="svc-hist-body">
                  <span class="svc-hist-label">Statut dégradé — pression basse</span>
                  <span class="muted svc-hist-date">28/04/2026 08:15</span>
                </div>
              </div>
              <div class="svc-hist-item">
                <div class="svc-hist-dot svc-hist-dot--coupure"></div>
                <div class="svc-hist-body">
                  <span class="svc-hist-label">Coupure signalée — maintenance pompe</span>
                  <span class="muted svc-hist-date">27/04/2026 22:00</span>
                </div>
              </div>
              <div class="svc-hist-item">
                <div class="svc-hist-dot svc-hist-dot--normal"></div>
                <div class="svc-hist-body">
                  <span class="svc-hist-label">Service rétabli après intervention</span>
                  <span class="muted svc-hist-date">27/04/2026 11:30</span>
                </div>
              </div>
            </div>
          </ng-container>

        </div><!-- svc-detail__body -->
      </ng-container>
    </div>

  </div>
</div>

<!-- ══ DRAWERS ══════════════════════════════════════════════ -->

<!-- Overlay -->
<div class="svc-overlay" *ngIf="showCreateIncident || showPlanifier" (click)="showCreateIncident = false; showPlanifier = false"></div>

<!-- Créer incident drawer -->
<div class="svc-drawer svc-drawer--wide" [class.svc-drawer--open]="showCreateIncident">
  <div class="svc-drawer__head">
    <div>
      <h2 class="svc-drawer__title">Créer un incident de service</h2>
      <p class="svc-drawer__sub">Déclarer manuellement un problème affectant le service d'eau potable.</p>
    </div>
    <button class="svc-drawer__close" (click)="showCreateIncident = false" type="button">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="svc-drawer__body">

    <!-- ── 1. Informations générales ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">1</span>
        Informations générales
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Type d'incident <span class="svc-req">*</span></label>
        <select class="svc-form-select" [(ngModel)]="incidentForm.type" (ngModelChange)="incidentForm.cause = ''">
          <option value="">Sélectionner un type…</option>
          <option value="manque_eau">Manque d'eau</option>
          <option value="coupure">Coupure totale</option>
          <option value="pression_faible">Pression faible</option>
          <option value="debit_insuffisant">Débit insuffisant</option>
          <option value="point_ferme">Point d'eau fermé</option>
          <option value="eau_trouble">Eau trouble / qualité</option>
          <option value="distribution_retardee">Distribution retardée</option>
          <option value="zone_non_desservie">Zone non desservie</option>
          <option value="plainte_repetee">Plainte répétée</option>
        </select>
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Gravité <span class="svc-req">*</span></label>
        <div class="svc-radio-group">
          <label class="svc-radio" style="color:#7c3aed" [class.svc-radio--sel]="incidentForm.severity === 'critique'" (click)="incidentForm.severity = 'critique'">Critique</label>
          <label class="svc-radio svc-radio--crit" [class.svc-radio--sel]="incidentForm.severity === 'haute'" (click)="incidentForm.severity = 'haute'">Haute</label>
          <label class="svc-radio svc-radio--warn" [class.svc-radio--sel]="incidentForm.severity === 'moyenne'" (click)="incidentForm.severity = 'moyenne'">Moyenne</label>
          <label class="svc-radio svc-radio--ok" [class.svc-radio--sel]="incidentForm.severity === 'basse'" (click)="incidentForm.severity = 'basse'">Basse</label>
        </div>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Source du signalement</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.source">
            <option value="admin">Administrateur</option>
            <option value="technicien">Agent / Technicien terrain</option>
            <option value="usager">Plainte usager</option>
            <option value="iot">Capteur IoT</option>
            <option value="mairie">Institution locale / Mairie</option>
          </select>
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Date / heure de début</label>
          <input type="datetime-local" class="svc-form-input" [(ngModel)]="incidentForm.startedAt">
        </div>
      </div>
    </div>

    <!-- ── 2. Localisation ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">2</span>
        Localisation
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Département <span class="svc-req">*</span></label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.dept" (ngModelChange)="onIncidentDeptChange()">
            <option value="">Sélectionner…</option>
            <option *ngFor="let d of depts" [value]="d">{{ d }}</option>
          </select>
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Commune <span class="svc-req">*</span></label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.commune" [disabled]="!incidentForm.dept" (ngModelChange)="onIncidentCommuneChange()">
            <option value="">Sélectionner…</option>
            <option *ngFor="let c of incidentCommunes()" [value]="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Section communale</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.section" [disabled]="!incidentForm.commune" (ngModelChange)="onIncidentSectionChange()">
            <option value="">Toutes les sections</option>
            <option *ngFor="let s of incidentSections()" [value]="s">{{ s }}</option>
          </select>
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Localité</label>
          <input class="svc-form-input" [(ngModel)]="incidentForm.locality" placeholder="Ex : Nan Palmiste, Marché central…">
        </div>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Zone de service concernée</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.zoneId" [disabled]="!incidentForm.commune" (ngModelChange)="onIncidentZoneChange()">
            <option value="">Sélectionner…</option>
            <option *ngFor="let z of incidentZones()" [value]="z.id">{{ z.name }}</option>
          </select>
          <span class="svc-form-hint" *ngIf="!incidentForm.commune">Choisissez d'abord une commune</span>
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Point d'eau concerné</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.waterPointId" [disabled]="!incidentForm.commune">
            <option value="">Optionnel…</option>
            <option *ngFor="let p of incidentWaterPoints()" [value]="p.id">{{ p.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── 3. Réseau lié ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">3</span>
        Réseau lié
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Réservoir lié</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.reservoirId">
            <option value="">Aucun / inconnu</option>
            <option *ngFor="let r of incidentReservoirs()" [value]="r.id">{{ r.name }} — {{ r.code }}</option>
          </select>
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Infrastructure concernée</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.infrastructureId">
            <option value="">Aucune / inconnue</option>
            <option *ngFor="let i of incidentInfrastructures()" [value]="i.id">{{ i.name }} ({{ i.code }})</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── 4. Description ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">4</span>
        Description
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Description de l'incident</label>
        <textarea class="svc-form-textarea" [(ngModel)]="incidentForm.description" rows="3" placeholder="Décrire le problème observé sur le terrain…"></textarea>
      </div>

      <div class="svc-form-group" *ngIf="incidentForm.type">
        <label class="svc-form-label">Cause probable</label>
        <select class="svc-form-select" [(ngModel)]="incidentForm.cause">
          <option value="">Sélectionner ou laisser vide</option>
          <option *ngFor="let c of incidentCausesForType()" [value]="c">{{ c }}</option>
        </select>
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Recommandation proposée</label>
        <textarea class="svc-form-textarea" [(ngModel)]="incidentForm.recommendation" rows="2" placeholder="Action recommandée pour résoudre l'incident…"></textarea>
      </div>
    </div>

    <!-- ── 5. Assignation ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">5</span>
        Assignation
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Institution responsable</label>
        <select class="svc-form-select" [(ngModel)]="incidentForm.institutionId" (ngModelChange)="incidentForm.responsableId = ''; incidentForm.technicianId = ''">
          <option value="">Non assignée</option>
          <option *ngFor="let i of incidentInstitutions()" [value]="i.id">{{ i.name }} — {{ i.type }}</option>
        </select>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Responsable superviseur</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.responsableId" [disabled]="!incidentForm.institutionId">
            <option value="">Sélectionner…</option>
            <option *ngFor="let r of incidentResponsables()" [value]="r.id">{{ r.name }}</option>
          </select>
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Technicien proposé</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.technicianId" [disabled]="!incidentForm.institutionId">
            <option value="">Sélectionner…</option>
            <option *ngFor="let t of incidentTechs()" [value]="t.id">{{ t.name }} — {{ t.specialty }}</option>
          </select>
          <span class="svc-form-hint" style="color:#f97316"
            *ngIf="incidentForm.institutionId && incidentTechs().length === 0">
            Aucun technicien actif pour cette institution. Ajoutez-en dans Gouvernance.
          </span>
        </div>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Priorité d'intervention</label>
          <select class="svc-form-select" [(ngModel)]="incidentForm.priority">
            <option value="critique">Critique — intervention immédiate</option>
            <option value="haute">Haute — dans les 24h</option>
            <option value="normale">Normale — dans les 48h</option>
            <option value="basse">Basse — planifiable</option>
          </select>
        </div>
        <div class="svc-form-group" style="justify-content:flex-end;padding-top:1.4rem">
          <label class="svc-toggle-row">
            <input type="checkbox" [(ngModel)]="incidentForm.createAlert">
            <span class="svc-toggle-label">Créer une alerte associée</span>
          </label>
        </div>
      </div>
    </div>

    <!-- ── 6. Résumé ── -->
    <div class="svc-drawer__section svc-drawer__section--summary" *ngIf="incidentSummary()">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">6</span>
        Résumé avant enregistrement
      </div>
      <p class="svc-summary-text">{{ incidentSummary() }}</p>
    </div>

  </div>

  <div class="svc-drawer__foot">
    <button class="svc-btn svc-btn--ghost" (click)="showCreateIncident = false" type="button">Annuler</button>
    <button class="svc-btn svc-btn--primary" (click)="submitIncident()" type="button">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
      Enregistrer l'incident
    </button>
  </div>
</div>

<!-- Planifier distribution drawer -->
<div class="svc-drawer svc-drawer--wide" [class.svc-drawer--open]="showPlanifier">
  <div class="svc-drawer__head">
    <div>
      <h2 class="svc-drawer__title">Planifier une distribution</h2>
      <p class="svc-drawer__sub">Définir les créneaux de distribution d'eau pour une zone desservie.</p>
    </div>
    <button class="svc-drawer__close" (click)="showPlanifier = false" type="button">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="svc-drawer__body">

    <!-- ── 1. Zone de service ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">1</span>
        Zone de service
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Zone concernée <span class="svc-req">*</span></label>
        <select class="svc-form-select" [(ngModel)]="distribForm.zoneId" (ngModelChange)="onDistribZoneChange()">
          <option value="">Sélectionner une zone…</option>
          <option *ngFor="let e of zoneEntities" [value]="e.id">{{ e.name }} — {{ e.commune }}</option>
        </select>
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Réservoir source <span class="svc-req">*</span></label>
        <select class="svc-form-select" [(ngModel)]="distribForm.reservoirId" [disabled]="!distribForm.zoneId">
          <option value="">Sélectionner un réservoir…</option>
          <option *ngFor="let r of distribReservoirs()" [value]="r.id">
            {{ r.name }} — {{ r.capacity ?? '—' }} — {{ r.status === 'en-service' ? 'En service' : r.status }}
          </option>
        </select>
        <span class="svc-form-hint" *ngIf="!distribForm.zoneId">Choisissez d'abord une zone</span>
      </div>

      <div class="svc-form-group" *ngIf="distribForm.zoneId">
        <label class="svc-form-label">Points d'eau concernés</label>
        <div class="svc-check-list">
          <label class="svc-check-row" *ngFor="let p of distribWaterPoints()">
            <input type="checkbox" [checked]="distribForm.waterPointIds.includes(p.id)" (change)="toggleWaterPoint(p.id)">
            <span>{{ p.name }} <span class="svc-check-meta">{{ p.code }} — {{ p.section ?? p.commune }}</span></span>
          </label>
          <span class="svc-form-hint" *ngIf="distribWaterPoints().length === 0">Aucun point d'eau enregistré pour cette zone</span>
        </div>
      </div>
    </div>

    <!-- ── 2. État du réservoir ── -->
    <div class="svc-drawer__section" *ngIf="distribForm.reservoirId">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">2</span>
        État du réservoir
      </div>
      <div class="svc-res-status" [class.svc-res-status--warn]="distribReservoirAlerts() === 'faible'" [class.svc-res-status--crit]="distribReservoirAlerts() === 'critique'">
        <div class="svc-res-status__row">
          <span class="svc-res-status__label">Capacité</span>
          <span class="svc-res-status__val">{{ distribReservoirInfo()?.capacity ?? '—' }}</span>
        </div>
        <div class="svc-res-status__row">
          <span class="svc-res-status__label">Niveau actuel</span>
          <span class="svc-res-status__val">
            <ng-container *ngIf="distribReservoirLevel() !== undefined; else noLevel">
              <span [class.svc-val--red]="(distribReservoirLevel() ?? 100) < 20" [class.svc-val--orange]="(distribReservoirLevel() ?? 100) >= 20 && (distribReservoirLevel() ?? 100) < 35">
                {{ distribReservoirLevel() }} %
              </span>
              <div class="svc-level-bar"><div class="svc-level-bar__fill" [style.width.%]="distribReservoirLevel()" [class.svc-level-bar__fill--warn]="(distribReservoirLevel() ?? 100) < 35" [class.svc-level-bar__fill--crit]="(distribReservoirLevel() ?? 100) < 20"></div></div>
            </ng-container>
            <ng-template #noLevel>—</ng-template>
          </span>
        </div>
        <div class="svc-res-status__row">
          <span class="svc-res-status__label">Statut</span>
          <span class="svc-res-status__val">
            <span class="svc-badge" [class.svc-badge--green]="distribReservoirInfo()?.status === 'en-service'" [class.svc-badge--orange]="distribReservoirInfo()?.status === 'a-inspecter'" [class.svc-badge--red]="distribReservoirInfo()?.status === 'critique' || distribReservoirInfo()?.status === 'hors-service'">
              {{ distribReservoirInfo()?.status === 'en-service' ? 'En service' : distribReservoirInfo()?.status === 'a-inspecter' ? 'À inspecter' : distribReservoirInfo()?.status ?? '—' }}
            </span>
          </span>
        </div>
        <div class="svc-res-status__row">
          <span class="svc-res-status__label">Dernière donnée IoT</span>
          <span class="svc-res-status__val">{{ distribReservoirInfo()?.lastActivity ?? '—' }}</span>
        </div>
        <div class="svc-res-status__alert" *ngIf="distribReservoirAlerts()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
          <span *ngIf="distribReservoirAlerts() === 'critique'">Niveau critique (&lt; 20 %) — Distribution à risque élevé.</span>
          <span *ngIf="distribReservoirAlerts() === 'faible'">Niveau faible (&lt; 35 %) — Planification possible mais surveiller l'évolution.</span>
        </div>
      </div>
    </div>

    <!-- ── 3. Créneau ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">3</span>
        Créneau de distribution
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Type de planification</label>
        <div class="svc-radio-group">
          <label class="svc-radio" [class.svc-radio--sel]="distribForm.scheduleType === 'unique'" (click)="distribForm.scheduleType = 'unique'">Ponctuelle</label>
          <label class="svc-radio" [class.svc-radio--sel]="distribForm.scheduleType === 'weekly'" (click)="distribForm.scheduleType = 'weekly'">Hebdomadaire</label>
          <label class="svc-radio" [class.svc-radio--sel]="distribForm.scheduleType === 'temporary'" (click)="distribForm.scheduleType = 'temporary'">Temporaire</label>
          <label class="svc-radio" [class.svc-radio--sel]="distribForm.scheduleType === 'permanent'" (click)="distribForm.scheduleType = 'permanent'">Permanente</label>
        </div>
      </div>

      <div class="svc-form-row" *ngIf="distribForm.scheduleType !== 'permanent'">
        <div class="svc-form-group">
          <label class="svc-form-label">Date de début</label>
          <input type="date" class="svc-form-input" [(ngModel)]="distribForm.startDate">
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Date de fin</label>
          <input type="date" class="svc-form-input" [(ngModel)]="distribForm.endDate">
        </div>
      </div>

      <div class="svc-form-group" *ngIf="distribForm.scheduleType !== 'unique'">
        <label class="svc-form-label">Jours de distribution <span class="svc-req">*</span></label>
        <div class="svc-days-grid">
          <label class="svc-day" [class.svc-day--sel]="distribForm.days.includes('lun')" (click)="toggleDay('lun')">Lun</label>
          <label class="svc-day" [class.svc-day--sel]="distribForm.days.includes('mar')" (click)="toggleDay('mar')">Mar</label>
          <label class="svc-day" [class.svc-day--sel]="distribForm.days.includes('mer')" (click)="toggleDay('mer')">Mer</label>
          <label class="svc-day" [class.svc-day--sel]="distribForm.days.includes('jeu')" (click)="toggleDay('jeu')">Jeu</label>
          <label class="svc-day" [class.svc-day--sel]="distribForm.days.includes('ven')" (click)="toggleDay('ven')">Ven</label>
          <label class="svc-day" [class.svc-day--sel]="distribForm.days.includes('sam')" (click)="toggleDay('sam')">Sam</label>
          <label class="svc-day" [class.svc-day--sel]="distribForm.days.includes('dim')" (click)="toggleDay('dim')">Dim</label>
        </div>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Heure de début <span class="svc-req">*</span></label>
          <input type="time" class="svc-form-input" [(ngModel)]="distribForm.startTime">
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Heure de fin <span class="svc-req">*</span></label>
          <input type="time" class="svc-form-input" [(ngModel)]="distribForm.endTime">
        </div>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Volume prévu</label>
          <input type="number" class="svc-form-input" [(ngModel)]="distribForm.expectedVolume" placeholder="ex : 2000" min="0">
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Unité</label>
          <select class="svc-form-select" [(ngModel)]="distribForm.volumeUnit">
            <option value="L">Litres (L)</option>
            <option value="m3">Mètres cubes (m³)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── 4. Responsabilité ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">4</span>
        Responsabilité
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Institution responsable <span class="svc-req">*</span></label>
        <select class="svc-form-select" [(ngModel)]="distribForm.institutionId" (ngModelChange)="distribForm.responsableId = ''; distribForm.technicianId = ''">
          <option value="">Sélectionner…</option>
          <option *ngFor="let i of distribInstitutions()" [value]="i.id">{{ i.name }} — {{ i.type }}</option>
        </select>
      </div>

      <div class="svc-form-row">
        <div class="svc-form-group">
          <label class="svc-form-label">Responsable superviseur</label>
          <select class="svc-form-select" [(ngModel)]="distribForm.responsableId" [disabled]="!distribForm.institutionId">
            <option value="">Sélectionner…</option>
            <option *ngFor="let r of distribResponsables()" [value]="r.id">{{ r.name }} — {{ r.fonction }}</option>
          </select>
        </div>
        <div class="svc-form-group">
          <label class="svc-form-label">Technicien référent</label>
          <select class="svc-form-select" [(ngModel)]="distribForm.technicianId" [disabled]="!distribForm.institutionId">
            <option value="">Sélectionner…</option>
            <option *ngFor="let t of distribTechniciens()" [value]="t.id">{{ t.name }} — {{ t.specialty }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── 5. Options ── -->
    <div class="svc-drawer__section">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">5</span>
        Options &amp; observations
      </div>

      <div class="svc-form-group">
        <label class="svc-toggle-row">
          <input type="checkbox" [(ngModel)]="distribForm.notify">
          <span class="svc-toggle-label">Notifier les responsables concernés</span>
        </label>
      </div>

      <div class="svc-form-group">
        <label class="svc-form-label">Observation</label>
        <textarea class="svc-form-textarea" [(ngModel)]="distribForm.notes" rows="3" placeholder="Conditions particulières, restrictions, notes opérationnelles…"></textarea>
      </div>
    </div>

    <!-- ── 6. Résumé ── -->
    <div class="svc-drawer__section svc-drawer__section--summary" *ngIf="distribSummary()">
      <div class="svc-drawer__section-label">
        <span class="svc-drawer__section-num">6</span>
        Résumé avant validation
      </div>
      <p class="svc-summary-text">{{ distribSummary() }}</p>
    </div>

  </div>

  <div class="svc-drawer__foot">
    <button class="svc-btn svc-btn--ghost" (click)="showPlanifier = false" type="button">Annuler</button>
    <button class="svc-btn svc-btn--success" (click)="submitDistrib()" type="button">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
      Enregistrer la planification
    </button>
  </div>
</div>
  `,
  styles: []
})
export class ServicePageComponent {
  selectedId?: string;
  detailTab: DetailTab = 'resume';

  filtresOuverts = false;
  filterDept = '';
  filterCommune = '';
  filterSection = '';
  filterStatus = '';
  filterType = '';
  filterReservoir = '';
  filterResource = '';
  filterPeriod = '2026-04-29';
  filterInstitution = '';

  showLayers = false;
  showLegend = true;
  showCreateIncident = false;
  showPlanifier = false;

  layers = {
    normal: true, intermittent: true, degrade: true, coupure: true, inconnu: true,
    pointsActifs: true, pointsFaibles: true, pointsHors: true, pointsPlanifies: true,
    reservoirs: true, conduites: false,
  };

  currentPage = 1;
  pageSize = 10;

  readonly entities = ENTITIES;

  get zoneEntities(): ServiceEntity[] {
    return this.entities.filter(e => e.entityType === 'zone');
  }

  get kpiTotal(): number { return this.filteredEntities().length; }
  get kpiNormal(): number { return this.filteredEntities().filter(e => e.status === 'normal').length; }
  get kpiDegrade(): number { return this.filteredEntities().filter(e => e.status === 'degrade' || e.status === 'intermittent').length; }
  get kpiCoupure(): number { return this.filteredEntities().filter(e => e.status === 'coupure').length; }
  get kpiPointsActifs(): number { return this.filteredEntities().filter(e => e.entityType === 'point' && e.waterAvailable).length; }
  get kpiIncidents(): number { return this.filteredEntities().reduce((sum, e) => sum + (e.incidents ?? 0), 0); }

  incidentForm = {
    type: '', severity: 'haute' as 'haute' | 'critique' | 'moyenne' | 'basse',
    source: 'admin' as 'admin' | 'technicien' | 'usager' | 'iot' | 'mairie',
    startedAt: new Date().toISOString().slice(0, 16),
    dept: '', commune: '', section: '', locality: '',
    zoneId: '', waterPointId: '',
    reservoirId: '', infrastructureId: '',
    description: '', cause: '', recommendation: '',
    institutionId: '', responsableId: '', technicianId: '',
    priority: 'haute' as 'critique' | 'haute' | 'normale' | 'basse',
    createAlert: false,
  };

  incidents: Array<{ id: string; type: string; severity: string; commune: string; zoneId: string; createdAt: string }> = [];

  distribForm = {
    zoneId: '',
    reservoirId: '',
    waterPointIds: [] as string[],
    scheduleType: 'weekly' as 'unique' | 'weekly' | 'temporary' | 'permanent',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    days: [] as string[],
    startTime: '06:00',
    endTime: '12:00',
    expectedVolume: '',
    volumeUnit: 'L' as 'L' | 'm3',
    institutionId: '',
    responsableId: '',
    technicianId: '',
    notify: true,
    notes: '',
  };

  distribSchedules: Array<typeof this.distribForm & { id: string; createdAt: string }> = [];

  readonly depts = HAITI_DEPARTMENTS;

  communesForDept(): string[] { return this.geo.communesForDept(this.filterDept); }
  sectionsForScope(): string[] { return this.geo.sectionsForScope(this.filterCommune, this.filterDept); }

  onFilterDeptChange(): void { this.filterCommune = ''; this.filterSection = ''; }
  onFilterCommuneChange(): void { this.filterSection = ''; }

  // ─── Distribution form helpers ───────────────────────────────────────────
  distribZone(): typeof ENTITIES[0] | undefined {
    return this.entities.find(e => e.id === this.distribForm.zoneId && e.entityType === 'zone');
  }

  distribReservoirs(): Infrastructure[] {
    const zone = this.distribZone();
    if (!zone) return this.infraStore.getReservoirs();
    return this.infraStore.getReservoirs().filter(r =>
      !r.commune || r.commune === zone.commune || r.aepSystem === zone.supplyChain?.reservoir?.split(' ')[0],
    );
  }

  distribWaterPoints(): Infrastructure[] {
    const zone = this.distribZone();
    if (!zone) return this.infraStore.snapshot.filter(i => ['point-eau','borne','kiosque'].includes(i.type));
    return this.infraStore.snapshot.filter(i =>
      ['point-eau','borne','kiosque'].includes(i.type) && i.commune === zone.commune,
    );
  }

  distribReservoirInfo(): Infrastructure | undefined {
    return this.infraStore.snapshot.find(r => r.id === this.distribForm.reservoirId);
  }

  distribReservoirLevel(): number | undefined {
    const r = this.distribReservoirInfo();
    return r?.sensors.find(s => s.type === 'niveau')?.value;
  }

  distribReservoirAlerts(): string {
    const lvl = this.distribReservoirLevel();
    if (lvl === undefined) return '';
    if (lvl < 20) return 'critique';
    if (lvl < 35) return 'faible';
    return '';
  }

  distribInstitutions() { return this.govStore.institutions.filter(i => i.status === 'active'); }

  distribResponsables() {
    const inst = this.govStore.institutions.find(i => i.id === this.distribForm.institutionId);
    if (!inst) return this.govStore.responsables;
    return this.govStore.responsables.filter(r => r.institution === inst.name);
  }

  distribTechniciens() {
    const inst = this.govStore.institutions.find(i => i.id === this.distribForm.institutionId);
    if (!inst) return this.govStore.techniciens;
    return this.govStore.techniciensForInstitution(inst.name);
  }

  distribSummary(): string {
    const zone = this.distribZone();
    const res = this.distribReservoirInfo();
    const inst = this.govStore.institutions.find(i => i.id === this.distribForm.institutionId);
    if (!zone || !res || this.distribForm.days.length === 0) return '';
    const dayLabels: Record<string, string> = { lun: 'lundi', mar: 'mardi', mer: 'mercredi', jeu: 'jeudi', ven: 'vendredi', sam: 'samedi', dim: 'dimanche' };
    const days = this.distribForm.days.map(d => dayLabels[d] ?? d).join(', ');
    return `${zone.name} sera desservie par ${res.name} — les ${days} de ${this.distribForm.startTime} à ${this.distribForm.endTime}${inst ? ` — Responsable : ${inst.name}` : ''}.`;
  }

  toggleWaterPoint(id: string): void {
    const idx = this.distribForm.waterPointIds.indexOf(id);
    if (idx >= 0) this.distribForm.waterPointIds.splice(idx, 1);
    else this.distribForm.waterPointIds.push(id);
  }

  // ─── Incident form helpers ───────────────────────────────────────────────
  incidentCommunes(): string[] { return this.geo.communesForDept(this.incidentForm.dept); }
  incidentSections(): string[] { return this.geo.sectionsForScope(this.incidentForm.commune, this.incidentForm.dept); }

  incidentZones(): ServiceEntity[] {
    let list = this.entities.filter(e => e.entityType === 'zone');
    if (this.incidentForm.commune) list = list.filter(e => e.commune === this.incidentForm.commune);
    if (this.incidentForm.section) list = list.filter(e => e.section === this.incidentForm.section);
    return list;
  }

  incidentWaterPoints(): ServiceEntity[] {
    let list = this.entities.filter(e => e.entityType === 'point');
    if (this.incidentForm.commune) list = list.filter(e => e.commune === this.incidentForm.commune);
    if (this.incidentForm.section) list = list.filter(e => e.section === this.incidentForm.section);
    return list;
  }

  incidentReservoirs(): Infrastructure[] {
    const res = this.infraStore.getReservoirs();
    if (this.incidentForm.commune) return res.filter(r => !r.commune || r.commune === this.incidentForm.commune);
    return res;
  }

  incidentInfrastructures(): Infrastructure[] {
    let list = this.infraStore.snapshot;
    if (this.incidentForm.commune) list = list.filter(i => i.commune === this.incidentForm.commune);
    return list;
  }

  incidentInstitutions() { return this.govStore.institutions.filter(i => i.status === 'active'); }
  incidentResponsables() {
    const inst = this.govStore.institutions.find(i => i.id === this.incidentForm.institutionId);
    if (!inst) return this.govStore.responsables;
    return this.govStore.responsables.filter(r => r.institution === inst.name);
  }
  incidentTechs() {
    const inst = this.govStore.institutions.find(i => i.id === this.incidentForm.institutionId);
    return this.govStore.techniciensForInstitution(inst?.name ?? '');
  }

  onIncidentDeptChange(): void { this.incidentForm.commune = ''; this.incidentForm.section = ''; this.incidentForm.zoneId = ''; this.incidentForm.waterPointId = ''; }
  onIncidentCommuneChange(): void { this.incidentForm.section = ''; this.incidentForm.zoneId = ''; this.incidentForm.waterPointId = ''; }
  onIncidentSectionChange(): void { this.incidentForm.zoneId = ''; this.incidentForm.waterPointId = ''; }

  onIncidentZoneChange(): void {
    const zone = this.entities.find(e => e.id === this.incidentForm.zoneId);
    if (!zone) return;
    if (!this.incidentForm.commune) this.incidentForm.commune = zone.commune;
    if (!this.incidentForm.section) this.incidentForm.section = zone.section;
    const inst = this.govStore.institutions.find(i => i.name === zone.institution);
    if (inst && !this.incidentForm.institutionId) this.incidentForm.institutionId = inst.id;
    const reservoirs = this.incidentReservoirs();
    if (reservoirs.length === 1 && !this.incidentForm.reservoirId) this.incidentForm.reservoirId = reservoirs[0].id;
  }

  incidentCausesForType(): string[] {
    const map: Record<string, string[]> = {
      manque_eau:           ['Niveau bas du réservoir', 'Pompe hors service', 'Ressource insuffisante', 'Conduite endommagée', 'Cause inconnue'],
      coupure:              ['Pompe arrêtée', 'Coupure électrique', 'Maintenance planifiée', 'Rupture de conduite', 'Cause inconnue'],
      pression_faible:      ['Débit insuffisant en amont', 'Fuite sur conduite', 'Vanne partiellement fermée', 'Cause inconnue'],
      debit_insuffisant:    ['Source faible', 'Captage obstrué', 'Pompe sous-dimensionnée', 'Cause inconnue'],
      point_ferme:          ['Vandalisme', 'Maintenance', 'Fermeture administrative', 'Cause inconnue'],
      eau_trouble:          ['Turbidité élevée', 'Contamination suspectée', 'Après forte pluie', 'Cause inconnue'],
      distribution_retardee:['Panne pompe', 'Absence technicien', 'Problème organisationnel', 'Cause inconnue'],
      zone_non_desservie:   ['Pas de réseau dans la zone', 'Coupure totale', 'Infrastructure manquante', 'Cause inconnue'],
      plainte_repetee:      ['Pression chroniquement basse', 'Service irrégulier', 'Qualité dégradée', 'Cause inconnue'],
    };
    return map[this.incidentForm.type] ?? ['Cause inconnue'];
  }

  incidentSummary(): string {
    if (!this.incidentForm.type || !this.incidentForm.commune) return '';
    const typeLabels: Record<string, string> = {
      manque_eau: "Manque d'eau", coupure: 'Coupure', pression_faible: 'Pression faible',
      debit_insuffisant: 'Débit insuffisant', eau_trouble: 'Eau trouble',
      distribution_retardee: 'Distribution retardée', zone_non_desservie: 'Zone non desservie',
    };
    const label = typeLabels[this.incidentForm.type] ?? this.incidentForm.type;
    const zone = this.entities.find(e => e.id === this.incidentForm.zoneId);
    const inst = this.govStore.institutions.find(i => i.id === this.incidentForm.institutionId);
    const loc = zone ? zone.name : `${this.incidentForm.commune}${this.incidentForm.section ? ' / ' + this.incidentForm.section : ''}`;
    return `${label} déclaré(e) à ${loc} — Gravité : ${this.incidentForm.severity}${inst ? ' — Responsable : ' + inst.name : ''}.`;
  }

  onDistribZoneChange(): void {
    this.distribForm.reservoirId = '';
    this.distribForm.waterPointIds = [];
    const zone = this.distribZone();
    if (zone) {
      const inst = this.govStore.institutions.find(i => i.name === zone.institution);
      if (inst) this.distribForm.institutionId = inst.id;
    }
    const reservoirs = this.distribReservoirs();
    if (reservoirs.length === 1) this.distribForm.reservoirId = reservoirs[0].id;
  }

  constructor(
    readonly toast: ToastService,
    private readonly geo: HaitiGeoService,
    readonly govStore: GovernanceStore,
    readonly infraStore: InfrastructureStore,
  ) {}

  readonly legend = SERVICE_LEGEND;

  mapItems(): GeoMapItem[] {
    const items: GeoMapItem[] = [];
    for (const e of this.filteredEntities()) {
      if (e.entityType === 'zone') {
        if (!this.layers[e.status as keyof typeof this.layers]) continue;
        items.push({
          id: e.id, lat: e.lat, lng: e.lng,
          color: statusColor(e.status),
          label: e.name, shape: 'zone', radius: 2800,
          tooltip: `${e.name} — ${this.statusLabel(e.status)}`,
          pulse: e.status === 'coupure',
        });
      } else {
        items.push({
          id: e.id, lat: e.lat, lng: e.lng,
          color: statusColor(e.status),
          shape: 'dot', size: 11,
          tooltip: `${e.name} — ${this.statusLabel(e.status)}`,
        });
      }
    }
    if (this.layers.reservoirs) {
      for (const r of this.infraStore.getReservoirs()) {
        if (r.lat != null && r.lon != null) {
          items.push({ id: r.id, lat: r.lat, lng: r.lon, color: '#0d9488', shape: 'dot', size: 9, tooltip: r.name });
        }
      }
    }
    return items;
  }

  selectEntity(id: string): void {
    this.selectedId = id;
    this.detailTab = 'resume';
  }

  closeDetail(): void {
    this.selectedId = undefined;
  }

  selectedEntity(): ServiceEntity | undefined {
    return this.entities.find(e => e.id === this.selectedId);
  }

  filteredEntities(): ServiceEntity[] {
    return this.entities.filter(e => {
      if (this.filterStatus && e.status !== this.filterStatus) return false;
      if (this.filterDept && e.department !== this.filterDept) return false;
      if (this.filterCommune && e.commune !== this.filterCommune) return false;
      if (this.filterSection && e.section !== this.filterSection) return false;
      if (this.filterType && e.type !== this.filterType) return false;
      if (this.filterReservoir && e.reservoirId !== this.filterReservoir) return false;
      return true;
    });
  }

  pagedEntities(): ServiceEntity[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredEntities().slice(start, start + +this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEntities().length / +this.pageSize));
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      normal: 'Normal', intermittent: 'Intermittent', degrade: 'Dégradé',
      coupure: 'En coupure', retablissement: 'En rétablissement',
      non_desservi: 'Non desservi', inconnu: 'Inconnu',
    };
    return map[status] ?? status;
  }

  severityLabel(s: string): string {
    return s === 'haute' ? 'Haute' : s === 'moyenne' ? 'Moyenne' : 'Basse';
  }

  gaugeLength(pct: number): number {
    return Math.round(125.7 * pct / 100);
  }

  gaugeColor(pct: number): string {
    if (pct >= 75) return '#16a34a';
    if (pct >= 40) return '#f59e0b';
    if (pct > 0) return '#f97316';
    return '#dc2626';
  }

  wpStatus(idx: number): ServiceStatus {
    const statuses: ServiceStatus[] = ['normal', 'degrade', 'coupure'];
    return statuses[idx % statuses.length];
  }

  wpStatusColor(idx: number): string {
    return statusColor(this.wpStatus(idx));
  }

  resetFilters(): void {
    this.filterDept = ''; this.filterCommune = ''; this.filterSection = '';
    this.filterStatus = ''; this.filterType = ''; this.filterReservoir = '';
    this.filterResource = ''; this.filterInstitution = '';
    this.currentPage = 1;
  }

  refresh(): void {
    this.toast.push('success', 'Données actualisées — 29/04/2026 09:45');
  }

  toggleDay(day: string): void {
    const idx = this.distribForm.days.indexOf(day);
    if (idx >= 0) this.distribForm.days.splice(idx, 1);
    else this.distribForm.days.push(day);
  }

  submitIncident(): void {
    if (!this.incidentForm.type) {
      this.toast.push('error', 'Veuillez sélectionner un type d\'incident');
      return;
    }
    if (!this.incidentForm.dept || !this.incidentForm.commune) {
      this.toast.push('error', 'Veuillez renseigner au moins le département et la commune');
      return;
    }

    const zone = this.entities.find(e => e.id === this.incidentForm.zoneId);
    const inst = this.govStore.institutions.find(i => i.id === this.incidentForm.institutionId);
    const typeLabels: Record<string, string> = {
      manque_eau: "Manque d'eau", coupure: 'Coupure', pression_faible: 'Pression faible',
      debit_insuffisant: 'Débit insuffisant', point_ferme: "Point d'eau fermé",
      eau_trouble: 'Eau trouble', distribution_retardee: 'Distribution retardée',
      zone_non_desservie: 'Zone non desservie', plainte_repetee: 'Plainte répétée',
    };

    this.incidents = [{
      id: `INC-${Date.now()}`,
      type: this.incidentForm.type,
      severity: this.incidentForm.severity,
      commune: this.incidentForm.commune,
      zoneId: this.incidentForm.zoneId,
      createdAt: new Date().toISOString(),
    }, ...this.incidents];

    const label = typeLabels[this.incidentForm.type] ?? this.incidentForm.type;
    const zoneName = zone ? ` — ${zone.name}` : this.incidentForm.commune ? ` — ${this.incidentForm.commune}` : '';
    this.showCreateIncident = false;
    this.toast.push('success', `Incident créé : ${label}${zoneName}${inst ? ` — Assigné à ${inst.name}` : ''}`);

    if (this.incidentForm.createAlert || this.incidentForm.severity === 'critique') {
      this.toast.push('info', 'Alerte associée créée automatiquement dans le module Alertes');
    }

    this.incidentForm = {
      type: '', severity: 'haute', source: 'admin', startedAt: new Date().toISOString().slice(0, 16),
      dept: '', commune: '', section: '', locality: '',
      zoneId: '', waterPointId: '', reservoirId: '', infrastructureId: '',
      description: '', cause: '', recommendation: '',
      institutionId: '', responsableId: '', technicianId: '',
      priority: 'haute', createAlert: false,
    };
  }

  submitDistrib(): void {
    if (!this.distribForm.zoneId)       { this.toast.push('error', 'Veuillez sélectionner une zone de service'); return; }
    if (!this.distribForm.reservoirId)  { this.toast.push('error', 'Veuillez choisir un réservoir source'); return; }
    if (this.distribForm.days.length === 0) { this.toast.push('error', 'Sélectionnez au moins un jour de distribution'); return; }
    if (!this.distribForm.institutionId) { this.toast.push('error', 'Veuillez choisir une institution responsable'); return; }
    if (this.distribForm.startTime >= this.distribForm.endTime) {
      this.toast.push('error', "L'heure de fin doit être supérieure à l'heure de début");
      return;
    }

    const resInfo = this.distribReservoirInfo();
    const zone = this.distribZone();
    const inst = this.govStore.institutions.find(i => i.id === this.distribForm.institutionId);

    this.distribSchedules = [
      { ...this.distribForm, id: `sched-${Date.now()}`, createdAt: new Date().toISOString() },
      ...this.distribSchedules,
    ];

    const zoneName = zone?.name ?? this.distribForm.zoneId;
    const warningMsg = resInfo && (this.distribReservoirLevel() ?? 100) < 20
      ? ' ⚠ Réservoir en niveau critique — planification marquée à risque.'
      : '';

    this.showPlanifier = false;
    this.toast.push('success', `Distribution planifiée pour ${zoneName} — Responsable : ${inst?.name ?? '—'}.${warningMsg}`);

    this.distribForm = {
      zoneId: '', reservoirId: '', waterPointIds: [],
      scheduleType: 'weekly', startDate: '2026-05-01', endDate: '2026-05-31',
      days: [], startTime: '06:00', endTime: '12:00',
      expectedVolume: '', volumeUnit: 'L',
      institutionId: '', responsableId: '', technicianId: '',
      notify: true, notes: '',
    };
  }

  notifyExport(): void {
    this.toast.push('info', 'Export du rapport de service en cours de préparation…');
  }

  notifyInfra(): void {
    this.toast.push('info', 'Navigation vers les infrastructures liées — Fonctionnalité disponible prochainement');
  }

  notifyInterventions(): void {
    this.toast.push('info', 'Navigation vers les interventions en cours — Fonctionnalité disponible prochainement');
  }
}

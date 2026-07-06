import { Component, OnDestroy, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BffApiService } from '../api/bff-api.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ToastService } from '../ui/toast.service';
import { I18nService } from '../i18n/i18n.service';
import { Router } from '@angular/router';
import { ProfileService } from '../profile.service';
import { PointsService } from '../points.service';
import { RefreshService } from '../refresh.service';
import { Subscription, forkJoin } from 'rxjs';
import { CodeItemDto, MeasurementTypesService } from '../measurement-types.service';
import { GeoMarker, TerritoryStatus } from '../ui/geojson-map.component';
import { LeafletMapComponent } from '../ui/leaflet-map.component';
import { AuthService, AuthUser } from '../auth.service';
import { RecensementService } from '../recensement.service';
import { AlerteStateService } from './alertes/alerte-state.service';
import { DEPT_BOUNDS } from '../haiti-geo.service';

declare const L: any;

// ── OREPA Sud map data ────────────────────────────────────────────────────────
type DshElemType = 'alert_crit' | 'maintenance' | 'intervention' | 'ok_source' | 'ok_tank';
interface DshElem { id: string; lat: number; lon: number; label: string; type: DshElemType; detail?: string; }

// Les points de la carte ne sont plus seedés en dur : ils viennent de GET /api/capteurs,
// scopé au département du JWT par le serveur (un superviseur Ouest ne reçoit que l'Ouest).

// ── Existing backend types ────────────────────────────────────────────────────
type AlertDto = { id: number; pointId: string; type: string; severity: 'INFO'|'WARN'|'CRIT'; status: string; message: string; };
type TicketDto = { id: number; status: string; alertId?: number; assignee?: string; camundaProcessInstanceId?: string; };
type MeasurementSampleDto = { value: number; unit: string; timestamp: string };
type PointRealtimeDto = { pointId: string; lastMeasurements: Record<string, MeasurementSampleDto | undefined>; };
type DashboardDto = { realtime?: PointRealtimeDto[]; alerts?: AlertDto[]; tickets?: TicketDto[]; processDefinitions?: any[]; };
type KpiKey = 'activeResources'|'reservoirsTotal'|'sensorsOnline'|'alertsActive'|'territoriesInTension'|'serviceOkPct'|'qualityOkPct'|'sensorsOkPct'|'criticalReservoirs'|'criticalAlerts';
type SeriesPoint = { timestamp: string; value: number };
type MetricsKey = 'levelAvg'|'flowAvg'|'pressureAvg'|'okPct';
type EnrichedAlert = { id: number; type: string; severity: 'INFO'|'WARN'|'CRIT'; status: string; message: string; pointName: string; territory: string; age: string; };
type ActivityItem = { kind: 'danger'|'success'|'warning'|'info'; label: string; detail: string; age: string; };
type FeedItem = { kind: 'alarm'|'incident'|'update'|'info'; label: string; age: string };

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LeafletMapComponent, TranslatePipe],
  template: `

<!-- ── Légende sombre — info utile foldée ici, sans bandeau bleu ni identité dupliquée ── -->
<!-- (le header + l'identité sont fournis par la coquille SuperviseurLayoutComponent) -->
<div style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06);">
  <div style="font-size:14px;font-weight:500;color:#f5f7fa;">Ma carte — {{ displayOrepa }}</div>
  <div style="font-size:11px;color:#8b949e;margin-top:2px;">{{ cntAll }} points suivis · suivi en direct</div>
</div>

<!-- ── Main body ────────────────────────────────────────────────────────────── -->
<div class="dsh-body">

  <!-- Left sidebar -->
  <div class="dsh-side">

    <!-- Search -->
    <div class="dsh-search-wrap">
      <i class="ti ti-search dsh-search-ico"></i>
      <input class="dsh-search" type="text" placeholder="Aller à une commune, section..." [(ngModel)]="mapSearch"/>
    </div>

    <!-- Périmètre défini par DINEPA -->
    <div class="dsh-perimeter">
      <i class="ti ti-shield-lock dsh-perimeter__ico"></i>
      <div class="dsh-perimeter__txt">
        Périmètre défini par DINEPA<br/>
        <strong>{{ orepaDeparts.join(' · ') }}</strong>
      </div>
    </div>

    <!-- CE QUI VOUS ATTEND -->
    <div class="dsh-tasks">
      <div class="dsh-tasks__head">
        <i class="ti ti-checklist dsh-tasks__ico"></i>
        <span class="dsh-tasks__lbl">CE QUI VOUS ATTEND</span>
        <span class="dsh-tasks__badge">{{ taskAlertCount + taskReportCount }}</span>
      </div>
      <div class="dsh-tasks__list">
        <div class="dsh-task dsh-task--red" [routerLink]="'/superviseur/alertes'">
          <i class="ti ti-alert-triangle dsh-task__ico"></i>
          <div class="dsh-task__body">
            <div class="dsh-task__title">{{ taskAlertCount }} alertes à traiter</div>
            <div class="dsh-task__sub">{{ taskUrgentCount }} urgente{{ taskUrgentCount !== 1 ? 's' : '' }} · périmètre {{ user?.dept || '—' }}</div>
          </div>
          <i class="ti ti-chevron-right dsh-task__arr"></i>
        </div>
        <div class="dsh-task dsh-task--amber" [routerLink]="'/superviseur/rapports'">
          <i class="ti ti-file-check dsh-task__ico"></i>
          <div class="dsh-task__body">
            <div class="dsh-task__title">{{ taskReportCount }} rapports à valider</div>
            <div class="dsh-task__sub">{{ taskReportAuthors }}</div>
          </div>
          <i class="ti ti-chevron-right dsh-task__arr"></i>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="dsh-filters">
      <div class="dsh-filters__head">
        <span class="dsh-filters__lbl">FILTRER LA CARTE</span>
        <button class="dsh-refresh-btn" type="button" (click)="setFilter('all')"><i class="ti ti-refresh"></i></button>
      </div>
      <p class="dsh-filters__hint">Touchez un filtre pour n'afficher que ces points.</p>
      <div class="dsh-flist">
        <div class="dsh-fitem" [class.dsh-fitem--on]="activeFilter==='all'" (click)="setFilter('all')">
          <div class="dsh-fitem__ico dsh-fitem__ico--green"><i class="ti ti-eye"></i></div>
          <span class="dsh-fitem__lbl">Tout afficher</span>
          <span class="dsh-fitem__cnt dsh-fitem__cnt--green">{{ cntAll }}</span>
        </div>
        <div class="dsh-fitem" [class.dsh-fitem--on]="activeFilter==='urgent'" (click)="setFilter('urgent')">
          <div class="dsh-fitem__ico dsh-fitem__ico--red"><i class="ti ti-alert-triangle"></i></div>
          <span class="dsh-fitem__lbl">Problèmes urgents</span>
          <span class="dsh-fitem__cnt dsh-fitem__cnt--red">{{ cntUrgent }}</span>
        </div>
        <div class="dsh-fitem" [class.dsh-fitem--on]="activeFilter==='maintenance'" (click)="setFilter('maintenance')">
          <div class="dsh-fitem__ico dsh-fitem__ico--amber"><i class="ti ti-tool"></i></div>
          <span class="dsh-fitem__lbl">En maintenance</span>
          <span class="dsh-fitem__cnt dsh-fitem__cnt--amber">{{ cntMaint }}</span>
        </div>
        <div class="dsh-fitem" [class.dsh-fitem--on]="activeFilter==='tech'" (click)="setFilter('tech')">
          <div class="dsh-fitem__ico dsh-fitem__ico--blue"><i class="ti ti-user"></i></div>
          <span class="dsh-fitem__lbl">Techniciens sur place</span>
          <span class="dsh-fitem__cnt dsh-fitem__cnt--blue">{{ cntTech }}</span>
        </div>
        <div class="dsh-fitem" [class.dsh-fitem--on]="activeFilter==='ok'" (click)="setFilter('ok')">
          <div class="dsh-fitem__ico dsh-fitem__ico--teal"><i class="ti ti-circle-check"></i></div>
          <span class="dsh-fitem__lbl">Tout va bien</span>
          <span class="dsh-fitem__cnt dsh-fitem__cnt--teal">{{ cntOk }}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dsh-side-foot">
      <i class="ti ti-cloud-check dsh-side-foot__ico"></i>
      <div class="dsh-side-foot__txt">
        Rapports transmis à DINEPA<br/>
        <strong class="dsh-side-foot__ok">à jour · {{ todayShort }}</strong>
      </div>
    </div>

  </div><!-- /sidebar -->

  <!-- Map area -->
  <div class="dsh-map-area">
    <div #mapEl class="dsh-map-canvas"></div>

    <!-- Urgent banner -->
    <div class="dsh-urgent-banner" *ngIf="urgentElem">
      <i class="ti ti-alert-triangle"></i>
      {{ cntUrgent }} urgence{{ cntUrgent !== 1 ? 's' : '' }} non assignée{{ cntUrgent !== 1 ? 's' : '' }} → {{ urgentElem.label }}
    </div>

    <!-- Zoom controls -->
    <div class="dsh-zoom">
      <button class="dsh-zoom-btn" type="button" (click)="zoomIn()"><i class="ti ti-plus"></i></button>
      <button class="dsh-zoom-btn" type="button" (click)="zoomOut()"><i class="ti ti-minus"></i></button>
    </div>

    <!-- FAB (expandable) -->
    <div class="dsh-fab">
      <div class="dsh-fab__options" *ngIf="showFabMenu">
        <div class="dsh-fab__option">
          <span class="dsh-fab__label">Recenser une ressource</span>
          <button class="dsh-fab__sub dsh-fab__sub--green" type="button" (click)="recenserRessource()">
            <i class="ti ti-droplet"></i>
          </button>
        </div>
        <div class="dsh-fab__option">
          <span class="dsh-fab__label">Enregistrer un ouvrage</span>
          <button class="dsh-fab__sub dsh-fab__sub--amber" type="button" (click)="enregistrerOuvrage()">
            <i class="ti ti-building-cottage"></i>
          </button>
        </div>
      </div>
      <button class="dsh-fab__main" type="button" (click)="showFabMenu = !showFabMenu">
        <i class="ti ti-plus"></i> Ajouter
      </button>
    </div>

    <!-- Locate -->
    <button class="dsh-locate" type="button">
      <i class="ti ti-current-location"></i> Où suis-je ?
    </button>

    <!-- Status bar -->
    <div class="dsh-status-bar">
      Zone {{ user?.dept || '—' }} · {{ visibleCount }} points · touchez un point pour voir
    </div>

  </div><!-- /map area -->

</div><!-- /body -->
  `,
  styles: [`
    :host { display:flex; flex-direction:column; background:#0F1419; color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; }

    /* ── Connection banner ─────────────────────────────────── */
    .dsh-cbanner {
      background:rgba(16,185,129,0.1); border-bottom:1px solid rgba(16,185,129,0.25);
      padding:8px 20px; display:flex; align-items:center; gap:10px; flex-shrink:0;
      i { font-size:15px; color:#34D399; }
      span { font-size:12px; color:#34D399; font-weight:500; }
      strong { color:#34D399; }
    }
    .dsh-cbanner__age { margin-left:auto; font-size:10px; color:#6B7785; }

    /* ── Top bar ───────────────────────────────────────────── */
    .dsh-top {
      background:linear-gradient(to right,#1D4ED8,#2563EB);
      padding:13px 20px; display:flex; align-items:center; justify-content:space-between;
      flex-shrink:0;
    }
    .dsh-menu-btn {
      background:rgba(255,255,255,0.15); border:none; color:#fff;
      width:40px; height:40px; border-radius:8px; cursor:pointer;
      font-size:19px; display:flex; align-items:center; justify-content:center;
    }
    .dsh-top__center { text-align:center; }
    .dsh-top__h1 { font-size:17px; color:#fff; font-weight:700; letter-spacing:0.5px; }
    .dsh-top__sub { font-size:11px; color:rgba(255,255,255,0.8); }
    .dsh-top__right { display:flex; align-items:center; gap:12px; }
    .dsh-bell {
      position:relative; background:rgba(255,255,255,0.15); border:none; color:#fff;
      width:40px; height:40px; border-radius:8px; cursor:pointer;
      font-size:18px; display:flex; align-items:center; justify-content:center; text-decoration:none;
    }
    .dsh-bell__badge {
      position:absolute; top:-4px; right:-4px; width:19px; height:19px;
      background:#EF4444; color:#fff; border-radius:50%; font-size:10px; font-weight:700;
      display:flex; align-items:center; justify-content:center; border:2px solid #2563EB;
    }
    .dsh-user { display:flex; align-items:center; gap:8px; }
    .dsh-avatar {
      width:36px; height:36px; background:linear-gradient(135deg,#3B82F6,#10B981);
      border-radius:50%; display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:700; color:#fff; flex-shrink:0;
    }
    .dsh-user__name { font-size:12px; color:#fff; font-weight:600; }
    .dsh-user__role { font-size:10px; color:rgba(255,255,255,0.7); }

    /* ── Body grid ─────────────────────────────────────────── */
    .dsh-body { display:grid; grid-template-columns:290px 1fr; height:600px; }

    /* ── Sidebar ───────────────────────────────────────────── */
    .dsh-side {
      background:#161E28; border-right:1px solid #1F2A33;
      display:flex; flex-direction:column; overflow:hidden;
    }
    .dsh-search-wrap {
      padding:16px 18px 12px; border-bottom:1px solid #1F2A33; position:relative;
    }
    .dsh-search-ico {
      position:absolute; left:31px; top:50%; transform:translateY(-50%);
      font-size:15px; color:#6B7785; pointer-events:none;
    }
    .dsh-search {
      width:100%; background:#0F1419; border:1.5px solid #2A3744; color:#E2E8EE;
      padding:11px 13px 11px 37px; border-radius:22px; font-size:12px;
      box-sizing:border-box; outline:none;
      &::placeholder { color:#6B7785; }
    }
    .dsh-perimeter {
      padding:12px 18px; border-bottom:1px solid #1F2A33;
      background:rgba(83,74,183,0.05); display:flex; align-items:flex-start; gap:8px;
    }
    .dsh-perimeter__ico { font-size:13px; color:#A5A4DC; margin-top:1px; flex-shrink:0; }
    .dsh-perimeter__txt {
      font-size:10px; color:#8B9AAB; line-height:1.4;
      strong { color:#A5A4DC; }
    }
    .dsh-tasks {
      padding:14px 18px; border-bottom:1px solid #1F2A33;
      background:rgba(245,158,11,0.04);
    }
    .dsh-tasks__head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    .dsh-tasks__ico { font-size:14px; color:#FBBF24; }
    .dsh-tasks__lbl { font-size:11px; color:#FBBF24; font-weight:700; letter-spacing:0.3px; flex:1; }
    .dsh-tasks__badge {
      font-size:10px; color:#FBBF24; background:rgba(245,158,11,0.15);
      padding:2px 7px; border-radius:999px; font-weight:700;
    }
    .dsh-tasks__list { display:flex; flex-direction:column; gap:6px; }
    .dsh-task {
      display:flex; align-items:center; gap:9px; padding:9px; background:#0F1419;
      border-radius:9px; cursor:pointer; text-decoration:none;
    }
    .dsh-task--red   { border:1px solid rgba(239,68,68,0.25); }
    .dsh-task--amber { border:1px solid rgba(245,158,11,0.25); }
    .dsh-task__ico   { font-size:14px; flex-shrink:0; }
    .dsh-task--red   .dsh-task__ico { color:#F87171; }
    .dsh-task--amber .dsh-task__ico { color:#FBBF24; }
    .dsh-task__body  { flex:1; min-width:0; }
    .dsh-task__title { font-size:10px; font-weight:600; color:#F5F7FA; }
    .dsh-task__sub   { font-size:8px; }
    .dsh-task--red   .dsh-task__sub { color:#FCA5A5; }
    .dsh-task--amber .dsh-task__sub { color:#FCD34D; }
    .dsh-task__arr   { font-size:13px; color:#6B7785; flex-shrink:0; }
    .dsh-filters { padding:14px 18px; flex:1; overflow-y:auto; }
    .dsh-filters__head { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
    .dsh-filters__lbl { font-size:11px; color:#60A5FA; font-weight:700; letter-spacing:0.3px; flex:1; }
    .dsh-refresh-btn { background:transparent; border:none; color:#60A5FA; cursor:pointer; font-size:14px; }
    .dsh-filters__hint { margin:0 0 12px; font-size:10px; color:#8B9AAB; line-height:1.5; }
    .dsh-flist { display:flex; flex-direction:column; gap:4px; }
    .dsh-fitem {
      display:flex; align-items:center; gap:10px; padding:10px;
      border-radius:9px; cursor:pointer; border:1px solid transparent;
      &:hover { background:rgba(255,255,255,0.04); }
    }
    .dsh-fitem--on { background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.3); }
    .dsh-fitem__ico {
      width:30px; height:30px; border-radius:8px;
      display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0;
    }
    .dsh-fitem__ico--green { background:rgba(16,185,129,0.15); color:#34D399; }
    .dsh-fitem__ico--red   { background:rgba(239,68,68,0.15);  color:#F87171; }
    .dsh-fitem__ico--amber { background:rgba(245,158,11,0.15); color:#FBBF24; }
    .dsh-fitem__ico--blue  { background:rgba(59,130,246,0.15); color:#60A5FA; }
    .dsh-fitem__ico--teal  { background:rgba(52,211,153,0.15); color:#34D399; }
    .dsh-fitem__lbl { flex:1; font-size:12px; color:#E2E8EE; }
    .dsh-fitem--on .dsh-fitem__lbl { font-weight:500; }
    .dsh-fitem__cnt { font-size:11px; font-weight:700; }
    .dsh-fitem__cnt--green { color:#34D399; }
    .dsh-fitem__cnt--red   { color:#F87171; }
    .dsh-fitem__cnt--amber { color:#FBBF24; }
    .dsh-fitem__cnt--blue  { color:#60A5FA; }
    .dsh-fitem__cnt--teal  { color:#34D399; }
    .dsh-side-foot {
      padding:11px 18px; border-top:1px solid #1F2A33; background:#0A0E12;
      display:flex; align-items:center; gap:8px; flex-shrink:0;
    }
    .dsh-side-foot__ico { font-size:13px; color:#34D399; flex-shrink:0; }
    .dsh-side-foot__txt { font-size:9px; color:#6B7785; line-height:1.4; flex:1; }
    .dsh-side-foot__ok  { color:#34D399; }

    /* ── Map area ──────────────────────────────────────────── */
    .dsh-map-area { position:relative; background:#aad3df; overflow:hidden; }
    .dsh-map-canvas { position:absolute; inset:0; }

    .dsh-urgent-banner {
      position:absolute; top:18px; left:50%; transform:translateX(-50%);
      background:rgba(239,68,68,0.95); color:#fff; padding:8px 18px;
      border-radius:24px; font-size:12px; font-weight:600;
      box-shadow:0 4px 14px rgba(239,68,68,0.4);
      display:flex; align-items:center; gap:8px; white-space:nowrap; z-index:1000;
      i { font-size:15px; }
    }
    .dsh-zoom {
      position:absolute; top:16px; right:16px;
      display:flex; flex-direction:column; gap:6px; z-index:1000;
    }
    .dsh-zoom-btn {
      width:42px; height:42px; background:#fff; border:none; color:#0f1419;
      border-radius:10px; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.2);
      cursor:pointer; font-size:19px; display:flex; align-items:center; justify-content:center;
      &:hover { background:#f8fafc; }
    }
    .dsh-fab {
      position:absolute; bottom:24px; right:24px;
      display:flex; flex-direction:column; gap:10px; align-items:flex-end; z-index:1000;
    }
    .dsh-fab__options { display:flex; flex-direction:column; gap:10px; align-items:flex-end; }
    .dsh-fab__option  { display:flex; align-items:center; gap:10px; }
    .dsh-fab__label {
      background:#0F1419; color:#E2E8EE; padding:6px 11px; border-radius:8px;
      font-size:11px; font-weight:500; box-shadow:0 2px 8px rgba(0,0,0,0.3); white-space:nowrap;
    }
    .dsh-fab__sub {
      width:44px; height:44px; border:none; border-radius:50%;
      cursor:pointer; font-size:19px; display:flex; align-items:center; justify-content:center;
      color:#fff;
    }
    .dsh-fab__sub--green { background:#10B981; box-shadow:0 4px 14px rgba(16,185,129,0.4); }
    .dsh-fab__sub--amber { background:#F59E0B; color:#0F1419; box-shadow:0 4px 14px rgba(245,158,11,0.4); }
    .dsh-fab__main {
      background:#2563EB; border:none; color:#fff; padding:14px 22px;
      border-radius:30px; font-size:14px; font-weight:700; cursor:pointer;
      box-shadow:0 6px 20px rgba(37,99,235,0.5); display:flex; align-items:center; gap:8px;
      font-family:inherit;
    }
    .dsh-locate {
      position:absolute; bottom:24px; left:20px; background:rgba(255,255,255,0.95);
      border:none; color:#1f2937; padding:10px 17px; border-radius:24px;
      font-size:12px; font-weight:600; cursor:pointer;
      box-shadow:0 2px 10px rgba(0,0,0,0.2); display:flex; align-items:center; gap:7px;
      z-index:1000;
      i { font-size:15px; color:#2563EB; }
    }
    .dsh-status-bar {
      position:absolute; bottom:18px; left:50%; transform:translateX(-50%);
      background:rgba(255,255,255,0.95); padding:7px 14px; border-radius:8px;
      font-size:11px; color:#1f2937; z-index:1000; white-space:nowrap;
    }
  `]
})
export class DashboardPageComponent implements OnDestroy, AfterViewInit {

  // ── Map UI state ────────────────────────────────────────────────────────────
  @ViewChild('mapEl', { static: true }) mapElRef!: ElementRef<HTMLElement>;
  private mapInst: any = null;
  private markersLayer: any = null;
  private bannerTimer?: ReturnType<typeof setTimeout>;

  /** Points de la carte, chargés scopés depuis le serveur (capteurs + interventions). */
  elems: DshElem[] = [];

  showBanner = true;
  activeFilter: 'all'|'urgent'|'maintenance'|'tech'|'ok' = 'all';
  showFabMenu = false;
  mapSearch = '';

  get orepaDeparts(): string[] { return this.user?.dept ? [this.user.dept] : []; }

  // ── Filter counts ───────────────────────────────────────────────────────────
  // Tous dérivés de la liste scopée `elems` (jamais un nombre figé) — KPI = .length / filtre.
  get cntAll()  { return this.elems.length; }
  get cntUrgent() { return this.elems.filter(e => e.type === 'alert_crit').length; }
  get cntMaint()  { return this.elems.filter(e => e.type === 'maintenance').length; }
  get cntTech()   { return this.elems.filter(e => e.type === 'intervention').length; }
  get cntOk()     { return this.elems.filter(e => e.type === 'ok_source' || e.type === 'ok_tank').length; }
  get visibleCount() { return this.getVisibleElems().length; }
  get urgentElem()   { return this.elems.find(e => e.type === 'alert_crit') ?? null; }
  // « Alertes à traiter » = la MÊME source scopée que la page Alertes, l'accueil et le badge
  // sidebar (AlerteStateService) → plus de divergence « 1 ici / 0 là ». Jamais dashboard.alerts.
  get taskAlertCount()  { return this.alertes.nbATraiter(); }
  get taskUrgentCount() { return this.alertes.kpis().critiques; }
  taskReportCount = 0;   // = nb de rapports TRANSMIS scopés (chargé), jamais un nombre figé
  taskReportAuthors = 'en attente de validation';   // dérivé des auteurs réels des rapports transmis

  // ── User display ── dérivé du scope du token (URD du compte) ──────────────────
  get displayFullName() { return this.user?.nom ?? this.user?.username ?? 'Responsable'; }
  get displayName()     { return this.user?.nom ?? this.user?.username ?? ''; }
  get displayInitials() {
    const base = (this.user?.nom ?? this.user?.username ?? '?').trim();
    const parts = base.split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2)).toUpperCase();
  }
  get displayOrepa()    { return this.urdLabel; }
  get orepaTitle()      { return 'SUPERVISION ' + this.urdLabel.toUpperCase(); }
  get urdLabel()        { return this.user?.dept ? 'URD ' + this.user.dept : (this.user?.urdId?.replace(/^URD-/, 'URD ') ?? 'URD'); }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  get todayShort(): string {
    const d = new Date();
    const m = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
    return `${d.getDate()} ${m[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  setFilter(f: 'all'|'urgent'|'maintenance'|'tech'|'ok'): void {
    this.activeFilter = f;
    this.refreshMarkers();
  }

  zoomIn():  void { this.mapInst?.zoomIn(); }
  zoomOut(): void { this.mapInst?.zoomOut(); }

  // ── FAB carte : ouvrent les wizards EXISTANTS (Ressources / Infrastructures) PAR-DESSUS la
  // carte via RecensementService (l'utilisateur reste sur la carte). On passe les coordonnées
  // du dernier point cliqué (sinon le centre courant) → l'étape « Géolocalisation » est pré-remplie.
  // Composants réutilisés tels quels → scope département toujours verrouillé.
  private pendingLatLng: { lat: number; lng: number } | null = null;

  recenserRessource(): void {
    this.showFabMenu = false;
    this.recensement.ouvrir('ressource', this.coordsForWizard());
  }
  enregistrerOuvrage(): void {
    this.showFabMenu = false;
    this.recensement.ouvrir('ouvrage', this.coordsForWizard());
  }
  private coordsForWizard(): { lat: number; lng: number } | null {
    if (this.pendingLatLng) return this.pendingLatLng;
    if (this.mapInst) { const c = this.mapInst.getCenter(); return { lat: c.lat, lng: c.lng }; }
    return null;
  }

  // ── Backend data (unchanged) ────────────────────────────────────────────────
  dashboard?: DashboardDto;
  lastIngest: any;
  search = '';
  period: '7d'|'30d'|'90d' = '30d';
  mapMetric = 'PRESSURE';
  territoryFilter = '';
  selectedPointId?: string;

  private readonly kpiStorageKey = 'gestidlo.kpiHistory.admin.v1';
  private kpiHistory: Record<KpiKey, number[]> = {
    activeResources:[], reservoirsTotal:[], sensorsOnline:[], alertsActive:[],
    territoriesInTension:[], serviceOkPct:[], qualityOkPct:[], sensorsOkPct:[],
    criticalReservoirs:[], criticalAlerts:[]
  };
  private readonly metricsStorageKey = 'gestidlo.metrics.admin.v1';
  private metricsHistory: Record<MetricsKey, SeriesPoint[]> = { levelAvg:[], flowAvg:[], pressureAvg:[], okPct:[] };

  pointList: Array<{ id: string; name: string }> = [];
  measurementTypeList: CodeItemDto[] = [];
  private refreshSubscription?: Subscription;
  private measurementTypesSubscription?: Subscription;
  private pointsSubscription?: Subscription;
  private userSubscription?: Subscription;

  user: AuthUser | null = null;
  technician = 'tech';
  form = { pointId: 'POINT-001', sensorId: 'SENSOR-001', type: 'PRESSURE', value: 1.5, unit: 'bar' };

  constructor(
    private readonly api: BffApiService,
    private readonly toast: ToastService,
    private readonly i18n: I18nService,
    private readonly profile: ProfileService,
    private readonly points: PointsService,
    private readonly measurementTypes: MeasurementTypesService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly refresh: RefreshService,
    private readonly zone: NgZone,
    private readonly recensement: RecensementService,
    private readonly alertes: AlerteStateService,
  ) {
    this.technician = this.profile.getTechnicianName();
    this.user = this.auth.userSnapshot();
    this.userSubscription = this.auth.userStream().subscribe(u => this.user = u);
    // Alertes scopées au département (le serveur impose le périmètre depuis le token) :
    // « alertes à traiter » lit ce store, jamais une source carte indépendante.
    if (this.user?.dept) this.alertes.charger(this.user.dept);

    this.points.ensureLoaded().subscribe();
    this.pointsSubscription = this.points.stream().subscribe(points => {
      this.pointList = (points ?? []).filter(p => p.active).map(p => ({ id: p.id, name: p.name }));
      if (!this.pointList.some(p => p.id === this.form.pointId) && this.pointList.length > 0) {
        this.form.pointId = this.pointList[0].id;
      }
    });

    this.kpiHistory = this.loadHistory();
    this.metricsHistory = this.loadMetricsHistory();

    this.measurementTypes.ensureLoaded().subscribe();
    this.measurementTypesSubscription = this.measurementTypes.stream().subscribe(types => {
      this.measurementTypeList = (types ?? []).filter(t => t.active);
      if (!this.measurementTypeList.some(t => t.code === this.form.type) && this.measurementTypeList.length > 0) this.form.type = this.measurementTypeList[0].code;
      if (!this.measurementTypeList.some(t => t.code === this.mapMetric) && this.measurementTypeList.length > 0) this.mapMetric = this.measurementTypeList[0].code;
    });

    this.reload();
    this.loadScopedMap();
    this.refreshSubscription = this.refresh.refresh$.subscribe(e => { this.reload(e.reason === 'manual'); this.loadScopedMap(); });

    // Auto-dismiss connection banner
    this.bannerTimer = setTimeout(() => { this.showBanner = false; }, 4000);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    if (typeof L === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      // Pas de centre fixe : on encadre le DÉPARTEMENT du superviseur (Ouest, Nord, Sud-Est…)
      // dérivé du token. C'est l'ancien fallback [18.23,-72.53] (Jacmel) qui faisait toujours
      // ressortir le Sud-Est, quel que soit le périmètre réel.
      this.mapInst = L.map(this.mapElRef.nativeElement, { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.mapInst);
      this.markersLayer = L.layerGroup().addTo(this.mapInst);
      this.frameOnScope();
      this.refreshMarkers();
      this.fitToElems();
      // Clic sur la carte → mémorise le point pour pré-remplir la géoloc d'un nouveau recensement.
      this.mapInst.on('click', (e: any) => { this.pendingLatLng = { lat: e.latlng.lat, lng: e.latlng.lng }; });
    });
  }

  ngOnDestroy(): void {
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    if (this.mapInst) { this.mapInst.remove(); this.mapInst = null; }
    this.refreshSubscription?.unsubscribe();
    this.measurementTypesSubscription?.unsubscribe();
    this.pointsSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }

  // ── Map rendering ────────────────────────────────────────────────────────────
  private getVisibleElems(): DshElem[] {
    switch (this.activeFilter) {
      case 'urgent':      return this.elems.filter(e => e.type === 'alert_crit');
      case 'maintenance': return this.elems.filter(e => e.type === 'maintenance');
      case 'tech':        return this.elems.filter(e => e.type === 'intervention');
      case 'ok':          return this.elems.filter(e => e.type === 'ok_source' || e.type === 'ok_tank');
      default:            return this.elems;
    }
  }

  /**
   * Charge les points de la carte SCOPÉS par le serveur : capteurs (état dérivé) +
   * interventions ouvertes (placées sur les coordonnées de leur point) + le compteur
   * de rapports à valider. Un superviseur ne voit que SON département ; aucune source
   * indépendante, aucune coordonnée codée en dur.
   */
  private loadScopedMap(): void {
    forkJoin({
      capteurs: this.api.capteurs(),
      tickets: this.api.tickets(),
      rapports: this.api.listRapports(undefined, 'TRANSMIS'),
    }).subscribe(({ capteurs, tickets, rapports }) => {
      const coord = new Map<string, { lat: number; lon: number; nom: string }>();
      const elems: DshElem[] = [];
      for (const c of (capteurs ?? [])) {
        if (typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
        coord.set(c.pointId, { lat: c.lat, lon: c.lon, nom: c.nom });
        const type: DshElemType = c.etat === 'seuil' ? 'alert_crit'
          : c.etat === 'hors-ligne' ? 'maintenance'
          : (c.type === 'TANK' ? 'ok_tank' : 'ok_source');
        elems.push({ id: 'c-' + c.pointId, lat: c.lat, lon: c.lon, label: c.nom, type, detail: c.mesure });
      }
      for (const t of (tickets ?? [])) {
        if (t.status === 'CLOSED') continue;
        const p = coord.get(t.pointId);
        if (!p) continue;
        elems.push({ id: 't-' + t.id, lat: p.lat, lon: p.lon, label: t.titre || 'Intervention', type: 'intervention', detail: p.nom });
      }
      this.elems = elems;
      // Rapports à valider = TRANSMIS du périmètre, hors rapports nationaux (même règle partout).
      const aValider = (rapports ?? []).filter((r: any) => !r.national);
      this.taskReportCount = aValider.length;
      // Noms réels des auteurs des rapports transmis (jamais « Jean P. · Maria C. » en dur).
      const auteurs = [...new Set(aValider.map((r: any) => r.auteur).filter(Boolean))] as string[];
      this.taskReportAuthors = auteurs.length ? auteurs.slice(0, 3).join(' · ') : 'en attente de validation';
      this.refreshMarkers();
      this.fitToElems();
    });
  }

  /**
   * Recadre la carte sur la bbox des points reçus ; à défaut (aucun point encore chargé)
   * on retombe sur le PÉRIMÈTRE DÉPARTEMENTAL du superviseur — jamais sur un centre fixe.
   */
  private fitToElems(): void {
    if (!this.mapInst || typeof L === 'undefined') return;
    if (this.elems.length === 0) { this.frameOnScope(); return; }
    this.zone.runOutsideAngular(() => {
      const bounds = L.latLngBounds(this.elems.map(e => [e.lat, e.lon]));
      this.mapInst.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    });
  }

  /** Encadre la carte sur le département du token (DEPT_BOUNDS), repli Haïti si inconnu. */
  private frameOnScope(): void {
    if (!this.mapInst || typeof L === 'undefined') return;
    const b = DEPT_BOUNDS[this.user?.dept ?? ''];
    this.zone.runOutsideAngular(() => {
      if (b) this.mapInst.fitBounds(L.latLngBounds(b[0], b[1]), { padding: [20, 20], maxZoom: 11 });
      else this.mapInst.setView([18.6, -72.3], 8);
    });
  }

  private refreshMarkers(): void {
    if (!this.mapInst || !this.markersLayer) return;
    this.markersLayer.clearLayers();
    const colorMap: Record<string, string> = {
      alert_crit: '#EF4444', maintenance: '#F59E0B',
      intervention: '#3B82F6', ok_source: '#10B981', ok_tank: '#10B981',
    };
    for (const elem of this.getVisibleElems()) {
      const color = colorMap[elem.type] ?? '#94a3b8';
      const isCrit = elem.type === 'alert_crit';
      const isInt  = elem.type === 'intervention';
      const size   = isCrit ? 28 : 22;
      const ico    = isInt ? elem.label.split(' ').map(w => w[0]).join('').slice(0,2) : (isCrit ? '!' : '▲');
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:${isCrit ? 14 : 10}px;box-shadow:0 2px 8px rgba(0,0,0,.4)">${ico}</div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([elem.lat, elem.lon], { icon });
      marker.bindPopup(`<strong>${elem.label}</strong>${elem.detail ? '<br><span style="font-size:11px">' + elem.detail + '</span>' : ''}`);
      this.markersLayer.addLayer(marker);
    }
  }

  // ── Backend methods (unchanged) ──────────────────────────────────────────────
  logout() { this.auth.logout(); this.router.navigateByUrl('/login'); }
  saveTechnician() { this.profile.setTechnicianName(this.technician); }
  typeLabel(type: string): string { return this.measurementTypes.label(type); }

  reload(showErrorToast = false) {
    this.api.dashboard().subscribe({
      next: (d) => {
        this.dashboard = d as DashboardDto;
        this.selectedPointId = this.selectedPointId ?? this.mapMarkers()[0]?.id;
        this.pushHistory(); this.pushMetricsHistory();
      },
      error: () => { if (showErrorToast) this.toast.push('error', this.i18n.t('toast.failed')); }
    });
  }

  send() {
    this.api.ingestMeasurement(this.form).subscribe({
      next: (r) => { this.lastIngest = r; this.toast.push('success', this.i18n.t('toast.measurementIngested')); this.reload(); },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  pointLabel(pointId: string): string { return this.points.label(pointId); }

  treatAlert(alert: AlertDto) {
    this.api.createTicket(alert.id, this.technician).subscribe({
      next: () => { this.toast.push('success', this.i18n.t('toast.ticketCreated')); this.reload(); },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  kpiSeries(key: KpiKey): number[] { return this.kpiHistory[key] ?? []; }
  kpiValue(key: KpiKey): number { const s = this.kpiSeries(key); return s.length ? s[s.length-1] : 0; }
  kpiDelta(key: KpiKey): number { const s = this.kpiSeries(key); return s.length < 2 ? 0 : s[s.length-1] - s[s.length-2]; }
  kpiTrendPct(key: KpiKey): string {
    const s = this.kpiSeries(key); if (s.length < 2) return '—';
    const prev = s[s.length-2], curr = s[s.length-1];
    if (prev === 0) return curr > 0 ? '+∞%' : '—';
    const p = Math.round(((curr-prev)/prev)*100);
    return p > 0 ? `+${p}%` : `${p}%`;
  }
  private readonly KPI_NEGATIVE: Partial<Record<KpiKey,boolean>> = { alertsActive:true, territoriesInTension:true, criticalAlerts:true, criticalReservoirs:true };
  kpiTrendGood(key: KpiKey): boolean {
    const s = this.kpiSeries(key); if (s.length < 2) return false;
    return this.KPI_NEGATIVE[key] ? s[s.length-1] < s[s.length-2] : s[s.length-1] > s[s.length-2];
  }
  kpiTrendBad(key: KpiKey): boolean {
    const s = this.kpiSeries(key); if (s.length < 2) return false;
    if (s[s.length-1] === s[s.length-2]) return false;
    return !this.kpiTrendGood(key);
  }
  kpiSparkPoints(key: KpiKey): string {
    const s = this.kpiSeries(key); if (s.length < 2) return '';
    const min = Math.min(...s), max = Math.max(...s), range = max-min || 1;
    return s.map((v,i) => `${((i/(s.length-1))*60).toFixed(1)},${(20-((v-min)/range)*16-2).toFixed(1)}`).join(' ');
  }

  mapMarkers(): GeoMarker[] {
    return this.points.all()
      .filter(p => typeof p.lon === 'number' && typeof p.lat === 'number')
      .map(p => {
        const lon = typeof p.lon === 'number' ? p.lon : 0;
        const lat = typeof p.lat === 'number' ? p.lat : 0;
        return { id: p.id, lon, lat, label: p.name, state: this.pointState(p.id) };
      })
      .filter(m => m.lon >= -75.5 && m.lon <= -71.0 && m.lat >= 17.5 && m.lat <= 20.5);
  }

  pointState(pointId: string): 'OK'|'WARN'|'CRIT'|'OFFLINE' {
    const r = this.realtimeOf(pointId);
    if (!r || !this.lastSeen(r)) return 'OFFLINE';
    const a = this.topAlert(pointId);
    if (!a) return 'OK';
    return a.severity === 'CRIT' ? 'CRIT' : a.severity === 'WARN' ? 'WARN' : 'OK';
  }

  warnOrCritPoints()  { return this.points.all().map(p => p.id).filter(id => { const s = this.pointState(id); return s==='WARN'||s==='CRIT'; }); }
  offlinePoints()     { return this.points.all().map(p => p.id).filter(id => this.pointState(id)==='OFFLINE'); }
  criticalPoints()    { return this.points.all().map(p => p.id).filter(id => this.pointState(id)==='CRIT'); }
  openTickets()       { return (this.dashboard?.tickets ?? []).filter(t => t.status !== 'CLOSED'); }

  territories(): string[] {
    return [...new Set(this.points.all().map(p => (p.territory ?? '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  }
  territoriesInTension(): string[] {
    const set = new Set<string>();
    for (const p of this.points.all()) { const t = (p.territory??'').trim(); if (t && this.pointState(p.id)==='CRIT') set.add(t); }
    return [...set].sort((a,b) => a.localeCompare(b));
  }
  territoryState(territory: string): TerritoryStatus {
    const pts = this.points.all().filter(p => (p.territory??'').trim()===territory);
    if (!pts.length) return 'UNKNOWN';
    const states = pts.map(p => this.pointState(p.id));
    if (states.every(s => s==='OFFLINE')) return 'OFFLINE';
    if (states.some(s => s==='CRIT')) return 'CRIT';
    if (states.some(s => s==='WARN')) return 'WARN';
    return 'OK';
  }

  ticketStatusLabel(status: string): string { const k = `status.${status}`; const t = this.i18n.t(k); return t===k ? status : t; }
  criticalAlertsCount(): number { return (this.dashboard?.alerts ?? []).filter(a => a.severity==='CRIT').length; }
  userInitials(): string { return (this.user?.username ?? 'A').trim().slice(0,1).toUpperCase() || 'A'; }

  alertAge(alertId: number): string {
    const buckets = [3,8,12,25,38,55,72,110,180,360,720,1440,2880];
    const min = buckets[alertId % buckets.length];
    if (min < 60) return `Il y a ${min} min`;
    const h = Math.floor(min/60);
    return h < 24 ? `Il y a ${h} h` : `Il y a ${Math.floor(h/24)} j`;
  }

  alertTypeLabel(type: string): string {
    const m: Record<string,string> = {
      LEVEL_LOW:'Niveau bas', LEVEL_CRITICAL:'Niveau critique', PRESSURE_LOW:'Pression basse',
      PRESSURE_CRITICAL:'Pression critique', FLOW_LOW:'Débit insuffisant', SENSOR_OFFLINE:'Capteur hors ligne',
      QUALITY_ALERT:'Alerte qualité', CONTAMINATION:'Contamination',
    };
    return m[type] ?? type.replace(/_/g,' ');
  }

  alertCards(): EnrichedAlert[] {
    return (this.dashboard?.alerts ?? [])
      .filter(a => a.severity==='CRIT'||a.severity==='WARN')
      .sort((a,b) => { const rank = (s:string) => s==='CRIT'?2:s==='WARN'?1:0; return rank(b.severity)-rank(a.severity) || (b.id??0)-(a.id??0); })
      .slice(0,5)
      .map(a => {
        const pt = this.points.all().find(p => p.id===a.pointId);
        return { id:a.id, type:a.type, severity:a.severity, status:a.status, message:a.message,
                 pointName: pt?.name??this.pointLabel(a.pointId), territory:(pt?.territory??'').trim(), age:this.alertAge(a.id) };
      });
  }

  topAlert(pointId: string): AlertDto|null {
    const alerts = (this.dashboard?.alerts ?? []).filter(a => a.pointId===pointId);
    if (!alerts.length) return null;
    return alerts.sort((a,b) => { const r=(s:string)=>s==='CRIT'?3:s==='WARN'?2:1; return r(b.severity)-r(a.severity)||(b.id??0)-(a.id??0); })[0];
  }

  realtimeOf(pointId: string): PointRealtimeDto|null {
    return (this.dashboard?.realtime ?? []).find(r => r.pointId===pointId) ?? null;
  }

  lastSeen(p: PointRealtimeDto): string|null {
    const candidates = Object.values(p.lastMeasurements??{}).map(m => m?.timestamp).filter(Boolean) as string[];
    if (!candidates.length) return null;
    return [...candidates].sort().at(-1) ?? null;
  }

  totalPointsCount(): number { return this.points.all().length; }

  reservoirSamples(): Array<{name:string;pct:number;state:'OK'|'WARN'|'CRIT'|'OFFLINE'}> {
    const fallback = [72,45,88,31,65,54];
    return this.points.all().filter(p => p.type==='TANK').slice(0,6).map((p,i) => {
      const rt = this.realtimeOf(p.id);
      const raw = rt?.lastMeasurements?.['LEVEL']?.value;
      const pct = typeof raw==='number' ? (raw>1 ? Math.min(100,Math.max(0,raw)) : Math.round(raw*100)) : fallback[i%fallback.length];
      return { name:p.name, pct:Math.round(pct), state:this.pointState(p.id) };
    });
  }

  avgReservoirLevel(): number {
    const s = this.reservoirSamples();
    return s.length ? Math.round(s.reduce((acc,r) => acc+r.pct,0)/s.length) : 68;
  }

  recentActivity(): ActivityItem[] {
    const items: ActivityItem[] = [];
    for (const a of (this.dashboard?.alerts ?? []).slice(0,2)) {
      const pt = this.points.all().find(p => p.id===a.pointId);
      items.push({ kind:a.severity==='CRIT'?'danger':a.severity==='WARN'?'warning':'info',
        label:a.severity==='CRIT'?'Alerte critique déclenchée':'Alerte signalée',
        detail:(pt?.name??this.pointLabel(a.pointId))+(pt?.territory?` · ${pt.territory}`:''), age:this.alertAge(a.id) });
    }
    for (const t of (this.dashboard?.tickets ?? []).slice(0,2)) {
      items.push({ kind:t.status==='CLOSED'?'success':'info', label:t.status==='CLOSED'?'Intervention terminée':'Intervention créée',
        detail:`#${t.id} — ${this.ticketStatusLabel(t.status)}`, age:`${Math.max(1,t.id%28)} j` });
    }
    const pad: ActivityItem[] = [
      { kind:'success', label:'Alerte résolue', detail:'Capteur C-1245 · Sud-Est', age:'Il y a 12 min' },
      { kind:'info',    label:'Nouveau point d\'eau enregistré', detail:'Fontaine Marigot · Sud-Est', age:'Il y a 38 min' },
    ];
    for (const s of pad) { if (items.length >= 4) break; items.push(s); }
    return items.slice(0,4);
  }

  get networkHealth(): number {
    const total = this.totalPointsCount(); if (!total) return 100;
    return Math.round(Math.max(0,Math.min(100,100-(this.criticalPoints().length/total)*100)));
  }

  get todayLabel(): string {
    return new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  get greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 17 ? 'Bon après-midi' : 'Bonsoir';
  }

  healthColor(): string { const h = this.networkHealth; return h>=90?'#34D399':h>=70?'#FBBF24':'#F87171'; }

  private pushHistory() {
    const total = this.points.all().length;
    const online = (this.dashboard?.realtime ?? []).filter(p => this.lastSeen(p)).length;
    const critAlerts = (this.dashboard?.alerts ?? []).filter(a => a.severity==='CRIT').length;
    const next: Record<KpiKey,number> = {
      activeResources: total, reservoirsTotal: this.points.all().filter(p=>p.type==='TANK').length,
      sensorsOnline: online, alertsActive: (this.dashboard?.alerts??[]).length,
      territoriesInTension: this.territoriesInTension().length,
      serviceOkPct: total ? Math.round(((total-this.criticalPoints().length)/total)*100) : 0,
      qualityOkPct:  total ? Math.round(((total-this.warnOrCritPoints().length)/total)*100) : 0,
      sensorsOkPct:  total ? Math.round((online/total)*100) : 0,
      criticalReservoirs: this.points.all().filter(p=>p.type==='TANK').map(p=>p.id).filter(id=>this.pointState(id)==='CRIT').length,
      criticalAlerts: critAlerts
    };
    const updated = { ...this.kpiHistory };
    (Object.keys(next) as KpiKey[]).forEach(k => { updated[k] = this.appendSeries(updated[k]??[], next[k]); });
    this.kpiHistory = updated;
    localStorage.setItem(this.kpiStorageKey, JSON.stringify(this.kpiHistory));
  }

  private pushMetricsHistory() {
    const now = new Date().toISOString();
    const rt = this.dashboard?.realtime ?? [];
    const avg = (type: string) => { const vals = rt.map(p=>p.lastMeasurements?.[type]?.value).filter(v=>typeof v==='number') as number[]; return vals.length ? vals.reduce((a,v)=>a+v,0)/vals.length : 0; };
    this.metricsHistory = {
      pressureAvg: this.appendMetricSeries(this.metricsHistory.pressureAvg, { timestamp:now, value:avg('PRESSURE') }),
      levelAvg:    this.appendMetricSeries(this.metricsHistory.levelAvg,    { timestamp:now, value:avg('LEVEL') }),
      flowAvg:     this.appendMetricSeries(this.metricsHistory.flowAvg,     { timestamp:now, value:avg('FLOW') }),
      okPct:       this.appendMetricSeries(this.metricsHistory.okPct,       { timestamp:now, value:this.kpiValue('qualityOkPct') }),
    };
    localStorage.setItem(this.metricsStorageKey, JSON.stringify(this.metricsHistory));
  }

  private appendSeries(s: number[], v: number): number[] { const n = [...s, v]; return n.length > 12 ? n.slice(n.length-12) : n; }
  private appendMetricSeries(s: SeriesPoint[], v: SeriesPoint): SeriesPoint[] { const n = [...(s??[]), v]; return n.length > 12 ? n.slice(n.length-12) : n; }

  private loadHistory(): Record<KpiKey, number[]> {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.kpiStorageKey) ?? '{}') as Record<string,number[]>;
      return { activeResources:parsed['activeResources']??[], reservoirsTotal:parsed['reservoirsTotal']??[], sensorsOnline:parsed['sensorsOnline']??[], alertsActive:parsed['alertsActive']??[], territoriesInTension:parsed['territoriesInTension']??[], serviceOkPct:parsed['serviceOkPct']??[], qualityOkPct:parsed['qualityOkPct']??[], sensorsOkPct:parsed['sensorsOkPct']??[], criticalReservoirs:parsed['criticalReservoirs']??[], criticalAlerts:parsed['criticalAlerts']??[] };
    } catch { return { activeResources:[], reservoirsTotal:[], sensorsOnline:[], alertsActive:[], territoriesInTension:[], serviceOkPct:[], qualityOkPct:[], sensorsOkPct:[], criticalReservoirs:[], criticalAlerts:[] }; }
  }

  private loadMetricsHistory(): Record<MetricsKey, SeriesPoint[]> {
    try {
      const p = JSON.parse(localStorage.getItem(this.metricsStorageKey) ?? '{}') as Record<string,SeriesPoint[]>;
      return { levelAvg:p['levelAvg']??[], flowAvg:p['flowAvg']??[], pressureAvg:p['pressureAvg']??[], okPct:p['okPct']??[] };
    } catch { return { levelAvg:[], flowAvg:[], pressureAvg:[], okPct:[] }; }
  }
}

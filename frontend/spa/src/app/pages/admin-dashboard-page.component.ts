import { Component, AfterViewInit, OnDestroy, OnInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BffApiService } from '../api/bff-api.service';
import { AuthService } from '../auth.service';
import { RefreshService } from '../refresh.service';
import { Subscription } from 'rxjs';
import { INFRA_DATA, InfraItem } from './infrastructures-page.component';
import { NatResource } from './resources-page.component';
import { ResourcesStore } from '../resources.store';

declare const L: any;

type SeverityLevel = 'INFO' | 'WARN' | 'CRIT';
type AlertDto  = { id: number; pointId: string; severity: SeverityLevel; status: string; message: string; type?: string };
type TicketDto = { id: number; status: string; alertId?: number; assignee?: string };

const ACTIVITY = [
  { time: '09:42', label: 'Alerte critique · Forage F-08', kind: 'crit', sub: 'Pompe HS · Carrefour' },
  { time: '08:15', label: 'Intervention assignée · Péligre', kind: 'info', sub: 'Tech. Jean P. · Station Péligre' },
  { time: '07:50', label: 'Rapport mensuel généré', kind: 'ok', sub: 'OREPA Ouest · Avril 2026' },
  { time: '06:30', label: 'Seuil dépassé · pH Station Jacmel', kind: 'warn', sub: 'Valeur 8.6 > seuil 8.2' },
  { time: '05:12', label: 'Maintenance planifiée · Péligre', kind: 'info', sub: 'Inspection turbines · demain 08h' },
  { time: '03:44', label: 'Connexion IoT rétablie', kind: 'ok', sub: 'Capteur CAP-BEL-01 · En ligne' },
];

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    /* ── PAGE ── */
    .adm { padding: 0; color: #E2E8EE; font-family: -apple-system, system-ui, sans-serif; }

    /* ── HEADER ── */
    .adm-header {
      padding: 18px 24px 14px;
      border-bottom: .5px solid rgba(255,255,255,.06);
    }
    .adm-header__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .adm-header__title { font-size: 1.25rem; font-weight: 700; color: #fff; letter-spacing: -.02em; margin: 0; }
    .adm-header__sub { font-size: .72rem; color: rgba(255,255,255,.38); margin-top: 2px; }
    .adm-header__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .adm-header__live {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 10px; background: rgba(52,211,153,.07);
      border: .5px solid rgba(52,211,153,.2); border-radius: 7px;
    }
    .adm-live-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #34D399;
      box-shadow: 0 0 6px rgba(52,211,153,.7);
      animation: live-pulse 2s ease-in-out infinite;
    }
    @keyframes live-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
    .adm-live-txt { font-size: .63rem; color: #34D399; font-weight: 600; letter-spacing: .06em; }
    .adm-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 13px; border-radius: 7px; border: .5px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.05); color: rgba(255,255,255,.7);
      font-size: .72rem; font-weight: 500; cursor: pointer; transition: all .15s;
    }
    .adm-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
    .adm-btn--primary {
      background: rgba(96,165,250,.12); border-color: rgba(96,165,250,.25); color: #60A5FA;
    }
    .adm-btn--primary:hover { background: rgba(96,165,250,.2); }

    /* ── KPI STRIP ── */
    .adm-kpis {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; padding: 18px 24px;
    }
    @media (max-width: 1100px) { .adm-kpis { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 700px)  { .adm-kpis { grid-template-columns: repeat(2, 1fr); } }
    .adm-kpi {
      background: rgba(15,23,41,.85); border: .5px solid rgba(255,255,255,.08);
      border-radius: 12px; padding: 14px 16px; position: relative; overflow: hidden;
      transition: border-color .2s;
    }
    .adm-kpi:hover { border-color: rgba(255,255,255,.16); }
    .adm-kpi__accent { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
    .adm-kpi__label { font-size: .63rem; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 7px; }
    .adm-kpi__value { font-size: 1.85rem; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -.03em; }
    .adm-kpi__unit  { font-size: .8rem; font-weight: 500; color: rgba(255,255,255,.45); margin-left: 1px; }
    .adm-kpi__trend { font-size: .68rem; margin-top: 5px; display: flex; align-items: center; gap: 3px; color: rgba(255,255,255,.38); }
    .adm-kpi__trend--up   { color: #34D399; }
    .adm-kpi__trend--down { color: #F87171; }
    .adm-kpi__trend--warn { color: #FBBF24; }
    .adm-crit-badge {
      font-size: .6rem; font-weight: 700; padding: .1rem .38rem;
      border-radius: 999px; background: rgba(239,68,68,.18); color: #F87171;
      border: .5px solid rgba(239,68,68,.3); margin-left: 4px;
    }

    /* ── MAP SECTION ── */
    .adm-map-section {
      margin: 0 24px 16px;
      background: rgba(8,14,26,.9); border: .5px solid rgba(255,255,255,.08);
      border-radius: 12px; overflow: hidden;
    }
    .adm-map-header {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 16px; border-bottom: .5px solid rgba(255,255,255,.06);
    }
    .adm-map-title { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .1em; }
    .adm-map-attr  { font-size: .62rem; color: rgba(255,255,255,.25); }
    .adm-layer-btns { display: flex; gap: 6px; margin-left: 6px; }
    .adm-layer-btn {
      padding: 3px 10px; border-radius: 5px; border: .5px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.04); color: rgba(255,255,255,.45);
      font-size: .65rem; font-weight: 500; cursor: pointer; transition: all .15s;
    }
    .adm-layer-btn:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.7); }
    .adm-layer-btn.active { border-color: rgba(96,165,250,.4); background: rgba(96,165,250,.1); color: #60A5FA; }
    .adm-layer-btn.active--green { border-color: rgba(52,211,153,.4); background: rgba(52,211,153,.08); color: #34D399; }
    .adm-map-badge {
      margin-left: auto; font-size: .63rem; font-weight: 700; padding: .15rem .45rem;
      border-radius: 999px; background: rgba(96,165,250,.12); color: #60A5FA;
      border: .5px solid rgba(96,165,250,.25);
    }
    .adm-map-wrap { position: relative; }
    .adm-map-leaflet { height: 360px; width: 100%; }
    .adm-map-legend {
      position: absolute; bottom: 12px; right: 12px; z-index: 999;
      background: rgba(8,14,26,.88); border: .5px solid rgba(255,255,255,.1);
      border-radius: 8px; padding: 8px 12px; backdrop-filter: blur(8px);
    }
    .adm-map-legend__title { font-size: .58rem; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
    .adm-map-legend__row { display: flex; align-items: center; gap: 6px; font-size: .63rem; color: rgba(255,255,255,.55); margin-bottom: 3px; }
    .adm-map-legend__row:last-child { margin-bottom: 0; }
    .adm-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .adm-legend-sq  { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
    .adm-legend-tri {
      width: 0; height: 0; border-left: 5px solid transparent;
      border-right: 5px solid transparent; border-bottom: 9px solid;
      flex-shrink: 0;
    }

    /* ── 3-COL & 2-COL ROWS ── */
    .adm-3col {
      display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 14px; padding: 0 24px 14px;
    }
    @media (max-width: 1100px) { .adm-3col { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 700px)  { .adm-3col { grid-template-columns: 1fr; } }
    .adm-2col {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 0 24px 24px;
    }
    @media (max-width: 800px) { .adm-2col { grid-template-columns: 1fr; } }

    /* ── PANEL ── */
    .adm-panel {
      background: rgba(15,23,41,.85); border: .5px solid rgba(255,255,255,.08);
      border-radius: 12px; overflow: hidden;
    }
    .adm-panel__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 14px; border-bottom: .5px solid rgba(255,255,255,.06);
    }
    .adm-panel__title { font-size: .68rem; font-weight: 700; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .1em; }
    .adm-panel__badge {
      font-size: .6rem; font-weight: 700; padding: .12rem .42rem; border-radius: 999px;
      background: rgba(239,68,68,.15); color: #F87171; border: .5px solid rgba(239,68,68,.25);
    }
    .adm-panel__badge--blue   { background: rgba(96,165,250,.12); color: #60A5FA; border-color: rgba(96,165,250,.25); }
    .adm-panel__badge--amber  { background: rgba(251,191,36,.1);  color: #FBBF24; border-color: rgba(251,191,36,.2); }
    .adm-panel__link { font-size: .68rem; color: #60A5FA; text-decoration: none; }
    .adm-panel__link:hover { text-decoration: underline; }

    /* ── ALERT ITEMS ── */
    .adm-alert-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 14px; border-bottom: .5px solid rgba(255,255,255,.04);
    }
    .adm-alert-item:last-child { border-bottom: none; }
    .adm-alert-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .adm-alert-dot--crit { background: #EF4444; box-shadow: 0 0 5px rgba(239,68,68,.55); }
    .adm-alert-dot--warn { background: #FBBF24; }
    .adm-alert-dot--info { background: #60A5FA; }
    .adm-alert-body { flex: 1; min-width: 0; }
    .adm-alert-title { font-size: .78rem; font-weight: 600; color: #E2E8EE; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .adm-alert-sub   { font-size: .67rem; color: rgba(255,255,255,.35); margin-top: 2px; }
    .adm-alert-tag {
      flex-shrink: 0; font-size: .58rem; font-weight: 700; padding: .12rem .38rem;
      border-radius: 999px; text-transform: uppercase; letter-spacing: .05em;
    }
    .adm-alert-tag--crit { background: rgba(239,68,68,.15); color: #F87171; border: .5px solid rgba(239,68,68,.25); }
    .adm-alert-tag--warn { background: rgba(251,191,36,.1); color: #FBBF24; border: .5px solid rgba(251,191,36,.2); }
    .adm-alert-tag--info { background: rgba(96,165,250,.1); color: #60A5FA; border: .5px solid rgba(96,165,250,.2); }
    .adm-alert-actions { display: flex; gap: 6px; padding: 10px 14px; border-top: .5px solid rgba(255,255,255,.04); }
    .adm-alert-btn {
      flex: 1; padding: 6px; border-radius: 6px; border: .5px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.04); color: rgba(255,255,255,.55); font-size: .67rem;
      font-weight: 500; cursor: pointer; text-align: center; transition: all .15s;
    }
    .adm-alert-btn:hover { background: rgba(255,255,255,.09); color: #fff; }
    .adm-alert-btn--red { border-color: rgba(239,68,68,.25); color: #F87171; background: rgba(239,68,68,.07); }
    .adm-alert-btn--red:hover { background: rgba(239,68,68,.15); }

    /* ── INTERVENTION ITEMS ── */
    .adm-intv-stats { display: flex; gap: 0; border-bottom: .5px solid rgba(255,255,255,.05); }
    .adm-intv-stat {
      flex: 1; padding: 9px 12px; text-align: center;
      border-right: .5px solid rgba(255,255,255,.05);
    }
    .adm-intv-stat:last-child { border-right: none; }
    .adm-intv-stat__val { font-size: 1.15rem; font-weight: 700; color: #fff; }
    .adm-intv-stat__lbl { font-size: .6rem; color: rgba(255,255,255,.35); margin-top: 2px; text-transform: uppercase; letter-spacing: .07em; }
    .adm-intv-item {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 14px; border-bottom: .5px solid rgba(255,255,255,.04);
    }
    .adm-intv-item:last-child { border-bottom: none; }
    .adm-intv-avatar {
      width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: .65rem; font-weight: 700; color: #fff;
    }
    .adm-intv-body { flex: 1; min-width: 0; }
    .adm-intv-title { font-size: .75rem; font-weight: 600; color: #E2E8EE; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .adm-intv-sub   { font-size: .65rem; color: rgba(255,255,255,.35); margin-top: 1px; }
    .adm-intv-pill  { flex-shrink: 0; font-size: .58rem; font-weight: 600; padding: .1rem .35rem; border-radius: 999px; }
    .adm-intv-pill--open     { background: rgba(96,165,250,.1); color: #60A5FA; }
    .adm-intv-pill--progress { background: rgba(251,191,36,.1); color: #FBBF24; }
    .adm-intv-pill--assigned { background: rgba(52,211,153,.1); color: #34D399; }

    /* ── INFRASTRUCTURE CRITIQUES ── */
    .adm-infra-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 14px; border-bottom: .5px solid rgba(255,255,255,.04);
    }
    .adm-infra-item:last-child { border-bottom: none; }
    .adm-infra-icon {
      width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: .75rem;
    }
    .adm-infra-icon--panne   { background: rgba(239,68,68,.15); }
    .adm-infra-icon--vetuste { background: rgba(251,191,36,.12); }
    .adm-infra-icon--maint   { background: rgba(96,165,250,.1); }
    .adm-infra-body { flex: 1; min-width: 0; }
    .adm-infra-title { font-size: .75rem; font-weight: 600; color: #E2E8EE; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .adm-infra-meta  { font-size: .65rem; color: rgba(255,255,255,.35); margin-top: 2px; }
    .adm-infra-bar { margin-top: 6px; }
    .adm-infra-bar__track { height: 3px; border-radius: 2px; background: rgba(255,255,255,.08); }
    .adm-infra-bar__fill  { height: 3px; border-radius: 2px; transition: width .4s; }
    .adm-infra-bar__fill--panne   { background: #EF4444; }
    .adm-infra-bar__fill--vetuste { background: #FBBF24; }
    .adm-infra-bar__fill--maint   { background: #60A5FA; }
    .adm-infra-bar__label { font-size: .6rem; color: rgba(255,255,255,.3); margin-top: 3px; }

    /* ── TIMELINE ── */
    .adm-timeline { padding: 10px 14px; display: flex; flex-direction: column; gap: 0; }
    .adm-tl-item  {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 0; border-bottom: .5px solid rgba(255,255,255,.04);
    }
    .adm-tl-item:last-child { border-bottom: none; }
    .adm-tl-time { font-size: .63rem; color: rgba(255,255,255,.3); flex-shrink: 0; width: 36px; padding-top: 1px; font-variant-numeric: tabular-nums; }
    .adm-tl-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .adm-tl-dot--crit { background: #EF4444; box-shadow: 0 0 5px rgba(239,68,68,.5); }
    .adm-tl-dot--warn { background: #FBBF24; }
    .adm-tl-dot--ok   { background: #34D399; }
    .adm-tl-dot--info { background: #60A5FA; }
    .adm-tl-body { flex: 1; min-width: 0; }
    .adm-tl-label { font-size: .75rem; font-weight: 500; color: #CBD5E1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .adm-tl-sub   { font-size: .65rem; color: rgba(255,255,255,.3); margin-top: 2px; }

    /* ── REPORTS GRID ── */
    .adm-reports-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px; }
    .adm-report-btn {
      display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
      padding: 13px 14px; border-radius: 9px;
      border: .5px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03);
      cursor: pointer; text-align: left; transition: all .15s;
    }
    .adm-report-btn:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.14); }
    .adm-report-icon  { font-size: 1.1rem; }
    .adm-report-label { font-size: .73rem; font-weight: 600; color: #CBD5E1; }
    .adm-report-sub   { font-size: .63rem; color: rgba(255,255,255,.3); }
    .adm-report-tag {
      font-size: .58rem; font-weight: 700; padding: .1rem .32rem; border-radius: 999px; margin-top: 4px;
    }
    .adm-report-tag--pdf  { background: rgba(239,68,68,.12); color: #F87171; border: .5px solid rgba(239,68,68,.2); }
    .adm-report-tag--xlsx { background: rgba(52,211,153,.1); color: #34D399; border: .5px solid rgba(52,211,153,.2); }
    .adm-report-tag--csv  { background: rgba(251,191,36,.1); color: #FBBF24; border: .5px solid rgba(251,191,36,.2); }
    .adm-report-tag--kml  { background: rgba(167,139,250,.1); color: #A78BFA; border: .5px solid rgba(167,139,250,.2); }

    /* ── UTILITY ── */
    .adm-empty { padding: 28px 14px; text-align: center; color: rgba(255,255,255,.22); font-size: .75rem; }
    @keyframes adm-spin { to { transform: rotate(360deg); } }
    .adm-spinner {
      width: 18px; height: 18px; margin: 22px auto; display: block;
      border: 2px solid rgba(255,255,255,.1); border-top-color: #60A5FA;
      border-radius: 50%; animation: adm-spin .7s linear infinite;
    }
  `],
  template: `
<div class="adm">

  <!-- ══ HEADER ══ -->
  <div class="adm-header">
    <div class="adm-header__top">
      <div>
        <h1 class="adm-header__title">Tableau de bord</h1>
        <p class="adm-header__sub">Vue globale · {{ totalOuvrages }} ouvrages · {{ natTotal }} ressources · {{ today }}</p>
      </div>
      <div class="adm-header__actions">
        <div class="adm-header__live">
          <span class="adm-live-dot"></span>
          <span class="adm-live-txt">LIVE</span>
        </div>
        <button class="adm-btn" type="button" (click)="reload()">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Actualiser
        </button>
        <button class="adm-btn adm-btn--primary" type="button" routerLink="/admin/rapports">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Exporter rapport
        </button>
      </div>
    </div>
  </div>

  <!-- ══ KPI STRIP (5) ══ -->
  <div class="adm-kpis">

    <div class="adm-kpi">
      <div class="adm-kpi__accent" style="background:linear-gradient(90deg,#34D399,#10B981)"></div>
      <div class="adm-kpi__label">Points d'eau actifs</div>
      <div class="adm-kpi__value">{{ kpiActive }}<span class="adm-kpi__unit">/{{ totalOuvrages }}</span></div>
      <div class="adm-kpi__trend adm-kpi__trend--up">▲ {{ kpiActiveRate }}% opérationnels</div>
    </div>

    <div class="adm-kpi">
      <div class="adm-kpi__accent" style="background:linear-gradient(90deg,#60A5FA,#3B82F6)"></div>
      <div class="adm-kpi__label">Capteurs IoT</div>
      <div class="adm-kpi__value">42<span class="adm-kpi__unit">/48</span></div>
      <div class="adm-kpi__trend adm-kpi__trend--up">▲ 87.5% en ligne</div>
    </div>

    <div class="adm-kpi">
      <div class="adm-kpi__accent" style="background:linear-gradient(90deg,#EF4444,#DC2626)"></div>
      <div class="adm-kpi__label">Alertes ouvertes</div>
      <div class="adm-kpi__value">{{ totalAlerts }}</div>
      <div class="adm-kpi__trend">
        <span class="adm-crit-badge" *ngIf="critCount > 0">{{ critCount }} CRIT</span>
        <span *ngIf="critCount === 0" class="adm-kpi__trend--up">✓ Aucune critique</span>
        <span *ngIf="critCount > 0" class="adm-kpi__trend--down">&nbsp;Attention requise</span>
      </div>
    </div>

    <div class="adm-kpi">
      <div class="adm-kpi__accent" style="background:linear-gradient(90deg,#A78BFA,#8B5CF6)"></div>
      <div class="adm-kpi__label">Interventions</div>
      <div class="adm-kpi__value">{{ openTickets }}</div>
      <div class="adm-kpi__trend adm-kpi__trend--warn">● {{ openTickets }} en cours</div>
    </div>

    <div class="adm-kpi">
      <div class="adm-kpi__accent" style="background:linear-gradient(90deg,#FBBF24,#D97706)"></div>
      <div class="adm-kpi__label">Infrastructures dégradées</div>
      <div class="adm-kpi__value">{{ critInfra.length }}<span class="adm-kpi__unit">/{{ totalOuvrages }}</span></div>
      <div class="adm-kpi__trend adm-kpi__trend--warn">● {{ degradedRate }}% du parc</div>
    </div>

  </div>

  <!-- ══ CARTE NATIONALE ══ -->
  <div class="adm-map-section">
    <div class="adm-map-header">
      <span class="adm-map-title">Carte nationale · Ressources &amp; Infrastructures</span>
      <span class="adm-map-attr">OpenStreetMap · CNIGS Haïti</span>
      <div class="adm-layer-btns">
        <button class="adm-layer-btn" [class.active]="showInfra" type="button" (click)="toggleLayer('infra')">
          Infrastructures ({{ totalOuvrages }})
        </button>
        <button class="adm-layer-btn" [class.active]="showResources" type="button" (click)="toggleLayer('resources')">
          Ressources naturelles ({{ natTotal }})
        </button>
      </div>
      <span class="adm-map-badge">{{ totalOuvrages + natTotal }} points</span>
    </div>
    <div class="adm-map-wrap">
      <div #dashMap class="adm-map-leaflet"></div>
      <div class="adm-map-legend">
        <div class="adm-map-legend__title">Légende</div>
        <div class="adm-map-legend__row"><span class="adm-legend-dot" style="background:#10B981"></span>Opérationnel / Saine</div>
        <div class="adm-map-legend__row"><span class="adm-legend-dot" style="background:#F59E0B"></span>Maintenance / Menacée</div>
        <div class="adm-map-legend__row"><span class="adm-legend-dot" style="background:#EF4444"></span>Panne / Polluée</div>
        <div style="border-top:.5px solid rgba(255,255,255,.08);margin:5px 0"></div>
        <div class="adm-map-legend__row">
          <svg viewBox="0 0 10 10" width="10" height="10"><rect x="1" y="1" width="8" height="8" fill="#10B981" rx="1"/></svg>Captage
        </div>
        <div class="adm-map-legend__row">
          <svg viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" fill="#A5A4DC"/></svg>Forage / Puits
        </div>
        <div class="adm-map-legend__row">
          <svg viewBox="0 0 10 10" width="10" height="10"><polygon points="5,1 9,9 1,9" fill="#06B6D4"/></svg>Source · Station
        </div>
        <div class="adm-map-legend__row">
          <svg viewBox="0 0 12 10" width="12" height="10"><ellipse cx="6" cy="5" rx="5" ry="3.5" fill="none" stroke="#60A5FA" stroke-width="1.5" stroke-dasharray="2,1"/><circle cx="6" cy="5" r="2" fill="#60A5FA"/></svg>Bassin versant
        </div>
      </div>
    </div>
  </div>

  <!-- ══ 3-COL ROW ══ -->
  <div class="adm-3col">

    <!-- Alertes prioritaires -->
    <div class="adm-panel">
      <div class="adm-panel__head">
        <span class="adm-panel__title">Alertes prioritaires</span>
        <span class="adm-panel__badge" *ngIf="alertItems.length">{{ alertItems.length }}</span>
      </div>
      <div *ngIf="loading" class="adm-spinner"></div>
      <div *ngIf="!loading">
        <div class="adm-alert-item" *ngFor="let a of alertItems">
          <span class="adm-alert-dot"
            [class.adm-alert-dot--crit]="a.kind === 'crit'"
            [class.adm-alert-dot--warn]="a.kind === 'warn'"
            [class.adm-alert-dot--info]="a.kind === 'info'"></span>
          <div class="adm-alert-body">
            <div class="adm-alert-title">{{ a.title }}</div>
            <div class="adm-alert-sub">{{ a.sub }}</div>
          </div>
          <span class="adm-alert-tag"
            [class.adm-alert-tag--crit]="a.kind === 'crit'"
            [class.adm-alert-tag--warn]="a.kind === 'warn'"
            [class.adm-alert-tag--info]="a.kind === 'info'">{{ a.tag }}</span>
        </div>
        <div class="adm-empty" *ngIf="alertItems.length === 0">Aucune alerte active</div>
        <div class="adm-alert-actions" *ngIf="alertItems.length > 0">
          <button class="adm-alert-btn adm-alert-btn--red" type="button" routerLink="/admin/alertes">Voir toutes</button>
          <button class="adm-alert-btn" type="button" routerLink="/admin/interventions">+ Intervention</button>
        </div>
      </div>
    </div>

    <!-- Interventions en cours -->
    <div class="adm-panel">
      <div class="adm-panel__head">
        <span class="adm-panel__title">Interventions en cours</span>
        <span class="adm-panel__badge adm-panel__badge--blue" *ngIf="openTickets > 0">{{ openTickets }}</span>
      </div>
      <div *ngIf="loading" class="adm-spinner"></div>
      <div *ngIf="!loading">
        <div class="adm-intv-stats">
          <div class="adm-intv-stat">
            <div class="adm-intv-stat__val">{{ openTickets }}</div>
            <div class="adm-intv-stat__lbl">Ouvertes</div>
          </div>
          <div class="adm-intv-stat">
            <div class="adm-intv-stat__val" style="color:#FBBF24">{{ inProgressCount }}</div>
            <div class="adm-intv-stat__lbl">En cours</div>
          </div>
          <div class="adm-intv-stat">
            <div class="adm-intv-stat__val" style="color:#34D399">{{ assignedCount }}</div>
            <div class="adm-intv-stat__lbl">Assignées</div>
          </div>
        </div>
        <div class="adm-intv-item" *ngFor="let t of intvItems">
          <div class="adm-intv-avatar" [style.background]="t.color">{{ t.initials }}</div>
          <div class="adm-intv-body">
            <div class="adm-intv-title">Ticket #{{ t.id }}</div>
            <div class="adm-intv-sub">{{ t.assignee }}</div>
          </div>
          <span class="adm-intv-pill"
            [class.adm-intv-pill--open]="t.status === 'OPEN'"
            [class.adm-intv-pill--progress]="t.status === 'IN_PROGRESS'"
            [class.adm-intv-pill--assigned]="t.status === 'ASSIGNED'">
            {{ ticketStatusLabel(t.status) }}
          </span>
        </div>
        <div class="adm-empty" *ngIf="intvItems.length === 0">Aucune intervention en cours</div>
      </div>
    </div>

    <!-- Infrastructures critiques -->
    <div class="adm-panel">
      <div class="adm-panel__head">
        <span class="adm-panel__title">Infrastructures critiques</span>
        <span class="adm-panel__badge adm-panel__badge--amber">{{ critInfra.length }}</span>
      </div>
      <div class="adm-infra-item" *ngFor="let inf of critInfra">
        <div class="adm-infra-icon"
          [class.adm-infra-icon--panne]="inf.status === 'panne'"
          [class.adm-infra-icon--vetuste]="inf.status === 'vetuste'"
          [class.adm-infra-icon--maint]="inf.status === 'maintenance'">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke-width="1.8" stroke-linecap="round"
            [attr.stroke]="inf.status === 'panne' ? '#EF4444' : inf.status === 'vetuste' ? '#FBBF24' : '#60A5FA'">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="adm-infra-body">
          <div class="adm-infra-title">{{ inf.name }}</div>
          <div class="adm-infra-meta">{{ inf.department }} · {{ infraStatusLabel(inf.status) }}</div>
          <div class="adm-infra-bar" *ngIf="inf.capaciteM3h">
            <div class="adm-infra-bar__track">
              <div class="adm-infra-bar__fill"
                [class.adm-infra-bar__fill--panne]="inf.status === 'panne'"
                [class.adm-infra-bar__fill--vetuste]="inf.status === 'vetuste'"
                [class.adm-infra-bar__fill--maint]="inf.status === 'maintenance'"
                [style.width]="capPct(inf) + '%'"></div>
            </div>
            <div class="adm-infra-bar__label">{{ inf.capaciteM3h }} m³/h · {{ inf.anneeConstruction ? (2026 - inf.anneeConstruction) + ' ans' : '' }}</div>
          </div>
          <div class="adm-infra-meta" *ngIf="inf.notes" style="margin-top:3px;font-style:italic">{{ inf.notes }}</div>
        </div>
      </div>
      <div style="padding:10px 14px;border-top:.5px solid rgba(255,255,255,.04)">
        <a routerLink="/admin/infrastructures" class="adm-panel__link">Voir toutes les infrastructures →</a>
      </div>
    </div>

  </div>

  <!-- ══ 2-COL ROW ══ -->
  <div class="adm-2col">

    <!-- Activité récente -->
    <div class="adm-panel">
      <div class="adm-panel__head">
        <span class="adm-panel__title">Activité récente · dernières 24h</span>
        <a class="adm-panel__link" routerLink="/admin/history">Historique →</a>
      </div>
      <div class="adm-timeline">
        <div class="adm-tl-item" *ngFor="let e of activity">
          <span class="adm-tl-time">{{ e.time }}</span>
          <span class="adm-tl-dot"
            [class.adm-tl-dot--crit]="e.kind === 'crit'"
            [class.adm-tl-dot--warn]="e.kind === 'warn'"
            [class.adm-tl-dot--ok]="e.kind === 'ok'"
            [class.adm-tl-dot--info]="e.kind === 'info'"></span>
          <div class="adm-tl-body">
            <div class="adm-tl-label">{{ e.label }}</div>
            <div class="adm-tl-sub">{{ e.sub }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rapports rapides -->
    <div class="adm-panel">
      <div class="adm-panel__head">
        <span class="adm-panel__title">Rapports rapides</span>
        <a class="adm-panel__link" routerLink="/admin/rapports">Tous les rapports →</a>
      </div>
      <div class="adm-reports-grid">
        <button class="adm-report-btn" type="button" routerLink="/admin/rapports">
          <span class="adm-report-icon">📊</span>
          <span class="adm-report-label">Bilan mensuel</span>
          <span class="adm-report-sub">Vue nationale · Avril 2026</span>
          <span class="adm-report-tag adm-report-tag--pdf">PDF</span>
        </button>
        <button class="adm-report-btn" type="button" routerLink="/admin/rapports">
          <span class="adm-report-icon">📈</span>
          <span class="adm-report-label">Qualité eau</span>
          <span class="adm-report-sub">Paramètres physico-chimiques</span>
          <span class="adm-report-tag adm-report-tag--xlsx">XLSX</span>
        </button>
        <button class="adm-report-btn" type="button" routerLink="/admin/rapports">
          <span class="adm-report-icon">🗂️</span>
          <span class="adm-report-label">Interventions</span>
          <span class="adm-report-sub">Tickets & temps de résolution</span>
          <span class="adm-report-tag adm-report-tag--csv">CSV</span>
        </button>
        <button class="adm-report-btn" type="button" routerLink="/admin/rapports">
          <span class="adm-report-icon">🗺️</span>
          <span class="adm-report-label">Cartographie</span>
          <span class="adm-report-sub">Export couches géographiques</span>
          <span class="adm-report-tag adm-report-tag--kml">KML</span>
        </button>
      </div>
    </div>

  </div>

</div>
  `
})
export class AdminDashboardPageComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('dashMap') mapRef!: ElementRef<HTMLDivElement>;

  loading = true;

  // KPI from INFRA_DATA
  totalOuvrages = INFRA_DATA.length;
  get natTotal(): number { return this.store.snapshot.length; }
  kpiActive     = INFRA_DATA.filter(i => i.status === 'operationnel').length;
  kpiActiveRate = Math.round(INFRA_DATA.filter(i => i.status === 'operationnel').length / INFRA_DATA.length * 100);
  degradedRate  = (INFRA_DATA.filter(i => i.status !== 'operationnel').length / INFRA_DATA.length * 100).toFixed(1);

  // KPI from API
  critCount    = 0;
  totalAlerts  = 0;
  openTickets  = 0;
  inProgressCount = 0;
  assignedCount   = 0;

  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  alertItems: { kind: 'crit' | 'warn' | 'info'; title: string; sub: string; tag: string }[] = [];
  intvItems:  { id: number; assignee: string; status: string; initials: string; color: string }[] = [];
  activity = ACTIVITY;

  // Map state
  showInfra     = true;
  showResources = true;
  private map: any = null;
  private infraMarkers: Record<string, any> = {};
  private natMarkers:   Record<string, any> = {};

  private subs: Subscription[] = [];

  constructor(
    private readonly api: BffApiService,
    private readonly auth: AuthService,
    private readonly refresh: RefreshService,
    private readonly zone: NgZone,
    private readonly store: ResourcesStore
  ) {}

  ngOnInit(): void {
    this.load();
    this.subs.push(this.refresh.refresh$.subscribe(() => this.load()));
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 150);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get critInfra(): InfraItem[] {
    return INFRA_DATA.filter(i => i.status !== 'operationnel');
  }

  // ── Map ──────────────────────────────────────────────────────────────────

  private initMap(): void {
    if (!this.mapRef?.nativeElement || typeof L === 'undefined') return;

    this.map = L.map(this.mapRef.nativeElement, {
      center: [18.9, -72.7], zoom: 8, zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · CNIGS Haïti · GestiDLO',
      maxZoom: 18
    }).addTo(this.map);

    this.buildInfraMarkers();
    this.buildNatMarkers();
  }

  private buildInfraMarkers(): void {
    Object.values(this.infraMarkers).forEach((m: any) => m.remove());
    this.infraMarkers = {};

    INFRA_DATA.forEach(item => {
      if (!item.lat || !item.lon) return;
      const icon = L.divIcon({
        html: this.infraMarkerSvg(item), className: '',
        iconSize: [30, 30], iconAnchor: [15, 15]
      });
      const m = L.marker([item.lat, item.lon], { icon })
        .bindPopup(this.infraPopup(item), { maxWidth: 230, className: 'in-leaflet-popup' });
      if (this.showInfra) m.addTo(this.map);
      this.infraMarkers[item.id] = m;
    });
  }

  private buildNatMarkers(): void {
    Object.values(this.natMarkers).forEach((m: any) => m.remove());
    this.natMarkers = {};

    this.store.snapshot.forEach(r => {
      if (!r.lat || !r.lon) return;
      const icon = L.divIcon({
        html: this.natMarkerSvg(r), className: '',
        iconSize: [30, 30], iconAnchor: [15, 15]
      });
      const m = L.marker([r.lat, r.lon], { icon })
        .bindPopup(this.natPopup(r), { maxWidth: 220, className: 'rn-leaflet-popup' });
      if (this.showResources) m.addTo(this.map);
      this.natMarkers[r.id] = m;
    });
  }

  toggleLayer(layer: 'infra' | 'resources'): void {
    if (layer === 'infra') {
      this.showInfra = !this.showInfra;
      Object.values(this.infraMarkers).forEach((m: any) => {
        this.showInfra ? m.addTo(this.map) : m.remove();
      });
    } else {
      this.showResources = !this.showResources;
      Object.values(this.natMarkers).forEach((m: any) => {
        this.showResources ? m.addTo(this.map) : m.remove();
      });
    }
  }

  // ── Marker SVGs (same as individual pages) ───────────────────────────────

  private infraMarkerSvg(item: InfraItem): string {
    const sc = item.status === 'operationnel' ? '#10B981'
             : item.status === 'maintenance'  ? '#F59E0B'
             : item.status === 'panne'        ? '#EF4444'
             : '#94A3B8';
    const ring = item.status !== 'operationnel'
      ? `<circle cx="15" cy="15" r="13" fill="${sc}" opacity="0.2"/>`
      : '';
    if (item.type === 'captage') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<rect x="6" y="6" width="18" height="18" fill="${sc}" stroke="white" stroke-width="1.5" rx="2"/>
      </svg>`;
    if (item.type === 'forage' || item.type === 'puits') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<circle cx="15" cy="15" r="10" fill="#A5A4DC" stroke="white" stroke-width="1.5"/>
        <circle cx="15" cy="15" r="5" fill="${sc}"/>
      </svg>`;
    if (item.type === 'pompage') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<circle cx="15" cy="15" r="10" fill="${sc}" stroke="white" stroke-width="1.5"/>
        <path d="M10,15 L20,15 M15,10 L15,20" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
    if (item.type === 'traitement') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<polygon points="15,4 26,23 4,23" fill="#06B6D4" stroke="white" stroke-width="1.5"/>
        <circle cx="15" cy="17" r="3.5" fill="${sc}"/>
      </svg>`;
    if (item.type === 'reservoir') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<rect x="9" y="4" width="12" height="22" fill="${sc}" stroke="white" stroke-width="1.5" rx="2"/>
      </svg>`;
    if (item.type === 'reseau') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<path d="M4,15 Q9,7 15,15 Q21,23 26,15" fill="none" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="15" cy="15" r="3" fill="#34D399"/>
      </svg>`;
    return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<circle cx="15" cy="15" r="9" fill="${sc}" stroke="white" stroke-width="1.5"/>
        <circle cx="15" cy="15" r="4" fill="white" opacity="0.6"/>
      </svg>`;
  }

  private natMarkerSvg(r: NatResource): string {
    const c = r.status === 'saine'   ? '#10B981'
            : r.status === 'menacee' ? '#F59E0B' : '#EF4444';
    const ring = r.status !== 'saine'
      ? `<circle cx="15" cy="15" r="12" fill="${c}" opacity="0.2"/>` : '';
    if (r.type === 'source') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}<polygon points="15,4 26,23 4,23" fill="${c}" stroke="white" stroke-width="1.5"/>
      </svg>`;
    if (r.type === 'riviere') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="11" fill="${c}" opacity="0.25"/>
        <circle cx="15" cy="15" r="7" fill="${c}" stroke="white" stroke-width="1.5"/>
      </svg>`;
    return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="15" cy="15" rx="13" ry="8" fill="${c}" opacity="0.18"
                 stroke="${c}" stroke-width="1.5" stroke-dasharray="3,2"/>
        <circle cx="15" cy="15" r="4" fill="${c}"/>
      </svg>`;
  }

  private infraPopup(item: InfraItem): string {
    const sc = item.status === 'operationnel' ? '#10B981'
             : item.status === 'maintenance'  ? '#F59E0B'
             : item.status === 'panne'        ? '#EF4444' : '#94A3B8';
    const sl = ({ operationnel: 'Opérationnel', maintenance: 'Maintenance', panne: 'Panne', vetuste: 'Vétuste' } as Record<string, string>)[item.status] ?? item.status;
    const tl = ({ captage:'Captage', forage:'Forage', puits:'Puits', pompage:'Pompage', traitement:'Traitement', reservoir:'Réservoir', reseau:'Réseau', borne:'Borne-fontaine' } as Record<string, string>)[item.type] ?? item.type;
    return `<div style="font-family:-apple-system,system-ui,sans-serif;min-width:190px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:9px;background:${sc}22;color:${sc};padding:1px 6px;border-radius:3px;font-weight:600;text-transform:uppercase">${tl}</span>
        <span style="font-size:11px;font-weight:700;color:#0f1419">${item.name}</span>
      </div>
      <div style="font-size:9px;color:#6b7280;line-height:1.6">
        ${item.commune} · ${item.department}<br/>
        ${item.capaciteM3h ? `<strong>${item.capaciteM3h} m³/h</strong> · ` : ''}
        <span style="color:${sc}">${sl}</span>
        ${item.notes ? `<br/><em>${item.notes}</em>` : ''}
      </div>
    </div>`;
  }

  private natPopup(r: NatResource): string {
    const sc = r.status === 'saine'   ? '#10B981'
             : r.status === 'menacee' ? '#F59E0B' : '#EF4444';
    const sl = r.status === 'saine' ? 'saine' : r.status === 'menacee' ? 'menacée' : 'polluée';
    const tl = r.type === 'source' ? 'Source' : r.type === 'riviere' ? 'Rivière' : 'Bassin';
    return `<div style="font-family:-apple-system,system-ui,sans-serif;min-width:180px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:9px;background:${sc}22;color:${sc};padding:1px 6px;border-radius:3px;font-weight:600;text-transform:uppercase">${tl}</span>
        <span style="font-size:11px;font-weight:700;color:#0f1419">${r.name}</span>
      </div>
      <div style="font-size:9px;color:#6b7280;line-height:1.6">
        ${r.commune}${r.section ? ' · ' + r.section : ''} · ${r.department}<br/>
        ${r.flowM3h ? `<strong>${r.flowM3h.toLocaleString('fr-FR')} m³/h</strong> · ` : ''}
        <span style="color:${sc}">${sl}</span>
      </div>
    </div>`;
  }

  // ── API load ──────────────────────────────────────────────────────────────

  reload(): void { this.load(); }

  private load(): void {
    this.loading = true;

    this.api.alerts('ACTIVE').subscribe({
      next: (rows: any) => {
        const alerts: AlertDto[] = Array.isArray(rows) ? rows : (rows?.alerts ?? []);
        this.critCount   = alerts.filter(a => a.severity === 'CRIT').length;
        this.totalAlerts = alerts.length;
        this.alertItems  = [
          ...alerts.filter(a => a.severity === 'CRIT').slice(0, 3).map(a => ({
            kind: 'crit' as const,
            title: a.message || `Alerte critique · ${a.pointId}`,
            sub:   `Point ${a.pointId} · ${a.type ?? 'mesure hors seuil'}`,
            tag:   'CRITIQUE'
          })),
          ...alerts.filter(a => a.severity === 'WARN').slice(0, 2).map(a => ({
            kind: 'warn' as const,
            title: a.message || `Avertissement · ${a.pointId}`,
            sub:   `Point ${a.pointId}`,
            tag:   'WARN'
          }))
        ];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });

    this.api.tickets().subscribe({
      next: (rows: any) => {
        const tickets: TicketDto[] = Array.isArray(rows) ? rows : [];
        const open = tickets.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status));
        this.openTickets     = open.length;
        this.inProgressCount = open.filter(t => t.status === 'IN_PROGRESS').length;
        this.assignedCount   = open.filter(t => t.status === 'ASSIGNED').length;
        const COLORS = ['#3B82F6', '#A78BFA', '#34D399', '#FBBF24', '#F87171'];
        this.intvItems = open.slice(0, 5).map((t, i) => {
          const name = t.assignee ?? 'N/A';
          return {
            id: t.id,
            assignee: t.assignee ? `Tech. ${t.assignee}` : 'Non assigné',
            status:   t.status,
            initials: name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?',
            color:    COLORS[i % COLORS.length]
          };
        });
      },
      error: () => {}
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  capPct(item: InfraItem): number {
    const maxCap = Math.max(...INFRA_DATA.map(i => i.capaciteM3h ?? 0), 1);
    return Math.round((item.capaciteM3h ?? 0) / maxCap * 100);
  }

  ticketStatusLabel(s: string): string {
    return ({ OPEN: 'OUVERT', ASSIGNED: 'ASSIGNÉ', IN_PROGRESS: 'EN COURS' } as Record<string, string>)[s] ?? s;
  }

  infraStatusLabel(s: string): string {
    return ({ operationnel: 'Opérationnel', maintenance: 'Maintenance', panne: 'Panne', vetuste: 'Vétuste' } as Record<string, string>)[s] ?? s;
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.map) { this.map.remove(); this.map = null; }
  }
}

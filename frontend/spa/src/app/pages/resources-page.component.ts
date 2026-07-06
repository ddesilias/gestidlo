import { Component, AfterViewInit, AfterViewChecked, OnDestroy, OnInit, ElementRef, ViewChild, NgZone, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HAITI_DEPARTMENTS, HAITI_COMMUNES, HAITI_SECTIONS, DEPT_BOUNDS } from '../haiti-geo.service';
import { GestidloStore } from '../gestidlo-store';
import { ResourcesStore } from '../resources.store';
import { BffApiService } from '../api/bff-api.service';

declare const L: any;

/** Dédoublonnage par code métier (repli id). Première occurrence gagne, ordre préservé. */
function dedupeByCode<T extends { code?: string | null; id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key = (r.code && r.code.trim()) ? r.code.trim() : r.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

interface WizardData {
  type: '' | NatType;
  lat: string; lon: string; altM: string;
  department: string; commune: string; section: string; locality: string;
  confirmedNotDuplicate: boolean;
  name: string; description: string;
  flowM3h: string; sourceClass: string; waterTempC: string;
  captured: boolean; geologicalFeature: string;
  lengthKm: string; mouthBody: string; tributaryOf: string;
  areaKm2: string; mainRiver: string; annualRainfallMm: string; communesCount: string;
  orepa: string; gestionnaire: string; recensementStatus: string;
}

const WIZARD_INIT: WizardData = {
  type: '', lat: '', lon: '', altM: '',
  department: '', commune: '', section: '', locality: '',
  confirmedNotDuplicate: false,
  name: '', description: '',
  flowM3h: '', sourceClass: '', waterTempC: '', captured: false, geologicalFeature: '',
  lengthKm: '', mouthBody: '', tributaryOf: '',
  areaKm2: '', mainRiver: '', annualRainfallMm: '', communesCount: '',
  orepa: '', gestionnaire: '', recensementStatus: 'recensee',
};

interface NearbyResource extends NatResource { distKm: number; }

export type NatType   = 'source' | 'riviere' | 'bassin';
export type NatStatus = 'saine' | 'menacee' | 'polluee';
/** Statut du cycle de validation (recensement TEPAC → décision superviseur). Absent = officielle. */
export type NatValidation = 'en_attente' | 'validee' | 'rejetee';

export interface NatResource {
  id: string;
  code: string;
  name: string;
  type: NatType;
  status: NatStatus;
  department: string;
  commune: string;
  section?: string;
  locality?: string;
  flowM3h?: number;
  flowTrend?: 'stable' | 'down' | 'up';
  flowNote?: string;
  lengthKm?: number;
  areaKm2?: number;
  communesCount?: number;
  badgeOverride?: string;
  lat?: number;
  lon?: number;
  /** Cycle de validation. Absent ⇒ ressource officielle de référence (seed catalogue). */
  validation?: NatValidation;
  createdBy?: string;
  motifRejet?: string;
  /** Provenance : `true` = catalogue de référence front (NAT_DATA), ignoré en vue commune (TEPAC). */
  seed?: boolean;
}

export const NAT_DATA: NatResource[] = [
  /* ─── Sources (10) ─────────────────────────────────────────── */
  { id:'rs-01', code:'SRC-BBLEU-001', name:'Source Bassin Bleu',
    type:'source', status:'menacee', department:'Sud-Est', commune:'Jacmel',
    section:'Section 3', locality:'Bassin Bleu',
    lat:18.234, lon:-72.534, flowM3h:18, flowTrend:'down', flowNote:'-23%' },

  { id:'rs-02', code:'SRC-FERM-002', name:'Source Fermathe',
    type:'source', status:'saine', department:'Ouest', commune:'Pétion-Ville',
    section:'Section 1',
    lat:18.483, lon:-72.318, flowM3h:42, flowTrend:'stable', flowNote:'stable' },

  { id:'rs-03', code:'SRC-NANB-003', name:'Source Nan Bwa',
    type:'source', status:'polluee', department:'Ouest', commune:'Kenscoff',
    section:'Section 4', locality:'Bélot',
    lat:18.383, lon:-72.259, flowM3h:12, flowTrend:'down', flowNote:'coliformes' },

  { id:'rs-04', code:'SRC-LAB-004', name:'Source Laboule',
    type:'source', status:'saine', department:'Ouest', commune:'Pétion-Ville',
    section:'Section 2', locality:'Laboule',
    lat:18.469, lon:-72.285, flowM3h:87, flowTrend:'stable', flowNote:'stable' },

  { id:'rs-05', code:'SRC-PLAI-005', name:'Source La Plaine',
    type:'source', status:'saine', department:'Nord', commune:'Cap-Haïtien',
    section:'Section 3', locality:'La Plaine',
    lat:19.757, lon:-72.201, flowM3h:30, flowTrend:'stable', flowNote:'stable' },

  { id:'rs-06', code:'SRC-NANR-006', name:'Source Nan Roch',
    type:'source', status:'polluee', department:'Ouest', commune:'Carrefour',
    section:'Section 1',
    lat:18.537, lon:-72.404, flowM3h:18, flowTrend:'down', flowNote:'pollution' },

  { id:'rs-07', code:"SRC-GRAN-007", name:"Source Grand'Anse",
    type:'source', status:'saine', department:"Grand'Anse", commune:'Jérémie',
    section:'Section 2',
    lat:18.637, lon:-74.118, flowM3h:120, flowTrend:'stable', flowNote:'stable' },

  { id:'rs-08', code:'SRC-BRAG-008', name:'Source Bras-Gauche',
    type:'source', status:'menacee', department:'Sud', commune:'Camp-Perrin',
    section:'Section 1',
    lat:18.307, lon:-73.862, flowM3h:22, flowTrend:'down', flowNote:'-15%' },

  { id:'rs-09', code:'SRC-NKAF-009', name:'Source Nan Kafou',
    type:'source', status:'menacee', department:'Artibonite', commune:'Gros-Morne',
    lat:19.105, lon:-72.849, flowM3h:15, flowTrend:'stable', flowNote:'stable' },

  { id:'rs-10', code:'SRC-BPIN-010', name:'Source Bois-Pin',
    type:'source', status:'saine', department:'Ouest', commune:'Kenscoff',
    section:'Section 2',
    lat:18.393, lon:-72.244, flowM3h:38, flowTrend:'stable', flowNote:'stable' },

  /* ─── Rivières (3) ─────────────────────────────────────────── */
  { id:'rs-11', code:'RIV-MOMA-011', name:'Rivière Momance',
    type:'riviere', status:'saine', department:'Ouest', commune:'Léogâne',
    lat:18.491, lon:-72.642, flowM3h:156, flowTrend:'stable', flowNote:'stable', lengthKm:24 },

  { id:'rs-12', code:'RIV-ARTI-012', name:'Rivière Artibonite',
    type:'riviere', status:'saine', department:'Artibonite', commune:'Dessalines',
    lat:19.100, lon:-72.700, flowM3h:2400, flowTrend:'stable', flowNote:'stable', lengthKm:320 },

  { id:'rs-13', code:'RIV-GRDN-013', name:'Rivière Grand-Rivière',
    type:'riviere', status:'saine', department:'Nord', commune:'Grande-Rivière-du-Nord',
    lat:19.566, lon:-72.199, flowM3h:200, flowTrend:'stable', flowNote:'stable', lengthKm:45 },

  /* ─── Bassins versants (2) ──────────────────────────────────── */
  { id:'rs-14', code:'BV-CULSAC-014', name:'Bassin Cul-de-Sac',
    type:'bassin', status:'menacee', department:'Ouest', commune:'Croix-des-Bouquets',
    lat:18.560, lon:-72.200, areaKm2:850, communesCount:6, badgeOverride:'PRESSION' },

  { id:'rs-15', code:'BV-GRISE-015', name:'Bassin Versant Grise',
    type:'bassin', status:'saine', department:'Ouest', commune:'Ouest',
    lat:18.582, lon:-72.120, areaKm2:220, communesCount:4 },
];

@Component({
  selector: 'app-resources-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="rn-shell" [class.rn-shell--embedded]="!!scope">

  <!-- Corps de page masqué en mode overlay : seul le wizard s'affiche par-dessus la carte. -->
  <ng-container *ngIf="!overlayMode">

  <!-- ═══ EN-TÊTE SCOPÉ (fiche URD / shell terrain) ═══ -->
  <div *ngIf="scope" class="rn-scope-header">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
    <span>Vue scopée · {{ scope.commune ? 'commune ' + scope.commune : 'département ' + scope.dept }}</span>
    <span class="rn-scope-count">{{ allData.length }} ressource{{ allData.length !== 1 ? 's' : '' }}</span>
    <button class="rn-btn rn-btn--primary" type="button" style="margin-left:auto" (click)="openAddModal()">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      {{ isTepac ? 'Soumettre un recensement' : 'Recenser · ' + scope.dept }}
    </button>
  </div>

  <!-- ═══ BREADCRUMB ═══ -->
  <div class="rn-bc" *ngIf="!scope">
    <a routerLink="/dashboard" class="rn-bc__home">
      <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
      </svg>
      Accueil
    </a>
    <svg viewBox="0 0 20 20" width="10" height="10" fill="currentColor" class="rn-bc__sep"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
    <span>Supervision</span>
    <svg viewBox="0 0 20 20" width="10" height="10" fill="currentColor" class="rn-bc__sep"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
    <span class="rn-bc__current">Ressources naturelles</span>
    <span class="rn-bc__stats">{{ allData.length }} ressources naturelles · 17/142 communes couvertes</span>
  </div>

  <!-- ═══ HEADER ═══ -->
  <div class="rn-header" *ngIf="!scope">
    <div class="rn-header__left">
      <div class="rn-header__icon">
        <!-- droplets -->
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#60A5FA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.09 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
          <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.54 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
        </svg>
      </div>
      <div>
        <div class="rn-header__title-row">
          <h2 class="rn-header__title">Ressources naturelles en eau</h2>
          <span class="rn-header__badge">PATRIMOINE HYDRIQUE</span>
        </div>
        <p class="rn-header__sub">Sources · rivières · bassins versants — le patrimoine que la nature donne à Haïti</p>
      </div>
    </div>
    <div class="rn-header__actions">
      <button class="rn-btn rn-btn--ghost" type="button">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5M12 5v12"/></svg>
        Importer
      </button>
      <button class="rn-btn rn-btn--ghost" type="button">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5 5-5-5M12 13V3"/></svg>
        Exporter
      </button>
      <button class="rn-btn rn-btn--primary" type="button" (click)="openAddModal()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Recenser une ressource
      </button>
    </div>
  </div>

  <!-- ═══ KPIs ═══ -->
  <div class="rn-kpis">

    <div class="rn-kpi rn-kpi--blue">
      <div class="rn-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#60A5FA" stroke-width="1.7" stroke-linecap="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/>
        </svg>
        <span>Patrimoine recensé</span>
      </div>
      <div class="rn-kpi__val">
        <span class="rn-kpi__big">{{ allData.length }}</span>
        <span class="rn-kpi__trend rn-kpi__trend--up">+2 ce trimestre</span>
      </div>
      <div class="rn-kpi__sub">{{ sources.length }} sources · {{ rivieres.length }} rivières · {{ bassins.length }} bassins</div>
    </div>

    <div class="rn-kpi rn-kpi--green">
      <div class="rn-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#34D399" stroke-width="1.7" stroke-linecap="round">
          <path d="M2 12h2l3-7 4 14 3-7 3 5 2-5h3"/>
        </svg>
        <span>Débit naturel disponible</span>
      </div>
      <div class="rn-kpi__val">
        <span class="rn-kpi__big rn-kpi__big--green">{{ formatFlow(totalFlow) }}</span>
        <span class="rn-kpi__unit">m³/h</span>
      </div>
      <div class="rn-kpi__sub rn-kpi__sub--red">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
        -8% vs 2024
      </div>
    </div>

    <div class="rn-kpi rn-kpi--amber">
      <div class="rn-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="1.7" stroke-linecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Patrimoine menacé</span>
      </div>
      <div class="rn-kpi__val">
        <span class="rn-kpi__big rn-kpi__big--amber">{{ threatened }}</span>
        <span class="rn-kpi__unit">/ {{ allData.length }}</span>
      </div>
      <div class="rn-kpi__sub">{{ polluees.length }} polluées · {{ menacees.length }} menacées</div>
    </div>

    <div class="rn-kpi rn-kpi--purple">
      <div class="rn-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#A5A4DC" stroke-width="1.7" stroke-linecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Couverture territoriale</span>
      </div>
      <div class="rn-kpi__val">
        <span class="rn-kpi__big rn-kpi__big--purple">12%</span>
        <span class="rn-kpi__trend rn-kpi__trend--down">125 sans</span>
      </div>
      <div class="rn-kpi__sub">17 / 142 communes couvertes</div>
    </div>

  </div><!-- /rn-kpis -->

  <!-- ═══ FILTER BAR ═══ -->
  <div class="rn-filters">
    <div class="rn-search">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#6B7785" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" placeholder="Rechercher source, rivière, lieu-dit…"
             [(ngModel)]="searchTerm" (ngModelChange)="onSearch()"/>
    </div>
    <div class="rn-sep"></div>

    <span class="rn-filter-lbl">Type</span>
    <button class="rn-chip" [class.rn-chip--blue]="typeFilter==='all'" type="button" (click)="setTypeFilter('all')">
      Toutes <span class="rn-chip__count">{{ allData.length }}</span>
    </button>
    <button class="rn-chip" [class.rn-chip--blue]="typeFilter==='source'" type="button" (click)="setTypeFilter('source')">
      <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true"><polygon points="6,1 11,10 1,10" fill="#34D399"/></svg>
      Sources <span class="rn-chip__count">{{ sources.length }}</span>
    </button>
    <button class="rn-chip" [class.rn-chip--blue]="typeFilter==='riviere'" type="button" (click)="setTypeFilter('riviere')">
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M1,6 Q3,2 6,6 Q9,10 11,6" fill="none" stroke="#60A5FA" stroke-width="2.2" stroke-linecap="round"/></svg>
      Rivières <span class="rn-chip__count">{{ rivieres.length }}</span>
    </button>
    <button class="rn-chip" [class.rn-chip--blue]="typeFilter==='bassin'" type="button" (click)="setTypeFilter('bassin')">
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><polygon points="6,1 11,3.5 11,8.5 6,11 1,8.5 1,3.5" fill="none" stroke="#34D399" stroke-width="1.5"/></svg>
      Bassins <span class="rn-chip__count">{{ bassins.length }}</span>
    </button>

    <div class="rn-sep"></div>
    <span class="rn-filter-lbl">État</span>

    <button class="rn-chip rn-chip--saine" [class.rn-chip--saine-active]="statusFilter==='saine'"
            type="button" (click)="setStatusFilter('saine')">
      <span class="rn-dot rn-dot--green"></span>
      Saines <span class="rn-chip__count">{{ saines.length }}</span>
    </button>
    <button class="rn-chip rn-chip--menacee" [class.rn-chip--menacee-active]="statusFilter==='menacee'"
            type="button" (click)="setStatusFilter('menacee')">
      <span class="rn-dot rn-dot--amber"></span>
      Menacées <span>{{ menacees.length }}</span>
    </button>
    <button class="rn-chip rn-chip--polluee" [class.rn-chip--polluee-active]="statusFilter==='polluee'"
            type="button" (click)="setStatusFilter('polluee')">
      <span class="rn-dot rn-dot--red"></span>
      Polluées <span class="rn-chip__count">{{ polluees.length }}</span>
    </button>

    <!-- Cycle de validation : visible dès qu'on est scopé (TEPAC suit ses recensements, superviseur sa file). -->
    <ng-container *ngIf="scope">
      <div class="rn-sep"></div>
      <span class="rn-filter-lbl">Validation</span>
      <button class="rn-chip" [class.rn-chip--blue]="validationFilter==='en_attente'"
              type="button" (click)="setValidationFilter('en_attente')">
        <span class="rn-dot rn-dot--amber"></span>
        En attente <span class="rn-chip__count">{{ enAttente.length }}</span>
      </button>
      <button class="rn-chip" [class.rn-chip--blue]="validationFilter==='validee'"
              type="button" (click)="setValidationFilter('validee')">
        <span class="rn-dot rn-dot--green"></span>
        Validées <span class="rn-chip__count">{{ validees.length }}</span>
      </button>
      <button class="rn-chip" [class.rn-chip--blue]="validationFilter==='rejetee'"
              type="button" (click)="setValidationFilter('rejetee')">
        <span class="rn-dot rn-dot--red"></span>
        Rejetées <span class="rn-chip__count">{{ rejetees.length }}</span>
      </button>
    </ng-container>
  </div>

  <!-- ═══ SPLIT LAYOUT ═══ -->
  <div class="rn-split">

    <!-- MAP CARD -->
    <div class="rn-map-card">
      <div class="rn-card-head">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
        <span class="rn-card-head__title">Carte hydrographique d'Haïti</span>
        <span class="rn-card-head__meta">{{ filtered.length }} ressources · OpenStreetMap · CNIGS</span>
        <div class="rn-sync-badge">
          <span class="rn-sync-dot"></span>
          Sync temps réel
        </div>
      </div>

      <div class="rn-map-wrap">
        <div #resMap class="rn-map-el"></div>
        <div class="rn-map-zoom">
          <button type="button" (click)="zoomIn()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" (click)="zoomOut()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" (click)="recenter()">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
          </button>
        </div>
      </div>

      <div class="rn-card-foot rn-card-foot--map">
        <span class="rn-legend-item rn-legend-item--source">
          <svg viewBox="0 0 12 12" width="9" height="9"><polygon points="6,1 11,10 1,10" fill="#34D399"/></svg>
          Source naturelle
        </span>
        <span class="rn-legend-item rn-legend-item--river">
          <svg viewBox="0 0 12 12" width="11" height="11"><path d="M1,6 Q3,2 6,6 Q9,10 11,6" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"/></svg>
          Rivière (tracé)
        </span>
        <span class="rn-legend-item rn-legend-item--bassin">
          <svg viewBox="0 0 12 12" width="11" height="11"><ellipse cx="6" cy="6" rx="5" ry="3" fill="none" stroke="#34D399" stroke-width="1.2" stroke-dasharray="2,1.5"/></svg>
          Bassin versant
        </span>
        <span class="rn-legend-tip">Cliquez un point pour voir la fiche</span>
      </div>
    </div>

    <!-- LIST CARD -->
    <div class="rn-list-card">
      <div class="rn-card-head">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#A5A4DC" stroke-width="2" stroke-linecap="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span class="rn-card-head__title">Liste synchronisée</span>
        <span class="rn-card-head__count">{{ filtered.length }} ressources</span>
      </div>

      <div class="rn-list-body" #listContainer>
        <div class="rn-list-item"
             *ngFor="let r of listItems; trackBy: trackByCode"
             [attr.data-res-id]="r.id"
             [class.rn-list-item--menacee]="r.status==='menacee' && r.id!==selectedId"
             [class.rn-list-item--polluee]="r.status==='polluee' && r.id!==selectedId"
             [class.rn-list-item--selected]="r.id===selectedId"
             (click)="onListItemClick(r)">
          <div class="rn-list-item__head">
            <span class="rn-type-icon" [innerHTML]="typeIcon(r.type)"></span>
            <span class="rn-list-item__name">{{ r.name }}</span>
            <span class="rn-badge"
                  [class.rn-badge--saine]="r.status==='saine'"
                  [class.rn-badge--menacee]="r.status==='menacee' && !r.badgeOverride"
                  [class.rn-badge--pression]="!!r.badgeOverride"
                  [class.rn-badge--polluee]="r.status==='polluee'">
              {{ r.badgeOverride || badgeLabel(r.status) }}
            </span>
          </div>
          <div class="rn-list-item__sub">{{ subText(r) }}</div>
          <div class="rn-list-item__code">{{ r.code }}</div>

          <!-- Statut de validation (uniquement pour les ressources entrées dans le cycle) -->
          <div class="rn-val-row" *ngIf="r.validation && r.validation !== 'validee'"
               [class.rn-val-row--wait]="r.validation==='en_attente'"
               [class.rn-val-row--rej]="r.validation==='rejetee'">
            <span class="rn-val-tag">{{ validationLabel(r.validation) }}</span>
            <span class="rn-val-by" *ngIf="r.validation==='en_attente' && r.createdBy">soumis par {{ r.createdBy }}</span>
            <span class="rn-val-by" *ngIf="r.validation==='rejetee' && r.motifRejet">{{ r.motifRejet }}</span>
          </div>

          <!-- Actions de validation : superviseur uniquement, sur les recensements en attente -->
          <div class="rn-val-actions" *ngIf="canValidate && r.validation==='en_attente'">
            <button class="rn-btn rn-btn--ok" type="button" (click)="validerRessource(r, $event)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Valider
            </button>
            <button class="rn-btn rn-btn--ko" type="button" (click)="rejeterRessource(r, $event)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Rejeter
            </button>
          </div>

          <!-- Ressource menacée / polluée → créer une alerte (entrée de la chaîne terrain) -->
          <div class="rn-alert-action" *ngIf="scope && (r.status==='menacee' || r.status==='polluee')">
            <button *ngIf="!alerteEnvoyee[r.id]" class="rn-btn rn-btn--alert" type="button" (click)="creerAlerteRessource(r, $event)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Créer une alerte
            </button>
            <span *ngIf="alerteEnvoyee[r.id]" class="rn-alert-sent">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Alerte créée · voir la page Alertes
            </span>
          </div>
        </div>

        <div class="rn-list-more" *ngIf="!showAll && filtered.length > 6" (click)="showAll=true">
          Voir les {{ filtered.length - 6 }} ressources suivantes →
        </div>
        <div class="rn-list-more" *ngIf="showAll && filtered.length > 6" (click)="showAll=false">
          Réduire la liste ↑
        </div>
        <div class="rn-list-empty" *ngIf="filtered.length === 0">
          Aucune ressource ne correspond à la recherche.
        </div>
      </div>

      <div class="rn-list-foot">
        <button class="rn-btn rn-btn--primary rn-btn--full" type="button" (click)="openAddModal()">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ isTepac ? 'Soumettre un recensement' : 'Recenser sur la carte' }}
        </button>
      </div>
    </div>

  </div><!-- /rn-split -->

  <!-- ═══ PERSISTENCE BANNER ═══ -->
  <div class="rn-banner">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#34D399" stroke-width="1.7" stroke-linecap="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/>
      <line x1="15" y1="17" x2="19" y2="17"/><line x1="17" y1="15" x2="17" y2="19"/>
    </svg>
    <div class="rn-banner__text">
      <strong class="rn-banner__strong">Persistance permanente :</strong>
      chaque ressource enregistrée est sauvegardée définitivement dans la base de données.
      Elle reste visible sur la carte et dans le tableau après rechargement, fermeture du navigateur,
      et à votre prochaine connexion.
    </div>
  </div>


</ng-container><!-- /corps masqué en overlay -->

<!-- ═══ MODAL RECENSER ═══ -->
<div class="wiz-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
  <div class="wiz-modal" (click)="$event.stopPropagation()">

    <!-- Header -->
    <div class="wiz-head">
      <div class="wiz-head__left">
        <div class="wiz-head__icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#60A5FA" stroke-width="1.6" stroke-linecap="round">
            <path d="M12 2C8 7 8 11 12 13s4 6 0 9c-4-3-4-7 0-9s4-6 0-11z"/>
            <line x1="12" y1="13" x2="12" y2="22"/><line x1="9" y1="16" x2="15" y2="16"/>
          </svg>
        </div>
        <div>
          <h3 class="wiz-head__title">Recenser une ressource naturelle</h3>
          <p class="wiz-head__sub">Ajout au patrimoine hydrique d'Haïti · sauvegarde permanente</p>
        </div>
      </div>
      <div class="wiz-head__right">
        <span class="wiz-draft-badge">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Brouillon sauvegardé
        </span>
        <button class="wiz-close-btn" type="button" (click)="closeModal()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Stepper -->
    <div class="wiz-stepper">
      <ng-container *ngFor="let s of wizSteps; let i=index">
        <div class="wiz-step-node" [class.wiz-step-node--done]="wizStep>s.n" [class.wiz-step-node--active]="wizStep===s.n">
          <div class="wiz-step-circle">
            <ng-container *ngIf="wizStep>s.n">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </ng-container>
            <ng-container *ngIf="wizStep<=s.n">{{ s.n }}</ng-container>
          </div>
          <div class="wiz-step-info">
            <div class="wiz-step-label">{{ s.label }}</div>
            <div class="wiz-step-sub" *ngIf="wizStep>s.n">{{ stepSub(s.n) }}</div>
            <div class="wiz-step-sub wiz-step-sub--active" *ngIf="wizStep===s.n">en cours</div>
          </div>
        </div>
        <div class="wiz-connector" *ngIf="i<wizSteps.length-1" [class.wiz-connector--done]="wizStep>s.n"></div>
      </ng-container>
    </div>

    <!-- Body -->
    <div class="wiz-body">

      <!-- ── FORM (left) ── -->
      <div class="wiz-form">

        <!-- STEP 1: Type -->
        <ng-container *ngIf="wizStep===1">
          <h4 class="wiz-form-title">Quel type de ressource naturelle ?</h4>
          <p class="wiz-form-sub">Cette classification détermine les champs spécifiques aux étapes suivantes.</p>
          <div class="wiz-type-cards">

            <div class="wiz-type-card" [class.wiz-type-card--on]="wizard.type==='source'" (click)="wizard.type='source'">
              <div class="wiz-type-card__icon" style="background:rgba(16,185,129,.15)">
                <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,3 22,20 2,20" fill="#34D399"/></svg>
              </div>
              <div class="wiz-type-card__body">
                <div class="wiz-type-card__name">Source naturelle</div>
                <div class="wiz-type-card__desc">Émergence ponctuelle — karstique, de montagne, thermale ou minérale</div>
              </div>
              <div class="wiz-radio" [class.wiz-radio--on]="wizard.type==='source'"></div>
            </div>

            <div class="wiz-type-card" [class.wiz-type-card--on]="wizard.type==='riviere'" (click)="wizard.type='riviere'">
              <div class="wiz-type-card__icon" style="background:rgba(59,130,246,.15)">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#60A5FA" stroke-width="2.2" stroke-linecap="round"><path d="M2,12 Q7,6 12,12 Q17,18 22,12"/></svg>
              </div>
              <div class="wiz-type-card__body">
                <div class="wiz-type-card__name">Rivière / cours d'eau</div>
                <div class="wiz-type-card__desc">Cours d'eau permanent ou saisonnier avec source et embouchure identifiées</div>
              </div>
              <div class="wiz-radio" [class.wiz-radio--on]="wizard.type==='riviere'"></div>
            </div>

            <div class="wiz-type-card" [class.wiz-type-card--on]="wizard.type==='bassin'" (click)="wizard.type='bassin'">
              <div class="wiz-type-card__icon" style="background:rgba(16,185,129,.1)">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#34D399" stroke-width="1.8"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/></svg>
              </div>
              <div class="wiz-type-card__body">
                <div class="wiz-type-card__name">Bassin versant</div>
                <div class="wiz-type-card__desc">Zone de collecte pluviale alimentant une rivière ou un aquifère principal</div>
              </div>
              <div class="wiz-radio" [class.wiz-radio--on]="wizard.type==='bassin'"></div>
            </div>

          </div>
        </ng-container>

        <!-- STEP 2: Géolocalisation -->
        <ng-container *ngIf="wizStep===2">
          <h4 class="wiz-form-title">Localiser la ressource sur la carte</h4>
          <p class="wiz-form-sub">Cliquez sur la carte ou saisissez les coordonnées · détection automatique de doublons</p>

          <!-- Location card -->
          <div class="wiz-card">
            <div class="wiz-card__actions">
              <button class="wiz-btn wiz-btn--blue" type="button" (click)="useGPS()">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                Position actuelle
              </button>
              <button class="wiz-btn wiz-btn--ghost" type="button">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/></svg>
                Cliquer carte
              </button>
              <span class="wiz-valid-badge" *ngIf="isLatLonValid">
                <span class="wiz-valid-dot"></span> Position en Haïti · validé
              </span>
            </div>
            <div class="wiz-mini-map-wrap">
              <div #modalMapEl class="wiz-mini-map"></div>
              <div class="wiz-mini-map__zoom">
                <button type="button" (click)="modalMap?.zoomIn()">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button type="button" (click)="modalMap?.zoomOut()">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              <div class="wiz-mini-map__attr">CNIGS Haïti · OSM</div>
              <div class="wiz-mini-map__coords" *ngIf="wizard.lat && wizard.lon">
                {{ wizard.lat }}°N · {{ wizard.lon }}°O
                <span *ngIf="wizard.commune"> · {{ wizard.commune }}</span>
              </div>
            </div>
            <div class="wiz-coord-grid">
              <div class="wiz-field">
                <label>Latitude <span class="wiz-req">*</span></label>
                <input type="text" [(ngModel)]="wizard.lat" (ngModelChange)="onCoordChange()"
                       [class.wiz-input--valid]="isLatValid" placeholder="ex: 18.234567"
                       style="font-family:'SF Mono',monospace"/>
              </div>
              <div class="wiz-field">
                <label>Longitude <span class="wiz-req">*</span></label>
                <input type="text" [(ngModel)]="wizard.lon" (ngModelChange)="onCoordChange()"
                       [class.wiz-input--valid]="isLonValid" placeholder="ex: -72.518234"
                       style="font-family:'SF Mono',monospace"/>
              </div>
              <div class="wiz-field">
                <label>Altitude (m)</label>
                <input type="text" [(ngModel)]="wizard.altM" placeholder="auto"
                       style="font-family:'SF Mono',monospace"/>
              </div>
            </div>
          </div>

          <!-- Admin division -->
          <div class="wiz-card">
            <div class="wiz-card__label-row">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#A5A4DC" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span class="wiz-card__section-lbl">Découpage administratif</span>
              <span class="wiz-auto-badge" *ngIf="wizard.department">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                auto-détecté
              </span>
            </div>
            <div class="wiz-admin-grid">
              <div class="wiz-field">
                <label>Département <span class="wiz-req">*</span></label>
                <select [(ngModel)]="wizard.department" (ngModelChange)="onDeptChange()"
                        [disabled]="!!scope?.dept"
                        [class.wiz-sel--valid]="wizard.department">
                  <option value="">—</option>
                  <option *ngFor="let d of DEPTS" [value]="d">{{ d }}</option>
                </select>
              </div>
              <div class="wiz-field">
                <label>Commune <span class="wiz-req">*</span></label>
                <select [(ngModel)]="wizard.commune" [disabled]="!wizard.department"
                        [class.wiz-sel--valid]="wizard.commune">
                  <option value="">—</option>
                  <option *ngFor="let c of availableCommunes" [value]="c">{{ c }}</option>
                </select>
              </div>
              <div class="wiz-field">
                <label>Section communale</label>
                <select [(ngModel)]="wizard.section" [disabled]="!wizard.commune"
                        [class.wiz-sel--valid]="wizard.section">
                  <option value="">—</option>
                  <option *ngFor="let s of availableSections" [value]="s">{{ s }}</option>
                </select>
              </div>
            </div>
            <div class="wiz-field" style="margin-top:8px">
              <label>Lieu-dit / Localité</label>
              <input type="text" [(ngModel)]="wizard.locality" placeholder="Ex : Nan Bwa, Près de l'école…"/>
            </div>
          </div>

          <!-- Doublon warning -->
          <div class="wiz-doublon" *ngIf="nearbyResources.length>0">
            <div class="wiz-doublon__head">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FBBF24" stroke-width="1.7" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {{ nearbyResources.length }} ressource{{ nearbyResources.length>1?'s':'' }} voisine{{ nearbyResources.length>1?'s':'' }} détectée{{ nearbyResources.length>1?'s':'' }} dans 5 km
            </div>
            <p class="wiz-doublon__desc">Vérifiez qu'il ne s'agit pas d'une ressource déjà recensée.</p>
            <div class="wiz-doublon__list">
              <div class="wiz-doublon-item" *ngFor="let r of nearbyResources">
                <span [innerHTML]="typeIcon(r.type)"></span>
                <div class="wiz-doublon-item__info">
                  <div class="wiz-doublon-item__name">{{ r.name }}</div>
                  <div class="wiz-doublon-item__meta">à {{ r.distKm.toFixed(1) }} km · {{ r.commune }}</div>
                </div>
                <button class="wiz-btn-link" type="button">Voir</button>
              </div>
            </div>
            <label class="wiz-checkbox">
              <input type="checkbox" [(ngModel)]="wizard.confirmedNotDuplicate"/>
              <span>Je confirme qu'il s'agit bien d'une <strong>nouvelle ressource distincte</strong></span>
            </label>
          </div>
        </ng-container>

        <!-- STEP 3: Identité -->
        <ng-container *ngIf="wizStep===3">
          <h4 class="wiz-form-title">Identité de la ressource</h4>
          <p class="wiz-form-sub">Le nom doit être celui utilisé localement sur le terrain.</p>
          <div class="wiz-card">
            <div class="wiz-field">
              <label>Nom de la ressource <span class="wiz-req">*</span></label>
              <input type="text" [(ngModel)]="wizard.name" placeholder="Ex : Source Bassin Bleu, Rivière Momance…" [class.wiz-input--valid]="wizard.name.trim()"/>
            </div>
            <div class="wiz-field" style="margin-top:10px">
              <label>Code d'inventaire <span style="color:#6B7785;font-weight:400">(auto-généré)</span></label>
              <input type="text" [value]="autoCode" readonly style="font-family:'SF Mono',monospace;color:#34D399;border-color:#2A3744"/>
            </div>
            <div class="wiz-field" style="margin-top:10px">
              <label>Description</label>
              <textarea [(ngModel)]="wizard.description" rows="4" placeholder="Contexte hydrologique, usage, état observé…" class="wiz-textarea"></textarea>
            </div>
          </div>
        </ng-container>

        <!-- STEP 4: Caractéristiques -->
        <ng-container *ngIf="wizStep===4">
          <h4 class="wiz-form-title">Caractéristiques techniques</h4>
          <p class="wiz-form-sub">Valeurs mesurées ou estimées — indiquez la source de données si disponible.</p>

          <!-- Source fields -->
          <div class="wiz-card" *ngIf="wizard.type==='source'">
            <div class="wiz-admin-grid">
              <div class="wiz-field">
                <label>Débit estimé (m³/h)</label>
                <input type="number" [(ngModel)]="wizard.flowM3h" placeholder="ex: 18"/>
              </div>
              <div class="wiz-field">
                <label>Température (°C)</label>
                <input type="number" [(ngModel)]="wizard.waterTempC" placeholder="ex: 20"/>
              </div>
              <div class="wiz-field">
                <label>Classe</label>
                <select [(ngModel)]="wizard.sourceClass">
                  <option value="">— choisir</option>
                  <option *ngFor="let c of SOURCE_CLASSES" [value]="c.val">{{ c.label }}</option>
                </select>
              </div>
            </div>
            <div class="wiz-field" style="margin-top:10px">
              <label>Formation géologique</label>
              <input type="text" [(ngModel)]="wizard.geologicalFeature" placeholder="Ex : Massif de la Selle, Calcaires du Crétacé…"/>
            </div>
            <label class="wiz-checkbox" style="margin-top:10px">
              <input type="checkbox" [(ngModel)]="wizard.captured"/>
              <span>Source captée (ouvrage de captage existant)</span>
            </label>
          </div>

          <!-- Rivière fields -->
          <div class="wiz-card" *ngIf="wizard.type==='riviere'">
            <div class="wiz-admin-grid">
              <div class="wiz-field">
                <label>Longueur (km)</label>
                <input type="number" [(ngModel)]="wizard.lengthKm" placeholder="ex: 24"/>
              </div>
              <div class="wiz-field">
                <label>Débit moyen (m³/h)</label>
                <input type="number" [(ngModel)]="wizard.flowM3h" placeholder="ex: 156"/>
              </div>
              <div class="wiz-field">
                <label>Tributaire de</label>
                <input type="text" [(ngModel)]="wizard.tributaryOf" placeholder="Ex : Golfe de la Gonâve…"/>
              </div>
            </div>
            <div class="wiz-field" style="margin-top:10px">
              <label>Corps d'eau récepteur (embouchure)</label>
              <input type="text" [(ngModel)]="wizard.mouthBody" placeholder="Ex : Golfe de la Gonâve, Mer des Caraïbes…"/>
            </div>
          </div>

          <!-- Bassin fields -->
          <div class="wiz-card" *ngIf="wizard.type==='bassin'">
            <div class="wiz-admin-grid">
              <div class="wiz-field">
                <label>Superficie (km²)</label>
                <input type="number" [(ngModel)]="wizard.areaKm2" placeholder="ex: 175"/>
              </div>
              <div class="wiz-field">
                <label>Pluviométrie (mm/an)</label>
                <input type="number" [(ngModel)]="wizard.annualRainfallMm" placeholder="ex: 1450"/>
              </div>
              <div class="wiz-field">
                <label>Communes couvertes</label>
                <input type="number" [(ngModel)]="wizard.communesCount" placeholder="ex: 6"/>
              </div>
            </div>
            <div class="wiz-field" style="margin-top:10px">
              <label>Rivière principale</label>
              <input type="text" [(ngModel)]="wizard.mainRiver" placeholder="Ex : Rivière Momance…"/>
            </div>
          </div>
        </ng-container>

        <!-- STEP 5: Gouvernance -->
        <ng-container *ngIf="wizStep===5">
          <h4 class="wiz-form-title">Rattachement institutionnel</h4>
          <p class="wiz-form-sub">L'institution gestionnaire peut être une CAEPA, un comité d'eau ou une collectivité.</p>
          <div class="wiz-card">
            <div class="wiz-field">
              <label>OREPA / Direction responsable</label>
              <select [(ngModel)]="wizard.orepa">
                <option value="">— choisir</option>
                <option *ngFor="let o of OREPA_OPTIONS" [value]="o">{{ o }}</option>
              </select>
            </div>
            <div class="wiz-field" style="margin-top:10px">
              <label>Institution gestionnaire</label>
              <input type="text" [(ngModel)]="wizard.gestionnaire" placeholder="Ex : CAEPA Bassin Bleu, Comité d'eau Seksyon 3…"/>
            </div>
            <div class="wiz-field" style="margin-top:10px">
              <label>Statut de recensement</label>
              <select [(ngModel)]="wizard.recensementStatus">
                <option value="recensee">Recensée — données disponibles</option>
                <option value="en_etude">En cours d'étude</option>
                <option value="protegee">Protégée — zone tampon active</option>
              </select>
            </div>
          </div>
        </ng-container>

        <!-- STEP 6: Validation -->
        <ng-container *ngIf="wizStep===6">
          <h4 class="wiz-form-title">Récapitulatif avant enregistrement</h4>
          <p class="wiz-form-sub">Vérifiez chaque information. La fiche sera visible sur la carte immédiatement après validation.</p>
          <div class="wiz-card wiz-recap-card">
            <div class="wiz-recap-header">
              <div class="wiz-recap-icon" [innerHTML]="typeIcon(wizard.type||'source')"></div>
              <div>
                <div class="wiz-recap-type">{{ typeFullLabel(wizard.type) }}</div>
                <div class="wiz-recap-name">{{ wizard.name || 'Sans nom' }}</div>
              </div>
              <div class="wiz-recap-code">{{ autoCode }}</div>
            </div>
            <div class="wiz-recap-rows">
              <div class="wiz-recap-row" *ngFor="let item of summaryItems">
                <span class="wiz-recap-row__label">{{ item.label }}</span>
                <span class="wiz-recap-row__value">{{ item.value }}</span>
              </div>
            </div>
          </div>
          <div class="wiz-final-banner">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#34D399" stroke-width="1.7" stroke-linecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/></svg>
            <span><strong>Persistance garantie</strong> — cette ressource sera sauvegardée définitivement dans la base de données GestiDLO.</span>
          </div>
        </ng-container>

      </div><!-- /wiz-form -->

      <!-- ── SIDEBAR (right) ── -->
      <div class="wiz-sidebar">

        <!-- Aperçu -->
        <div class="wiz-sb-section">
          <div class="wiz-sb-section__head">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Aperçu
          </div>
          <div class="wiz-preview">
            <div class="wiz-preview__icon" [innerHTML]="typeIcon(wizard.type||'source')"></div>
            <div>
              <div class="wiz-preview__type">{{ typeFullLabel(wizard.type) || 'Type non choisi' }}</div>
              <div class="wiz-preview__name">{{ wizard.name || 'À nommer' }}</div>
            </div>
            <div class="wiz-preview__loc" *ngIf="wizard.commune">{{ wizard.commune }} · {{ wizard.department }}</div>
            <div class="wiz-preview__coords" *ngIf="wizard.lat && wizard.lon">{{ wizard.lat }}°N · {{ wizard.lon }}°O</div>
          </div>
        </div>

        <!-- Progression -->
        <div class="wiz-sb-section">
          <div class="wiz-sb-section__head">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            Progression
          </div>
          <div class="wiz-progress">
            <div class="wiz-progress-item" *ngFor="let s of wizSteps"
                 [class.wiz-progress-item--done]="wizStep>s.n"
                 [class.wiz-progress-item--active]="wizStep===s.n">
              <svg *ngIf="wizStep>s.n" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <svg *ngIf="wizStep===s.n" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>
              <svg *ngIf="wizStep<s.n" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#4B5563" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/></svg>
              <span>{{ s.label }}<span *ngIf="wizStep>s.n && stepSub(s.n)" style="opacity:.7"> : {{ stepSub(s.n) }}</span></span>
            </div>
          </div>
        </div>

        <!-- Conseil -->
        <div class="wiz-sb-section">
          <div class="wiz-sb-section__head" style="color:#FBBF24">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.5-1.5 4.5-3 6l-1 3H9l-1-3C6.5 13.5 5 11.5 5 9a7 7 0 017-7z"/></svg>
            Conseil
          </div>
          <div class="wiz-tip">{{ currentTip }}</div>
        </div>

      </div><!-- /wiz-sidebar -->

    </div><!-- /wiz-body -->

    <!-- Footer -->
    <div class="wiz-foot">
      <div class="wiz-foot__left">
        <span class="wiz-foot__step">Étape {{ wizStep }} / {{ wizSteps.length }} · {{ currentStepLabel }}</span>
        <div class="wiz-sep-v"></div>
        <span class="wiz-autosave">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Sauvegardé automatiquement
        </span>
      </div>
      <div class="wiz-foot__right">
        <button class="rn-btn rn-btn--ghost" type="button" (click)="closeModal()">Annuler</button>
        <button class="rn-btn rn-btn--ghost" type="button" *ngIf="wizStep>1" (click)="prevStep()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Précédent
        </button>
        <button class="rn-btn rn-btn--primary" type="button" *ngIf="wizStep<6"
                [disabled]="!canAdvance" (click)="nextStep()">
          Continuer
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
        <button class="rn-btn rn-btn--success" type="button" *ngIf="wizStep===6" (click)="submitWizard()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Enregistrer définitivement
        </button>
      </div>
    </div>

  </div><!-- /wiz-modal -->
</div><!-- /wiz-overlay -->

<!-- ═══ DRAWER DÉTAIL RESSOURCE ═══ -->
<div class="dr-overlay" *ngIf="drawerResourceId" (click)="closeDrawer()">
  <div class="dr-panel" *ngIf="drawerResource" (click)="$event.stopPropagation()">

    <!-- Header -->
    <div class="dr-header" [style.background]="drawerHeaderGradient">
      <div class="dr-header__top">
        <div class="dr-header__icon-wrap">
          <div class="dr-header__icon" [innerHTML]="drawerTypeIconLarge(drawerResource.type)"></div>
          <span class="dr-header__status-dot"
                [class.dr-dot--green]="drawerResource.status==='saine'"
                [class.dr-dot--amber]="drawerResource.status==='menacee'"
                [class.dr-dot--red]="drawerResource.status==='polluee'"></span>
        </div>
        <div class="dr-header__info">
          <div class="dr-header__row1">
            <span class="dr-code-chip">{{ drawerResource.code }}</span>
            <span class="dr-type-badge">{{ typeFullLabel(drawerResource.type) }}</span>
            <span class="dr-status-badge"
                  [class.dr-status--saine]="drawerResource.status==='saine'"
                  [class.dr-status--menacee]="drawerResource.status==='menacee'"
                  [class.dr-status--polluee]="drawerResource.status==='polluee'">
              <span class="dr-pulse"
                    [class.dr-pulse--green]="drawerResource.status==='saine'"
                    [class.dr-pulse--amber]="drawerResource.status==='menacee'"
                    [class.dr-pulse--red]="drawerResource.status==='polluee'"></span>
              {{ badgeLabel(drawerResource.status) }}
            </span>
          </div>
          <div class="dr-header__name">{{ drawerResource.name }}</div>
          <div class="dr-header__loc">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2a4 4 0 014 4c0 3-4 8-4 8S4 9 4 6a4 4 0 014-4z"/><circle cx="8" cy="6" r="1.5"/></svg>
            {{ drawerResource.commune }}, {{ drawerResource.department }}
            <span class="dr-dms" *ngIf="drawerResource.lat && drawerResource.lon">
              · {{ formatDMS(drawerResource.lat!, 'lat') }} {{ formatDMS(drawerResource.lon!, 'lon') }}
            </span>
          </div>
        </div>
        <div class="dr-header__nav">
          <span class="dr-nav-count">{{ drawerIndex + 1 }} / {{ allData.length }}</span>
          <button class="dr-nav-btn" type="button" (click)="drawerPrev()" [disabled]="drawerIndex===0">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="10 4 6 8 10 12"/></svg>
          </button>
          <button class="dr-nav-btn" type="button" (click)="drawerNext()" [disabled]="drawerIndex===allData.length-1">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 4 10 8 6 12"/></svg>
          </button>
          <button class="dr-close-btn" type="button" (click)="closeDrawer()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="dr-actions">
        <button class="dr-action-btn dr-action-btn--primary" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Inspecter
        </button>
        <button class="dr-action-btn" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Modifier
        </button>
        <button class="dr-action-btn" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          Lier infrastructure
        </button>
        <button class="dr-action-btn" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Ajouter photo
        </button>
        <button class="dr-action-btn" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Exporter
        </button>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="dr-tabs">
      <button class="dr-tab" [class.dr-tab--active]="drawerTab==='overview'" type="button" (click)="setDrawerTab('overview')">Vue d'ensemble</button>
      <button class="dr-tab" [class.dr-tab--active]="drawerTab==='map'" type="button" (click)="setDrawerTab('map')">Carte précise</button>
      <button class="dr-tab" [class.dr-tab--active]="drawerTab==='hydro'" type="button" (click)="setDrawerTab('hydro')">
        Hydrologie <span class="dr-tab-warn">!</span>
      </button>
      <button class="dr-tab" [class.dr-tab--active]="drawerTab==='links'" type="button" (click)="setDrawerTab('links')">
        Liaisons <span class="dr-tab-count">{{ drawerLinkedInfra.length }}</span>
      </button>
      <button class="dr-tab" [class.dr-tab--active]="drawerTab==='insp'" type="button" (click)="setDrawerTab('insp')">
        Inspections <span class="dr-tab-count">0</span>
      </button>
    </div>

    <!-- Body -->
    <div class="dr-body">

      <!-- ── Vue d'ensemble ── (uses [hidden] so Leaflet map DOM is preserved) -->
      <div [hidden]="drawerTab!=='overview'">

        <!-- Description -->
        <div class="dr-desc-block" *ngIf="drawerResource.type==='source'">
          <p>Source naturelle d'eau douce localisée dans la commune de <strong>{{ drawerResource.commune }}</strong>,
          département <strong>{{ drawerResource.department }}</strong>.
          <ng-container *ngIf="drawerResource.flowM3h">Débit mesuré : <strong>{{ drawerResource.flowM3h.toLocaleString('fr-FR') }} m³/h</strong>{{ drawerResource.flowNote ? ' (' + drawerResource.flowNote + ')' : '' }}.</ng-container>
          <ng-container *ngIf="drawerResource.section"> Section communale : {{ drawerResource.section }}.</ng-container></p>
        </div>
        <div class="dr-desc-block dr-desc-block--blue" *ngIf="drawerResource.type==='riviere'">
          <p>Cours d'eau de <strong>{{ drawerResource.lengthKm }} km</strong> traversant le département <strong>{{ drawerResource.department }}</strong>.
          Débit moyen : <strong>{{ (drawerResource.flowM3h ?? 0).toLocaleString('fr-FR') }} m³/h</strong>.</p>
        </div>
        <div class="dr-desc-block dr-desc-block--purple" *ngIf="drawerResource.type==='bassin'">
          <p>Bassin versant de <strong>{{ drawerResource.areaKm2 }} km²</strong> couvrant <strong>{{ drawerResource.communesCount }} communes</strong>
          dans le département <strong>{{ drawerResource.department }}</strong>.</p>
        </div>

        <!-- Inline map -->
        <div class="dr-map-section" *ngIf="drawerResource.lat && drawerResource.lon">
          <div class="dr-map-wrap">
            <div #drawerMapEl class="dr-map-el"></div>
            <div class="dr-map-coords">
              {{ drawerResource.lat!.toFixed(5) }}°N · {{ (drawerResource.lon! * -1).toFixed(5) }}°O
            </div>
            <div class="dr-map-attr">OpenStreetMap · CNIGS</div>
          </div>
          <div class="dr-map-foot">
            <button class="dr-map-btn" type="button" (click)="copyCoords()">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copier coord.
            </button>
            <button class="dr-map-btn" type="button" (click)="openGoogleMaps()">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Google Maps
            </button>
            <button class="dr-map-btn" type="button">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Itinéraire
            </button>
          </div>
        </div>

        <!-- 2-col: Caractéristiques + Gouvernance -->
        <div class="dr-info-grid">
          <div class="dr-info-section">
            <div class="dr-info-section__head">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#60A5FA" stroke-width="1.7" stroke-linecap="round"><path d="M2 12h2l3-7 4 14 3-7 3 5 2-5h3"/></svg>
              Caractéristiques
            </div>
            <div class="dr-info-rows">
              <div class="dr-info-row" *ngIf="drawerResource.flowM3h">
                <span class="dr-info-row__lbl">Débit</span>
                <span class="dr-info-row__val">{{ drawerResource.flowM3h.toLocaleString('fr-FR') }} m³/h</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.flowNote">
                <span class="dr-info-row__lbl">Tendance</span>
                <span class="dr-info-row__val">{{ drawerResource.flowNote }}</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.lengthKm">
                <span class="dr-info-row__lbl">Longueur</span>
                <span class="dr-info-row__val">{{ drawerResource.lengthKm }} km</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.areaKm2">
                <span class="dr-info-row__lbl">Superficie</span>
                <span class="dr-info-row__val">{{ drawerResource.areaKm2 }} km²</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.communesCount">
                <span class="dr-info-row__lbl">Communes</span>
                <span class="dr-info-row__val">{{ drawerResource.communesCount }}</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.lat">
                <span class="dr-info-row__lbl">Latitude</span>
                <span class="dr-info-row__val dr-mono">{{ drawerResource.lat }}°N</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.lon">
                <span class="dr-info-row__lbl">Longitude</span>
                <span class="dr-info-row__val dr-mono">{{ drawerResource.lon }}°</span>
              </div>
              <div class="dr-info-row">
                <span class="dr-info-row__lbl">État</span>
                <span class="dr-info-row__val" [style.color]="drawerStatusColor">{{ badgeLabel(drawerResource.status) }}</span>
              </div>
            </div>
          </div>

          <div class="dr-info-section">
            <div class="dr-info-section__head">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#A5A4DC" stroke-width="1.7" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              Gouvernance
            </div>
            <div class="dr-info-rows">
              <div class="dr-info-row">
                <span class="dr-info-row__lbl">OREPA</span>
                <span class="dr-info-row__val">{{ orepaForDept(drawerResource.department) }}</span>
              </div>
              <div class="dr-info-row">
                <span class="dr-info-row__lbl">Département</span>
                <span class="dr-info-row__val">{{ drawerResource.department }}</span>
              </div>
              <div class="dr-info-row">
                <span class="dr-info-row__lbl">Commune</span>
                <span class="dr-info-row__val">{{ drawerResource.commune }}</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.section">
                <span class="dr-info-row__lbl">Section</span>
                <span class="dr-info-row__val">{{ drawerResource.section }}</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerResource.locality">
                <span class="dr-info-row__lbl">Lieu-dit</span>
                <span class="dr-info-row__val">{{ drawerResource.locality }}</span>
              </div>
              <div class="dr-info-row">
                <span class="dr-info-row__lbl">Statut</span>
                <span class="dr-info-row__val" style="color:#34D399">Recensée</span>
              </div>
              <div class="dr-info-row" *ngIf="drawerBassin">
                <span class="dr-info-row__lbl">Bassin versant</span>
                <span class="dr-info-row__val" style="color:#60A5FA">
                  {{drawerBassin!.label}}<span *ngIf="drawerBassin!.areaKm2"> · {{drawerBassin!.areaKm2}} km²</span>
                </span>
              </div>
              <div class="dr-info-row" *ngIf="drawerC4Regulator">
                <span class="dr-info-row__lbl">Tutelle</span>
                <span class="dr-info-row__val" style="color:#A5A4DC">{{drawerC4Regulator}}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Capteurs IoT (C5) -->
        <div class="dr-infra-section" *ngIf="drawerC5Sensors.length">
          <div class="dr-infra-section__head">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#60A5FA" stroke-width="1.7" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/></svg>
            Capteurs IoT
            <span class="dr-infra-count" style="background:rgba(96,165,250,0.12);color:#60A5FA">{{drawerC5Sensors.length}}</span>
            <span style="margin-left:auto;font-size:9px;color:#34D399;display:flex;align-items:center;gap:4px">
              <span style="width:5px;height:5px;border-radius:50%;background:#34D399;display:inline-block;animation:dr-blink 1.4s infinite"></span>
              LIVE
            </span>
          </div>
          <div class="dr-infra-list">
            <div class="dr-infra-item" *ngFor="let s of drawerC5Sensors"
                 [style.border-color]="s.warn ? 'rgba(245,158,11,0.25)' : 'rgba(96,165,250,0.15)'">
              <div class="dr-infra-item__icon" [style.color]="s.warn ? '#FBBF24' : '#60A5FA'">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div class="dr-infra-item__info">
                <div class="dr-infra-item__name" style="font-family:monospace;font-size:10px">{{s.code}}</div>
                <div class="dr-infra-item__code">{{s.label}}</div>
              </div>
              <span style="font-size:12px;font-weight:600;margin-left:auto" [style.color]="s.warn ? '#FBBF24' : '#34D399'">
                {{s.value}} <span style="font-size:10px;font-weight:400;opacity:0.7">{{s.unit}}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Infrastructures exploitantes -->
        <div class="dr-infra-section" *ngIf="drawerLinkedInfra.length">
          <div class="dr-infra-section__head">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#FBBF24" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Infrastructures exploitantes
            <span class="dr-infra-count">{{ drawerLinkedInfra.length }}</span>
          </div>
          <div class="dr-infra-list">
            <div class="dr-infra-item" *ngFor="let inf of drawerLinkedInfra">
              <div class="dr-infra-item__icon">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="1.7" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div class="dr-infra-item__info">
                <div class="dr-infra-item__name">{{ inf.name }}</div>
                <div class="dr-infra-item__code">{{ inf.code }}</div>
              </div>
              <span class="dr-infra-item__badge"
                    [class.dr-infra-badge--op]="inf.status==='operationnel'"
                    [class.dr-infra-badge--dg]="inf.status==='degrade'">
                {{ inf.status === 'operationnel' ? 'Opérationnel' : 'Dégradé' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Cross-links -->
        <div class="dr-crosslinks" *ngIf="drawerCrossLinks.length">
          <div class="dr-crosslinks__head">Liaisons croisées</div>
          <div class="dr-crosslinks__chips">
            <span class="dr-cl-chip" *ngFor="let cl of drawerCrossLinks">
              <span [innerHTML]="typeIcon(cl.type)"></span>
              {{ cl.name }}
            </span>
          </div>
        </div>

      </div><!-- /overview -->

      <!-- ── Carte précise tab ── -->
      <div *ngIf="drawerTab==='map'" class="dr-tab-placeholder">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#3B4A5A" stroke-width="1.5" stroke-linecap="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
        <span>Carte détaillée à l'échelle 1:25 000 — disponible prochainement</span>
      </div>

      <!-- ── Hydrologie tab ── -->
      <div *ngIf="drawerTab==='hydro'" class="dr-tab-placeholder dr-tab-placeholder--warn">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Données hydrologiques insuffisantes — mesure de terrain requise</span>
      </div>

      <!-- ── Liaisons tab ── -->
      <div *ngIf="drawerTab==='links'" class="dr-tab-placeholder">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#3B4A5A" stroke-width="1.5" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        <span>{{ drawerLinkedInfra.length }} infrastructure(s) liée(s) · voir onglet Vue d'ensemble</span>
      </div>

      <!-- ── Inspections tab ── -->
      <div *ngIf="drawerTab==='insp'" class="dr-tab-placeholder">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#3B4A5A" stroke-width="1.5" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        <span>Aucune inspection enregistrée pour cette ressource</span>
      </div>

    </div><!-- /dr-body -->
  </div><!-- /dr-panel -->
</div><!-- /dr-overlay -->

</div><!-- /rn-shell -->
`,
  styles: [`
    /* ═══════════════════════════════════════════════
       SHELL
    ═══════════════════════════════════════════════ */
    .rn-shell {
      display: flex; flex-direction: column; gap: 14px;
      padding: 16px 20px 24px;
      min-height: 100%;
      background: #0F1419;
      color: #E2E8EE;
      font-family: -apple-system, system-ui, sans-serif;
    }
    /* Embarquée dans la fiche URD : pas de fond plein ni de padding latéral */
    .rn-shell--embedded { padding: 0; background: transparent; min-height: 0; }
    .rn-scope-header {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 12px; border-radius: 10px;
      background: rgba(96,165,250,.08); border: 1px solid rgba(96,165,250,.25);
      font-size: 12.5px; color: #CBD5E1;
    }
    .rn-scope-count {
      font-size: 11px; color: #8B9AAB;
      padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,.05);
    }

    /* ═══════════════════════════════════════════════
       BREADCRUMB
    ═══════════════════════════════════════════════ */
    .rn-bc {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #8B9AAB;
    }
    .rn-bc__home {
      display: flex; align-items: center; gap: 4px;
      color: #60A5FA; text-decoration: none; cursor: pointer;
    }
    .rn-bc__home:hover { color: #93C5FD; }
    .rn-bc__sep { color: #4B5563; flex-shrink: 0; }
    .rn-bc__current { color: #F5F7FA; font-weight: 500; }
    .rn-bc__stats { margin-left: auto; font-size: 10px; color: #6B7785; }

    /* ═══════════════════════════════════════════════
       HEADER
    ═══════════════════════════════════════════════ */
    .rn-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; flex-wrap: wrap;
    }
    .rn-header__left { display: flex; align-items: center; gap: 10px; }
    .rn-header__icon {
      width: 38px; height: 38px; flex-shrink: 0;
      background: rgba(59,130,246,0.15); border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .rn-header__title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .rn-header__title { margin: 0; font-size: 18px; color: #F5F7FA; font-weight: 500; }
    .rn-header__badge {
      font-size: 9px; padding: 2px 8px;
      background: rgba(59,130,246,0.15); color: #60A5FA;
      border: 1px solid rgba(59,130,246,0.3);
      border-radius: 999px; font-weight: 500; letter-spacing: 0.5px;
    }
    .rn-header__sub { margin: 2px 0 0; font-size: 12px; color: #8B9AAB; }
    .rn-header__actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    /* ═══════════════════════════════════════════════
       BUTTONS
    ═══════════════════════════════════════════════ */
    .rn-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; padding: 6px 10px; border-radius: 6px;
      cursor: pointer; border: none; font-weight: 500; transition: opacity .15s;
    }
    .rn-btn:hover { opacity: .85; }
    .rn-btn--ghost {
      background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1;
    }
    .rn-btn--primary {
      background: #2563EB; border: 1px solid #2563EB; color: #fff;
    }
    .rn-btn--full { width: 100%; justify-content: center; padding: 7px; }
    .rn-btn--ok {
      background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.4); color: #34D399; flex: 1;
    }
    .rn-btn--ok:hover { background: rgba(16,185,129,.2); }
    .rn-btn--ko {
      background: rgba(239,68,68,.10); border: 1px solid rgba(239,68,68,.4); color: #F87171; flex: 1;
    }
    .rn-btn--ko:hover { background: rgba(239,68,68,.18); }

    /* ── Cycle de validation des recensements ── */
    .rn-val-row {
      display: flex; align-items: center; gap: 6px; margin-top: 6px;
      font-size: 9px; line-height: 1.4;
    }
    .rn-val-tag {
      font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
      padding: 1px 6px; border-radius: 999px;
    }
    .rn-val-row--wait .rn-val-tag { background: rgba(245,158,11,.15); color: #FBBF24; }
    .rn-val-row--rej  .rn-val-tag { background: rgba(239,68,68,.15);  color: #F87171; }
    .rn-val-by { color: #8B9AAB; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rn-val-actions { display: flex; gap: 6px; margin-top: 8px; }

    /* ── Ressource menacée → alerte (chaîne terrain) ── */
    .rn-alert-action { margin-top: 8px; }
    .rn-btn--alert {
      background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.4); color: #FBBF24; width: 100%;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .rn-btn--alert:hover { background: rgba(245,158,11,.2); }
    .rn-alert-sent {
      display: flex; align-items: center; gap: 6px; font-size: 11px; color: #34D399;
      padding: 5px 0;
    }

    /* ═══════════════════════════════════════════════
       KPIs
    ═══════════════════════════════════════════════ */
    .rn-kpis {
      display: grid; grid-template-columns: repeat(4,1fr); gap: 12px;
    }
    @media (max-width: 900px) { .rn-kpis { grid-template-columns: repeat(2,1fr); } }

    .rn-kpi {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 8px; padding: 14px;
    }
    .rn-kpi--blue  { border-left: 3px solid #3B82F6; }
    .rn-kpi--green { border-left: 3px solid #10B981; }
    .rn-kpi--amber { border-left: 3px solid #F59E0B; }
    .rn-kpi--purple{ border-left: 3px solid #A5A4DC; }

    .rn-kpi__top {
      display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
      font-size: 10px; color: #8B9AAB; text-transform: uppercase;
      letter-spacing: 0.5px; font-weight: 500;
    }
    .rn-kpi__val {
      display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px;
    }
    .rn-kpi__big { font-size: 26px; color: #F5F7FA; font-weight: 600; }
    .rn-kpi__big--green  { color: #34D399; }
    .rn-kpi__big--amber  { color: #FBBF24; }
    .rn-kpi__big--purple { color: #A5A4DC; }
    .rn-kpi__unit { font-size: 11px; color: #8B9AAB; }
    .rn-kpi__trend { font-size: 11px; }
    .rn-kpi__trend--up   { color: #34D399; }
    .rn-kpi__trend--down { color: #F87171; }
    .rn-kpi__sub { font-size: 10px; color: #6B7785; display: flex; align-items: center; gap: 3px; }
    .rn-kpi__sub--red { color: #F87171; }

    /* ═══════════════════════════════════════════════
       FILTER BAR
    ═══════════════════════════════════════════════ */
    .rn-filters {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 10px; padding: 10px 14px;
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .rn-search {
      display: flex; align-items: center; gap: 6px;
      background: #0F1419; border: 1px solid #2A3744;
      border-radius: 6px; padding: 5px 10px; min-width: 220px;
    }
    .rn-search input {
      background: transparent; border: none; outline: none;
      color: #E2E8EE; font-size: 11px; flex: 1; min-width: 0;
    }
    .rn-search input::placeholder { color: #6B7785; }
    .rn-sep { width: 1px; height: 20px; background: #2A3744; flex-shrink: 0; }
    .rn-filter-lbl {
      font-size: 10px; color: #6B7785; text-transform: uppercase;
      letter-spacing: 0.5px; white-space: nowrap;
    }

    .rn-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; padding: 4px 10px;
      background: #1A2530; color: #CBD5E1;
      border: 1px solid #2A3744; border-radius: 999px;
      cursor: pointer; transition: all .15s; white-space: nowrap;
    }
    .rn-chip:hover { border-color: #3B4A5A; }
    .rn-chip__count { opacity: .65; }

    .rn-chip--blue {
      background: rgba(59,130,246,0.15); color: #60A5FA;
      border-color: rgba(59,130,246,0.3);
    }
    .rn-chip--saine       { background: #1A2530; color: #CBD5E1; border-color: #2A3744; }
    .rn-chip--saine-active{ background: rgba(16,185,129,0.15); color: #34D399; border-color: rgba(16,185,129,0.4); }
    .rn-chip--menacee       { background: rgba(245,158,11,0.1); color: #FBBF24; border-color: rgba(245,158,11,0.3); }
    .rn-chip--menacee-active{ background: rgba(245,158,11,0.25); color: #FBBF24; border-color: rgba(245,158,11,0.6); }
    .rn-chip--polluee       { background: #1A2530; color: #CBD5E1; border-color: #2A3744; }
    .rn-chip--polluee-active{ background: rgba(239,68,68,0.15); color: #F87171; border-color: rgba(239,68,68,0.4); }

    .rn-dot {
      width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0;
    }
    .rn-dot--green { background: #10B981; }
    .rn-dot--amber { background: #F59E0B; }
    .rn-dot--red   { background: #EF4444; }

    /* ═══════════════════════════════════════════════
       SPLIT LAYOUT
    ═══════════════════════════════════════════════ */
    .rn-split {
      display: grid; grid-template-columns: 1fr 360px; gap: 14px;
    }
    @media (max-width: 1100px) { .rn-split { grid-template-columns: 1fr; } }

    /* ═══════════════════════════════════════════════
       CARD HEADER (shared)
    ═══════════════════════════════════════════════ */
    .rn-card-head {
      padding: 10px 14px; border-bottom: 1px solid #1F2A33;
      background: #0F1419; display: flex; align-items: center; gap: 8px;
    }
    .rn-card-head__title { font-size: 11px; color: #F5F7FA; font-weight: 600; }
    .rn-card-head__meta  { font-size: 10px; color: #6B7785; }
    .rn-card-head__count { margin-left: auto; font-size: 10px; color: #6B7785; }

    .rn-sync-badge {
      margin-left: auto; font-size: 9px; padding: 2px 8px;
      background: rgba(16,185,129,0.1); color: #34D399;
      border: 1px solid rgba(16,185,129,0.3); border-radius: 999px;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .rn-sync-dot {
      width: 5px; height: 5px; background: #10B981; border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(16,185,129,0.2);
      animation: rnSyncPulse 2s ease-in-out infinite;
    }
    @keyframes rnSyncPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,.4); }
      50%      { box-shadow: 0 0 0 4px rgba(16,185,129,0); }
    }

    /* ═══════════════════════════════════════════════
       MAP CARD
    ═══════════════════════════════════════════════ */
    .rn-map-card {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 10px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .rn-map-wrap { position: relative; flex: 1; }
    .rn-map-el { width: 100%; height: 540px; background: #aad3df; }

    .rn-map-zoom {
      position: absolute; top: 10px; right: 10px;
      display: flex; flex-direction: column; gap: 4px; z-index: 1000;
    }
    .rn-map-zoom button {
      width: 30px; height: 30px;
      background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.2);
      color: #1f2937; border-radius: 5px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .1s;
    }
    .rn-map-zoom button:hover { background: #fff; }

    .rn-card-foot {
      padding: 8px 14px; background: #0A0E12; border-top: 1px solid #1F2A33;
    }
    .rn-card-foot--map {
      display: flex; align-items: center; gap: 12px; font-size: 9px;
    }
    .rn-legend-item {
      display: flex; align-items: center; gap: 4px; color: #6B7785;
    }
    .rn-legend-item--source { color: #34D399; }
    .rn-legend-item--river  { color: #60A5FA; }
    .rn-legend-item--bassin { color: #34D399; }
    .rn-legend-tip { margin-left: auto; color: #6B7785; }

    /* Leaflet popup override */
    ::ng-deep .rn-leaflet-popup .leaflet-popup-content-wrapper {
      background: #fff; border-radius: 6px; padding: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    ::ng-deep .rn-leaflet-popup .leaflet-popup-content { margin: 10px 12px; }
    ::ng-deep .rn-leaflet-popup .leaflet-popup-tip-container { margin-top: -1px; }

    /* ═══════════════════════════════════════════════
       LIST CARD
    ═══════════════════════════════════════════════ */
    .rn-list-card {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 10px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .rn-list-body {
      flex: 1; overflow-y: auto; max-height: 560px;
    }
    .rn-list-body::-webkit-scrollbar { width: 4px; }
    .rn-list-body::-webkit-scrollbar-track { background: #161E28; }
    .rn-list-body::-webkit-scrollbar-thumb { background: #2A3744; border-radius: 2px; }
    .rn-list-foot { padding: 8px; background: #0A0E12; border-top: 1px solid #1F2A33; }

    /* List items */
    .rn-list-item {
      padding: 10px 14px; border-bottom: 1px solid #1F2A33;
      cursor: pointer; border-left: 3px solid transparent;
      transition: background .12s;
    }
    .rn-list-item:hover { background: rgba(255,255,255,0.03); }
    .rn-list-item--menacee {
      background: rgba(245,158,11,0.04);
      border-left-color: #F59E0B;
    }
    .rn-list-item--polluee {
      background: rgba(239,68,68,0.04);
      border-left-color: #EF4444;
    }
    .rn-list-item--selected {
      background: rgba(37,99,235,0.08) !important;
      border-left-color: #2563EB !important;
    }
    .rn-list-item__head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 3px;
    }
    .rn-type-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
    .rn-list-item__name {
      font-size: 11px; font-weight: 600; color: #F5F7FA; flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .rn-list-item__sub { font-size: 9px; color: #8B9AAB; margin-bottom: 2px; }
    .rn-list-item__code { font-size: 9px; color: #6B7785; font-family: 'SF Mono', monospace; }

    .rn-badge {
      flex-shrink: 0; font-size: 8px; padding: 1px 5px;
      border-radius: 999px; font-weight: 500; letter-spacing: 0.3px;
    }
    .rn-badge--saine   { background: rgba(16,185,129,0.15);  color: #34D399; }
    .rn-badge--menacee { background: rgba(245,158,11,0.15);  color: #FBBF24; }
    .rn-badge--pression{ background: rgba(245,158,11,0.15);  color: #FBBF24; }
    .rn-badge--polluee { background: rgba(239,68,68,0.15);   color: #F87171; font-weight: 600; }

    .rn-list-more {
      padding: 10px 14px; text-align: center;
      font-size: 10px; color: #60A5FA; cursor: pointer;
    }
    .rn-list-more:hover { color: #93C5FD; }
    .rn-list-empty {
      padding: 24px 14px; text-align: center; font-size: 11px; color: #6B7785;
    }

    /* ═══════════════════════════════════════════════
       BANNER
    ═══════════════════════════════════════════════ */
    .rn-banner {
      background: rgba(16,185,129,0.06);
      border: 1px solid rgba(16,185,129,0.25);
      border-radius: 8px; padding: 10px 14px;
      display: flex; align-items: flex-start; gap: 10px;
    }
    .rn-banner svg { flex-shrink: 0; margin-top: 1px; }
    .rn-banner__text { font-size: 11px; color: #A7F3D0; line-height: 1.5; }
    .rn-banner__strong { color: #34D399; font-weight: 600; }

    /* ═══════════════════════════════════════════════
       MODAL OVERLAY
    ═══════════════════════════════════════════════ */
    .wiz-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 24px 16px; overflow-y: auto;
    }
    .wiz-modal {
      background: #0F1419; border: 1px solid #2A3744;
      border-radius: 14px; overflow: hidden;
      width: 100%; max-width: 920px;
      display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      max-height: calc(100vh - 48px);
    }

    /* ── Modal Header ── */
    .wiz-head {
      padding: 16px 20px; border-bottom: 1px solid #1F2A33; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(to right, rgba(59,130,246,0.1), transparent);
    }
    .wiz-head__left { display: flex; align-items: center; gap: 12px; }
    .wiz-head__icon {
      width: 40px; height: 40px; flex-shrink: 0;
      background: rgba(59,130,246,0.15); border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .wiz-head__title { margin: 0; font-size: 16px; color: #F5F7FA; font-weight: 600; }
    .wiz-head__sub   { margin: 0; font-size: 11px; color: #8B9AAB; }
    .wiz-head__right { display: flex; align-items: center; gap: 8px; }
    .wiz-draft-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 10px; color: #34D399;
      background: rgba(16,185,129,0.1); padding: 4px 10px;
      border: 1px solid rgba(16,185,129,0.3); border-radius: 999px;
    }
    .wiz-close-btn {
      background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1;
      padding: 6px 10px; border-radius: 6px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .wiz-close-btn:hover { background: #222E3A; }

    /* ── Stepper ── */
    .wiz-stepper {
      padding: 14px 20px; background: #0A0E12; border-bottom: 1px solid #1F2A33;
      display: flex; align-items: center; flex-shrink: 0; overflow-x: auto;
    }
    .wiz-step-node {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .wiz-step-circle {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      background: #1A2530; color: #94A3B8; border: 1px solid #2A3744;
    }
    .wiz-step-node--done .wiz-step-circle {
      background: #10B981; color: #fff; border-color: #10B981;
    }
    .wiz-step-node--active .wiz-step-circle {
      background: #3B82F6; color: #fff; border-color: transparent;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
    }
    .wiz-step-info { min-width: 0; }
    .wiz-step-label {
      font-size: 10px; font-weight: 600; color: #94A3B8; white-space: nowrap;
    }
    .wiz-step-node--done .wiz-step-label   { color: #34D399; }
    .wiz-step-node--active .wiz-step-label { color: #60A5FA; }
    .wiz-step-sub { font-size: 9px; color: #6B7785; white-space: nowrap; }
    .wiz-step-sub--active { color: #6B7785; }
    .wiz-connector {
      flex: 1; min-width: 20px; height: 2px; background: #2A3744; margin: 0 4px;
    }
    .wiz-connector--done { background: #10B981; }

    /* ── Body ── */
    .wiz-body {
      display: grid; grid-template-columns: 1fr 300px; flex: 1; overflow: hidden;
      min-height: 0;
    }
    @media (max-width: 700px) { .wiz-body { grid-template-columns: 1fr; } }

    /* ── Form area ── */
    .wiz-form {
      padding: 18px 20px; overflow-y: auto;
    }
    .wiz-form::-webkit-scrollbar { width: 4px; }
    .wiz-form::-webkit-scrollbar-thumb { background: #2A3744; border-radius: 2px; }

    .wiz-form-title { margin: 0 0 4px; font-size: 14px; color: #F5F7FA; font-weight: 600; }
    .wiz-form-sub   { margin: 0 0 14px; font-size: 11px; color: #8B9AAB; }

    /* Cards */
    .wiz-card {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 8px; padding: 12px; margin-bottom: 12px;
    }
    .wiz-card__actions {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;
    }
    .wiz-card__label-row {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
    }
    .wiz-card__section-lbl {
      font-size: 11px; color: #8B9AAB; text-transform: uppercase;
      letter-spacing: 0.5px; font-weight: 500;
    }
    .wiz-auto-badge {
      margin-left: auto; display: inline-flex; align-items: center; gap: 3px;
      font-size: 9px; color: #34D399;
    }

    /* Buttons within wizard */
    .wiz-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; padding: 5px 10px; border-radius: 5px; cursor: pointer;
    }
    .wiz-btn--blue  { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60A5FA; }
    .wiz-btn--ghost { background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1; }
    .wiz-btn-link   { background: #1A2530; border: 1px solid #2A3744; color: #60A5FA; font-size: 9px; padding: 3px 7px; border-radius: 4px; cursor: pointer; }
    .rn-btn--success { background: #10B981; border: 1px solid #10B981; color: #fff; }

    /* Valid indicator */
    .wiz-valid-badge {
      margin-left: auto; display: inline-flex; align-items: center; gap: 5px;
      font-size: 10px; color: #34D399;
    }
    .wiz-valid-dot {
      width: 6px; height: 6px; background: #10B981; border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(16,185,129,0.2);
    }

    /* Mini map */
    .wiz-mini-map-wrap {
      position: relative; height: 200px; border-radius: 6px; overflow: hidden;
      margin-bottom: 10px;
    }
    .wiz-mini-map { width: 100%; height: 100%; }
    .wiz-mini-map__zoom {
      position: absolute; top: 6px; right: 6px;
      display: flex; flex-direction: column; gap: 3px; z-index: 500;
    }
    .wiz-mini-map__zoom button {
      width: 24px; height: 24px; background: rgba(0,0,0,0.6); border: 1px solid #2A3744;
      color: #fff; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .wiz-mini-map__attr {
      position: absolute; bottom: 6px; left: 8px;
      background: rgba(0,0,0,0.7); border: 1px solid #1F2A33;
      border-radius: 4px; padding: 3px 7px; font-size: 9px; color: #8B9AAB;
      z-index: 500; pointer-events: none;
    }
    .wiz-mini-map__coords {
      position: absolute; bottom: 6px; right: 8px;
      background: rgba(0,0,0,0.7); padding: 3px 7px; border-radius: 4px;
      font-size: 9px; color: #60A5FA; font-family: 'SF Mono', monospace; z-index: 500;
      pointer-events: none;
    }

    /* Coordinate grid */
    .wiz-coord-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .wiz-admin-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    @media (max-width: 600px) {
      .wiz-coord-grid, .wiz-admin-grid { grid-template-columns: 1fr; }
    }

    /* Fields */
    .wiz-field { display: flex; flex-direction: column; }
    .wiz-field label { font-size: 10px; color: #8B9AAB; margin-bottom: 3px; }
    .wiz-req { color: #F87171; }
    .wiz-field input, .wiz-field select, .wiz-textarea {
      background: #0F1419; border: 1px solid #2A3744; color: #E2E8EE;
      padding: 6px 8px; border-radius: 5px; font-size: 11px; outline: none;
    }
    .wiz-field input::placeholder { color: #4B5563; }
    .wiz-field input:focus, .wiz-field select:focus { border-color: #3B82F6; }
    .wiz-field select option { background: #161E28; }
    .wiz-field select:disabled { opacity: .5; }
    .wiz-textarea { resize: vertical; font-family: inherit; width: 100%; }
    .wiz-input--valid { border-color: #10B981 !important; color: #34D399 !important; }
    .wiz-sel--valid   { border-color: #10B981 !important; color: #34D399 !important; }

    /* Doublon warning */
    .wiz-doublon {
      background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.25);
      border-radius: 8px; padding: 12px; margin-bottom: 12px;
    }
    .wiz-doublon__head {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #FBBF24; font-weight: 600; margin-bottom: 6px;
    }
    .wiz-doublon__desc { font-size: 10px; color: #FCD34D; margin: 0 0 8px; }
    .wiz-doublon__list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .wiz-doublon-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px; background: #0F1419;
      border: 1px solid #2A3744; border-radius: 5px;
    }
    .wiz-doublon-item__info { flex: 1; }
    .wiz-doublon-item__name { font-size: 11px; font-weight: 500; color: #E2E8EE; }
    .wiz-doublon-item__meta { font-size: 9px; color: #6B7785; }
    .wiz-checkbox {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 11px; cursor: pointer; color: #CBD5E1;
    }
    .wiz-checkbox input { accent-color: #10B981; margin-top: 2px; flex-shrink: 0; }

    /* Type selection (step 1) */
    .wiz-type-cards { display: flex; flex-direction: column; gap: 10px; }
    .wiz-type-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; background: #161E28;
      border: 1px solid #2A3744; border-radius: 10px;
      cursor: pointer; transition: border-color .15s, background .15s;
    }
    .wiz-type-card:hover { border-color: #3B4A5A; }
    .wiz-type-card--on  {
      border-color: #3B82F6; background: rgba(59,130,246,0.07);
    }
    .wiz-type-card__icon {
      width: 44px; height: 44px; flex-shrink: 0;
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
    }
    .wiz-type-card__body { flex: 1; }
    .wiz-type-card__name { font-size: 13px; font-weight: 600; color: #F5F7FA; }
    .wiz-type-card__desc { font-size: 11px; color: #8B9AAB; margin-top: 2px; }
    .wiz-radio {
      width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
      border: 2px solid #2A3744; background: #0F1419;
    }
    .wiz-radio--on {
      border-color: #3B82F6; background: #3B82F6;
      box-shadow: inset 0 0 0 3px #0F1419;
    }

    /* Recap (step 6) */
    .wiz-recap-card { padding: 14px; }
    .wiz-recap-header {
      display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
      padding-bottom: 10px; border-bottom: 1px solid #1F2A33;
    }
    .wiz-recap-icon { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: rgba(16,185,129,0.1); border-radius: 7px; }
    .wiz-recap-type { font-size: 9px; color: #34D399; text-transform: uppercase; font-weight: 600; }
    .wiz-recap-name { font-size: 13px; font-weight: 600; color: #F5F7FA; }
    .wiz-recap-code { margin-left: auto; font-size: 9px; color: #6B7785; font-family: 'SF Mono', monospace; }
    .wiz-recap-rows { display: flex; flex-direction: column; gap: 6px; }
    .wiz-recap-row { display: flex; align-items: baseline; gap: 8px; font-size: 11px; }
    .wiz-recap-row__label { color: #8B9AAB; min-width: 120px; flex-shrink: 0; }
    .wiz-recap-row__value { color: #E2E8EE; }
    .wiz-final-banner {
      display: flex; align-items: flex-start; gap: 8px;
      background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.25);
      border-radius: 8px; padding: 10px 12px; font-size: 11px; color: #A7F3D0;
    }
    .wiz-final-banner strong { color: #34D399; }

    /* ── Sidebar ── */
    .wiz-sidebar {
      background: #0A0E12; border-left: 1px solid #1F2A33;
      padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;
    }
    .wiz-sidebar::-webkit-scrollbar { width: 4px; }
    .wiz-sidebar::-webkit-scrollbar-thumb { background: #2A3744; border-radius: 2px; }

    .wiz-sb-section__head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
      font-size: 10px; font-weight: 600; color: #93C5FD;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .wiz-preview {
      background: #161E28; border: 1.5px solid #34D399;
      border-radius: 8px; padding: 10px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .wiz-preview__icon { margin-bottom: 4px; }
    .wiz-preview__type { font-size: 9px; color: #34D399; text-transform: uppercase; font-weight: 600; }
    .wiz-preview__name { font-size: 11px; font-weight: 500; color: #E2E8EE; }
    .wiz-preview__loc  { font-size: 9px; color: #8B9AAB; }
    .wiz-preview__coords { font-size: 9px; color: #6B7785; font-family: 'SF Mono', monospace; }

    .wiz-progress { display: flex; flex-direction: column; gap: 2px; }
    .wiz-progress-item {
      display: flex; align-items: center; gap: 6px; padding: 3px 0;
      font-size: 10px; color: #6B7785;
    }
    .wiz-progress-item--done   { color: #34D399; }
    .wiz-progress-item--active { color: #60A5FA; }

    .wiz-tip {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 8px; padding: 10px;
      font-size: 10px; color: #CBD5E1; line-height: 1.6;
    }

    /* ── Footer ── */
    .wiz-foot {
      padding: 14px 20px; background: #0A0E12; border-top: 1px solid #1F2A33;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .wiz-foot__left  { display: flex; align-items: center; gap: 10px; }
    .wiz-foot__right { display: flex; gap: 6px; }
    .wiz-foot__step  { font-size: 11px; color: #6B7785; }
    .wiz-sep-v { width: 1px; height: 14px; background: #2A3744; }
    .wiz-autosave {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; color: #34D399;
    }

    ::ng-deep .wiz-mini-map .leaflet-control-attribution { display: none; }

    /* ═══════════════════════════════════════════════
       DRAWER OVERLAY
    ═══════════════════════════════════════════════ */
    .dr-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(0,0,0,0.78);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .dr-panel {
      background: #0F1419; border: 1px solid #2A3744;
      border-radius: 14px; overflow: hidden;
      width: 100%; max-width: 900px; max-height: 80vh;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,0.85);
    }

    /* ── Header ── */
    .dr-header {
      flex-shrink: 0; padding: 16px 20px 0;
      border-bottom: 1px solid #1F2A33;
    }
    .dr-header__top {
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 12px;
    }
    .dr-header__icon-wrap { position: relative; flex-shrink: 0; }
    .dr-header__icon {
      width: 52px; height: 52px; border-radius: 12px;
      background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.2);
      display: flex; align-items: center; justify-content: center;
    }
    .dr-header__status-dot {
      position: absolute; bottom: -2px; right: -2px;
      width: 14px; height: 14px; border-radius: 50%;
      border: 2.5px solid #0F1419;
    }
    .dr-dot--green { background: #10B981; box-shadow: 0 0 0 2px rgba(16,185,129,0.3); }
    .dr-dot--amber { background: #F59E0B; box-shadow: 0 0 0 2px rgba(245,158,11,0.3); }
    .dr-dot--red   { background: #EF4444; box-shadow: 0 0 0 2px rgba(239,68,68,0.3); }

    .dr-header__info { flex: 1; min-width: 0; }
    .dr-header__row1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 5px; }

    .dr-code-chip {
      font-family: 'SF Mono', monospace; font-size: 9px;
      background: rgba(52,211,153,0.12); color: #34D399;
      border: 1px solid rgba(52,211,153,0.3);
      padding: 2px 8px; border-radius: 4px; font-weight: 600;
    }
    .dr-type-badge {
      font-size: 9px; background: rgba(96,165,250,0.1); color: #60A5FA;
      border: 1px solid rgba(96,165,250,0.3); padding: 2px 7px; border-radius: 4px;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .dr-status-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
    }
    .dr-status--saine  { background: rgba(16,185,129,0.1);  color: #34D399; }
    .dr-status--menacee{ background: rgba(245,158,11,0.1);  color: #FBBF24; }
    .dr-status--polluee{ background: rgba(239,68,68,0.1);   color: #F87171; }

    .dr-pulse {
      width: 6px; height: 6px; border-radius: 50%;
      animation: drPulse 2s ease-in-out infinite;
    }
    .dr-pulse--green { background: #10B981; }
    .dr-pulse--amber { background: #F59E0B; }
    .dr-pulse--red   { background: #EF4444; }
    @keyframes drPulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }

    .dr-header__name {
      font-size: 18px; font-weight: 600; color: #F5F7FA; margin-bottom: 4px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .dr-header__loc {
      display: flex; align-items: center; gap: 4px; font-size: 11px; color: #8B9AAB;
    }
    .dr-dms { font-family: 'SF Mono', monospace; font-size: 10px; color: #6B7785; }

    .dr-header__nav { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .dr-nav-count { font-size: 10px; color: #6B7785; margin-right: 4px; white-space: nowrap; }
    .dr-nav-btn {
      width: 28px; height: 28px; background: #1A2530; border: 1px solid #2A3744;
      color: #CBD5E1; border-radius: 5px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: background .1s;
    }
    .dr-nav-btn:hover:not(:disabled) { background: #222E3A; }
    .dr-nav-btn:disabled { opacity: .35; cursor: default; }
    .dr-close-btn {
      width: 28px; height: 28px; background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2); color: #F87171;
      border-radius: 5px; cursor: pointer; margin-left: 2px;
      display: flex; align-items: center; justify-content: center; transition: background .1s;
    }
    .dr-close-btn:hover { background: rgba(239,68,68,0.18); }

    .dr-actions {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      padding: 10px 0 12px;
    }
    .dr-action-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; padding: 5px 10px; border-radius: 6px;
      background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1;
      cursor: pointer; transition: opacity .15s; font-weight: 500;
    }
    .dr-action-btn:hover { opacity: .82; }
    .dr-action-btn--primary { background: #2563EB; border-color: #2563EB; color: #fff; }

    /* ── Tabs ── */
    .dr-tabs {
      display: flex; flex-shrink: 0;
      border-bottom: 1px solid #1F2A33; background: #0A0E12;
      overflow-x: auto; padding: 0 20px; gap: 2px;
    }
    .dr-tabs::-webkit-scrollbar { height: 3px; }
    .dr-tabs::-webkit-scrollbar-thumb { background: #2A3744; }

    .dr-tab {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 10px 12px; font-size: 11px; color: #6B7785;
      background: none; border: none; cursor: pointer;
      border-bottom: 2px solid transparent; white-space: nowrap;
      transition: color .15s;
    }
    .dr-tab:hover { color: #CBD5E1; }
    .dr-tab--active { color: #34D399; border-bottom-color: #34D399; font-weight: 600; }

    .dr-tab-warn {
      background: rgba(245,158,11,0.15); color: #FBBF24;
      font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
    }
    .dr-tab-count {
      background: rgba(96,165,250,0.15); color: #60A5FA;
      font-size: 8px; font-weight: 600; padding: 1px 5px; border-radius: 3px;
    }

    /* ── Body ── */
    .dr-body {
      flex: 1; overflow-y: auto; padding: 14px 20px; min-height: 0;
    }
    .dr-body::-webkit-scrollbar { width: 4px; }
    .dr-body::-webkit-scrollbar-thumb { background: #2A3744; border-radius: 2px; }

    /* Description block */
    .dr-desc-block {
      border-left: 3px solid #10B981;
      background: rgba(16,185,129,0.05); border-radius: 0 6px 6px 0;
      padding: 10px 14px; margin-bottom: 14px;
      font-size: 12px; color: #CBD5E1; line-height: 1.7;
    }
    .dr-desc-block p { margin: 0; }
    .dr-desc-block strong { color: #F5F7FA; }
    .dr-desc-block--blue   { border-left-color: #3B82F6; background: rgba(59,130,246,0.05); }
    .dr-desc-block--purple { border-left-color: #A5A4DC; background: rgba(165,164,220,0.05); }

    /* Inline map */
    .dr-map-section { margin-bottom: 16px; }
    .dr-map-wrap {
      position: relative; height: 260px; border-radius: 8px; overflow: hidden;
      border: 1px solid #1F2A33;
    }
    .dr-map-el { width: 100%; height: 100%; background: #aad3df; }
    .dr-map-coords {
      position: absolute; bottom: 6px; right: 8px; z-index: 500;
      background: rgba(0,0,0,0.7); padding: 3px 8px; border-radius: 4px;
      font-size: 9px; color: #60A5FA; font-family: 'SF Mono', monospace;
      pointer-events: none;
    }
    .dr-map-attr {
      position: absolute; bottom: 6px; left: 8px; z-index: 500;
      background: rgba(0,0,0,0.7); padding: 3px 8px; border-radius: 4px;
      font-size: 9px; color: #8B9AAB; pointer-events: none;
    }
    .dr-map-foot { display: flex; gap: 6px; padding: 8px 0 0; }
    .dr-map-btn {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; padding: 4px 10px; border-radius: 5px;
      background: #161E28; border: 1px solid #2A3744; color: #CBD5E1;
      cursor: pointer; transition: background .1s;
    }
    .dr-map-btn:hover { background: #1A2530; }

    /* 2-col info grid */
    .dr-info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;
    }
    @media (max-width: 600px) { .dr-info-grid { grid-template-columns: 1fr; } }

    .dr-info-section {
      background: #161E28; border: 1px solid #1F2A33; border-radius: 8px; padding: 12px;
    }
    .dr-info-section__head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
      font-size: 10px; font-weight: 600; color: #8B9AAB;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .dr-info-rows { display: flex; flex-direction: column; gap: 5px; }
    .dr-info-row { display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
    .dr-info-row__lbl { color: #6B7785; min-width: 78px; flex-shrink: 0; }
    .dr-info-row__val { color: #E2E8EE; flex: 1; min-width: 0; }
    .dr-mono { font-family: 'SF Mono', monospace; font-size: 10px; }

    /* Infrastructures */
    .dr-infra-section { margin-bottom: 16px; }
    .dr-infra-section__head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
      font-size: 10px; font-weight: 600; color: #8B9AAB;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .dr-infra-count {
      background: rgba(251,191,36,0.12); color: #FBBF24;
      font-size: 8px; padding: 1px 6px; border-radius: 3px; font-weight: 600;
    }
    .dr-infra-list { display: flex; flex-direction: column; gap: 6px; }
    .dr-infra-item {
      display: flex; align-items: center; gap: 10px;
      background: #161E28; border: 1px solid #1F2A33; border-radius: 7px; padding: 9px 12px;
      cursor: pointer; transition: border-color .1s;
    }
    .dr-infra-item:hover { border-color: #2A3744; background: #1A2530; }
    .dr-infra-item__icon {
      width: 28px; height: 28px; flex-shrink: 0;
      background: rgba(251,191,36,0.1); border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .dr-infra-item__info { flex: 1; min-width: 0; }
    .dr-infra-item__name { font-size: 11px; font-weight: 500; color: #E2E8EE; }
    .dr-infra-item__code { font-size: 9px; color: #6B7785; font-family: 'SF Mono', monospace; }
    .dr-infra-item__badge { flex-shrink: 0; }
    .dr-infra-badge--op {
      background: rgba(16,185,129,0.12); color: #34D399;
      font-size: 9px; padding: 2px 7px; border-radius: 4px;
    }
    .dr-infra-badge--dg {
      background: rgba(245,158,11,0.12); color: #FBBF24;
      font-size: 9px; padding: 2px 7px; border-radius: 4px;
    }

    /* Cross links */
    .dr-crosslinks { margin-bottom: 10px; }
    .dr-crosslinks__head {
      font-size: 10px; font-weight: 600; color: #6B7785;
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
    }
    .dr-crosslinks__chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .dr-cl-chip {
      display: inline-flex; align-items: center; gap: 4px; font-size: 10px;
      padding: 3px 10px; background: #161E28; border: 1px solid #2A3744;
      color: #CBD5E1; border-radius: 999px; cursor: pointer; transition: border-color .1s;
    }
    .dr-cl-chip:hover { border-color: #3B4A5A; }

    /* Tab placeholders */
    .dr-tab-placeholder {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 48px 20px; text-align: center;
      font-size: 12px; color: #4B5563;
    }
    .dr-tab-placeholder--warn { color: #92400E; }
    .dr-tab-placeholder--warn span { color: #FBBF24; }
  `]
})
export class ResourcesPageComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('resMap',        { static: false }) mapRef!:      ElementRef<HTMLDivElement>;
  @ViewChild('listContainer', { static: false }) listRef!:     ElementRef<HTMLDivElement>;
  @ViewChild('modalMapEl',    { static: false }) modalMapRef?: ElementRef<HTMLDivElement>;
  @ViewChild('drawerMapEl',   { static: false }) drawerMapRef?: ElementRef<HTMLDivElement>;

  private map: any = null;
  private markers: Record<string, any> = {};
  modalMap: any = null;
  private modalMarker: any = null;
  private drawerMap: any = null;
  private _drawerMapNeedsInit = false;

  /** Quand défini, la page s'affiche scopée à un département (embarquée dans la fiche URD). */
  @Input() scope?: { dept: string; commune?: string };
  /** Mode overlay : monté par-dessus la carte → on masque la page et on ouvre direct le wizard. */
  @Input() overlayMode = false;
  /** Coordonnées pré-remplies (point cliqué sur la carte) — lues à l'étape « Géolocalisation ». */
  @Input() initialCoords: { lat: number; lng: number } | null = null;
  @Output() overlayClose = new EventEmitter<void>();

  readonly DEPTS = HAITI_DEPARTMENTS;

  /** Source de vérité unique = ResourcesStore, filtrée par le scope éventuel. */
  get allData(): NatResource[] {
    const all = this.store.snapshot;
    // TEPAC : périmètre fin commune, 100 % piloté par le backend → on écarte le catalogue de
    // référence front (seed) pour ne montrer QUE les ressources réelles de la commune.
    if (this.scope?.commune) {
      const c = this.scope.commune.toLowerCase();
      return all.filter(r => !r.seed
        && r.department === this.scope!.dept
        && (r.commune ?? '').toLowerCase() === c);
    }
    // Superviseur : département. Admin : tout (catalogue de référence inclus).
    return this.scope?.dept ? all.filter(r => r.department === this.scope!.dept) : all;
  }

  /** TEPAC (périmètre commune) : la page passe en mode « recensement à soumettre ». */
  get isTepac(): boolean { return !!this.scope?.commune; }
  /** Superviseur (département sans commune) : autorité de validation des recensements. */
  get canValidate(): boolean { return !!this.scope?.dept && !this.scope?.commune; }

  readonly SOURCE_CLASSES = [
    { val:'karstic',    label:'Karstique' },
    { val:'spring',     label:'De montagne' },
    { val:'thermal',    label:'Thermale' },
    { val:'mineral',    label:'Minérale' },
    { val:'vauclusian', label:'Vauclusienne' },
  ];
  readonly OREPA_OPTIONS = [
    'DINEPA / OREPA Ouest','OREPA Nord','OREPA Nord-Artibonite',
    'OREPA Nord-Ouest','OREPA Centre','DINEPA Sud',
    'DINEPA Sud-Est','DINEPA Nord-Est',"DINEPA Grand'Anse",'DINEPA Nippes',
  ];
  readonly wizSteps = [
    { n:1, label:'Type' }, { n:2, label:'Géolocalisation' },
    { n:3, label:'Identité' }, { n:4, label:'Caractéristiques' },
    { n:5, label:'Gouvernance' }, { n:6, label:'Validation' },
  ];
  readonly WIZ_TIPS: Record<number,string> = {
    1: 'Sources = émergence naturelle visible. Rivières = cours d\'eau avec source et embouchure. Bassins = zones de collecte pluviale.',
    2: 'Précision GPS minimale recommandée : ±10 m. Cliquer sur la carte pour placer le marqueur.',
    3: 'Le nom doit être celui utilisé localement. Le code est généré automatiquement.',
    4: 'Les caractéristiques peuvent être estimées si non mesurées. Indiquez la source de données.',
    5: 'L\'institution gestionnaire peut être une CAEPA, un comité d\'eau ou une collectivité.',
    6: 'Vérifiez chaque information avant de valider. La fiche sera visible sur la carte immédiatement.',
  };

  showModal  = false;
  wizStep    = 1;
  wizard: WizardData = { ...WIZARD_INIT };

  searchTerm   = '';
  typeFilter:   'all' | NatType         = 'all';
  statusFilter: '' | NatStatus          = '';
  validationFilter: '' | NatValidation  = '';
  selectedId:   string | null     = null;
  showAll = false;

  drawerResourceId: string | null = null;
  drawerTab = 'overview';

  private readonly DR_INFRA: Record<string, Array<{ name: string; code: string; status: 'operationnel' | 'degrade' }>> = {
    'rs-01': [{ name: 'Captage Bassin Bleu', code: 'CAP-JACM-001', status: 'degrade' }],
    'rs-02': [{ name: 'AEP Pétion-Ville Nord', code: 'AEP-PETV-003', status: 'operationnel' }, { name: 'Réservoir Fermathe', code: 'RES-FERM-001', status: 'operationnel' }],
    'rs-04': [{ name: 'AEP Laboule-12', code: 'AEP-LAB-012', status: 'operationnel' }],
    'rs-11': [{ name: 'Prise Momance', code: 'PRI-MOMA-001', status: 'operationnel' }],
    'rs-12': [{ name: 'Barrage Péligre', code: 'BAR-PELI-001', status: 'degrade' }, { name: 'Périmètre irrigué Artibonite', code: 'IRR-ARTI-001', status: 'operationnel' }],
    'rs-14': [{ name: 'Station de pompage Cul-de-Sac', code: 'STA-CSAC-001', status: 'degrade' }],
  };
  private readonly DR_CROSSLINKS: Record<string, string[]> = {
    'rs-01': ['rs-11'], 'rs-12': ['rs-14'],
    'rs-14': ['rs-12', 'rs-15'], 'rs-15': ['rs-14'],
  };

  constructor(private ngZone: NgZone, private store: ResourcesStore,
              private route: ActivatedRoute, private router: Router,
              private bff: BffApiService) {
    GestidloStore.seed();
  }

  /** Ressources pour lesquelles une alerte vient d'être créée (anti double-clic + confirmation UI). */
  alerteEnvoyee: Record<string, boolean> = {};

  /**
   * Geste « ressource menacée → alerte » : crée une VRAIE alerte dans la commune, préremplie depuis
   * la ressource. Entre dans la chaîne Ressource → Alerte → Intervention → Rapport. Le serveur scope
   * sur le token (la commune de la ressource = celle du TEPAC), d'où aucune saisie.
   */
  creerAlerteRessource(r: NatResource, ev?: Event) {
    ev?.stopPropagation();
    if (this.alerteEnvoyee[r.id]) return;
    const label = r.status === 'polluee' ? 'polluée' : 'menacée';
    const severite = r.status === 'polluee' ? 'critique' : 'haute';
    this.bff.createAlert({
      titre:       `Ressource ${label} — ${r.name}`,
      description: r.flowNote ? `État ${label}. ${r.flowNote}.` : `Ressource ${label} signalée depuis le recensement.`,
      severite,
      type:        'RESSOURCE',
      departement: r.department,
      commune:     r.commune,
      ressourceId: r.id,
    }).subscribe({
      next: () => { this.alerteEnvoyee[r.id] = true; },
      error: () => {},
    });
  }

  /* ── Derived collections ──────────────────────────────────── */
  get sources()  { return this.allData.filter(r => r.type === 'source');  }
  get rivieres() { return this.allData.filter(r => r.type === 'riviere'); }
  get bassins()  { return this.allData.filter(r => r.type === 'bassin');  }
  get saines()   { return this.allData.filter(r => r.status === 'saine');   }
  get menacees() { return this.allData.filter(r => r.status === 'menacee'); }
  get polluees() { return this.allData.filter(r => r.status === 'polluee'); }

  /* ── Cycle de validation (absence de validation ⇒ officielle de référence) ── */
  validationOf(r: NatResource): NatValidation { return r.validation ?? 'validee'; }
  get enAttente() { return this.allData.filter(r => this.validationOf(r) === 'en_attente'); }
  get validees()  { return this.allData.filter(r => this.validationOf(r) === 'validee');  }
  get rejetees()  { return this.allData.filter(r => this.validationOf(r) === 'rejetee');  }

  setValidationFilter(v: '' | NatValidation) { this.validationFilter = this.validationFilter === v ? '' : v; }

  /** Superviseur : valide un recensement (devient officiel). */
  validerRessource(r: NatResource, ev?: Event) {
    ev?.stopPropagation();
    this.store.valider(r.id);
  }

  /** Superviseur : rejette un recensement avec motif obligatoire. */
  rejeterRessource(r: NatResource, ev?: Event) {
    ev?.stopPropagation();
    const motif = (window.prompt(`Motif du rejet de « ${r.name} » :`, '') ?? '').trim();
    if (!motif) return;
    this.store.rejeter(r.id, motif);
  }

  validationLabel(v: NatValidation): string {
    return v === 'en_attente' ? 'En attente' : v === 'rejetee' ? 'Rejetée' : 'Validée';
  }
  get threatened() { return this.menacees.length + this.polluees.length; }
  get totalFlow()  { return this.allData.reduce((s, r) => s + (r.flowM3h ?? 0), 0); }

  get filtered(): NatResource[] {
    const rows = this.allData.filter(r => {
      if (this.typeFilter !== 'all' && r.type !== this.typeFilter)     return false;
      if (this.statusFilter          && r.status !== this.statusFilter) return false;
      if (this.validationFilter && this.validationOf(r) !== this.validationFilter) return false;
      if (this.searchTerm) {
        const q = this.searchTerm.toLowerCase();
        return r.name.toLowerCase().includes(q)
            || r.commune.toLowerCase().includes(q)
            || r.code.toLowerCase().includes(q);
      }
      return true;
    });
    // Dédoublonnage par code : seed + enregistrements API peuvent porter le même code
    // (ex. une ressource recensée puis re-poussée). Le code est l'identité métier unique.
    return dedupeByCode(rows);
  }

  get listItems(): NatResource[] {
    return this.showAll ? this.filtered : this.filtered.slice(0, 6);
  }

  /** trackBy stable par code (repli id) : Angular réutilise les nœuds, plus de re-render complet. */
  trackByCode(_i: number, r: NatResource): string { return r.code || r.id; }

  /* ── Lifecycle ────────────────────────────────────────────── */
  ngOnInit() {
    this.store.reload();   // recharger au montage (survie au reload)
    // Monté en overlay par-dessus la carte (RecensementService) → on ouvre direct le wizard.
    if (this.overlayMode) {
      this.openAddModal();
      return;
    }
    // Fallback navigation : ?nouveau=1 ouvre LE MÊME wizard, puis on nettoie l'URL.
    if (this.route.snapshot.queryParamMap.get('nouveau')) {
      this.openAddModal();
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  ngAfterViewInit() { setTimeout(() => this.initMap(), 150); }

  ngAfterViewChecked() {
    if (this.showModal && this.wizStep === 2 && !this.modalMap && this.modalMapRef?.nativeElement) {
      this.initModalMap();
    }
    if (this._drawerMapNeedsInit && this.drawerMapRef?.nativeElement) {
      this._drawerMapNeedsInit = false;
      this.initDrawerMap();
    }
  }

  ngOnDestroy() {
    if (this.map)       { this.map.remove();       this.map = null; }
    if (this.modalMap)  { this.modalMap.remove();  this.modalMap = null; }
    if (this.drawerMap) { this.drawerMap.remove();  this.drawerMap = null; }
    delete (window as any).__rnSelect;
  }

  /* ── Map ──────────────────────────────────────────────────── */
  private initMap() {
    if (!this.mapRef?.nativeElement || typeof L === 'undefined') return;

    this.map = L.map(this.mapRef.nativeElement, {
      center: [18.9, -72.7], zoom: 8, zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · CNIGS Haïti · GestiDLO',
      maxZoom: 18
    }).addTo(this.map);

    (window as any).__rnSelect = (id: string) => {
      this.ngZone.run(() => this.selectById(id));
    };

    this.buildMarkers();
    this.applyScopeView();
  }

  /**
   * Cadre la carte sur le périmètre du compte : commune (resserrée sur ses ressources) →
   * département → Haïti. `setMaxBounds` verrouille la navigation hors zone (un TEPAC de
   * Carrefour ne défile pas jusqu'à Jacmel).
   */
  private applyScopeView() {
    if (!this.map) return;

    if (this.scope?.commune) {
      const pts = this.allData
        .filter(r => r.lat != null && r.lon != null)
        .map(r => [r.lat as number, r.lon as number] as [number, number]);
      if (pts.length) {
        const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const pad = 0.11; // ≈ 12 km autour du barycentre → verrou commune
        if (pts.length === 1) this.map.setView([lat, lon], 13);
        else this.map.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom: 14 });
        this.map.setMaxBounds(L.latLngBounds([lat - pad, lon - pad], [lat + pad, lon + pad]));
        return;
      }
      // Commune sans ressource géolocalisée : repli sur le département.
    }

    const bounds = this.scope?.dept ? DEPT_BOUNDS[this.scope.dept] : null;
    if (bounds) {
      this.map.fitBounds(bounds);
      this.map.setMaxBounds(L.latLngBounds(bounds).pad(0.3));
    }
  }

  private buildMarkers() {
    Object.values(this.markers).forEach((m: any) => m.remove());
    this.markers = {};

    this.allData.forEach(r => {
      if (!r.lat || !r.lon) return;

      const icon = L.divIcon({
        html: this.markerSvg(r), className: '',
        iconSize: [30, 30], iconAnchor: [15, 15]
      });

      const m = L.marker([r.lat, r.lon], { icon })
        .addTo(this.map)
        .bindPopup(this.popupHtml(r), { maxWidth: 220, className: 'rn-leaflet-popup' });

      m.on('click', () => this.ngZone.run(() => {
        this.selectedId = r.id;
        this.scrollToItem(r.id);
      }));

      this.markers[r.id] = m;
    });
  }

  private markerSvg(r: NatResource): string {
    const c = r.status === 'saine' ? '#10B981'
            : r.status === 'menacee' ? '#F59E0B' : '#EF4444';
    const ring = r.status !== 'saine'
      ? `<circle cx="15" cy="15" r="12" fill="${c}" opacity="0.2"/>`
      : '';
    if (r.type === 'source') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <polygon points="15,4 26,23 4,23" fill="${c}" stroke="white" stroke-width="1.5"/>
      </svg>`;
    if (r.type === 'riviere') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="11" fill="${c}" opacity="0.25"/>
        <circle cx="15" cy="15" r="7"  fill="${c}" stroke="white" stroke-width="1.5"/>
      </svg>`;
    return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="15" cy="15" rx="13" ry="8" fill="${c}" opacity="0.18"
                 stroke="${c}" stroke-width="1.5" stroke-dasharray="3,2"/>
        <circle  cx="15" cy="15" r="4" fill="${c}"/>
      </svg>`;
  }

  private popupHtml(r: NatResource): string {
    const sc = r.status === 'saine' ? '#10B981'
             : r.status === 'menacee' ? '#F59E0B' : '#EF4444';
    const sl = r.status === 'saine' ? 'saine'
             : r.status === 'menacee' ? 'menacée' : 'polluée';
    const tl = r.type === 'source' ? 'Source'
             : r.type === 'riviere' ? 'Rivière' : 'Bassin';
    const fl = r.flowM3h  ? `<strong>${r.flowM3h.toLocaleString('fr-FR')} m³/h</strong> · `
             : r.areaKm2  ? `<strong>${r.areaKm2} km²</strong> · ` : '';
    return `<div style="font-family:-apple-system,system-ui,sans-serif;min-width:180px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:9px;background:${sc}22;color:${sc};padding:1px 6px;border-radius:3px;font-weight:600;text-transform:uppercase">${tl}</span>
        <span style="font-size:11px;font-weight:700;color:#0f1419">${r.name}</span>
      </div>
      <div style="font-size:9px;color:#6b7280;margin-bottom:6px;line-height:1.5">
        ${r.commune}${r.section ? ' · ' + r.section : ''} · ${r.department}<br/>
        ${fl}<span style="color:${sc}">${sl}</span>
      </div>
      <button onclick="window.__rnSelect('${r.id}')"
              style="background:#2563EB;border:none;color:#fff;font-size:9px;
                     padding:3px 8px;border-radius:3px;font-weight:600;cursor:pointer">
        Voir fiche →
      </button>
    </div>`;
  }

  private updateMarkerVisibility() {
    this.allData.forEach(r => {
      const m = this.markers[r.id];
      if (!m) return;
      if (this.isVisible(r)) m.addTo(this.map);
      else m.remove();
    });
  }

  private isVisible(r: NatResource): boolean {
    if (this.typeFilter !== 'all' && r.type !== this.typeFilter) return false;
    if (this.statusFilter          && r.status !== this.statusFilter) return false;
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      return r.name.toLowerCase().includes(q)
          || r.commune.toLowerCase().includes(q)
          || r.code.toLowerCase().includes(q);
    }
    return true;
  }

  /* ── User interactions ────────────────────────────────────── */
  setTypeFilter(t: 'all' | NatType) {
    this.typeFilter = t;
    this.showAll = false;
    this.updateMarkerVisibility();
  }

  setStatusFilter(s: '' | NatStatus) {
    this.statusFilter = this.statusFilter === s ? '' : s;
    this.showAll = false;
    this.updateMarkerVisibility();
  }

  onSearch() {
    this.showAll = false;
    this.updateMarkerVisibility();
  }

  onListItemClick(r: NatResource) {
    this.selectedId = r.id;
    if (r.lat && r.lon && this.map) {
      this.map.flyTo([r.lat, r.lon], 11, { duration: 0.8 });
    }
    this.openDrawer(r.id);
  }

  selectById(id: string) {
    this.selectedId = id;
    this.scrollToItem(id);
    this.openDrawer(id);
  }

  private scrollToItem(id: string) {
    setTimeout(() => {
      const el = this.listRef?.nativeElement
        .querySelector(`[data-res-id="${id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
  }

  zoomIn()   { this.map?.zoomIn(); }
  zoomOut()  { this.map?.zoomOut(); }
  recenter() {
    if (this.scope?.dept) { this.applyScopeView(); return; }
    this.map?.flyTo([18.9, -72.7], 8, { duration: 0.8 });
  }

  /* ── Display helpers ──────────────────────────────────────── */
  formatFlow(n: number): string { return n.toLocaleString('fr-FR'); }

  badgeLabel(s: NatStatus): string {
    return { saine: 'SAINE', menacee: 'MENACÉE', polluee: 'POLLUÉE' }[s];
  }

  typeIcon(t: NatType): string {
    if (t === 'source') return `
      <svg viewBox="0 0 16 16" width="11" height="11">
        <polygon points="8,2 14,13 2,13" fill="#34D399"/>
      </svg>`;
    if (t === 'riviere') return `
      <svg viewBox="0 0 16 16" width="12" height="12">
        <path d="M2,8 Q5,4 8,8 Q11,12 14,8" fill="none" stroke="#60A5FA" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
    return `
      <svg viewBox="0 0 16 16" width="11" height="11">
        <polygon points="8,2 14,6 13,13 3,13 2,6" fill="none" stroke="#34D399" stroke-width="1.5"/>
      </svg>`;
  }

  subText(r: NatResource): string {
    if (r.type === 'riviere') {
      return `${r.commune} · ${r.lengthKm} km · ${(r.flowM3h ?? 0).toLocaleString('fr-FR')} m³/h`;
    }
    if (r.type === 'bassin') {
      return `${r.department} · ${r.areaKm2} km² · ${r.communesCount} communes`;
    }
    return `${r.commune} · ${r.flowM3h} m³/h · ${r.flowNote ?? 'stable'}`;
  }

  /* ── WIZARD ──────────────────────────────────────────────── */
  openAddModal() {
    this.wizard   = { ...WIZARD_INIT };
    // Recensement pré-lié au département quand la page est scopée (fiche URD).
    if (this.scope?.dept) this.wizard.department = this.scope.dept;
    // TEPAC : commune verrouillée sur celle du token (périmètre fin imposé).
    if (this.scope?.commune) this.wizard.commune = this.scope.commune;
    // Géoloc pré-remplie depuis le point cliqué sur la carte (étape « Géolocalisation »).
    if (this.initialCoords) {
      this.wizard.lat = this.initialCoords.lat.toFixed(6);
      this.wizard.lon = this.initialCoords.lng.toFixed(6);
    }
    this.wizStep  = 1;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    if (this.modalMap) { this.modalMap.remove(); this.modalMap = null; }
    this.modalMarker = null;
    if (this.overlayMode) this.overlayClose.emit();   // rend la main à la carte
  }

  onOverlayClick(e: MouseEvent) { this.closeModal(); }

  nextStep() {
    if (!this.canAdvance) return;
    if (this.wizStep === 6) { this.submitWizard(); return; }
    if (this.wizStep !== 2 && this.modalMap) {
      this.modalMap.remove(); this.modalMap = null; this.modalMarker = null;
    }
    this.wizStep++;
  }

  prevStep() {
    if (this.wizStep > 1) {
      if (this.modalMap) { this.modalMap.remove(); this.modalMap = null; this.modalMarker = null; }
      this.wizStep--;
    }
  }

  get canAdvance(): boolean {
    switch (this.wizStep) {
      case 1: return this.wizard.type !== '';
      case 2: {
        const ok = this.isLatValid && this.isLonValid
                && !!this.wizard.department && !!this.wizard.commune;
        const noDoublon = this.nearbyResources.length === 0 || this.wizard.confirmedNotDuplicate;
        return ok && noDoublon;
      }
      case 3: return this.wizard.name.trim() !== '';
      default: return true;
    }
  }

  submitWizard() {
    const r = this.buildResourceFromWizard();

    // 1. Ajouter au store unique (persistance localStorage incluse)
    this.store.add(r);

    // 2. Ajouter le marqueur sur la carte principale
    this.addMarkerForResource(r);

    // 4. Réinitialiser les filtres pour que la ressource soit visible
    this.typeFilter   = 'all';
    this.statusFilter = '';
    this.searchTerm   = '';
    this.showAll      = true;

    // 5. Sélectionner et centrer
    this.selectedId = r.id;
    if (r.lat && r.lon && this.map) {
      setTimeout(() => {
        this.map.flyTo([r.lat!, r.lon!], 12, { duration: 1 });
        setTimeout(() => this.markers[r.id]?.openPopup(), 1100);
      }, 200);
    }

    // 6. Scroll vers la ligne dans la liste
    setTimeout(() => this.scrollToItem(r.id), 400);

    this.closeModal();
  }

  private buildResourceFromWizard(): NatResource {
    return {
      id:           `custom-${Date.now()}`,
      code:          this.autoCode !== '—' ? this.autoCode : `USR-${Date.now()}`,
      name:          this.wizard.name.trim(),
      type:          this.wizard.type as NatType,
      status:       'saine',
      department:    this.wizard.department,
      // TEPAC : commune imposée par le token (le serveur la re-verrouille de toute façon).
      commune:       this.scope?.commune ?? this.wizard.commune,
      section:       this.wizard.section   || undefined,
      locality:      this.wizard.locality  || undefined,
      lat:           parseFloat(this.wizard.lat)  || undefined,
      lon:           parseFloat(this.wizard.lon)  || undefined,
      flowM3h:       this.wizard.flowM3h   ? parseFloat(this.wizard.flowM3h)   : undefined,
      flowTrend:    'stable',
      flowNote:     'stable',
      lengthKm:      this.wizard.lengthKm  ? parseFloat(this.wizard.lengthKm)  : undefined,
      areaKm2:       this.wizard.areaKm2   ? parseFloat(this.wizard.areaKm2)   : undefined,
      communesCount: this.wizard.communesCount ? parseInt(this.wizard.communesCount) : undefined,
      // TEPAC : entre dans le cycle de validation ; superviseur/admin : officielle d'office.
      validation:    this.isTepac ? 'en_attente' : 'validee',
    };
  }

  private addMarkerForResource(r: NatResource) {
    if (!r.lat || !r.lon || !this.map || typeof L === 'undefined') return;
    const icon = L.divIcon({
      html: this.markerSvg(r), className: '',
      iconSize: [30, 30], iconAnchor: [15, 15]
    });
    const m = L.marker([r.lat, r.lon], { icon })
      .addTo(this.map)
      .bindPopup(this.popupHtml(r), { maxWidth: 220, className: 'rn-leaflet-popup' });
    m.on('click', () => this.ngZone.run(() => {
      this.selectedId = r.id;
      this.scrollToItem(r.id);
    }));
    this.markers[r.id] = m;
  }

  /* ── Modal map ── */
  private initModalMap() {
    if (!this.modalMapRef?.nativeElement || typeof L === 'undefined') return;
    const lat = parseFloat(this.wizard.lat) || 18.5;
    const lon = parseFloat(this.wizard.lon) || -72.7;
    this.modalMap = L.map(this.modalMapRef.nativeElement, {
      center: [lat, lon], zoom: 10, zoomControl: false, attributionControl: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.modalMap);
    this.modalMap.on('click', (e: any) => {
      this.ngZone.run(() => {
        this.wizard.lat = e.latlng.lat.toFixed(6);
        this.wizard.lon = e.latlng.lng.toFixed(6);
        this.updateModalMarker();
      });
    });
    if (!isNaN(parseFloat(this.wizard.lat))) this.updateModalMarker();
  }

  private updateModalMarker() {
    if (!this.modalMap) return;
    const lat = parseFloat(this.wizard.lat);
    const lon = parseFloat(this.wizard.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    if (this.modalMarker) {
      this.modalMarker.setLatLng([lat, lon]);
    } else {
      this.modalMarker = L.circleMarker([lat, lon], {
        radius: 10, color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.35, weight: 2
      }).addTo(this.modalMap);
    }
    this.modalMap.panTo([lat, lon]);
  }

  onCoordChange()  { this.updateModalMarker(); }
  onDeptChange()   { this.wizard.commune = ''; this.wizard.section = ''; }

  useGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      this.ngZone.run(() => {
        this.wizard.lat = pos.coords.latitude.toFixed(6);
        this.wizard.lon = pos.coords.longitude.toFixed(6);
        this.updateModalMarker();
      });
    });
  }

  get isLatValid(): boolean {
    const v = parseFloat(this.wizard.lat);
    return !isNaN(v) && v >= 17.5 && v <= 20.5;
  }
  get isLonValid(): boolean {
    const v = parseFloat(this.wizard.lon);
    return !isNaN(v) && v >= -75 && v <= -71;
  }
  get isLatLonValid(): boolean { return this.isLatValid && this.isLonValid; }

  get availableCommunes(): string[] {
    return this.wizard.department ? (HAITI_COMMUNES[this.wizard.department] ?? []) : [];
  }
  get availableSections(): string[] {
    return this.wizard.commune ? (HAITI_SECTIONS[this.wizard.commune] ?? []) : [];
  }

  get nearbyResources(): NearbyResource[] {
    const lat = parseFloat(this.wizard.lat);
    const lon = parseFloat(this.wizard.lon);
    if (isNaN(lat) || isNaN(lon)) return [];
    return this.allData
      .filter(r => r.lat != null && r.lon != null)
      .map(r => ({ ...r, distKm: this.haversineKm(lat, lon, r.lat!, r.lon!) }))
      .filter(r => r.distKm < 5)
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 3);
  }

  private haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
    const R = 6371, d2r = Math.PI / 180;
    const dLat = (la2 - la1) * d2r, dLon = (lo2 - lo1) * d2r;
    const a = Math.sin(dLat/2)**2 + Math.cos(la1*d2r)*Math.cos(la2*d2r)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  stepSub(n: number): string {
    if (n === 1) return ({ source:'Source', riviere:'Rivière', bassin:'Bassin versant' } as any)[this.wizard.type] ?? '';
    if (n === 2) return this.wizard.commune ? `${this.wizard.commune} · ${this.wizard.department}` : '';
    if (n === 3) return this.wizard.name;
    return '';
  }

  get currentStepLabel(): string { return this.wizSteps[this.wizStep-1]?.label ?? ''; }
  get currentTip():       string { return this.WIZ_TIPS[this.wizStep] ?? ''; }

  typeFullLabel(t: '' | NatType): string {
    return ({ source:'Source naturelle', riviere:'Rivière / cours d\'eau', bassin:'Bassin versant' } as any)[t] ?? '';
  }

  get summaryItems(): { label: string; value: string }[] {
    const items: { label: string; value: string }[] = [];
    const tl = ({ source:'Source', riviere:'Rivière', bassin:'Bassin versant' } as any)[this.wizard.type] ?? '—';
    items.push({ label:'Type',          value: tl });
    items.push({ label:'Nom',           value: this.wizard.name || '—' });
    items.push({ label:'Code',          value: this.autoCode });
    items.push({ label:'Localisation',  value: [this.wizard.commune, this.wizard.section, this.wizard.department].filter(Boolean).join(' · ') || '—' });
    items.push({ label:'Coordonnées',   value: this.wizard.lat && this.wizard.lon ? `${this.wizard.lat}°N · ${this.wizard.lon}°O` : '—' });
    if (this.wizard.type === 'source'  && this.wizard.flowM3h)   items.push({ label:'Débit',       value: this.wizard.flowM3h + ' m³/h' });
    if (this.wizard.type === 'riviere' && this.wizard.lengthKm)  items.push({ label:'Longueur',    value: this.wizard.lengthKm + ' km' });
    if (this.wizard.type === 'bassin'  && this.wizard.areaKm2)   items.push({ label:'Superficie',  value: this.wizard.areaKm2 + ' km²' });
    if (this.wizard.orepa)             items.push({ label:'OREPA',        value: this.wizard.orepa });
    if (this.wizard.gestionnaire)      items.push({ label:'Gestionnaire', value: this.wizard.gestionnaire });
    return items;
  }

  get autoCode(): string {
    if (!this.wizard.type || !this.wizard.commune) return '—';
    const p  = ({ source:'SRC', riviere:'RIV', bassin:'BV' } as any)[this.wizard.type];
    const cc = this.wizard.commune.toUpperCase().replace(/[^A-Z]/g,'').substring(0,4);
    const n  = String(this.allData.length + 1).padStart(3,'0');
    return `${p}-${cc}-${n}`;
  }

  /* ── DRAWER ─────────────────────────────────────────────────── */
  get drawerResource(): NatResource | null {
    if (!this.drawerResourceId) return null;
    return this.allData.find(r => r.id === this.drawerResourceId) ?? null;
  }

  get drawerIndex(): number {
    return this.allData.findIndex(r => r.id === this.drawerResourceId);
  }

  get drawerLinkedInfra(): Array<{ name: string; code: string; status: 'operationnel' | 'degrade' }> {
    if (!this.drawerResourceId) return [];
    const conns = GestidloStore.getC1ForResource(this.drawerResourceId);
    if (conns.length) {
      return conns.map(c => ({
        name:   c.toLabel ?? c.toId,
        code:   String(c.meta?.['code'] ?? ''),
        status: (c.meta?.['status'] === 'operationnel' ? 'operationnel' : 'degrade') as 'operationnel' | 'degrade',
      }));
    }
    return this.DR_INFRA[this.drawerResourceId] ?? [];
  }

  /** C6 — Bassin versant auquel appartient cette ressource */
  get drawerBassin(): { label: string; areaKm2?: number } | null {
    if (!this.drawerResourceId) return null;
    const conn = GestidloStore.getC6ForResource(this.drawerResourceId);
    if (!conn) return null;
    return {
      label:   conn.toLabel ?? conn.toId,
      areaKm2: conn.meta?.['areaKm2'] ? Number(conn.meta['areaKm2']) : undefined,
    };
  }

  /** C5 — Capteurs IoT surveillant cette ressource */
  get drawerC5Sensors(): Array<{ code: string; label: string; value: string; unit: string; sub: string; warn?: boolean }> {
    if (!this.drawerResourceId) return [];
    return GestidloStore.getC5ForEntity(this.drawerResourceId).map(c => ({
      code:  c.fromId,
      label: c.fromLabel ?? c.fromId,
      value: String(c.meta?.['value'] ?? '—'),
      unit:  String(c.meta?.['unit']  ?? ''),
      sub:   String(c.meta?.['sub']   ?? ''),
      warn:  Boolean(c.meta?.['warn']),
    }));
  }

  /** C4 — Institution régulatrice de cette ressource */
  get drawerC4Regulator(): string {
    if (!this.drawerResourceId) return '';
    const conn = GestidloStore.getC4ForEntity(this.drawerResourceId)
      .find(c => c.meta?.['role'] === 'regulator');
    return conn?.fromLabel ?? '';
  }

  get drawerCrossLinks(): NatResource[] {
    if (!this.drawerResourceId) return [];
    const ids = this.DR_CROSSLINKS[this.drawerResourceId] ?? [];
    return ids.map(id => this.allData.find(r => r.id === id)).filter(Boolean) as NatResource[];
  }

  get drawerStatusColor(): string {
    const r = this.drawerResource;
    if (!r) return '#34D399';
    return r.status === 'saine' ? '#34D399' : r.status === 'menacee' ? '#FBBF24' : '#F87171';
  }

  get drawerHeaderGradient(): string {
    const r = this.drawerResource;
    if (!r) return 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(59,130,246,0.08))';
    if (r.type === 'riviere') return 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.04))';
    if (r.type === 'bassin')  return 'linear-gradient(135deg,rgba(165,164,220,0.12),rgba(59,130,246,0.04))';
    return 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(59,130,246,0.06))';
  }

  openDrawer(id: string) {
    if (this.drawerMap) { this.drawerMap.remove(); this.drawerMap = null; }
    this.drawerResourceId = id;
    this.drawerTab = 'overview';
    const r = this.allData.find(x => x.id === id);
    if (r?.lat && r?.lon) this._drawerMapNeedsInit = true;
  }

  closeDrawer() {
    this.drawerResourceId = null;
    if (this.drawerMap) { this.drawerMap.remove(); this.drawerMap = null; }
    this._drawerMapNeedsInit = false;
  }

  drawerPrev() {
    const idx = this.drawerIndex;
    if (idx > 0) this.openDrawer(this.allData[idx - 1].id);
  }

  drawerNext() {
    const idx = this.drawerIndex;
    if (idx < this.allData.length - 1) this.openDrawer(this.allData[idx + 1].id);
  }

  setDrawerTab(tab: string) {
    this.drawerTab = tab;
    if (tab === 'overview') {
      const r = this.drawerResource;
      if (r?.lat && r?.lon && !this.drawerMap) this._drawerMapNeedsInit = true;
    }
  }

  private initDrawerMap() {
    if (!this.drawerMapRef?.nativeElement || typeof L === 'undefined') return;
    const r = this.drawerResource;
    if (!r?.lat || !r?.lon) return;
    this.drawerMap = L.map(this.drawerMapRef.nativeElement, {
      center: [r.lat, r.lon], zoom: 13, zoomControl: true, attributionControl: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.drawerMap);
    const icon = L.divIcon({ html: this.markerSvg(r), className: '', iconSize: [30,30], iconAnchor: [15,15] });
    L.marker([r.lat, r.lon], { icon }).addTo(this.drawerMap);
  }

  formatDMS(deg: number, type: 'lat' | 'lon'): string {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(1);
    const dir = type === 'lat' ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'O');
    return `${d}°${m}'${s}"${dir}`;
  }

  orepaForDept(dept: string): string {
    const map: Record<string, string> = {
      'Ouest': 'DINEPA / OREPA Ouest', 'Nord': 'OREPA Nord',
      'Nord-Est': 'DINEPA Nord-Est', 'Nord-Ouest': 'OREPA Nord-Ouest',
      'Artibonite': 'OREPA Nord-Artibonite', 'Centre': 'OREPA Centre',
      'Sud': 'DINEPA Sud', 'Sud-Est': 'DINEPA Sud-Est',
      "Grand'Anse": "DINEPA Grand'Anse", 'Nippes': 'DINEPA Nippes',
    };
    return map[dept] ?? 'DINEPA';
  }

  drawerTypeIconLarge(t: NatType): string {
    if (t === 'source') return `
      <svg viewBox="0 0 30 30" width="26" height="26">
        <polygon points="15,4 26,23 4,23" fill="#34D399" stroke="rgba(52,211,153,0.4)" stroke-width="1"/>
      </svg>`;
    if (t === 'riviere') return `
      <svg viewBox="0 0 30 30" width="26" height="26">
        <path d="M3,15 Q9,7 15,15 Q21,23 27,15" fill="none" stroke="#60A5FA" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
    return `
      <svg viewBox="0 0 30 30" width="26" height="26">
        <ellipse cx="15" cy="15" rx="13" ry="8" fill="rgba(52,211,153,0.15)" stroke="#34D399" stroke-width="1.5" stroke-dasharray="3,2"/>
        <circle cx="15" cy="15" r="4" fill="#34D399"/>
      </svg>`;
  }

  copyCoords() {
    const r = this.drawerResource;
    if (!r?.lat || !r?.lon) return;
    navigator.clipboard?.writeText(`${r.lat}, ${r.lon}`).catch(() => {});
  }

  openGoogleMaps() {
    const r = this.drawerResource;
    if (!r?.lat || !r?.lon) return;
    window.open(`https://www.google.com/maps?q=${r.lat},${r.lon}`, '_blank');
  }
}

import { Component, AfterViewInit, AfterViewChecked, OnDestroy, OnInit, ElementRef, ViewChild, NgZone, Input, Output, EventEmitter } from '@angular/core';
import { DEPT_BOUNDS } from '../haiti-geo.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GestidloStore } from '../gestidlo-store';
import { BffApiService, OuvrageDto } from '../api/bff-api.service';
import { catchError, of } from 'rxjs';

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

type InfraType   = 'captage' | 'forage' | 'puits' | 'pompage' | 'traitement' | 'reservoir' | 'reseau' | 'borne';
type InfraStatus = 'operationnel' | 'maintenance' | 'panne' | 'vetuste';
type InfraCat    = 'all' | 'captage' | 'forage' | 'station' | 'reservoir' | 'reseau';

/** Cycle de validation (recensement TEPAC → décision superviseur). Absent ⇒ ouvrage officiel. */
export type InfraValidation = 'en_attente' | 'validee' | 'rejetee';

export interface InfraItem {
  id: string; code: string; name: string;
  type: InfraType; status: InfraStatus;
  department: string; commune: string;
  section?: string; locality?: string;
  lat?: number; lon?: number;
  capaciteM3h?: number; anneeConstruction?: number;
  resourceId?: string; resourceName?: string; notes?: string;
  /** Cycle de validation. Absent ⇒ ouvrage officiel de référence (seed). */
  validation?: InfraValidation;
  createdBy?: string; motifRejet?: string;
  /** Provenance : `true` = catalogue de référence front (INFRA_DATA), ignoré en vue commune (TEPAC). */
  seed?: boolean;
}

function typeToCat(t: InfraType): InfraCat {
  if (t === 'captage')  return 'captage';
  if (t === 'forage' || t === 'puits') return 'forage';
  if (t === 'pompage' || t === 'traitement') return 'station';
  if (t === 'reservoir') return 'reservoir';
  return 'reseau';
}

// 16 items · capacity sum = 1 850 m³/h · 13 opérationnel (81%) · avg age ≈ 23 ans
export const INFRA_DATA: InfraItem[] = [
  { id:'if-01', code:'CAP-BBLEU-01', name:'Captage Bassin Bleu',
    type:'captage', status:'operationnel', department:'Sud-Est', commune:'Jacmel',
    section:'Section 3', lat:18.234, lon:-72.534, capaciteM3h:30, anneeConstruction:2015,
    resourceId:'rs-01', resourceName:'Source Bassin Bleu' },

  { id:'if-02', code:'PUMP-JAC-02', name:'Station Pompage Jacmel',
    type:'pompage', status:'operationnel', department:'Sud-Est', commune:'Jacmel',
    lat:18.238, lon:-72.528, capaciteM3h:50, anneeConstruction:2007 },

  { id:'if-03', code:'STA-JAC-T01', name:'Station Traitement Jacmel',
    type:'traitement', status:'operationnel', department:'Sud-Est', commune:'Jacmel',
    lat:18.236, lon:-72.526, anneeConstruction:2019, notes:'Chloration continue' },

  { id:'if-04', code:'TANK-JAC-R02', name:'Réservoir Jacmel R02',
    type:'reservoir', status:'operationnel', department:'Sud-Est', commune:'Jacmel',
    lat:18.235, lon:-72.523, capaciteM3h:200, anneeConstruction:1998 },

  { id:'if-05', code:'CAP-FERM-01', name:'Captage Fermathe',
    type:'captage', status:'operationnel', department:'Ouest', commune:'Pétion-Ville',
    section:'Section 1', lat:18.483, lon:-72.318, capaciteM3h:42, anneeConstruction:2006,
    resourceId:'rs-02', resourceName:'Source Fermathe' },

  { id:'if-06', code:'TANK-PV-R03', name:"Château d'eau Pétion-Ville",
    type:'reservoir', status:'vetuste', department:'Ouest', commune:'Pétion-Ville',
    lat:18.477, lon:-72.292, capaciteM3h:500, anneeConstruction:1982,
    notes:'Rénovation prévue 2026 — 43 ans' },

  { id:'if-07', code:'F-CIT-12', name:'Forage Cité-Soleil F-12',
    type:'forage', status:'operationnel', department:'Ouest', commune:'Cité-Soleil',
    lat:18.558, lon:-72.342, capaciteM3h:28, anneeConstruction:2019 },

  { id:'if-08', code:'F-CAR-08', name:'Forage Carrefour F-08',
    type:'forage', status:'panne', department:'Ouest', commune:'Carrefour',
    lat:18.537, lon:-72.404, capaciteM3h:35, anneeConstruction:2012,
    notes:'Pompe HS — intervention requise' },

  { id:'if-09', code:'CAP-MOM-01', name:'Prise Momance',
    type:'captage', status:'operationnel', department:'Ouest', commune:'Léogâne',
    lat:18.491, lon:-72.642, capaciteM3h:156, anneeConstruction:2001,
    resourceId:'rs-11', resourceName:'Rivière Momance' },

  { id:'if-10', code:'P-BEL-01', name:'Puits Bel-Air',
    type:'puits', status:'operationnel', department:'Sud-Est', commune:'Jacmel',
    lat:18.241, lon:-72.527, capaciteM3h:15, anneeConstruction:2014 },

  { id:'if-11', code:'CAP-CAP-01', name:'Captage La Plaine',
    type:'captage', status:'operationnel', department:'Nord', commune:'Cap-Haïtien',
    lat:19.757, lon:-72.201, capaciteM3h:30, anneeConstruction:2016,
    resourceId:'rs-05', resourceName:'Source La Plaine' },

  { id:'if-12', code:'TANK-CAP-R01', name:'Réservoir Cap-Haïtien',
    type:'reservoir', status:'operationnel', department:'Nord', commune:'Cap-Haïtien',
    lat:19.754, lon:-72.198, capaciteM3h:300, anneeConstruction:2016 },

  { id:'if-13', code:'STA-PEL-01', name:'Station Péligre',
    type:'traitement', status:'maintenance', department:'Artibonite', commune:'Dessalines',
    lat:19.100, lon:-72.700, capaciteM3h:464, anneeConstruction:1956,
    resourceId:'rs-12', resourceName:'Rivière Artibonite',
    notes:'Maintenance turbines · inspection OREPA' },

  { id:'if-14', code:'NET-LEO-01', name:'Réseau AEP Léogâne',
    type:'reseau', status:'operationnel', department:'Ouest', commune:'Léogâne',
    lat:18.512, lon:-72.637, anneeConstruction:2009 },

  { id:'if-15', code:'P-ARC-01', name:'Puits Arcahaie',
    type:'puits', status:'operationnel', department:'Ouest', commune:'Arcahaie',
    lat:18.774, lon:-72.530, anneeConstruction:1978,
    notes:'Puits artésien historique' },

  { id:'if-16', code:'BF-CAP-01', name:'Bornes-fontaines Cap-Haïtien',
    type:'borne', status:'operationnel', department:'Nord', commune:'Cap-Haïtien',
    lat:19.760, lon:-72.202, anneeConstruction:1995 },
];

const CY = 2026;

interface WizDraft {
  type: InfraType | ''; name: string; code: string; status: InfraStatus; notes: string;
  lat: string; lon: string; altitude: string;
  department: string; commune: string; section: string; adresse: string;
  capaciteM3h: string; anneeConstruction: string; profondeur: string;
  resourceId: string; resourceName: string;
}

interface ChainNode {
  kind: 'resource' | 'infra' | 'usagers';
  code: string; name: string; type?: InfraType;
  color: string; isCurrent?: boolean; households?: number;
}
interface MaintEvent {
  date: string; title: string; by: string;
  kind: 'preventive' | 'corrective' | 'planned'; cost?: string;
}
interface IotSensor {
  code: string; label: string; value: string; unit: string; sub: string; color: string; warn?: boolean;
}
interface InfraDetail {
  model?: string; hmt?: string; power?: string; lifespan?: number; serviceDate?: string;
  realFlow?: number; realFlowPct?: number;
  owner: string; operator: string; funder?: string; fundYear?: number; fundAmount?: string;
  hoursPerDay?: string; households?: number; persons?: number;
  sensors?: IotSensor[]; events?: MaintEvent[];
}

@Component({
  selector: 'app-infrastructures-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="in-shell" [class.in-shell--embedded]="!!scope">

  <!-- Corps de page masqué en mode overlay : seul le wizard s'affiche par-dessus la carte. -->
  <ng-container *ngIf="!overlayMode">

  <!-- ═══ BREADCRUMB (hidden when embedded) ═══ -->
  <div class="in-bc" *ngIf="!scope">
    <a routerLink="/dashboard" class="in-bc__home">
      <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
      </svg>
      Accueil
    </a>
    <svg viewBox="0 0 20 20" width="10" height="10" fill="currentColor" class="in-bc__sep"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
    <span>Supervision</span>
    <svg viewBox="0 0 20 20" width="10" height="10" fill="currentColor" class="in-bc__sep"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
    <span class="in-bc__current">Infrastructures</span>
    <span class="in-bc__stats">{{ allData.length }} ouvrages · capacité {{ formatFlow(totalCapacity) }} m³/h · couverture 18% des communes</span>
  </div>

  <!-- ═══ SCOPED HEADER (embedded in URD detail) ═══ -->
  <div *ngIf="scope" class="in-scope-header">
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    <span>Vue scopée · {{ scope.commune ? 'commune ' + scope.commune : 'département ' + scope.dept }}</span>
    <span class="in-scope-count">{{ allData.length }} ouvrage{{ allData.length !== 1 ? 's' : '' }}</span>
    <button class="in-btn in-btn--amber" style="margin-left:auto" type="button" (click)="openAddModal()">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      {{ isTepac ? 'Soumettre une infrastructure' : 'Enregistrer · ' + scope.dept }}
    </button>
  </div>

  <!-- ═══ HEADER (standalone page) ═══ -->
  <div class="in-header" *ngIf="!scope">
    <div class="in-header__left">
      <div class="in-header__icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FBBF24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div>
        <div class="in-header__title-row">
          <h2 class="in-header__title">Infrastructures hydrauliques</h2>
          <span class="in-header__badge">PATRIMOINE BÂTI</span>
        </div>
        <p class="in-header__sub">Captages · forages · puits · stations · réservoirs · réseaux — les ouvrages construits pour exploiter l'eau</p>
      </div>
    </div>
    <div class="in-header__actions">
      <button class="in-btn in-btn--ghost" type="button">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5M12 5v12"/></svg>
        Importer
      </button>
      <button class="in-btn in-btn--ghost" type="button">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5 5-5-5M12 13V3"/></svg>
        Exporter
      </button>
      <button class="in-btn in-btn--amber" type="button" (click)="openAddModal()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Enregistrer un ouvrage
      </button>
    </div>
  </div>

  <!-- ═══ KPIs ═══ -->
  <div class="in-kpis">

    <div class="in-kpi in-kpi--amber">
      <div class="in-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="1.7" stroke-linecap="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>Parc total</span>
      </div>
      <div class="in-kpi__val">
        <span class="in-kpi__big">{{ allData.length }}</span>
        <span class="in-kpi__trend in-kpi__trend--up">+3 ce mois</span>
      </div>
      <div class="in-kpi__sub">{{ captages.length }} captages · {{ foragesPuits.length }} forages/puits · {{ reservoirs.length }} réservoirs</div>
    </div>

    <div class="in-kpi in-kpi--green">
      <div class="in-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#34D399" stroke-width="1.7" stroke-linecap="round">
          <path d="M2 12h2l3-7 4 14 3-7 3 5 2-5h3"/>
        </svg>
        <span>Taux de fonctionnement</span>
      </div>
      <div class="in-kpi__val">
        <span class="in-kpi__big in-kpi__big--green">{{ tauxFonctionnement }}%</span>
        <span class="in-kpi__unit">{{ operationnels.length }}/{{ allData.length }}</span>
      </div>
      <div class="in-kpi__sub in-kpi__sub--warn">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        {{ maintenances.length }} maintenance · {{ pannes.length }} panne{{ pannes.length > 1 ? 's' : '' }}
      </div>
    </div>

    <div class="in-kpi in-kpi--blue">
      <div class="in-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#60A5FA" stroke-width="1.7" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>
        </svg>
        <span>Capacité installée</span>
      </div>
      <div class="in-kpi__val">
        <span class="in-kpi__big in-kpi__big--blue">{{ formatFlow(totalCapacity) }}</span>
        <span class="in-kpi__unit">m³/h</span>
      </div>
      <div class="in-kpi__sub">
        réelle <span style="color:#F87171">62%</span> · pertes réseau élevées
      </div>
    </div>

    <div class="in-kpi in-kpi--red">
      <div class="in-kpi__top">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#F87171" stroke-width="1.7" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Vétusté du parc</span>
      </div>
      <div class="in-kpi__val">
        <span class="in-kpi__big in-kpi__big--red">{{ avgAge }}</span>
        <span class="in-kpi__unit">ans moy.</span>
      </div>
      <div class="in-kpi__sub in-kpi__sub--red">{{ vetusteItems.length }} ouvrages &gt; 40 ans · à rénover</div>
    </div>

  </div><!-- /in-kpis -->

  <!-- ═══ FILTER BAR ═══ -->
  <div class="in-filters">
    <div class="in-search">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#6B7785" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" placeholder="Rechercher forage, réservoir, code…"
             [(ngModel)]="searchTerm" (ngModelChange)="onSearch()"/>
    </div>
    <div class="in-sep"></div>

    <span class="in-filter-lbl">Catégorie</span>
    <button class="in-chip" [class.in-chip--amber]="catFilter==='all'" type="button" (click)="setCatFilter('all')">
      Toutes <span class="in-chip__count">{{ allData.length }}</span>
    </button>
    <button class="in-chip" [class.in-chip--amber]="catFilter==='captage'" type="button" (click)="setCatFilter('captage')">
      <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="#F59E0B" rx="1"/></svg>
      Captages <span class="in-chip__count">{{ captages.length }}</span>
    </button>
    <button class="in-chip" [class.in-chip--amber]="catFilter==='forage'" type="button" (click)="setCatFilter('forage')">
      <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="#A5A4DC"/></svg>
      Forages/puits <span class="in-chip__count">{{ foragesPuits.length }}</span>
    </button>
    <button class="in-chip" [class.in-chip--amber]="catFilter==='station'" type="button" (click)="setCatFilter('station')">
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><polygon points="5,1 9,9 1,9" fill="#06B6D4"/></svg>
      Stations <span class="in-chip__count">{{ stations.length }}</span>
    </button>
    <button class="in-chip" [class.in-chip--amber]="catFilter==='reservoir'" type="button" (click)="setCatFilter('reservoir')">
      <svg viewBox="0 0 10 10" width="8" height="10" aria-hidden="true"><rect x="2" y="0" width="6" height="10" fill="#60A5FA" rx="1"/></svg>
      Réservoirs <span class="in-chip__count">{{ reservoirs.length }}</span>
    </button>
    <button class="in-chip" [class.in-chip--amber]="catFilter==='reseau'" type="button" (click)="setCatFilter('reseau')">
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M1,5 Q3,1 5,5 Q7,9 9,5" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"/></svg>
      Réseaux <span class="in-chip__count">{{ reseaux.length }}</span>
    </button>

    <div class="in-sep"></div>
    <span class="in-filter-lbl">État</span>

    <button class="in-chip in-chip--op" [class.in-chip--op-active]="statusFilter==='operationnel'"
            type="button" (click)="setStatusFilter('operationnel')">
      <span class="in-dot in-dot--green"></span>
      Opérationnel <span class="in-chip__count">{{ operationnels.length }}</span>
    </button>
    <button class="in-chip in-chip--maint" [class.in-chip--maint-active]="statusFilter==='maintenance'"
            type="button" (click)="setStatusFilter('maintenance')">
      <span class="in-dot in-dot--amber"></span>
      Maintenance <span class="in-chip__count">{{ maintenances.length }}</span>
    </button>
    <button class="in-chip in-chip--panne" [class.in-chip--panne-active]="statusFilter==='panne'"
            type="button" (click)="setStatusFilter('panne')">
      <span class="in-dot in-dot--red"></span>
      Panne <span class="in-chip__count">{{ pannes.length }}</span>
    </button>
    <button class="in-chip in-chip--vet" [class.in-chip--vet-active]="statusFilter==='vetuste'"
            type="button" (click)="setStatusFilter('vetuste')">
      <span class="in-dot in-dot--grey"></span>
      Vétuste <span class="in-chip__count">{{ vetusteItems.length }}</span>
    </button>

    <!-- Cycle de validation : visible dès qu'on est scopé (TEPAC suit ses soumissions, superviseur sa file). -->
    <ng-container *ngIf="scope">
      <span class="in-filter-lbl">Validation</span>
      <button class="in-chip" [class.in-chip--amber]="validationFilter==='en_attente'"
              type="button" (click)="setValidationFilter('en_attente')">
        <span class="in-dot in-dot--amber"></span>
        En attente <span class="in-chip__count">{{ enAttente.length }}</span>
      </button>
      <button class="in-chip" [class.in-chip--amber]="validationFilter==='validee'"
              type="button" (click)="setValidationFilter('validee')">
        <span class="in-dot in-dot--green"></span>
        Validées <span class="in-chip__count">{{ validees.length }}</span>
      </button>
      <button class="in-chip" [class.in-chip--amber]="validationFilter==='rejetee'"
              type="button" (click)="setValidationFilter('rejetee')">
        <span class="in-dot in-dot--red"></span>
        Rejetées <span class="in-chip__count">{{ rejetees.length }}</span>
      </button>
    </ng-container>
  </div>

  <!-- ═══ SPLIT LAYOUT ═══ -->
  <div class="in-split">

    <!-- MAP CARD -->
    <div class="in-map-card">
      <div class="in-card-head">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
        <span class="in-card-head__title">Carte du patrimoine bâti AEP</span>
        <span class="in-card-head__meta">{{ filtered.length }} ouvrages · OpenStreetMap · CNIGS</span>
        <div class="in-sync-badge">
          <span class="in-sync-dot"></span>
          Sync temps réel
        </div>
      </div>

      <div class="in-map-wrap">
        <div #ifMap class="in-map-el"></div>
        <div class="in-map-zoom">
          <button type="button" (click)="zoomIn()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" (click)="zoomOut()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" (click)="recenter()">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
          </button>
          <button type="button" (click)="toggleChain()" [class.in-map-zoom-chain--active]="chainView"
                  title="Afficher la chaîne d'exploitation">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/><path d="M12 3v14M8 7l4-4 4 4"/></svg>
          </button>
        </div>
      </div>

      <div class="in-card-foot in-card-foot--map">
        <span class="in-legend-item"><svg viewBox="0 0 10 10" width="9" height="9"><rect x="1" y="1" width="8" height="8" fill="#F59E0B" rx="1"/></svg> Captage</span>
        <span class="in-legend-item"><svg viewBox="0 0 10 10" width="9" height="9"><circle cx="5" cy="5" r="4" fill="#A5A4DC"/></svg> Forage/Puits</span>
        <span class="in-legend-item"><svg viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" fill="#F59E0B"/></svg> Pompage</span>
        <span class="in-legend-item"><svg viewBox="0 0 10 10" width="10" height="10"><polygon points="5,1 9,9 1,9" fill="#06B6D4"/></svg> Traitement</span>
        <span class="in-legend-item"><svg viewBox="0 0 8 10" width="7" height="9"><rect x="0" y="0" width="8" height="10" fill="#60A5FA" rx="1"/></svg> Réservoir</span>
        <span class="in-legend-item"><svg viewBox="0 0 12 4" width="13" height="4"><path d="M1,2 L11,2" stroke="#34D399" stroke-width="2" stroke-dasharray="2,2"/></svg> Conduite/Réseau</span>
        <span class="in-legend-tip">Cliquez un ouvrage pour voir la fiche</span>
      </div>
    </div>

    <!-- LIST CARD -->
    <div class="in-list-card">
      <div class="in-card-head">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span class="in-card-head__title">Liste synchronisée</span>
        <span class="in-card-head__count">{{ filtered.length }} ouvrages</span>
      </div>

      <div class="in-list-body" #listContainer>
        <div class="in-list-item"
             *ngFor="let item of listItems; trackBy: trackByCode"
             [attr.data-if-id]="item.id"
             [class.in-list-item--panne]="item.status==='panne' && item.id!==selectedId"
             [class.in-list-item--maint]="item.status==='maintenance' && item.id!==selectedId"
             [class.in-list-item--vet]="item.status==='vetuste' && item.id!==selectedId"
             [class.in-list-item--selected]="item.id===selectedId"
             (click)="onListItemClick(item)">
          <div class="in-list-item__head">
            <span class="in-type-icon" [innerHTML]="typeIcon(item.type)"></span>
            <span class="in-list-item__name">{{ item.name }}</span>
            <span class="in-badge"
                  [class.in-badge--op]="item.status==='operationnel'"
                  [class.in-badge--maint]="item.status==='maintenance'"
                  [class.in-badge--panne]="item.status==='panne'"
                  [class.in-badge--vet]="item.status==='vetuste'">
              {{ statusLabel(item.status) }}
            </span>
          </div>
          <div class="in-list-item__sub">{{ subText(item) }}</div>
          <div class="in-list-item__code">
            {{ item.code }}<span *ngIf="item.resourceName"> → {{ item.resourceName }}</span>
          </div>
          <div class="in-list-item__notes" *ngIf="item.notes && item.status !== 'operationnel'">{{ item.notes }}</div>

          <!-- Statut de validation (uniquement pour les ouvrages entrés dans le cycle) -->
          <div class="in-val-row" *ngIf="item.validation && item.validation !== 'validee'"
               [class.in-val-row--wait]="item.validation==='en_attente'"
               [class.in-val-row--rej]="item.validation==='rejetee'">
            <span class="in-val-tag">{{ validationLabel(item.validation) }}</span>
            <span class="in-val-by" *ngIf="item.validation==='en_attente' && item.createdBy">soumis par {{ item.createdBy }}</span>
            <span class="in-val-by" *ngIf="item.validation==='rejetee' && item.motifRejet">{{ item.motifRejet }}</span>
          </div>

          <!-- Actions de validation : superviseur uniquement, sur les soumissions en attente -->
          <div class="in-val-actions" *ngIf="canValidate && item.validation==='en_attente'">
            <button class="in-btn in-btn--ok" type="button" (click)="validerInfra(item, $event)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Valider
            </button>
            <button class="in-btn in-btn--ko" type="button" (click)="rejeterInfra(item, $event)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Rejeter
            </button>
          </div>
        </div>

        <div class="in-list-more" *ngIf="!showAll && filtered.length > 7" (click)="showAll=true">
          Voir les {{ filtered.length - 7 }} ouvrages suivants →
        </div>
        <div class="in-list-more" *ngIf="showAll && filtered.length > 7" (click)="showAll=false">
          Réduire la liste ↑
        </div>
        <div class="in-list-empty" *ngIf="filtered.length === 0">
          Aucun ouvrage ne correspond à la recherche.
        </div>
      </div>

      <div class="in-list-foot">
        <button class="in-btn in-btn--amber in-btn--full" type="button" (click)="openAddModal()">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ isTepac ? 'Soumettre une infrastructure' : 'Enregistrer sur la carte' }}
        </button>
      </div>
    </div>

  </div><!-- /in-split -->

  <!-- ═══ CHAIN BANNER ═══ -->
  <div class="in-chain-banner">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#60A5FA" stroke-width="1.7" stroke-linecap="round">
      <path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/>
      <path d="M12 3v14M8 7l4-4 4 4"/>
    </svg>
    <div class="in-chain-banner__text">
      <strong class="in-chain-banner__strong">Chaîne d'exploitation :</strong>
      chaque infrastructure remonte à une ressource naturelle et descend vers des usagers.
      Activez la vue chaîne sur la carte pour visualiser les flux
      Source → Captage → Pompage → Réservoir → Réseau → Bornes-fontaines.
    </div>
    <button class="in-btn in-btn--ghost" type="button" (click)="toggleChain()">Voir la chaîne →</button>
  </div>

  <!-- ═══ PERSISTENCE BANNER ═══ -->
  <div class="in-banner">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FBBF24" stroke-width="1.7" stroke-linecap="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/>
      <line x1="15" y1="17" x2="19" y2="17"/><line x1="17" y1="15" x2="17" y2="19"/>
    </svg>
    <div class="in-banner__text">
      <strong class="in-banner__strong">Persistance permanente :</strong>
      chaque ouvrage enregistré est sauvegardé définitivement avec sa géolocalisation,
      son historique de maintenance et ses liens vers les ressources qu'il exploite.
      Visible sur la carte et dans le tableau immédiatement.
    </div>
  </div>

  <!-- ═══ DRAWER DÉTAIL INFRASTRUCTURE ═══ -->
  <div class="dif-overlay" *ngIf="drawerInfraId" (click)="closeDrawer()">
  <div class="dif-panel" *ngIf="drawerInfra" (click)="$event.stopPropagation()">

    <!-- HEADER -->
    <div class="dif-head">
      <div class="dif-head__top">
        <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0">
          <!-- TYPE ICON -->
          <div class="dif-head__icon">
            <span [innerHTML]="typeIcon(drawerInfra.type)" style="transform:scale(1.6);display:flex"></span>
            <span class="dif-head__status-dot"
                  [class.dif-dot--green]="drawerInfra.status==='operationnel'"
                  [class.dif-dot--amber]="drawerInfra.status==='maintenance'"
                  [class.dif-dot--red]="drawerInfra.status==='panne'"
                  [class.dif-dot--grey]="drawerInfra.status==='vetuste'">
              <svg *ngIf="drawerInfra.status==='operationnel'" viewBox="0 0 12 12" width="8" height="8"><polyline points="2 6 5 9 10 3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
            </span>
          </div>
          <!-- TITLE BLOCK -->
          <div style="flex:1;min-width:0">
            <div class="dif-head__badges">
              <span class="dif-code-chip">{{drawerInfra.code}}</span>
              <span class="dif-type-badge">{{typeFullLabel(drawerInfra.type)}}</span>
              <span class="dif-status-badge"
                    [class.dif-status--op]="drawerInfra.status==='operationnel'"
                    [class.dif-status--maint]="drawerInfra.status==='maintenance'"
                    [class.dif-status--panne]="drawerInfra.status==='panne'"
                    [class.dif-status--vet]="drawerInfra.status==='vetuste'">
                <span class="dif-pulse-dot"
                      [class.dif-pulse-dot--green]="drawerInfra.status==='operationnel'"
                      [class.dif-pulse-dot--amber]="drawerInfra.status==='maintenance'"
                      [class.dif-pulse-dot--red]="drawerInfra.status==='panne'"
                      [class.dif-pulse-dot--grey]="drawerInfra.status==='vetuste'"></span>
                {{statusLabel(drawerInfra.status)}}
              </span>
              <span class="dif-age" *ngIf="drawerInfra.anneeConstruction">{{2026 - drawerInfra.anneeConstruction}} ans d'âge</span>
            </div>
            <h3 class="dif-head__name">{{drawerInfra.name}}</h3>
            <p class="dif-head__loc">
              {{drawerInfra.commune}}<span *ngIf="drawerInfra.section"> · {{drawerInfra.section}}</span> · {{drawerInfra.department}}
              <span *ngIf="drawerInfra.lat && drawerInfra.lon"> ·
                <span class="dif-dms">{{formatDMS(drawerInfra.lat,'lat')}} · {{formatDMS(drawerInfra.lon,'lon')}}</span>
              </span>
            </p>
          </div>
        </div>
        <!-- NAV + CLOSE -->
        <div class="dif-nav">
          <button class="dif-nav-btn" type="button" (click)="drawerPrev()" [disabled]="drawerIndex===0">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="dif-nav-pos">{{drawerIndex+1}} / {{allData.length}}</span>
          <button class="dif-nav-btn" type="button" (click)="drawerNext()" [disabled]="drawerIndex===allData.length-1">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="dif-nav-btn" type="button" (click)="closeDrawer()">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <!-- ACTION BUTTONS -->
      <div class="dif-actions">
        <button class="dif-act dif-act--amber" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          Maintenance
        </button>
        <button class="dif-act dif-act--ghost" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Inspecter
        </button>
        <button class="dif-act dif-act--ghost" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Modifier
        </button>
        <button class="dif-act dif-act--ghost" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/></svg>
          Capteur IoT
        </button>
        <button class="dif-act dif-act--ghost" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Photo
        </button>
        <button class="dif-act dif-act--ghost" type="button">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Exporter
        </button>
      </div>
    </div>

    <!-- TABS -->
    <div class="dif-tabs">
      <span class="dif-tab" [class.dif-tab--active]="drawerTab==='overview'" (click)="drawerTab='overview'">Vue d'ensemble</span>
      <span class="dif-tab" [class.dif-tab--active]="drawerTab==='chain'"    (click)="drawerTab='chain'">Chaîne d'exploitation</span>
      <span class="dif-tab" [class.dif-tab--active]="drawerTab==='maint'"    (click)="drawerTab='maint'">Maintenance
        <span class="dif-tab-badge dif-tab-badge--amber" *ngIf="drawerDetail?.events?.length">{{drawerDetail?.events?.length}}</span>
      </span>
      <span class="dif-tab" [class.dif-tab--active]="drawerTab==='iot'"     (click)="drawerTab='iot'">Capteurs IoT
        <span class="dif-tab-badge dif-tab-badge--blue" *ngIf="drawerDetail?.sensors?.length">{{drawerDetail?.sensors?.length}}</span>
      </span>
      <span class="dif-tab" [class.dif-tab--active]="drawerTab==='docs'"    (click)="drawerTab='docs'">Documents</span>
    </div>

    <!-- BODY -->
    <div class="dif-body">

      <!-- ── VUE D'ENSEMBLE ── -->
      <div *ngIf="drawerTab==='overview'">

        <!-- C7 — ALERTES ACTIVES EN AMONT -->
        <div *ngIf="drawerC7Alerts.length" style="
          display:flex;flex-direction:column;gap:6px;
          margin-bottom:12px;padding:10px 14px;
          background:rgba(248,113,113,0.06);
          border:1px solid rgba(248,113,113,0.3);
          border-left:3px solid #F87171;
          border-radius:8px;font-size:11px">
          <div style="display:flex;align-items:center;gap:6px;color:#F87171;font-weight:600">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {{drawerC7Alerts.length}} alerte(s) propagée(s) en amont
          </div>
          <div *ngFor="let a of drawerC7Alerts" style="display:flex;gap:8px;color:#E2E8EE">
            <span style="font-family:monospace;color:#FBBF24;font-size:10px">{{a.alertId}}</span>
            <span style="color:#94A3B8">{{a.from}}</span>
            <span style="margin-left:auto;color:#94A3B8;font-size:10px">depuis {{a.since}}</span>
          </div>
        </div>

        <!-- CHAIN BLOCK -->
        <div class="dif-section">
          <div class="dif-section-head">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/><path d="M12 3v14M8 7l4-4 4 4"/></svg>
            <span>Chaîne d'exploitation complète</span>
            <span class="dif-section-meta">de la ressource au robinet</span>
          </div>
          <div class="dif-chain-scroll">
            <div class="dif-chain-flow">
              <ng-container *ngFor="let n of drawerChain; let i=index; let last=last">
                <div class="dif-chain-node"
                     [class.dif-chain-node--current]="n.isCurrent"
                     [style.border-color]="n.isCurrent ? n.color : n.color + '55'"
                     [style.background]="n.isCurrent ? n.color + '18' : 'transparent'">
                  <div class="dif-chain-node__badge" [style.color]="n.color">{{chainKindLabel(n)}}</div>
                  <div class="dif-chain-node__code" *ngIf="n.code" [style.color]="n.color">{{n.code}}</div>
                  <div class="dif-chain-node__name">{{n.name}}</div>
                  <div class="dif-chain-node__here" *ngIf="n.isCurrent">VOUS ÊTES ICI</div>
                  <div class="dif-chain-node__hh" *ngIf="n.kind==='usagers' && n.households">~{{n.households}} foyers</div>
                </div>
                <div class="dif-chain-arrow" *ngIf="!last">
                  <svg viewBox="0 0 24 10" width="24" height="10"><path d="M0,5 L20,5 M16,1 L20,5 L16,9" fill="none" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
              </ng-container>
            </div>
          </div>
          <div class="dif-impact" *ngIf="drawerImpactText">
            <strong class="dif-impact__label">Impact de cet ouvrage :</strong> {{drawerImpactText}}
          </div>
        </div>

        <!-- TECH + GOVERNANCE 2-col -->
        <div class="dif-grid2">

          <div class="dif-card">
            <div class="dif-card-head">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
              <span>Caractéristiques techniques</span>
            </div>
            <div class="dif-kv-grid">
              <div class="dif-kv" *ngIf="drawerDetail?.model">
                <div class="dif-kv__k">Modèle / type</div>
                <div class="dif-kv__v" style="color:#FBBF24">{{drawerDetail?.model}}</div>
              </div>
              <div class="dif-kv" *ngIf="drawerInfra.capaciteM3h">
                <div class="dif-kv__k">Capacité installée</div>
                <div class="dif-kv__v" style="color:#60A5FA">{{drawerInfra.capaciteM3h}} m³/h</div>
              </div>
              <div class="dif-kv" *ngIf="drawerDetail?.realFlow !== undefined">
                <div class="dif-kv__k">Débit réel actuel</div>
                <div class="dif-kv__v" style="color:#FBBF24">{{drawerDetail?.realFlow}} m³/h<span *ngIf="drawerDetail?.realFlowPct"> ({{drawerDetail?.realFlowPct}}%)</span></div>
              </div>
              <div class="dif-kv" *ngIf="drawerDetail?.hmt">
                <div class="dif-kv__k">HMT (hauteur manométrique)</div>
                <div class="dif-kv__v">{{drawerDetail?.hmt}}</div>
              </div>
              <div class="dif-kv" *ngIf="drawerDetail?.power">
                <div class="dif-kv__k">Puissance installée</div>
                <div class="dif-kv__v">{{drawerDetail?.power}}</div>
              </div>
              <div class="dif-kv" *ngIf="drawerDetail?.serviceDate">
                <div class="dif-kv__k">Mise en service</div>
                <div class="dif-kv__v">{{drawerDetail?.serviceDate}}<span *ngIf="drawerInfra.anneeConstruction"> · {{2026 - drawerInfra.anneeConstruction}} ans</span></div>
              </div>
              <div class="dif-kv" *ngIf="drawerDetail?.lifespan">
                <div class="dif-kv__k">Durée de vie estimée</div>
                <div class="dif-kv__v">{{drawerDetail?.lifespan}} ans<span *ngIf="drawerInfra.anneeConstruction && drawerDetail?.lifespan"> · reste {{(drawerDetail!.lifespan! - (2026 - drawerInfra.anneeConstruction!))}} ans</span></div>
              </div>
              <div class="dif-kv" *ngIf="drawerInfra.notes">
                <div class="dif-kv__k">Observations</div>
                <div class="dif-kv__v" style="color:#FBBF24">{{drawerInfra.notes}}</div>
              </div>
            </div>
          </div>

          <div class="dif-card">
            <div class="dif-card-head">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#A5A4DC" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Gouvernance &amp; exploitation</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:11px">
              <div>
                <div class="dif-kv__k">Propriétaire</div>
                <div style="color:#A5A4DC;font-weight:500;margin-top:2px">{{drawerDetail?.owner ?? 'DINEPA'}}</div>
              </div>
              <div>
                <div class="dif-kv__k">Exploitant</div>
                <div style="color:#A5A4DC;font-weight:500;margin-top:2px">{{drawerDetail?.operator}}</div>
              </div>
              <div *ngIf="drawerDetail?.funder">
                <div class="dif-kv__k">Bailleur initial</div>
                <div style="margin-top:2px">{{drawerDetail?.funder}}<span *ngIf="drawerDetail?.fundYear"> · {{drawerDetail?.fundYear}}</span><span *ngIf="drawerDetail?.fundAmount"> · {{drawerDetail?.fundAmount}}</span></div>
              </div>
              <div *ngIf="drawerDetail?.hoursPerDay">
                <div class="dif-kv__k">Heures de fonctionnement</div>
                <div style="margin-top:2px">{{drawerDetail?.hoursPerDay}}</div>
              </div>
              <div *ngIf="drawerDetail?.households">
                <div class="dif-kv__k">Foyers desservis</div>
                <div style="margin-top:2px">~{{drawerDetail?.households}} foyers · ~{{drawerDetail?.persons}} personnes</div>
              </div>
            </div>
          </div>

        </div><!-- /dif-grid2 -->

        <!-- IoT SENSORS -->
        <div class="dif-section" *ngIf="drawerDetail?.sensors?.length">
          <div class="dif-section-head">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/></svg>
            <span>Surveillance IoT en temps réel</span>
            <span class="dif-section-meta dif-meta-green">
              <span class="dif-live-dot"></span>
              {{drawerDetail?.sensors?.length}} capteurs actifs · sync il y a 8s
            </span>
          </div>
          <div class="dif-sensors">
            <div class="dif-sensor" *ngFor="let s of drawerDetail?.sensors"
                 [style.border-color]="s.warn ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.25)'">
              <div class="dif-sensor__head" [style.color]="s.color">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span class="dif-sensor__code">{{s.code}}</span>
              </div>
              <div class="dif-sensor__val">
                <span class="dif-sensor__num" [style.color]="s.color">{{s.value}}</span>
                <span class="dif-sensor__unit">{{s.unit}}</span>
              </div>
              <div class="dif-sensor__label">{{s.label}}</div>
              <div class="dif-sensor__sub" [style.color]="s.warn ? '#FBBF24' : '#6B7785'">{{s.sub}}</div>
            </div>
          </div>
        </div>

        <!-- MAINTENANCE EVENTS -->
        <div class="dif-section" *ngIf="drawerDetail?.events?.length">
          <div class="dif-section-head">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
            <span>Maintenance · derniers événements</span>
            <span class="dif-section-meta">{{drawerDetail?.events?.length}} interventions</span>
          </div>
          <div class="dif-maint-list">
            <div class="dif-maint-row" *ngFor="let ev of drawerDetail?.events"
                 [class.dif-maint-row--planned]="ev.kind==='planned'">
              <div class="dif-maint-date"
                   [style.color]="ev.kind==='preventive' ? '#34D399' : ev.kind==='corrective' ? '#FBBF24' : '#94A3B8'">
                {{ev.date}}
              </div>
              <div class="dif-maint-info">
                <div class="dif-maint-title">{{ev.title}}</div>
                <div class="dif-maint-by">{{ev.by}}<span *ngIf="ev.cost"> · {{ev.cost}}</span></div>
              </div>
              <span class="dif-maint-badge"
                    [class.dif-maint-badge--prev]="ev.kind==='preventive'"
                    [class.dif-maint-badge--corr]="ev.kind==='corrective'"
                    [class.dif-maint-badge--plan]="ev.kind==='planned'">
                {{ev.kind==='preventive' ? 'Préventive' : ev.kind==='corrective' ? 'Corrective' : 'Prévue'}}
              </span>
            </div>
          </div>
        </div>

        <!-- CROSS-LINKS -->
        <div class="dif-section dif-section--last">
          <div class="dif-section-head">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#8B9AAB" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            <span>Liaisons croisées</span>
          </div>
          <div class="dif-chips">
            <span class="dif-chip dif-chip--green" *ngIf="drawerInfra.resourceName">
              <svg viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" fill="#34D399"/></svg>
              {{drawerInfra.resourceName}}
            </span>
            <span class="dif-chip dif-chip--purple">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              {{drawerDetail?.operator ?? 'OREPA'}}
            </span>
            <span class="dif-chip dif-chip--blue" *ngIf="drawerDetail?.sensors?.length">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
              {{drawerDetail?.sensors?.length}} capteurs IoT
            </span>
            <ng-container *ngFor="let n of drawerChain">
              <span class="dif-chip dif-chip--amber" *ngIf="n.kind==='infra' && !n.isCurrent" (click)="openDrawerByCode(n.code)">
                <span [innerHTML]="typeIcon(n.type!)" style="display:inline-flex;align-items:center"></span>
                {{n.code}}
              </span>
            </ng-container>
            <span class="dif-chip dif-chip--amber" *ngIf="drawerDetail?.events?.length">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
              {{drawerDetail?.events?.length}} interventions
            </span>
            <span class="dif-chip dif-chip--purple" *ngIf="drawerUsagers.households > 0">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              {{drawerUsagers.households}} foyers desservis
            </span>
          </div>
        </div>

      </div><!-- /overview -->

      <!-- ── CHAÎNE ── -->
      <div *ngIf="drawerTab==='chain'" class="dif-placeholder">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#2A3744" stroke-width="1.5" stroke-linecap="round"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/><path d="M12 3v14M8 7l4-4 4 4"/></svg>
        <div>Vue chaîne d'exploitation détaillée</div>
        <div class="dif-placeholder__sub">Visualisation complète Source → Captage → Traitement → Réservoir → Usagers avec débits en temps réel.</div>
      </div>

      <!-- ── MAINTENANCE ── -->
      <div *ngIf="drawerTab==='maint'" class="dif-placeholder">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#2A3744" stroke-width="1.5" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        <div>Historique maintenance complet</div>
        <div class="dif-placeholder__sub">{{drawerDetail?.events?.length ?? 0}} interventions enregistrées · planification prochaines visites · coûts cumulés.</div>
      </div>

      <!-- ── IoT ── -->
      <div *ngIf="drawerTab==='iot'" class="dif-placeholder">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#2A3744" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/></svg>
        <div>Télémétrie IoT</div>
        <div class="dif-placeholder__sub">{{drawerDetail?.sensors?.length ?? 0}} capteurs · courbes temps réel · seuils d'alerte · historique 30 jours.</div>
      </div>

      <!-- ── DOCUMENTS ── -->
      <div *ngIf="drawerTab==='docs'" class="dif-placeholder">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#2A3744" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div>Documents techniques</div>
        <div class="dif-placeholder__sub">Plans, certificats de conformité, rapports d'inspection, photos terrain.</div>
      </div>

    </div><!-- /dif-body -->
  </div><!-- /dif-panel -->
  </div><!-- /dif-overlay -->

  </ng-container><!-- /corps masqué en overlay -->

  <!-- ═══ MODAL WIZARD ═══ -->
  <div class="wz-overlay" *ngIf="showModal" (click)="closeModal()">
  <div class="wz-modal" (click)="$event.stopPropagation()">

    <!-- HEADER -->
    <div class="wz-head">
      <div class="wz-head__icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FBBF24" stroke-width="1.6" stroke-linecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div>
        <h3 class="wz-head__title">Enregistrer un nouvel ouvrage</h3>
        <p class="wz-head__sub">Ajout au patrimoine bâti d'Haïti · liaison avec une ressource naturelle</p>
      </div>
      <span class="wz-saved-chip" *ngIf="wizDraftSaved">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Brouillon sauvegardé
      </span>
      <button class="wz-close" type="button" (click)="closeModal()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- STEP BAR -->
    <div class="wz-steps">
      <ng-container *ngFor="let s of WIZ_STEPS; let i=index">
        <div class="wz-step"
             [class.wz-step--done]="wizStep > i+1"
             [class.wz-step--active]="wizStep === i+1">
          <div class="wz-step__dot">
            <svg *ngIf="wizStep > i+1" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span *ngIf="wizStep <= i+1">{{i+1}}</span>
          </div>
          <div>
            <div class="wz-step__label">{{s.label}}</div>
            <div class="wz-step__sub" *ngIf="wizStep > i+1">{{wizStepDoneSub(i)}}</div>
            <div class="wz-step__sub wz-step__sub--cur" *ngIf="wizStep === i+1">en cours</div>
          </div>
        </div>
        <div class="wz-step__line" *ngIf="i < 5" [class.wz-step__line--done]="wizStep > i+1"></div>
      </ng-container>
    </div>

    <!-- BODY -->
    <div class="wz-body">

      <!-- MAIN AREA -->
      <div class="wz-main">

        <!-- ── STEP 1: CATÉGORIE ── -->
        <div *ngIf="wizStep===1">
          <div class="wz-section-title">Choisir la catégorie d'ouvrage</div>
          <p class="wz-section-sub">Sélectionnez le type d'infrastructure hydraulique que vous souhaitez enregistrer.</p>
          <div class="wz-type-grid">
            <button class="wz-type-card" *ngFor="let c of wizTypeCards()"
                    [class.wz-type-card--sel]="wizDraft.type === c.type"
                    type="button" (click)="wizSelectType(c.type)">
              <div class="wz-type-card__icon" [innerHTML]="typeIcon(c.type)"></div>
              <div class="wz-type-card__label">{{c.label}}</div>
              <div class="wz-type-card__desc">{{c.desc}}</div>
            </button>
          </div>
          <div class="wz-warn" *ngIf="!wizDraft.type">Sélectionnez un type pour continuer.</div>
        </div>

        <!-- ── STEP 2: IDENTITÉ ── -->
        <div *ngIf="wizStep===2">
          <div class="wz-section-title">Identité de l'ouvrage</div>
          <p class="wz-section-sub">Donnez un nom descriptif et un code unique à l'ouvrage.</p>
          <div class="wz-field">
            <label class="wz-label">Nom de l'ouvrage <span class="wz-req">*</span></label>
            <input class="wz-input" type="text" placeholder="Ex : Captage Bassin Bleu, Forage Cité-Soleil F-12…"
                   [(ngModel)]="wizDraft.name"/>
          </div>
          <div class="wz-row2">
            <div class="wz-field">
              <label class="wz-label">Code <span class="wz-req">*</span></label>
              <div style="display:flex;gap:6px">
                <input class="wz-input wz-input--mono" type="text" placeholder="CAP-JAC-01"
                       [(ngModel)]="wizDraft.code" style="flex:1"/>
                <button class="wz-btn wz-btn--ghost wz-btn--sm" type="button" (click)="wizAutoCode()">Auto</button>
              </div>
            </div>
            <div class="wz-field">
              <label class="wz-label">État initial</label>
              <select class="wz-select" [(ngModel)]="wizDraft.status">
                <option value="operationnel">Opérationnel</option>
                <option value="maintenance">En maintenance</option>
                <option value="panne">En panne</option>
                <option value="vetuste">Vétuste</option>
              </select>
            </div>
          </div>
          <div class="wz-field">
            <label class="wz-label">Notes (facultatif)</label>
            <textarea class="wz-textarea" rows="3" placeholder="Observations, contexte…"
                      [(ngModel)]="wizDraft.notes"></textarea>
          </div>
          <div class="wz-warn" *ngIf="!wizDraft.name">Le nom est obligatoire.</div>
        </div>

        <!-- ── STEP 3: LOCALISATION ── -->
        <div *ngIf="wizStep===3">
          <div class="wz-section-title">Localiser l'ouvrage</div>
          <p class="wz-section-sub">Position GPS exacte · détection automatique des ouvrages voisins</p>

          <div class="wz-card wz-card--loc">
            <div class="wz-loc-toolbar">
              <button class="wz-btn wz-btn--amber-outline wz-btn--sm" type="button">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                Position actuelle
              </button>
              <button class="wz-btn wz-btn--ghost wz-btn--sm" type="button">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Cliquer carte
              </button>
              <button class="wz-btn wz-btn--ghost wz-btn--sm" type="button">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Photo géoloc.
              </button>
              <span class="wz-loc-valid" *ngIf="wizLocValid">
                <span class="wz-loc-dot"></span> Position validée
              </span>
            </div>
            <div #wizMapEl class="wz-mini-map"></div>
            <div class="wz-row3" style="margin-top:10px">
              <div class="wz-field">
                <label class="wz-label">Latitude <span class="wz-req">*</span></label>
                <input class="wz-input wz-input--mono" [class.wz-input--amber]="wizLocValid" type="text"
                       placeholder="18.234890" [(ngModel)]="wizDraft.lat" (ngModelChange)="wizUpdateCoords()"/>
              </div>
              <div class="wz-field">
                <label class="wz-label">Longitude <span class="wz-req">*</span></label>
                <input class="wz-input wz-input--mono" [class.wz-input--amber]="wizLocValid" type="text"
                       placeholder="-72.517980" [(ngModel)]="wizDraft.lon" (ngModelChange)="wizUpdateCoords()"/>
              </div>
              <div class="wz-field">
                <label class="wz-label">Altitude (m)</label>
                <input class="wz-input wz-input--mono" type="text" placeholder="375"
                       [(ngModel)]="wizDraft.altitude"/>
              </div>
            </div>
          </div>

          <div class="wz-card" style="margin-top:10px">
            <div class="wz-card-head">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#A5A4DC" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Découpage administratif</span>
              <span class="wz-auto-tag">auto-détecté</span>
            </div>
            <div class="wz-row3">
              <div class="wz-field">
                <label class="wz-label">Département <span class="wz-req">*</span></label>
                <ng-container *ngIf="scope?.dept; else deptSelectTpl">
                  <div class="wz-input wz-input--green" style="display:flex;align-items:center;gap:6px;cursor:default;opacity:.85">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    {{ scope!.dept }} · verrouillé
                  </div>
                </ng-container>
                <ng-template #deptSelectTpl>
                  <select class="wz-select" [class.wz-select--green]="!!wizDraft.department" [(ngModel)]="wizDraft.department">
                    <option value="">— Choisir</option>
                    <option *ngFor="let d of DEPTS" [value]="d">{{d}}</option>
                  </select>
                </ng-template>
              </div>
              <div class="wz-field">
                <label class="wz-label">Commune <span class="wz-req">*</span></label>
                <!-- TEPAC : commune verrouillée sur la sienne (périmètre du JWT). -->
                <ng-container *ngIf="scope?.commune; else communeInputTpl">
                  <div class="wz-input wz-input--green" style="display:flex;align-items:center;gap:6px;cursor:default;opacity:.85">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    {{ scope!.commune }} · verrouillé
                  </div>
                </ng-container>
                <ng-template #communeInputTpl>
                  <input class="wz-input" [class.wz-input--green]="!!wizDraft.commune" type="text"
                         placeholder="Jacmel" [(ngModel)]="wizDraft.commune"/>
                </ng-template>
              </div>
              <div class="wz-field">
                <label class="wz-label">Section</label>
                <input class="wz-input" [class.wz-input--green]="!!wizDraft.section" type="text"
                       placeholder="Section 3" [(ngModel)]="wizDraft.section"/>
              </div>
            </div>
            <div class="wz-field" style="margin-top:8px">
              <label class="wz-label">Adresse / Lieu-dit</label>
              <input class="wz-input" type="text" placeholder="Près du captage, Route nationale 2…"
                     [(ngModel)]="wizDraft.adresse"/>
            </div>
          </div>

          <div class="wz-nearby" *ngIf="wizNearby.length > 0">
            <div class="wz-nearby__head">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              Ouvrages voisins détectés (à 500 m)
            </div>
            <div class="wz-nearby__info">Cette position est proche d'ouvrages existants — une connexion peut être établie.</div>
            <div class="wz-nearby__item" *ngFor="let nb of wizNearby">
              <span class="in-type-icon" [innerHTML]="typeIcon(nb.type)"></span>
              <div class="wz-nearby__item-info">
                <div>{{nb.code}} — {{nb.name}}</div>
                <div class="wz-nearby__item-meta">{{nb.commune}} · {{statusLabel(nb.status)}}</div>
              </div>
              <button class="wz-btn wz-btn--green-outline wz-btn--sm" type="button" (click)="wizLinkNearby(nb)">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                Connecter
              </button>
            </div>
          </div>
        </div>

        <!-- ── STEP 4: TECHNIQUE ── -->
        <div *ngIf="wizStep===4">
          <div class="wz-section-title">Caractéristiques techniques</div>
          <p class="wz-section-sub">Paramètres dimensionnants de l'ouvrage.</p>
          <div class="wz-row2">
            <div class="wz-field">
              <label class="wz-label">Capacité (m³/h)</label>
              <input class="wz-input wz-input--mono" type="number" min="0" placeholder="Ex : 50"
                     [(ngModel)]="wizDraft.capaciteM3h"/>
            </div>
            <div class="wz-field">
              <label class="wz-label">Année de construction</label>
              <input class="wz-input wz-input--mono" type="number" min="1900" max="2026" placeholder="Ex : 2008"
                     [(ngModel)]="wizDraft.anneeConstruction"/>
            </div>
          </div>
          <div class="wz-field" *ngIf="wizDraft.type==='forage' || wizDraft.type==='puits'">
            <label class="wz-label">Profondeur (m)</label>
            <input class="wz-input wz-input--mono" type="number" min="0" placeholder="Ex : 45"
                   [(ngModel)]="wizDraft.profondeur"/>
          </div>
          <div class="wz-info-box">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            La capacité sera intégrée au calcul de la capacité installée nationale (actuellement <strong style="color:#60A5FA">{{ formatFlow(totalCapacity) }} m³/h</strong>).
          </div>
        </div>

        <!-- ── STEP 5: LIAISON RESSOURCE ── -->
        <div *ngIf="wizStep===5">
          <div class="wz-section-title">Liaison avec une ressource naturelle</div>
          <p class="wz-section-sub">Indiquez la ressource (source, rivière, aquifère) exploitée par cet ouvrage.</p>

          <div class="wz-card" *ngIf="wizDraft.resourceId" style="margin-bottom:12px;border-color:rgba(16,185,129,0.4)">
            <div style="display:flex;align-items:center;gap:8px">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style="font-size:11px;color:#34D399;font-weight:600">Ressource sélectionnée</span>
              <button class="wz-btn wz-btn--ghost wz-btn--sm" type="button" (click)="wizClearResource()" style="margin-left:auto">
                Changer
              </button>
            </div>
            <div style="margin-top:6px;font-size:12px;color:#F5F7FA;font-weight:500">{{wizDraft.resourceName}}</div>
            <div style="font-size:10px;color:#8B9AAB;margin-top:2px">ID : {{wizDraft.resourceId}}</div>
          </div>

          <div *ngIf="!wizDraft.resourceId">
            <div class="wz-field" style="margin-bottom:10px">
              <input class="wz-input" type="text" placeholder="Rechercher par nom, commune, département…"
                     [(ngModel)]="wizResourceSearch"/>
            </div>
            <div class="wz-res-list">
              <div class="wz-res-item" *ngFor="let r of wizFilteredResources" (click)="wizSelectResource(r)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#60A5FA" stroke-width="1.7" stroke-linecap="round">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
                  <path d="M2 12s4-5 10-5 10 5 10 5-4 5-10 5-10-5-10-5z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <div style="flex:1">
                  <div class="wz-res-item__name">{{r.name}}</div>
                  <div class="wz-res-item__meta">{{r.commune}} · {{r.dept}} · {{r.type}}</div>
                </div>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#4B5563" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
            <button class="wz-btn wz-btn--ghost wz-btn--sm" type="button" style="margin-top:8px" (click)="wizDraft.resourceId='none';wizDraft.resourceName='Aucune liaison'">
              Aucune liaison (ouvrage autonome)
            </button>
          </div>
        </div>

        <!-- ── STEP 6: VALIDATION ── -->
        <div *ngIf="wizStep===6">
          <div class="wz-section-title">Validation et enregistrement</div>
          <p class="wz-section-sub">Vérifiez les informations avant d'enregistrer l'ouvrage dans le patrimoine bâti.</p>
          <div class="wz-validation-card">
            <div class="wz-val-row">
              <span class="wz-val-key">Type</span>
              <span class="wz-val-val">
                <span class="in-type-icon" [innerHTML]="wizTypeIcon"></span>
                {{wizTypeLabel}}
              </span>
            </div>
            <div class="wz-val-row">
              <span class="wz-val-key">Nom</span>
              <span class="wz-val-val" style="font-weight:600">{{wizDraft.name || '—'}}</span>
            </div>
            <div class="wz-val-row">
              <span class="wz-val-key">Code</span>
              <span class="wz-val-val wz-val-val--mono">{{wizDraft.code || '—'}}</span>
            </div>
            <div class="wz-val-row">
              <span class="wz-val-key">État</span>
              <span class="in-badge"
                    [class.in-badge--op]="wizDraft.status==='operationnel'"
                    [class.in-badge--maint]="wizDraft.status==='maintenance'"
                    [class.in-badge--panne]="wizDraft.status==='panne'"
                    [class.in-badge--vet]="wizDraft.status==='vetuste'">
                {{statusLabel(wizDraft.status)}}
              </span>
            </div>
            <div class="wz-val-row" *ngIf="wizDraft.commune">
              <span class="wz-val-key">Localisation</span>
              <span class="wz-val-val">{{wizDraft.commune}}<span *ngIf="wizDraft.department"> · {{wizDraft.department}}</span></span>
            </div>
            <div class="wz-val-row" *ngIf="wizDraft.lat">
              <span class="wz-val-key">Coordonnées</span>
              <span class="wz-val-val wz-val-val--mono">{{wizDraft.lat}}°N · {{wizDraft.lon}}°O</span>
            </div>
            <div class="wz-val-row" *ngIf="wizDraft.capaciteM3h">
              <span class="wz-val-key">Capacité</span>
              <span class="wz-val-val">{{wizDraft.capaciteM3h}} m³/h</span>
            </div>
            <div class="wz-val-row" *ngIf="wizDraft.anneeConstruction">
              <span class="wz-val-key">Construction</span>
              <span class="wz-val-val">{{wizDraft.anneeConstruction}} · {{2026 - (+wizDraft.anneeConstruction)}} ans</span>
            </div>
            <div class="wz-val-row" *ngIf="wizDraft.resourceName && wizDraft.resourceId !== 'none'">
              <span class="wz-val-key">Ressource liée</span>
              <span class="wz-val-val" style="color:#34D399">{{wizDraft.resourceName}}</span>
            </div>
            <div class="wz-val-row" *ngIf="wizDraft.notes">
              <span class="wz-val-key">Notes</span>
              <span class="wz-val-val" style="color:#8B9AAB;font-style:italic">{{wizDraft.notes}}</span>
            </div>
          </div>
          <div class="wz-info-box wz-info-box--amber" style="margin-top:12px">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/></svg>
            L'ouvrage sera enregistré <strong style="color:#FBBF24">définitivement</strong> avec géolocalisation, code unique et liaison ressource. Il apparaîtra immédiatement sur la carte.
          </div>
        </div>

      </div><!-- /wz-main -->

      <!-- SIDEBAR -->
      <div class="wz-sidebar">

        <!-- Aperçu -->
        <div class="wz-sidebar-section">
          <div class="wz-sidebar-title">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Aperçu ouvrage
          </div>
          <div class="wz-preview">
            <div class="wz-preview__head">
              <span class="in-type-icon" *ngIf="wizDraft.type" [innerHTML]="wizTypeIcon"></span>
              <div style="flex:1">
                <div class="wz-preview__type">{{wizTypeLabel}}</div>
                <div class="wz-preview__code">{{wizDraft.code || '—'}}</div>
              </div>
            </div>
            <div class="wz-preview__name" *ngIf="wizDraft.name">{{wizDraft.name}}</div>
            <div class="wz-preview__loc" *ngIf="wizDraft.commune || wizDraft.lat">
              <span *ngIf="wizDraft.commune">{{wizDraft.commune}}<span *ngIf="wizDraft.section"> · {{wizDraft.section}}</span></span>
              <span *ngIf="wizDraft.lat"> · {{wizDraft.lat}}°N</span>
            </div>
          </div>
        </div>

        <!-- Progression -->
        <div class="wz-sidebar-section">
          <div class="wz-sidebar-title">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            Progression
          </div>
          <div class="wz-progress">
            <div class="wz-prog-item" *ngFor="let s of WIZ_STEPS; let i=index"
                 [class.wz-prog-item--done]="wizStep > i+1"
                 [class.wz-prog-item--cur]="wizStep === i+1">
              <svg *ngIf="wizStep > i+1" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10" fill="rgba(16,185,129,0.15)"/><polyline points="9 12 11 14 15 10"/></svg>
              <svg *ngIf="wizStep === i+1" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <svg *ngIf="wizStep < i+1" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#4B5563" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg>
              <span>{{s.label}}<span *ngIf="wizStep > i+1 && wizStepDoneSub(i)" style="color:#6B7785"> · {{wizStepDoneSub(i)}}</span></span>
            </div>
          </div>
        </div>

        <!-- Info contextuelle -->
        <div class="wz-sidebar-section">
          <div class="wz-sidebar-title">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Important
          </div>
          <div class="wz-info-box">
            <ng-container *ngIf="wizStep===1">Chaque ouvrage est catégorisé selon sa fonction dans la chaîne d'exploitation AEP.</ng-container>
            <ng-container *ngIf="wizStep===2">Le code doit être <strong style="color:#FBBF24">unique</strong> dans le système. Utilisez le bouton Auto pour générer un code conforme à la nomenclature.</ng-container>
            <ng-container *ngIf="wizStep===3">La géolocalisation permet la détection automatique des ouvrages de la même chaîne d'exploitation.</ng-container>
            <ng-container *ngIf="wizStep===4">La capacité installée alimente le KPI national (<strong style="color:#FBBF24">{{ formatFlow(totalCapacity) }} m³/h</strong> actuellement).</ng-container>
            <ng-container *ngIf="wizStep===5 && (wizDraft.type==='pompage' || wizDraft.type==='captage')">Un <strong style="color:#FBBF24">{{wizTypeLabel}}</strong> doit toujours être connecté à une ressource naturelle (source, rivière ou aquifère).</ng-container>
            <ng-container *ngIf="wizStep===5 && wizDraft.type!=='pompage' && wizDraft.type!=='captage'">La liaison ressource est recommandée mais facultative pour un {{wizTypeLabelFallback}}.</ng-container>
            <ng-container *ngIf="wizStep===6">Après enregistrement, l'ouvrage est <strong style="color:#FBBF24">permanent</strong> dans le système. Vous pourrez modifier ses données depuis la fiche détail.</ng-container>
          </div>
        </div>

      </div><!-- /wz-sidebar -->

    </div><!-- /wz-body -->

    <!-- FOOTER -->
    <div class="wz-foot">
      <div class="wz-foot__left">
        <span>Étape {{wizStep}} / 6 · {{WIZ_STEPS[wizStep-1].label}}</span>
        <div class="wz-foot__sep"></div>
        <span class="wz-foot__autosave" *ngIf="wizDraftSaved">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Sauvegardé automatiquement
        </span>
      </div>
      <div class="wz-foot__right">
        <button class="wz-btn wz-btn--ghost" type="button" (click)="closeModal()">Annuler</button>
        <button class="wz-btn wz-btn--ghost" type="button" *ngIf="wizStep > 1" (click)="wizPrev()">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Précédent
        </button>
        <button class="wz-btn wz-btn--amber" type="button" (click)="wizNext()"
                [disabled]="(wizStep===1 && !wizDraft.type) || (wizStep===2 && !wizDraft.name)">
          <span *ngIf="wizStep < 6">Continuer <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:inline-block;vertical-align:middle"><polyline points="9 18 15 12 9 6"/></svg></span>
          <span *ngIf="wizStep===6">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:inline-block;vertical-align:middle"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {{ isTepac ? 'Soumettre au superviseur' : "Enregistrer l'ouvrage" }}
          </span>
        </button>
      </div>
    </div>

  </div><!-- /wz-modal -->
  </div><!-- /wz-overlay -->

</div><!-- /in-shell -->
`,
  styles: [`
    /* ═══════════════════════════════════════════════
       SHELL
    ═══════════════════════════════════════════════ */
    .in-shell {
      display: flex; flex-direction: column; gap: 14px;
      padding: 16px 20px 24px;
      min-height: 100%;
      background: #0F1419; color: #E2E8EE;
      font-family: -apple-system, system-ui, sans-serif;
    }

    /* ═══════════════════════════════════════════════
       BREADCRUMB
    ═══════════════════════════════════════════════ */
    .in-bc {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #8B9AAB;
    }
    .in-bc__home {
      display: flex; align-items: center; gap: 4px;
      color: #60A5FA; text-decoration: none; cursor: pointer;
    }
    .in-bc__home:hover { color: #93C5FD; }
    .in-bc__sep { color: #4B5563; flex-shrink: 0; }
    .in-bc__current { color: #F5F7FA; font-weight: 500; }
    .in-bc__stats { margin-left: auto; font-size: 10px; color: #6B7785; }

    /* ═══════════════════════════════════════════════
       HEADER
    ═══════════════════════════════════════════════ */
    .in-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; flex-wrap: wrap;
    }
    .in-header__left { display: flex; align-items: center; gap: 10px; }
    .in-header__icon {
      width: 38px; height: 38px; flex-shrink: 0;
      background: rgba(245,158,11,0.15); border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .in-header__title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .in-header__title { margin: 0; font-size: 18px; color: #F5F7FA; font-weight: 500; }
    .in-header__badge {
      font-size: 9px; padding: 2px 8px;
      background: rgba(245,158,11,0.15); color: #FBBF24;
      border: 1px solid rgba(245,158,11,0.3);
      border-radius: 999px; font-weight: 500; letter-spacing: 0.5px;
    }
    .in-header__sub { margin: 2px 0 0; font-size: 12px; color: #8B9AAB; }
    .in-header__actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    /* ═══════════════════════════════════════════════
       BUTTONS
    ═══════════════════════════════════════════════ */
    .in-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; padding: 6px 10px; border-radius: 6px;
      cursor: pointer; border: none; font-weight: 500; transition: opacity .15s;
    }
    .in-btn:hover { opacity: .85; }
    .in-btn--ghost { background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1; }
    .in-btn--amber {
      background: #F59E0B; border: 1px solid #F59E0B; color: #0F1419; font-weight: 600;
    }
    .in-btn--full { width: 100%; justify-content: center; padding: 7px; }

    /* ═══════════════════════════════════════════════
       KPIs
    ═══════════════════════════════════════════════ */
    .in-kpis {
      display: grid; grid-template-columns: repeat(4,1fr); gap: 12px;
    }
    @media (max-width: 900px) { .in-kpis { grid-template-columns: repeat(2,1fr); } }

    .in-kpi {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 8px; padding: 14px;
    }
    .in-kpi--amber { border-left: 3px solid #F59E0B; }
    .in-kpi--green { border-left: 3px solid #10B981; }
    .in-kpi--blue  { border-left: 3px solid #3B82F6; }
    .in-kpi--red   { border-left: 3px solid #EF4444; }

    .in-kpi__top {
      display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
      font-size: 10px; color: #8B9AAB; text-transform: uppercase;
      letter-spacing: 0.5px; font-weight: 500;
    }
    .in-kpi__val { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
    .in-kpi__big { font-size: 26px; color: #F5F7FA; font-weight: 600; }
    .in-kpi__big--green  { color: #34D399; }
    .in-kpi__big--blue   { color: #60A5FA; }
    .in-kpi__big--red    { color: #F87171; }
    .in-kpi__unit  { font-size: 11px; color: #8B9AAB; }
    .in-kpi__trend { font-size: 11px; }
    .in-kpi__trend--up { color: #34D399; }
    .in-kpi__sub { font-size: 10px; color: #6B7785; display: flex; align-items: center; gap: 4px; }
    .in-kpi__sub--warn { color: #FBBF24; }
    .in-kpi__sub--red  { color: #F87171; }

    /* ═══════════════════════════════════════════════
       FILTER BAR
    ═══════════════════════════════════════════════ */
    .in-filters {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 10px; padding: 10px 14px;
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .in-search {
      display: flex; align-items: center; gap: 6px;
      background: #0F1419; border: 1px solid #2A3744;
      border-radius: 6px; padding: 5px 10px; min-width: 220px;
    }
    .in-search input {
      background: transparent; border: none; outline: none;
      color: #E2E8EE; font-size: 11px; flex: 1; min-width: 0;
    }
    .in-search input::placeholder { color: #6B7785; }
    .in-sep { width: 1px; height: 20px; background: #2A3744; flex-shrink: 0; }
    .in-filter-lbl {
      font-size: 10px; color: #6B7785; text-transform: uppercase;
      letter-spacing: 0.5px; white-space: nowrap;
    }

    .in-chip {
      display: inline-flex; align-items: center; gap: 4px; font-size: 11px;
      padding: 4px 10px; background: #1A2530; color: #CBD5E1;
      border: 1px solid #2A3744; border-radius: 999px;
      cursor: pointer; transition: all .15s; white-space: nowrap;
    }
    .in-chip:hover { border-color: #3B4A5A; }
    .in-chip__count { opacity: .65; }
    .in-chip--amber { background: rgba(245,158,11,0.15); color: #FBBF24; border-color: rgba(245,158,11,0.3); }

    .in-chip--op      { background: #1A2530; color: #CBD5E1; border-color: #2A3744; }
    .in-chip--op-active { background: rgba(16,185,129,0.15); color: #34D399; border-color: rgba(16,185,129,0.4); }
    .in-chip--maint   { background: rgba(245,158,11,0.1); color: #FBBF24; border-color: rgba(245,158,11,0.3); }
    .in-chip--maint-active { background: rgba(245,158,11,0.25); color: #FBBF24; border-color: rgba(245,158,11,0.6); }
    .in-chip--panne   { background: #1A2530; color: #CBD5E1; border-color: #2A3744; }
    .in-chip--panne-active { background: rgba(239,68,68,0.15); color: #F87171; border-color: rgba(239,68,68,0.4); }
    .in-chip--vet     { background: #1A2530; color: #CBD5E1; border-color: #2A3744; }
    .in-chip--vet-active { background: rgba(148,163,184,0.15); color: #94A3B8; border-color: rgba(148,163,184,0.4); }

    .in-dot {
      width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0;
    }
    .in-dot--green { background: #10B981; }
    .in-dot--amber { background: #F59E0B; }
    .in-dot--red   { background: #EF4444; }
    .in-dot--grey  { background: #94A3B8; }

    /* ═══════════════════════════════════════════════
       SPLIT LAYOUT
    ═══════════════════════════════════════════════ */
    .in-split {
      display: grid; grid-template-columns: 1fr 360px; gap: 14px;
    }
    @media (max-width: 1100px) { .in-split { grid-template-columns: 1fr; } }

    /* ═══════════════════════════════════════════════
       CARD HEADER (shared)
    ═══════════════════════════════════════════════ */
    .in-card-head {
      padding: 10px 14px; border-bottom: 1px solid #1F2A33;
      background: #0F1419; display: flex; align-items: center; gap: 8px;
    }
    .in-card-head__title { font-size: 11px; color: #F5F7FA; font-weight: 600; }
    .in-card-head__meta  { font-size: 10px; color: #6B7785; }
    .in-card-head__count { margin-left: auto; font-size: 10px; color: #6B7785; }

    .in-sync-badge {
      margin-left: auto; font-size: 9px; padding: 2px 8px;
      background: rgba(245,158,11,0.1); color: #FBBF24;
      border: 1px solid rgba(245,158,11,0.3); border-radius: 999px;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .in-sync-dot {
      width: 5px; height: 5px; background: #F59E0B; border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(245,158,11,0.2);
      animation: inSyncPulse 2s ease-in-out infinite;
    }
    @keyframes inSyncPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,.4); }
      50%      { box-shadow: 0 0 0 4px rgba(245,158,11,0); }
    }

    /* ═══════════════════════════════════════════════
       MAP CARD
    ═══════════════════════════════════════════════ */
    .in-map-card {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 10px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .in-map-wrap { position: relative; flex: 1; }
    .in-map-el { width: 100%; height: 540px; background: #aad3df; }

    .in-map-zoom {
      position: absolute; top: 10px; right: 10px;
      display: flex; flex-direction: column; gap: 4px; z-index: 1000;
    }
    .in-map-zoom button {
      width: 30px; height: 30px;
      background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.2);
      color: #1f2937; border-radius: 5px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .1s;
    }
    .in-map-zoom button:hover { background: #fff; }
    .in-map-zoom-chain--active { background: rgba(245,158,11,0.95) !important; color: #fff !important; }

    .in-card-foot {
      padding: 8px 14px; background: #0A0E12; border-top: 1px solid #1F2A33;
    }
    .in-card-foot--map {
      display: flex; align-items: center; gap: 10px; font-size: 9px; flex-wrap: wrap;
    }
    .in-legend-item { display: flex; align-items: center; gap: 4px; color: #8B9AAB; }
    .in-legend-tip { margin-left: auto; color: #6B7785; }

    ::ng-deep .in-leaflet-popup .leaflet-popup-content-wrapper {
      background: #fff; border-radius: 6px; padding: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    ::ng-deep .in-leaflet-popup .leaflet-popup-content { margin: 10px 12px; }
    ::ng-deep .in-leaflet-popup .leaflet-popup-tip-container { margin-top: -1px; }

    /* ═══════════════════════════════════════════════
       LIST CARD
    ═══════════════════════════════════════════════ */
    .in-list-card {
      background: #161E28; border: 1px solid #1F2A33;
      border-radius: 10px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .in-list-body {
      flex: 1; overflow-y: auto; max-height: 560px;
    }
    .in-list-body::-webkit-scrollbar { width: 4px; }
    .in-list-body::-webkit-scrollbar-track { background: #161E28; }
    .in-list-body::-webkit-scrollbar-thumb { background: #2A3744; border-radius: 2px; }
    .in-list-foot { padding: 8px; background: #0A0E12; border-top: 1px solid #1F2A33; }

    .in-list-item {
      padding: 10px 14px; border-bottom: 1px solid #1F2A33;
      cursor: pointer; border-left: 3px solid transparent;
      transition: background .12s;
    }
    .in-list-item:hover { background: rgba(255,255,255,0.03); }
    .in-list-item--panne {
      background: rgba(239,68,68,0.04); border-left-color: #EF4444;
    }
    .in-list-item--maint {
      background: rgba(245,158,11,0.04); border-left-color: #F59E0B;
    }
    .in-list-item--vet {
      background: rgba(148,163,184,0.04); border-left-color: #94A3B8;
    }
    .in-list-item--selected {
      background: rgba(245,158,11,0.08) !important; border-left-color: #F59E0B !important;
    }
    .in-list-item__head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 3px;
    }
    .in-type-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
    .in-list-item__name {
      font-size: 11px; font-weight: 600; color: #F5F7FA; flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .in-list-item__sub { font-size: 9px; color: #8B9AAB; margin-bottom: 2px; }
    .in-list-item__code {
      font-size: 9px; color: #6B7785; font-family: 'SF Mono', monospace;
    }
    .in-list-item__notes { font-size: 9px; color: #FBBF24; margin-top: 2px; }

    /* ── Cycle de validation des soumissions ── */
    .in-val-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 9px; line-height: 1.4; }
    .in-val-tag {
      font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
      padding: 1px 6px; border-radius: 999px;
    }
    .in-val-row--wait .in-val-tag { background: rgba(245,158,11,.15); color: #FBBF24; }
    .in-val-row--rej  .in-val-tag { background: rgba(239,68,68,.15);  color: #F87171; }
    .in-val-by { color: #8B9AAB; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .in-val-actions { display: flex; gap: 6px; margin-top: 8px; }
    .in-btn--ok {
      background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.4); color: #34D399; flex: 1; justify-content: center;
    }
    .in-btn--ok:hover { background: rgba(16,185,129,.2); }
    .in-btn--ko {
      background: rgba(239,68,68,.10); border: 1px solid rgba(239,68,68,.4); color: #F87171; flex: 1; justify-content: center;
    }
    .in-btn--ko:hover { background: rgba(239,68,68,.18); }

    .in-badge {
      flex-shrink: 0; font-size: 8px; padding: 1px 5px;
      border-radius: 999px; font-weight: 600; letter-spacing: 0.3px;
    }
    .in-badge--op    { background: rgba(16,185,129,0.15);  color: #34D399; }
    .in-badge--maint { background: rgba(245,158,11,0.15);  color: #FBBF24; }
    .in-badge--panne { background: rgba(239,68,68,0.15);   color: #F87171; }
    .in-badge--vet   { background: rgba(148,163,184,0.15); color: #94A3B8; }

    .in-list-more {
      padding: 10px 14px; text-align: center;
      font-size: 10px; color: #FBBF24; cursor: pointer;
    }
    .in-list-more:hover { color: #FDE68A; }
    .in-list-empty {
      padding: 24px 14px; text-align: center; font-size: 11px; color: #6B7785;
    }

    /* ═══════════════════════════════════════════════
       CHAIN BANNER
    ═══════════════════════════════════════════════ */
    .in-chain-banner {
      background: rgba(59,130,246,0.06);
      border: 1px solid rgba(59,130,246,0.2);
      border-radius: 8px; padding: 10px 14px;
      display: flex; align-items: center; gap: 10px;
    }
    .in-chain-banner svg { flex-shrink: 0; }
    .in-chain-banner__text { flex: 1; font-size: 11px; color: #BFDBFE; line-height: 1.5; }
    .in-chain-banner__strong { color: #93C5FD; font-weight: 600; }

    /* ═══════════════════════════════════════════════
       PERSISTENCE BANNER
    ═══════════════════════════════════════════════ */
    .in-banner {
      background: rgba(245,158,11,0.06);
      border: 1px solid rgba(245,158,11,0.25);
      border-radius: 8px; padding: 10px 14px;
      display: flex; align-items: flex-start; gap: 10px;
    }
    .in-banner svg { flex-shrink: 0; margin-top: 1px; }
    .in-banner__text { font-size: 11px; color: #FCD34D; line-height: 1.5; }
    .in-banner__strong { color: #FBBF24; font-weight: 600; }

    /* ═══════════════════════════════════════════════
       WIZARD MODAL
    ═══════════════════════════════════════════════ */
    .wz-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 16px; overflow-y: auto;
    }
    .wz-modal {
      background: #0F1419; border: 1px solid #2A3744; border-radius: 14px;
      width: 100%; max-width: 920px; color: #E2E8EE;
      font-family: -apple-system,system-ui,sans-serif;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      display: flex; flex-direction: column; max-height: 90vh;
      overflow: hidden;
    }
    /* HEAD */
    .wz-head {
      padding: 16px 20px; border-bottom: 1px solid #1F2A33; flex-shrink: 0;
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(to right, rgba(245,158,11,0.1), transparent);
    }
    .wz-head__icon {
      width: 40px; height: 40px; background: rgba(245,158,11,0.15);
      border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .wz-head__title { margin: 0; font-size: 16px; color: #F5F7FA; font-weight: 600; }
    .wz-head__sub   { margin: 0; font-size: 11px; color: #8B9AAB; }
    .wz-saved-chip {
      margin-left: auto; font-size: 10px; color: #FBBF24;
      background: rgba(245,158,11,0.1); padding: 4px 10px;
      border-radius: 999px; border: 1px solid rgba(245,158,11,0.3);
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    }
    .wz-close {
      background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1;
      padding: 6px 10px; border-radius: 6px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .wz-close:hover { background: #222E3A; }
    /* STEP BAR */
    .wz-steps {
      padding: 14px 20px; background: #0A0E12; border-bottom: 1px solid #1F2A33;
      display: flex; align-items: center; flex-shrink: 0; overflow-x: auto;
    }
    .wz-steps::-webkit-scrollbar { height: 0; }
    .wz-step { display: flex; align-items: center; gap: 8px; padding: 0 4px; flex-shrink: 0; }
    .wz-step__dot {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: #1A2530; border: 1px solid #2A3744; color: #94A3B8;
      display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600;
    }
    .wz-step--done .wz-step__dot { background: #10B981; border-color: #10B981; color: #fff; }
    .wz-step--active .wz-step__dot {
      background: #F59E0B; border-color: #F59E0B; color: #0F1419; font-weight: 700;
      box-shadow: 0 0 0 3px rgba(245,158,11,0.25);
    }
    .wz-step__label { font-size: 10px; font-weight: 600; color: #94A3B8; white-space: nowrap; }
    .wz-step--done .wz-step__label  { color: #34D399; }
    .wz-step--active .wz-step__label { color: #FBBF24; }
    .wz-step__sub { font-size: 9px; color: #6B7785; }
    .wz-step--done .wz-step__sub { color: rgba(52,211,153,0.7); }
    .wz-step__sub--cur { color: #6B7785; }
    .wz-step__line { width: 22px; height: 2px; background: #2A3744; flex-shrink: 0; }
    .wz-step__line--done { background: #10B981; }
    /* BODY */
    .wz-body {
      display: grid; grid-template-columns: 1fr 280px; flex: 1; overflow: hidden;
    }
    .wz-main {
      padding: 18px 20px; overflow-y: auto;
    }
    .wz-main::-webkit-scrollbar { width: 4px; }
    .wz-main::-webkit-scrollbar-thumb { background: #2A3744; border-radius: 2px; }
    /* SIDEBAR */
    .wz-sidebar {
      background: #0A0E12; border-left: 1px solid #1F2A33;
      padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
    }
    .wz-sidebar::-webkit-scrollbar { width: 3px; }
    .wz-sidebar::-webkit-scrollbar-thumb { background: #1F2A33; }
    .wz-sidebar-section { display: flex; flex-direction: column; gap: 8px; }
    .wz-sidebar-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #FBBF24;
    }
    /* FOOT */
    .wz-foot {
      padding: 12px 20px; background: #0A0E12; border-top: 1px solid #1F2A33;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
      gap: 10px; flex-wrap: wrap;
    }
    .wz-foot__left { display: flex; align-items: center; gap: 10px; font-size: 11px; color: #6B7785; }
    .wz-foot__sep  { width: 1px; height: 14px; background: #2A3744; }
    .wz-foot__autosave { font-size: 10px; color: #FBBF24; display: inline-flex; align-items: center; gap: 4px; }
    .wz-foot__right { display: flex; gap: 6px; }
    /* BUTTONS */
    .wz-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; padding: 8px 14px; border-radius: 6px;
      cursor: pointer; border: none; font-weight: 500; transition: opacity .15s;
    }
    .wz-btn:hover:not(:disabled) { opacity: .85; }
    .wz-btn:disabled { opacity: .4; cursor: not-allowed; }
    .wz-btn--ghost  { background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1; }
    .wz-btn--amber  { background: #F59E0B; border: 1px solid #F59E0B; color: #0F1419; font-weight: 600; }
    .wz-btn--amber-outline { background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.35); color: #FBBF24; }
    .wz-btn--green-outline { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); color: #34D399; }
    .wz-btn--sm { font-size: 11px; padding: 5px 10px; }
    /* FORM */
    .wz-section-title { font-size: 14px; font-weight: 600; color: #F5F7FA; margin: 0 0 4px; }
    .wz-section-sub   { font-size: 11px; color: #8B9AAB; margin: 0 0 14px; }
    .wz-field { display: flex; flex-direction: column; gap: 4px; }
    .wz-label { font-size: 10px; color: #8B9AAB; }
    .wz-req   { color: #F87171; }
    .wz-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .wz-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .wz-input {
      background: #0F1419; border: 1px solid #2A3744; color: #E2E8EE;
      padding: 7px 9px; border-radius: 5px; font-size: 11px; outline: none;
    }
    .wz-input::placeholder { color: #4B5563; }
    .wz-input:focus { border-color: #3B82F6; }
    .wz-input--mono { font-family: 'SF Mono', 'Consolas', monospace; }
    .wz-input--amber { border-color: #F59E0B; color: #FBBF24; }
    .wz-input--green { border-color: #10B981; color: #34D399; }
    .wz-select {
      background: #0F1419; border: 1px solid #2A3744; color: #E2E8EE;
      padding: 7px 9px; border-radius: 5px; font-size: 11px; outline: none; cursor: pointer;
    }
    .wz-select:focus { border-color: #3B82F6; }
    .wz-select--green { border-color: #10B981; color: #34D399; font-weight: 500; }
    .wz-textarea {
      background: #0F1419; border: 1px solid #2A3744; color: #E2E8EE;
      padding: 7px 9px; border-radius: 5px; font-size: 11px; outline: none;
      resize: vertical; font-family: inherit;
    }
    .wz-textarea:focus { border-color: #3B82F6; }
    .wz-warn { font-size: 10px; color: #F87171; padding: 6px 0; }
    .wz-card {
      background: #161E28; border: 1px solid #1F2A33; border-radius: 8px; padding: 12px;
    }
    .wz-card--loc { margin-bottom: 0; }
    .wz-card-head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
      font-size: 11px; color: #8B9AAB; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;
    }
    .wz-auto-tag { margin-left: auto; font-size: 9px; color: #34D399; }
    /* MINI MAP */
    .wz-loc-toolbar {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;
    }
    .wz-loc-valid { margin-left: auto; font-size: 10px; color: #34D399; display: inline-flex; align-items: center; gap: 4px; }
    .wz-loc-dot { width: 6px; height: 6px; background: #10B981; border-radius: 50%; box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
    .wz-mini-map { height: 180px; border-radius: 6px; overflow: hidden; background: #aad3df; }
    /* TYPE GRID */
    .wz-type-grid {
      display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 12px;
    }
    @media (max-width: 700px) { .wz-type-grid { grid-template-columns: repeat(2,1fr); } }
    .wz-type-card {
      background: #161E28; border: 1px solid #2A3744; border-radius: 8px;
      padding: 12px 10px; display: flex; flex-direction: column; align-items: center; gap: 5px;
      cursor: pointer; transition: all .15s; text-align: center;
    }
    .wz-type-card:hover { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.05); }
    .wz-type-card--sel  { border-color: #F59E0B; background: rgba(245,158,11,0.12); box-shadow: 0 0 0 1px rgba(245,158,11,0.3); }
    .wz-type-card__icon { display: flex; align-items: center; justify-content: center; height: 24px; }
    .wz-type-card__label { font-size: 11px; font-weight: 600; color: #F5F7FA; }
    .wz-type-card__desc  { font-size: 9px; color: #6B7785; line-height: 1.3; }
    /* NEARBY */
    .wz-nearby {
      margin-top: 10px; background: rgba(34,197,94,0.06);
      border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 12px;
    }
    .wz-nearby__head {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #34D399; font-weight: 600; margin-bottom: 6px;
    }
    .wz-nearby__info { font-size: 10px; color: #A7F3D0; line-height: 1.5; margin-bottom: 8px; }
    .wz-nearby__item {
      display: flex; align-items: center; gap: 8px; padding: 7px 10px;
      background: #0F1419; border: 1px solid #2A3744; border-radius: 5px; margin-bottom: 4px;
    }
    .wz-nearby__item-info { flex: 1; font-size: 11px; color: #F5F7FA; }
    .wz-nearby__item-meta { font-size: 9px; color: #6B7785; margin-top: 1px; }
    /* RESOURCE LIST */
    .wz-res-list { display: flex; flex-direction: column; gap: 4px; }
    .wz-res-item {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: #161E28; border: 1px solid #2A3744; border-radius: 6px;
      cursor: pointer; transition: background .12s;
    }
    .wz-res-item:hover { background: rgba(96,165,250,0.08); border-color: rgba(96,165,250,0.3); }
    .wz-res-item__name { font-size: 11px; color: #F5F7FA; font-weight: 500; }
    .wz-res-item__meta { font-size: 9px; color: #6B7785; margin-top: 1px; }
    /* VALIDATION */
    .wz-validation-card {
      background: #161E28; border: 1px solid #1F2A33; border-radius: 8px; padding: 12px;
      display: flex; flex-direction: column; gap: 0;
    }
    .wz-val-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 11px;
    }
    .wz-val-row:last-child { border-bottom: none; }
    .wz-val-key { width: 110px; flex-shrink: 0; font-size: 10px; color: #6B7785; text-transform: uppercase; letter-spacing: 0.3px; }
    .wz-val-val { flex: 1; color: #E2E8EE; display: flex; align-items: center; gap: 5px; }
    .wz-val-val--mono { font-family: monospace; font-size: 11px; color: #FBBF24; }
    /* INFO BOX */
    .wz-info-box {
      background: #161E28; border: 1px solid #1F2A33; border-radius: 8px; padding: 10px 12px;
      font-size: 10px; color: #CBD5E1; line-height: 1.6;
      display: flex; gap: 8px; align-items: flex-start;
    }
    .wz-info-box--amber { border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.04); color: #FCD34D; }
    .wz-info-box svg { flex-shrink: 0; margin-top: 1px; }
    /* PREVIEW */
    .wz-preview {
      background: #161E28; border: 1.5px solid #F59E0B; border-radius: 8px; padding: 10px;
    }
    .wz-preview__head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .wz-preview__type { font-size: 9px; color: #FBBF24; text-transform: uppercase; font-weight: 600; }
    .wz-preview__code { font-size: 11px; color: #F5F7FA; font-weight: 500; font-family: monospace; }
    .wz-preview__name { font-size: 11px; color: #E2E8EE; margin-bottom: 3px; }
    .wz-preview__loc  { font-size: 9px; color: #8B9AAB; line-height: 1.5; }
    /* PROGRESS */
    .wz-progress { background: #161E28; border: 1px solid #1F2A33; border-radius: 8px; padding: 10px 12px; }
    .wz-prog-item {
      display: flex; align-items: center; gap: 6px; padding: 3px 0;
      font-size: 10px; color: #6B7785;
    }
    .wz-prog-item--done { color: #34D399; }
    .wz-prog-item--cur  { color: #FBBF24; }

    /* ═══════════════════════════════════════════════
       DRAWER DETAIL INFRASTRUCTURE
    ═══════════════════════════════════════════════ */
    .dif-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(0,0,0,0.7);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 20px 16px; overflow-y: auto;
    }
    .dif-panel {
      background: #0F1419; border: 1px solid #1F2A33; border-radius: 12px;
      width: 100%; max-width: 900px; color: #E2E8EE;
      font-family: -apple-system,system-ui,sans-serif;
      display: flex; flex-direction: column; max-height: 88vh;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    }
    /* HEAD */
    .dif-head {
      padding: 14px 18px; border-bottom: 1px solid #1F2A33; flex-shrink: 0;
      background: linear-gradient(to right, rgba(245,158,11,0.08), transparent);
    }
    .dif-head__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .dif-head__icon {
      width: 48px; height: 48px; flex-shrink: 0;
      background: rgba(245,158,11,0.15); border-radius: 10px;
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    .dif-head__status-dot {
      position: absolute; bottom: -2px; right: -2px;
      width: 14px; height: 14px; border: 2px solid #0F1419; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .dif-dot--green { background: #10B981; }
    .dif-dot--amber { background: #F59E0B; }
    .dif-dot--red   { background: #EF4444; }
    .dif-dot--grey  { background: #94A3B8; }
    .dif-head__badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
    .dif-code-chip { font-family: monospace; font-size: 10px; color: #FBBF24; background: rgba(245,158,11,0.1); padding: 2px 7px; border-radius: 4px; }
    .dif-type-badge { font-size: 10px; padding: 2px 8px; background: rgba(245,158,11,0.15); color: #FBBF24; border: 1px solid rgba(245,158,11,0.3); border-radius: 999px; font-weight: 500; }
    .dif-status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
    .dif-status--op   { background: rgba(16,185,129,0.15); color: #34D399; }
    .dif-status--maint{ background: rgba(245,158,11,0.15); color: #FBBF24; }
    .dif-status--panne{ background: rgba(239,68,68,0.15);  color: #F87171; }
    .dif-status--vet  { background: rgba(148,163,184,0.15);color: #94A3B8; }
    .dif-pulse-dot { width: 5px; height: 5px; border-radius: 50%; }
    .dif-pulse-dot--green { background: #10B981; animation: difPulse 2s ease-in-out infinite; }
    .dif-pulse-dot--amber { background: #F59E0B; }
    .dif-pulse-dot--red   { background: #EF4444; }
    .dif-pulse-dot--grey  { background: #94A3B8; }
    @keyframes difPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,.5); }
      50%      { box-shadow: 0 0 0 3px rgba(16,185,129,0); }
    }
    .dif-age { font-size: 10px; color: #94A3B8; }
    .dif-head__name { margin: 0; font-size: 18px; color: #F5F7FA; font-weight: 500; }
    .dif-head__loc  { margin: 2px 0 0; font-size: 12px; color: #8B9AAB; }
    .dif-dms { color: #60A5FA; cursor: pointer; font-family: monospace; }
    /* NAV */
    .dif-nav { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .dif-nav-btn {
      background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1;
      width: 28px; height: 28px; border-radius: 5px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 11px;
    }
    .dif-nav-btn:disabled { opacity: .4; cursor: not-allowed; }
    .dif-nav-btn:hover:not(:disabled) { background: #222E3A; }
    .dif-nav-pos { font-size: 11px; color: #6B7785; padding: 0 4px; }
    /* ACTION BUTTONS */
    .dif-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .dif-act {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; padding: 5px 10px; border-radius: 6px;
      cursor: pointer; font-weight: 500; border: none; transition: opacity .15s;
    }
    .dif-act:hover { opacity: .85; }
    .dif-act--amber { background: #F59E0B; border: 1px solid #F59E0B; color: #0F1419; font-weight: 600; }
    .dif-act--ghost { background: #1A2530; border: 1px solid #2A3744; color: #CBD5E1; }
    /* TABS */
    .dif-tabs {
      display: flex; gap: 0; padding: 0 18px; border-bottom: 1px solid #1F2A33;
      font-size: 12px; background: #0A0E12; flex-shrink: 0; overflow-x: auto;
    }
    .dif-tabs::-webkit-scrollbar { height: 0; }
    .dif-tab {
      padding: 10px 14px; color: #8B9AAB; cursor: pointer;
      border-bottom: 2px solid transparent; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 5px; transition: color .15s;
    }
    .dif-tab:hover { color: #CBD5E1; }
    .dif-tab--active { color: #FBBF24; border-bottom-color: #FBBF24; font-weight: 500; }
    .dif-tab-badge { font-size: 10px; padding: 1px 5px; border-radius: 999px; }
    .dif-tab-badge--amber { background: rgba(245,158,11,0.15); color: #FBBF24; }
    .dif-tab-badge--blue  { background: rgba(96,165,250,0.15);  color: #60A5FA; }
    /* BODY */
    .dif-body { flex: 1; overflow-y: auto; padding: 18px; }
    .dif-body::-webkit-scrollbar { width: 4px; }
    .dif-body::-webkit-scrollbar-thumb { background: #2A3744; border-radius: 2px; }
    /* SECTIONS */
    .dif-section {
      background: #161E28; border: 1px solid #1F2A33; border-radius: 10px;
      overflow: hidden; margin-bottom: 14px;
    }
    .dif-section--last { margin-bottom: 0; }
    .dif-section-head {
      padding: 10px 14px; border-bottom: 1px solid #1F2A33; background: #0A0E12;
      display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600;
    }
    .dif-section-meta { margin-left: auto; font-size: 10px; color: #6B7785; }
    .dif-meta-green { color: #34D399; display: flex; align-items: center; gap: 4px; }
    .dif-live-dot {
      width: 6px; height: 6px; background: #10B981; border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(16,185,129,0.2); animation: difPulse 2s ease-in-out infinite;
    }
    /* CHAIN */
    .dif-chain-scroll { padding: 14px; overflow-x: auto; }
    .dif-chain-flow { display: flex; align-items: center; gap: 0; min-width: max-content; }
    .dif-chain-node {
      border: 1.5px solid #2A3744; border-radius: 8px; padding: 10px 12px;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      min-width: 100px; max-width: 130px; text-align: center; transition: all .15s;
    }
    .dif-chain-node--current { box-shadow: 0 0 0 2px rgba(245,158,11,0.3); }
    .dif-chain-node__badge { font-size: 8px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    .dif-chain-node__code { font-size: 8px; font-family: monospace; font-weight: 600; }
    .dif-chain-node__name { font-size: 9px; color: #CBD5E1; line-height: 1.3; }
    .dif-chain-node__here { font-size: 8px; color: #F59E0B; font-weight: 700; margin-top: 2px; letter-spacing: 0.3px; }
    .dif-chain-node__hh { font-size: 10px; color: #A5A4DC; font-weight: 600; margin-top: 2px; }
    .dif-chain-arrow { padding: 0 8px; flex-shrink: 0; display: flex; align-items: center; }
    .dif-impact {
      margin: 0 14px 14px; padding: 8px 10px; font-size: 10px; color: #93C5FD; line-height: 1.5;
      background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.2); border-radius: 6px;
    }
    /* 2-COL GRID */
    .dif-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    @media (max-width: 680px) { .dif-grid2 { grid-template-columns: 1fr; } }
    .dif-card { background: #161E28; border: 1px solid #1F2A33; border-radius: 8px; padding: 14px; }
    .dif-card-head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 12px;
      font-size: 11px; color: #8B9AAB; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;
    }
    .dif-kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; }
    .dif-kv__k { font-size: 9px; color: #6B7785; text-transform: uppercase; letter-spacing: 0.3px; }
    .dif-kv__v { margin-top: 2px; }
    /* SENSORS */
    .dif-sensors { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 14px; }
    @media (max-width: 600px) { .dif-sensors { grid-template-columns: 1fr; } }
    .dif-sensor { background: #0F1419; border: 1px solid #2A3744; border-radius: 8px; padding: 10px; }
    .dif-sensor__head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .dif-sensor__code { font-size: 9px; font-family: monospace; }
    .dif-sensor__val { display: flex; align-items: baseline; gap: 4px; }
    .dif-sensor__num { font-size: 16px; font-weight: 600; }
    .dif-sensor__unit { font-size: 10px; color: #8B9AAB; }
    .dif-sensor__label { font-size: 8px; color: #6B7785; margin-top: 2px; }
    .dif-sensor__sub { font-size: 8px; margin-top: 1px; }
    /* MAINTENANCE LIST */
    .dif-maint-list { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
    .dif-maint-row {
      display: grid; grid-template-columns: 90px 1fr auto; gap: 10px; padding: 8px;
      background: #0F1419; border: 1px solid #1F2A33; border-radius: 6px; align-items: center;
    }
    .dif-maint-row--planned { background: rgba(245,158,11,0.04); border-color: rgba(245,158,11,0.2); }
    .dif-maint-date { font-size: 10px; font-weight: 500; }
    .dif-maint-info {}
    .dif-maint-title { font-size: 11px; font-weight: 500; }
    .dif-maint-by { font-size: 9px; color: #6B7785; margin-top: 1px; }
    .dif-maint-badge { font-size: 9px; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
    .dif-maint-badge--prev { background: rgba(16,185,129,0.15); color: #34D399; }
    .dif-maint-badge--corr { background: rgba(245,158,11,0.15); color: #FBBF24; }
    .dif-maint-badge--plan { background: rgba(148,163,184,0.15); color: #94A3B8; }
    /* CROSS-LINK CHIPS */
    .dif-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 14px; font-size: 11px; }
    .dif-chip { padding: 4px 10px; border-radius: 999px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: opacity .15s; }
    .dif-chip:hover { opacity: .8; }
    .dif-chip--green  { background: rgba(34,197,94,0.1);   color: #34D399; border: 1px solid rgba(34,197,94,0.2); }
    .dif-chip--purple { background: rgba(83,74,183,0.1);   color: #A5A4DC; border: 1px solid rgba(83,74,183,0.2); }
    .dif-chip--blue   { background: rgba(96,165,250,0.1);  color: #60A5FA; border: 1px solid rgba(96,165,250,0.2); }
    .dif-chip--amber  { background: rgba(245,158,11,0.1);  color: #FBBF24; border: 1px solid rgba(245,158,11,0.2); }
    /* PLACEHOLDER */
    .dif-placeholder {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 40px 20px; text-align: center; color: #F5F7FA; font-size: 14px; font-weight: 600;
    }
    .dif-placeholder__sub { font-size: 11px; color: #8B9AAB; line-height: 1.6; max-width: 400px; font-weight: 400; }
    /* EMBEDDED (inside URD detail onglet) */
    .in-shell--embedded { padding: 0; background: transparent; }
    .in-scope-header {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 500; color: #60A5FA; padding: 0 0 4px;
    }
    .in-scope-count {
      font-size: 11px; color: #8B9AAB; font-weight: 400;
      padding: 2px 7px; background: #1A2530; border-radius: 999px;
    }
  `],
})
export class InfrastructuresPageComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  /** `commune` non nulle (TEPAC) → on resserre la liste à la commune, sinon au département. */
  @Input() scope?: { dept: string; commune?: string };
  /** Mode overlay : monté par-dessus la carte → on masque la page et on ouvre direct le wizard. */
  @Input() overlayMode = false;
  /** Coordonnées pré-remplies (point cliqué sur la carte) — lues à l'étape « Géolocalisation ». */
  @Input() initialCoords: { lat: number; lng: number } | null = null;
  @Output() overlayClose = new EventEmitter<void>();

  @ViewChild('ifMap',        { static: false }) mapRef!:      ElementRef<HTMLDivElement>;
  @ViewChild('listContainer', { static: false }) listRef!:    ElementRef<HTMLDivElement>;
  @ViewChild('wizMapEl',     { static: false }) wizMapRef?:  ElementRef<HTMLDivElement>;

  private map: any = null;
  private markers: Record<string, any> = {};
  private wizMap: any = null;
  private _wizMapNeedsInit = false;

  private readonly STORAGE_KEY = 'gestidlo_infrastructures_v1';
  // Catalogue de référence front (INFRA_DATA) marqué `seed` → la vue commune (TEPAC) l'ignore,
  // ne montrant que le patrimoine réel (backend + ses propres soumissions).
  private _allData: InfraItem[] = INFRA_DATA.map(i => ({ ...i, seed: true }));

  /** Scopé : par commune si fournie (TEPAC), sinon par département (superviseur), sinon tout. */
  get allData(): InfraItem[] {
    if (!this.scope?.dept) return this._allData;
    // TEPAC : périmètre fin commune, 100 % piloté par le backend → on écarte le catalogue de
    // référence front (seed) pour ne montrer QUE le patrimoine réel de la commune + ses soumissions.
    if (this.scope.commune) {
      const c = this.scope.commune.toLowerCase();
      return this._allData.filter(i => !i.seed
        && i.department === this.scope!.dept
        && (i.commune ?? '').toLowerCase() === c);
    }
    return this._allData.filter(i => i.department === this.scope!.dept);
  }

  /** TEPAC (périmètre commune) : il SOUMET un recensement (pas d'enregistrement officiel). */
  get isTepac(): boolean { return !!this.scope?.commune; }
  /** Superviseur (département sans commune) : autorité de validation des soumissions. */
  get canValidate(): boolean { return !!this.scope?.dept && !this.scope?.commune; }

  searchTerm    = '';
  catFilter:    InfraCat    = 'all';
  statusFilter: '' | InfraStatus = '';
  validationFilter: '' | InfraValidation = '';
  selectedId:   string | null = null;
  showAll  = false;
  chainView = false;
  showModal = false;
  wizStep = 1;
  wizDraftSaved = false;
  wizDraft: WizDraft = this.emptyDraft();
  wizResourceSearch = '';

  drawerInfraId: string | null = null;
  drawerTab = 'overview';

  private readonly DR_CHAINS: Record<string, ChainNode[]> = {
    'if-01': [
      { kind:'resource', code:'rs-01', name:'Source Bassin Bleu', color:'#34D399' },
      { kind:'infra', code:'CAP-BBLEU-01', name:'Captage Bassin Bleu', type:'captage', color:'#FBBF24', isCurrent:true },
      { kind:'infra', code:'PUMP-JAC-02', name:'Pompage', type:'pompage', color:'#F59E0B' },
      { kind:'infra', code:'STA-JAC-T01', name:'Traitement', type:'traitement', color:'#06B6D4' },
      { kind:'infra', code:'TANK-JAC-R02', name:'Réservoir', type:'reservoir', color:'#60A5FA' },
      { kind:'usagers', code:'', name:'247 foyers', color:'#A5A4DC', households:247 },
    ],
    'if-02': [
      { kind:'resource', code:'rs-01', name:'Source Bassin Bleu', color:'#34D399' },
      { kind:'infra', code:'CAP-BBLEU-01', name:'Captage', type:'captage', color:'#FBBF24' },
      { kind:'infra', code:'PUMP-JAC-02', name:'Station de pompage Bassin Bleu', type:'pompage', color:'#F59E0B', isCurrent:true },
      { kind:'infra', code:'STA-JAC-T01', name:'Traitement', type:'traitement', color:'#06B6D4' },
      { kind:'infra', code:'TANK-JAC-R02', name:'Réservoir', type:'reservoir', color:'#60A5FA' },
      { kind:'usagers', code:'', name:'247 foyers', color:'#A5A4DC', households:247 },
    ],
    'if-03': [
      { kind:'resource', code:'rs-01', name:'Source Bassin Bleu', color:'#34D399' },
      { kind:'infra', code:'CAP-BBLEU-01', name:'Captage', type:'captage', color:'#FBBF24' },
      { kind:'infra', code:'PUMP-JAC-02', name:'Pompage', type:'pompage', color:'#F59E0B' },
      { kind:'infra', code:'STA-JAC-T01', name:'Traitement Jacmel', type:'traitement', color:'#06B6D4', isCurrent:true },
      { kind:'infra', code:'TANK-JAC-R02', name:'Réservoir', type:'reservoir', color:'#60A5FA' },
      { kind:'usagers', code:'', name:'247 foyers', color:'#A5A4DC', households:247 },
    ],
    'if-04': [
      { kind:'resource', code:'rs-01', name:'Source Bassin Bleu', color:'#34D399' },
      { kind:'infra', code:'CAP-BBLEU-01', name:'Captage', type:'captage', color:'#FBBF24' },
      { kind:'infra', code:'PUMP-JAC-02', name:'Pompage', type:'pompage', color:'#F59E0B' },
      { kind:'infra', code:'STA-JAC-T01', name:'Traitement', type:'traitement', color:'#06B6D4' },
      { kind:'infra', code:'TANK-JAC-R02', name:'Réservoir Jacmel R02', type:'reservoir', color:'#60A5FA', isCurrent:true },
      { kind:'usagers', code:'', name:'247 foyers', color:'#A5A4DC', households:247 },
    ],
    'if-05': [
      { kind:'resource', code:'rs-02', name:'Source Fermathe', color:'#34D399' },
      { kind:'infra', code:'CAP-FERM-01', name:'Captage Fermathe', type:'captage', color:'#FBBF24', isCurrent:true },
      { kind:'infra', code:'TANK-PV-R03', name:"Château d'eau PV", type:'reservoir', color:'#60A5FA' },
      { kind:'usagers', code:'', name:'420 foyers', color:'#A5A4DC', households:420 },
    ],
    'if-06': [
      { kind:'resource', code:'rs-02', name:'Source Fermathe', color:'#34D399' },
      { kind:'infra', code:'CAP-FERM-01', name:'Captage', type:'captage', color:'#FBBF24' },
      { kind:'infra', code:'TANK-PV-R03', name:"Château d'eau Pétion-Ville", type:'reservoir', color:'#60A5FA', isCurrent:true },
      { kind:'usagers', code:'', name:'420 foyers', color:'#A5A4DC', households:420 },
    ],
    'if-07': [
      { kind:'resource', code:'aq-01', name:'Aquifère urbain', color:'#60A5FA' },
      { kind:'infra', code:'F-CIT-12', name:'Forage Cité-Soleil F-12', type:'forage', color:'#A5A4DC', isCurrent:true },
      { kind:'usagers', code:'', name:'85 foyers', color:'#A5A4DC', households:85 },
    ],
    'if-08': [
      { kind:'resource', code:'aq-02', name:'Aquifère côtier', color:'#60A5FA' },
      { kind:'infra', code:'F-CAR-08', name:'Forage Carrefour F-08', type:'forage', color:'#A5A4DC', isCurrent:true },
      { kind:'usagers', code:'', name:'110 foyers (hors service)', color:'#F87171', households:0 },
    ],
    'if-09': [
      { kind:'resource', code:'rs-11', name:'Rivière Momance', color:'#60A5FA' },
      { kind:'infra', code:'CAP-MOM-01', name:'Prise Momance', type:'captage', color:'#FBBF24', isCurrent:true },
      { kind:'infra', code:'NET-LEO-01', name:'Réseau AEP Léogâne', type:'reseau', color:'#34D399' },
      { kind:'usagers', code:'', name:'312 foyers', color:'#A5A4DC', households:312 },
    ],
    'if-10': [
      { kind:'resource', code:'aq-03', name:'Nappe phréatique', color:'#60A5FA' },
      { kind:'infra', code:'P-BEL-01', name:'Puits Bel-Air', type:'puits', color:'#A5A4DC', isCurrent:true },
      { kind:'usagers', code:'', name:'45 foyers', color:'#A5A4DC', households:45 },
    ],
    'if-11': [
      { kind:'resource', code:'rs-05', name:'Source La Plaine', color:'#34D399' },
      { kind:'infra', code:'CAP-CAP-01', name:'Captage La Plaine', type:'captage', color:'#FBBF24', isCurrent:true },
      { kind:'infra', code:'TANK-CAP-R01', name:'Réservoir Cap', type:'reservoir', color:'#60A5FA' },
      { kind:'infra', code:'BF-CAP-01', name:'Bornes-fontaines', type:'borne', color:'#34D399' },
      { kind:'usagers', code:'', name:'380 foyers', color:'#A5A4DC', households:380 },
    ],
    'if-12': [
      { kind:'resource', code:'rs-05', name:'Source La Plaine', color:'#34D399' },
      { kind:'infra', code:'CAP-CAP-01', name:'Captage', type:'captage', color:'#FBBF24' },
      { kind:'infra', code:'TANK-CAP-R01', name:'Réservoir Cap-Haïtien', type:'reservoir', color:'#60A5FA', isCurrent:true },
      { kind:'infra', code:'BF-CAP-01', name:'Bornes-fontaines', type:'borne', color:'#34D399' },
      { kind:'usagers', code:'', name:'380 foyers', color:'#A5A4DC', households:380 },
    ],
    'if-13': [
      { kind:'resource', code:'rs-12', name:'Rivière Artibonite', color:'#60A5FA' },
      { kind:'infra', code:'STA-PEL-01', name:'Station Péligre', type:'traitement', color:'#06B6D4', isCurrent:true },
      { kind:'usagers', code:'', name:'1 200 foyers', color:'#A5A4DC', households:1200 },
    ],
    'if-14': [
      { kind:'resource', code:'rs-11', name:'Rivière Momance', color:'#60A5FA' },
      { kind:'infra', code:'CAP-MOM-01', name:'Prise Momance', type:'captage', color:'#FBBF24' },
      { kind:'infra', code:'NET-LEO-01', name:'Réseau AEP Léogâne', type:'reseau', color:'#34D399', isCurrent:true },
      { kind:'usagers', code:'', name:'312 foyers', color:'#A5A4DC', households:312 },
    ],
    'if-15': [
      { kind:'resource', code:'aq-04', name:'Nappe phréatique Arcahaie', color:'#60A5FA' },
      { kind:'infra', code:'P-ARC-01', name:'Puits Arcahaie', type:'puits', color:'#A5A4DC', isCurrent:true },
      { kind:'usagers', code:'', name:'28 foyers', color:'#A5A4DC', households:28 },
    ],
    'if-16': [
      { kind:'resource', code:'rs-05', name:'Source La Plaine', color:'#34D399' },
      { kind:'infra', code:'CAP-CAP-01', name:'Captage', type:'captage', color:'#FBBF24' },
      { kind:'infra', code:'TANK-CAP-R01', name:'Réservoir Cap', type:'reservoir', color:'#60A5FA' },
      { kind:'infra', code:'BF-CAP-01', name:'Bornes-fontaines Cap-Haïtien', type:'borne', color:'#34D399', isCurrent:true },
      { kind:'usagers', code:'', name:'380 foyers', color:'#A5A4DC', households:380 },
    ],
  };

  private readonly DR_DETAILS: Record<string, InfraDetail> = {
    'if-01': {
      model:'Seuil bétonné + grille acier inox', owner:'DINEPA', operator:'OREPA Sud',
      funder:'BID', fundYear:2015, fundAmount:'45 000 USD',
      lifespan:50, serviceDate:'03/2015', realFlow:27, realFlowPct:90,
      hoursPerDay:'24h/24h · alimentation gravitaire', households:247, persons:1247,
      events:[
        { date:'12/01/2026', title:'Nettoyage grille et dégrilleur', by:'Jonas Pierre · OREPA Sud', kind:'preventive' },
        { date:'04/09/2025', title:'Réparation joint étanchéité radier', by:'Marie Joseph · OREPA Sud', kind:'corrective', cost:'120 USD' },
        { date:'01/07/2026', title:'Inspection saisonnière hivernage', by:'À assigner', kind:'planned' },
      ],
    },
    'if-02': {
      model:'Grundfos CR 32-4', hmt:'85 m', power:'15 kW',
      owner:'DINEPA', operator:'OREPA Sud', funder:'USAID', fundYear:2019, fundAmount:'285 000 USD',
      lifespan:25, serviceDate:'15/03/2019', realFlow:42, realFlowPct:84,
      hoursPerDay:'18h/24h · EDH + groupe électrogène', households:247, persons:1247,
      sensors:[
        { code:'CPT-DEB-JAC-007', label:'Débit en sortie', value:'42', unit:'m³/h', sub:'Danfoss FH010', color:'#34D399' },
        { code:'CPT-PRE-JAC-008', label:'Pression conduite', value:'3.8', unit:'bar',  sub:'Keller PR-33X', color:'#34D399' },
        { code:'CPT-ELC-JAC-009', label:'Conso. électrique', value:'12.4', unit:'kW', sub:'+8% anormal', color:'#FBBF24', warn:true },
      ],
      events:[
        { date:'15/04/2026', title:'Vidange et nettoyage filtre', by:'Pierre Lubin · technicien OREPA Sud · 4h', kind:'preventive' },
        { date:'02/02/2026', title:'Remplacement garniture mécanique', by:'Marie Charles · cheffe OREPA Sud · 8h', kind:'corrective', cost:'450 USD' },
        { date:'15/06/2026', title:'Inspection trimestrielle programmée', by:'À assigner', kind:'planned' },
      ],
    },
    'if-04': {
      model:'Réservoir béton armé 200 m³', owner:'DINEPA', operator:'OREPA Sud',
      funder:'MINUSTAH', fundYear:1998, fundAmount:'n/d',
      lifespan:50, serviceDate:'1998', realFlow:200, realFlowPct:100,
      hoursPerDay:'Alimentation gravitaire · permanent', households:247, persons:1247,
      events:[
        { date:'20/03/2026', title:'Inspection parois et toiture réservoir', by:'Ingénieur OREPA Sud', kind:'preventive' },
        { date:'10/2025', title:'Réparation fissures béton fond', by:'Entreprise Haïti Travaux', kind:'corrective', cost:'1 200 USD' },
        { date:'15/09/2026', title:'Nettoyage annuel curage', by:'À programmer', kind:'planned' },
      ],
    },
    'if-06': {
      model:"Château d'eau béton 500 m³ · vétuste", owner:'DINEPA', operator:'OREPA Ouest',
      funder:'Gouvernement haïtien', fundYear:1982, fundAmount:'n/d',
      lifespan:50, serviceDate:'1982', realFlow:380, realFlowPct:76,
      hoursPerDay:'Alimentation mixte · 16h/24h', households:420, persons:2100,
      events:[
        { date:'15/05/2026', title:'Évaluation structurelle · plan rénovation', by:'Bureau CTE / Ingénierie', kind:'preventive' },
        { date:'03/2026', title:'Plan rénovation soumis à DINEPA', by:'OREPA Ouest', kind:'corrective' },
        { date:'2027', title:'Réhabilitation complète prévue', by:'Budget BID en cours', kind:'planned' },
      ],
    },
    'if-08': {
      model:'Pompe submersible Grundfos SP17-8', hmt:'45 m', power:'7.5 kW',
      owner:'DINEPA', operator:'OREPA Ouest', funder:'UNICEF', fundYear:2012, fundAmount:'38 000 USD',
      lifespan:20, serviceDate:'2012', realFlow:0, realFlowPct:0,
      hoursPerDay:'Hors service · panne moteur', households:0, persons:0,
      events:[
        { date:'08/05/2026', title:'Diagnostic panne moteur pompe', by:'Technicien OREPA Ouest', kind:'corrective' },
        { date:'22/04/2026', title:'Coupure alimentation électrique', by:'Signalement automatique', kind:'corrective' },
        { date:'01/06/2026', title:'Remplacement pompe complète prévu', by:'Devis en cours', kind:'planned' },
      ],
    },
    'if-09': {
      model:'Prise directe · canal bétonné 1,2 m', owner:'DINEPA', operator:'OREPA Ouest',
      funder:'AFD', fundYear:2001, fundAmount:'120 000 EUR',
      lifespan:40, serviceDate:'2001', realFlow:140, realFlowPct:90,
      hoursPerDay:'24h/24h · alimentation gravitaire', households:312, persons:1560,
      sensors:[
        { code:'CPT-DEB-LEO-002', label:'Débit prise', value:'140', unit:'m³/h', sub:'Débitmètre électromag.', color:'#34D399' },
        { code:'CPT-TUR-LEO-003', label:'Turbidité eau', value:'4.2', unit:'NTU', sub:'Valeur normale < 5', color:'#34D399' },
      ],
      events:[
        { date:'02/05/2026', title:'Nettoyage bassin dessableur', by:'Jean-Marc Louis · OREPA Ouest', kind:'preventive' },
        { date:'11/2025', title:'Réparation grille après crue saison pluies', by:'Brigade OREPA · 2 jours', kind:'corrective', cost:'800 USD' },
        { date:'15/08/2026', title:'Inspection hivernage saison cyclonique', by:'À programmer', kind:'planned' },
      ],
    },
    'if-13': {
      model:'Station mixte · turbines axiales + pompage', power:'464 kW',
      owner:'DINEPA', operator:'OREPA Artibonite', funder:'Gouvernement + BID', fundYear:1956, fundAmount:'n/d',
      lifespan:60, serviceDate:'1956', realFlow:320, realFlowPct:69,
      hoursPerDay:'14h/24h · délestage fréquent EDH', households:1200, persons:6000,
      events:[
        { date:'Avr 2026', title:'Maintenance turbines en cours', by:'Équipe OREPA Artibonite + DINEPA', kind:'corrective' },
        { date:'2025', title:'Inspection OREPA annuelle', by:'Ingénieurs DINEPA', kind:'preventive' },
        { date:'Déc 2026', title:'Réhabilitation partielle turbines', by:'Budget BID approuvé', kind:'planned' },
      ],
    },
  };

  readonly DEPTS = ['Artibonite','Centre',"Grand'Anse",'Nippes','Nord','Nord-Est','Nord-Ouest','Ouest','Sud','Sud-Est'];
  readonly WIZ_STEPS = [
    { label: 'Catégorie' }, { label: 'Identité' }, { label: 'Localisation' },
    { label: 'Technique' }, { label: 'Liaison ressource' }, { label: 'Validation' },
  ];
  readonly WIZ_RESOURCES = [
    { id:'rs-01', name:'Source Bassin Bleu',    type:'source',   dept:'Sud-Est',   commune:'Jacmel' },
    { id:'rs-02', name:'Source Fermathe',        type:'source',   dept:'Ouest',     commune:'Pétion-Ville' },
    { id:'rs-05', name:'Source La Plaine',       type:'source',   dept:'Nord',      commune:'Cap-Haïtien' },
    { id:'rs-09', name:'Source Mapou',           type:'source',   dept:'Nord',      commune:'Limbé' },
    { id:'rs-11', name:'Rivière Momance',        type:'riviere',  dept:'Ouest',     commune:'Léogâne' },
    { id:'rs-12', name:'Rivière Artibonite',     type:'riviere',  dept:'Artibonite',commune:'Dessalines' },
    { id:'rs-14', name:'Aquifère Cul-de-Sac',   type:'aquifere', dept:'Ouest',     commune:'Carrefour' },
    { id:'rs-15', name:'Lac Azuéi',             type:'lac',      dept:'Ouest',     commune:'Ganthier' },
  ];

  constructor(private ngZone: NgZone,
              private route: ActivatedRoute, private router: Router,
              private bff: BffApiService) {
    GestidloStore.seed();
    this.loadPersisted();
  }

  ngOnInit() {
    this.loadFromApi();   // patrimoine bâti persistant (api-metier) — fait autorité sur le seed
    // Monté en overlay par-dessus la carte (RecensementService) → on ouvre direct le modal.
    if (this.overlayMode) {
      this.openAddModal();
      return;
    }
    // Fallback navigation : ?nouveau=1 ouvre LE MÊME modal, puis on nettoie l'URL.
    if (this.route.snapshot.queryParamMap.get('nouveau')) {
      this.openAddModal();
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  /** Base = catalogue de référence front (seed) + ajouts/cache non-seed du localStorage. */
  private loadPersisted() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const custom: InfraItem[] = JSON.parse(raw);
        const seedIds = new Set(INFRA_DATA.map(i => i.id));
        this._allData = [
          ...INFRA_DATA.map(i => ({ ...i, seed: true })),
          ...custom.filter(c => !seedIds.has(c.id)),
        ];
      }
    } catch { }
  }

  /** Persiste tout ce qui n'est pas le catalogue de référence (ajouts + cache backend). */
  private persistCustom() {
    const custom = this._allData.filter(i => !i.seed);
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(custom)); } catch { }
  }

  /** Recharge le patrimoine bâti persistant ; le backend fait autorité (par id). */
  private loadFromApi() {
    this.bff.listOuvrages().pipe(catchError(() => of([] as OuvrageDto[])))
      .subscribe(dtos => this.mergeBackend(dtos));
  }

  private mergeBackend(dtos: OuvrageDto[]) {
    if (!dtos.length) return;
    const fromApi = dtos.map(d => this.fromBackend(d));
    const byId = new Map(this._allData.map(i => [i.id, i] as const));
    for (const i of fromApi) byId.set(i.id, i);   // le backend fait autorité
    this._allData = [...byId.values()];
    this.persistCustom();
    if (this.map) this.buildMarkers();
  }

  private fromBackend(d: OuvrageDto): InfraItem {
    const validation = d.statut === 'EN_ATTENTE_VALIDATION' ? 'en_attente'
      : d.statut === 'REJETEE' ? 'rejetee' : 'validee';
    return {
      id: d.id, code: d.code, name: d.nom,
      type: d.type.toLowerCase() as InfraType,
      status: d.etat.toLowerCase() as InfraStatus,
      department: d.department, commune: d.commune ?? '',
      section: d.section ?? undefined, locality: d.locality ?? undefined,
      lat: d.lat ?? undefined, lon: d.lon ?? undefined,
      capaciteM3h: d.capaciteM3h ?? undefined,
      anneeConstruction: d.anneeConstruction ?? undefined,
      resourceId: d.resourceId ?? undefined, resourceName: d.resourceName ?? undefined,
      notes: d.notes ?? undefined,
      validation, createdBy: d.createdBy ?? undefined, motifRejet: d.motifRejet ?? undefined,
    };
  }

  private toBackend(i: InfraItem) {
    return {
      id: i.id, code: i.code, nom: i.name,
      type: i.type.toUpperCase(), etat: (i.status ?? 'operationnel').toUpperCase(),
      department: i.department, commune: i.commune ?? null,
      section: i.section ?? null, locality: i.locality ?? null,
      lat: i.lat ?? null, lon: i.lon ?? null,
      capaciteM3h: i.capaciteM3h ?? null, anneeConstruction: i.anneeConstruction ?? null,
      resourceId: i.resourceId ?? null, resourceName: i.resourceName ?? null, notes: i.notes ?? null,
    };
  }

  /* ── Derived collections ──────────────────────────────────── */
  get captages()     { return this.allData.filter(i => typeToCat(i.type) === 'captage');   }
  get foragesPuits() { return this.allData.filter(i => typeToCat(i.type) === 'forage');    }
  get stations()     { return this.allData.filter(i => typeToCat(i.type) === 'station');   }
  get reservoirs()   { return this.allData.filter(i => typeToCat(i.type) === 'reservoir'); }
  get reseaux()      { return this.allData.filter(i => typeToCat(i.type) === 'reseau');    }

  get operationnels() { return this.allData.filter(i => i.status === 'operationnel'); }
  get maintenances()  { return this.allData.filter(i => i.status === 'maintenance');  }
  get pannes()        { return this.allData.filter(i => i.status === 'panne');        }
  get vetusteItems()  { return this.allData.filter(i => i.status === 'vetuste' || (i.anneeConstruction && CY - i.anneeConstruction > 40)); }

  /* ── Cycle de validation (absence de validation ⇒ ouvrage officiel) ── */
  validationOf(i: InfraItem): InfraValidation { return i.validation ?? 'validee'; }
  get enAttente() { return this.allData.filter(i => this.validationOf(i) === 'en_attente'); }
  get validees()  { return this.allData.filter(i => this.validationOf(i) === 'validee');  }
  get rejetees()  { return this.allData.filter(i => this.validationOf(i) === 'rejetee');  }

  setValidationFilter(v: '' | InfraValidation) { this.validationFilter = this.validationFilter === v ? '' : v; }

  /** Superviseur : valide une soumission → l'ouvrage devient officiel (optimiste + backend). */
  validerInfra(item: InfraItem, ev?: Event) {
    ev?.stopPropagation();
    this._allData = this._allData.map(i =>
      i.id === item.id ? { ...i, validation: 'validee', motifRejet: undefined } : i);
    this.persistCustom();
    this.buildMarkers();
    this.bff.validerOuvrage(item.id).pipe(catchError(() => of(null)))
      .subscribe(dto => { if (dto) this.mergeBackend([dto]); });
  }

  /** Superviseur : rejette une soumission avec motif obligatoire (optimiste + backend). */
  rejeterInfra(item: InfraItem, ev?: Event) {
    ev?.stopPropagation();
    const motif = (window.prompt(`Motif du rejet de « ${item.name} » :`, '') ?? '').trim();
    if (!motif) return;
    this._allData = this._allData.map(i =>
      i.id === item.id ? { ...i, validation: 'rejetee', motifRejet: motif } : i);
    this.persistCustom();
    this.buildMarkers();
    this.bff.rejeterOuvrage(item.id, motif).pipe(catchError(() => of(null)))
      .subscribe(dto => { if (dto) this.mergeBackend([dto]); });
  }

  validationLabel(v: InfraValidation): string {
    return v === 'en_attente' ? 'En attente' : v === 'rejetee' ? 'Rejetée' : 'Validée';
  }

  get totalCapacity(): number {
    return this.allData.reduce((s, i) => s + (i.capaciteM3h ?? 0), 0);
  }

  get tauxFonctionnement(): number {
    return Math.round(this.operationnels.length / this.allData.length * 100);
  }

  get avgAge(): number {
    const items = this.allData.filter(i => i.anneeConstruction);
    if (!items.length) return 0;
    const avg = items.reduce((s, i) => s + (CY - i.anneeConstruction!), 0) / items.length;
    return Math.round(avg);
  }

  get filtered(): InfraItem[] {
    const rows = this.allData.filter(i => {
      if (this.catFilter !== 'all' && typeToCat(i.type) !== this.catFilter) return false;
      if (this.statusFilter && i.status !== this.statusFilter) return false;
      if (this.validationFilter && this.validationOf(i) !== this.validationFilter) return false;
      if (this.searchTerm) {
        const q = this.searchTerm.toLowerCase();
        return i.name.toLowerCase().includes(q)
            || i.commune.toLowerCase().includes(q)
            || i.code.toLowerCase().includes(q);
      }
      return true;
    });
    // Dédoublonnage par code : catalogue seed + ouvrages API peuvent partager un code.
    return dedupeByCode(rows);
  }

  get listItems(): InfraItem[] {
    return this.showAll ? this.filtered : this.filtered.slice(0, 7);
  }

  /** trackBy stable par code (repli id). */
  trackByCode(_i: number, i: InfraItem): string { return i.code || i.id; }

  /* ── Lifecycle ────────────────────────────────────────────── */
  ngAfterViewInit() { setTimeout(() => this.initMap(), 150); }

  ngAfterViewChecked() {
    if (this._wizMapNeedsInit && this.wizMapRef?.nativeElement) {
      this._wizMapNeedsInit = false;
      this.initWizMap();
    }
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    if (this.wizMap) { this.wizMap.remove(); this.wizMap = null; }
    delete (window as any).__ifSelect;
  }

  /* ── Map ──────────────────────────────────────────────────── */
  private initMap() {
    if (!this.mapRef?.nativeElement || typeof L === 'undefined') return;

    this.map = L.map(this.mapRef.nativeElement, {
      center: [18.9, -72.7], zoom: 8, zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · CNIGS Haïti · GestiDLO',
      maxZoom: 18
    }).addTo(this.map);

    (window as any).__ifSelect = (id: string) => {
      this.ngZone.run(() => this.selectById(id));
    };

    this.buildMarkers();
    this.applyScopeView();
  }

  /**
   * Cadre la carte sur le périmètre du compte : commune (resserrée sur ses ouvrages) →
   * département → Haïti. `setMaxBounds` verrouille la navigation hors zone : un TEPAC de
   * Carrefour ne peut pas faire défiler jusqu'à Jacmel ou Cap-Haïtien.
   */
  private applyScopeView() {
    if (!this.map) return;

    // TEPAC : périmètre fin commune → on resserre sur les ouvrages de la commune.
    if (this.scope?.commune) {
      const pts = this.allData
        .filter(i => i.lat != null && i.lon != null)
        .map(i => [i.lat as number, i.lon as number] as [number, number]);
      if (pts.length) {
        const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const pad = 0.11; // ≈ 12 km autour du barycentre → verrou commune
        if (pts.length === 1) this.map.setView([lat, lon], 13);
        else this.map.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom: 14 });
        this.map.setMaxBounds(L.latLngBounds([lat - pad, lon - pad], [lat + pad, lon + pad]));
        return;
      }
      // Commune sans ouvrage géolocalisé : repli sur le département.
    }

    if (this.scope?.dept) {
      const bounds = DEPT_BOUNDS[this.scope.dept];
      if (bounds) {
        this.map.fitBounds(bounds);
        this.map.setMaxBounds(L.latLngBounds(bounds).pad(0.3));
      }
    }
  }

  private buildMarkers() {
    Object.values(this.markers).forEach((m: any) => m.remove());
    this.markers = {};

    this.allData.forEach(item => {
      if (!item.lat || !item.lon) return;
      const icon = L.divIcon({
        html: this.markerSvg(item), className: '',
        iconSize: [30, 30], iconAnchor: [15, 15]
      });
      const m = L.marker([item.lat, item.lon], { icon })
        .addTo(this.map)
        .bindPopup(this.popupHtml(item), { maxWidth: 230, className: 'in-leaflet-popup' });

      m.on('click', () => this.ngZone.run(() => {
        this.selectedId = item.id;
        this.scrollToItem(item.id);
      }));
      this.markers[item.id] = m;
    });
  }

  private markerSvg(item: InfraItem): string {
    const sc = item.status === 'operationnel' ? '#10B981'
             : item.status === 'maintenance'  ? '#F59E0B'
             : item.status === 'panne'        ? '#EF4444'
             : '#94A3B8';
    const ring = item.status !== 'operationnel'
      ? `<circle cx="15" cy="15" r="13" fill="${sc}" opacity="0.2"/>`
      : '';

    if (item.type === 'captage') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <rect x="6" y="6" width="18" height="18" fill="${sc}" stroke="white" stroke-width="1.5" rx="2"/>
      </svg>`;
    if (item.type === 'forage' || item.type === 'puits') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <circle cx="15" cy="15" r="10" fill="#A5A4DC" stroke="white" stroke-width="1.5"/>
        <circle cx="15" cy="15" r="5"  fill="${sc}"/>
      </svg>`;
    if (item.type === 'pompage') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <circle cx="15" cy="15" r="10" fill="${sc}" stroke="white" stroke-width="1.5"/>
        <path d="M10,15 L20,15 M15,10 L15,20" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
    if (item.type === 'traitement') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <polygon points="15,4 26,23 4,23" fill="#06B6D4" stroke="white" stroke-width="1.5"/>
        <circle cx="15" cy="17" r="3.5" fill="${sc}"/>
      </svg>`;
    if (item.type === 'reservoir') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <rect x="9" y="4" width="12" height="22" fill="${sc}" stroke="white" stroke-width="1.5" rx="2"/>
      </svg>`;
    if (item.type === 'reseau') return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <path d="M4,15 Q9,7 15,15 Q21,23 26,15" fill="none" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="15" cy="15" r="3" fill="#34D399"/>
      </svg>`;
    return `
      <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <circle cx="15" cy="15" r="9" fill="${sc}" stroke="white" stroke-width="1.5"/>
        <circle cx="15" cy="15" r="4" fill="white" opacity="0.6"/>
      </svg>`;
  }

  private popupHtml(item: InfraItem): string {
    const sc = item.status === 'operationnel' ? '#10B981'
             : item.status === 'maintenance'  ? '#F59E0B'
             : item.status === 'panne'        ? '#EF4444' : '#94A3B8';
    const sl = this.statusLabel(item.status);
    const tl = this.typeFullLabel(item.type);
    const cap  = item.capaciteM3h ? `Capacité : <strong>${item.capaciteM3h} m³/h</strong>` : '';
    const res  = item.resourceName ? `Exploite : <span style="color:#10b981">${item.resourceName}</span>` : '';
    const yr   = item.anneeConstruction ? `${item.anneeConstruction} · ${CY - item.anneeConstruction} ans` : '';
    return `<div style="font-family:-apple-system,system-ui,sans-serif;min-width:190px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="font-size:9px;background:rgba(245,158,11,.15);color:#F59E0B;padding:1px 6px;border-radius:3px;font-weight:600;text-transform:uppercase">${tl}</span>
        <span style="font-size:11px;font-weight:700;color:#0f1419;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.name}</span>
        <span style="font-size:8px;background:${sc}22;color:${sc};padding:1px 5px;border-radius:999px;font-weight:700;flex-shrink:0">${sl}</span>
      </div>
      <div style="font-size:9px;color:#6b7280;margin-bottom:6px;line-height:1.6">
        ${item.commune} · ${item.department}<br/>
        ${cap}${cap && yr ? ' · ' : ''}${yr}<br/>
        ${res}
      </div>
      <div style="display:flex;gap:4px;padding-top:5px;border-top:1px solid #e5e7eb">
        <button onclick="window.__ifSelect('${item.id}')"
                style="background:#F59E0B;border:none;color:#0f1419;font-size:9px;padding:3px 8px;border-radius:3px;font-weight:700;cursor:pointer">
          Voir fiche →
        </button>
        <button style="background:#f3f4f6;border:1px solid #e5e7eb;color:#1f2937;font-size:9px;padding:3px 8px;border-radius:3px;cursor:pointer">
          Chaîne →
        </button>
      </div>
    </div>`;
  }

  private updateMarkerVisibility() {
    this.allData.forEach(item => {
      const m = this.markers[item.id];
      if (!m) return;
      if (this.isVisible(item)) m.addTo(this.map);
      else m.remove();
    });
  }

  private isVisible(item: InfraItem): boolean {
    if (this.catFilter !== 'all' && typeToCat(item.type) !== this.catFilter) return false;
    if (this.statusFilter && item.status !== this.statusFilter) return false;
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      return item.name.toLowerCase().includes(q)
          || item.commune.toLowerCase().includes(q)
          || item.code.toLowerCase().includes(q);
    }
    return true;
  }

  /* ── User interactions ────────────────────────────────────── */
  setCatFilter(c: InfraCat) {
    this.catFilter = c; this.showAll = false;
    this.updateMarkerVisibility();
  }

  setStatusFilter(s: '' | InfraStatus) {
    this.statusFilter = this.statusFilter === s ? '' : s;
    this.showAll = false;
    this.updateMarkerVisibility();
  }

  onSearch() {
    this.showAll = false;
    this.updateMarkerVisibility();
  }

  /* ── Drawer computed ─────────────────────────────────────── */
  get drawerInfra(): InfraItem | null {
    return this.drawerInfraId ? this.allData.find(i => i.id === this.drawerInfraId) ?? null : null;
  }
  get drawerIndex(): number {
    return this.allData.findIndex(i => i.id === this.drawerInfraId);
  }
  get drawerChain(): ChainNode[] {
    if (!this.drawerInfraId) return [];
    const chain = this.DR_CHAINS[this.drawerInfraId];
    if (chain) return chain;
    const item = this.drawerInfra;
    if (!item) return [];
    return [
      { kind:'resource', code: item.resourceId ?? '—', name: item.resourceName ?? 'Ressource inconnue', color:'#34D399' },
      { kind:'infra', code:item.code, name:item.name, type:item.type, color:'#F59E0B', isCurrent:true },
      { kind:'usagers', code:'', name:'—', color:'#A5A4DC', households:0 },
    ];
  }
  get drawerDetail(): InfraDetail | null {
    const item = this.drawerInfra;
    if (!item) return null;
    const det = this.DR_DETAILS[item.id];
    if (det) return det;
    return {
      owner:'DINEPA', operator:`OREPA ${item.department}`,
      serviceDate: item.anneeConstruction ? String(item.anneeConstruction) : '—',
      realFlow: item.capaciteM3h, realFlowPct: item.status === 'operationnel' ? 85 : 0,
      lifespan: item.type === 'reservoir' ? 50 : item.type === 'captage' ? 40 : 25,
      hoursPerDay: item.type === 'captage' ? '24h/24h · gravitaire' : '—',
    };
  }
  get drawerUsagers(): { households: number; persons: number } {
    if (this.drawerInfraId) {
      // C3 store takes precedence
      const c3 = GestidloStore.getC3ForInfra(this.drawerInfraId);
      if (c3.length) {
        const hh  = c3.reduce((s, c) => s + (Number(c.meta?.['households']) || 0), 0);
        const per = c3.reduce((s, c) => s + (Number(c.meta?.['persons'])    || 0), 0);
        return { households: hh, persons: per };
      }
    }
    const chain = this.drawerChain;
    const u = chain.find(n => n.kind === 'usagers');
    const hh = u?.households ?? 0;
    return { households: hh, persons: hh * 5 };
  }

  /** C7 — Alertes actives impactant cet ouvrage */
  get drawerC7Alerts(): Array<{ alertId: string; from: string; severity: string; since: string }> {
    if (!this.drawerInfraId) return [];
    return GestidloStore.getC7AlertsOn(this.drawerInfraId).map(c => ({
      alertId:  String(c.meta?.['alertId']     ?? '—'),
      from:     c.fromLabel ?? c.fromId,
      severity: String(c.meta?.['severity']    ?? 'warning'),
      since:    String(c.meta?.['triggeredAt'] ?? '—'),
    }));
  }

  /** C4 — Exploitant de cet ouvrage (store, fallback DR_DETAILS) */
  get drawerC4Operator(): string {
    if (!this.drawerInfraId) return '';
    const conn = GestidloStore.getOperatorOf(this.drawerInfraId);
    return conn?.fromLabel ?? this.drawerDetail?.operator ?? '';
  }
  get drawerImpactText(): string {
    const item = this.drawerInfra;
    if (!item) return '';
    const { households, persons } = this.drawerUsagers;
    if (item.status === 'panne') return `${item.code} est hors service. ${households > 0 ? `~${households} foyers (~${persons} personnes) sont actuellement privés d'eau.` : ''}`;
    if (households > 0) return `Si ${item.code} tombe en panne, ~${households} foyers (~${persons} personnes) sont privés d'eau. La ressource reste disponible mais ne peut plus être acheminée en aval.`;
    return '';
  }

  chainKindLabel(n: ChainNode): string {
    if (n.kind === 'resource') return 'RESSOURCE';
    if (n.kind === 'usagers') return 'USAGERS';
    return this.typeFullLabel(n.type!).toUpperCase();
  }

  formatDMS(deg: number, type: 'lat' | 'lon'): string {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(0);
    const dir = type === 'lat' ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'O');
    return `${d}°${m}'${s}"${dir}`;
  }

  openDrawer(id: string) {
    this.drawerInfraId = id;
    this.drawerTab = 'overview';
    const item = this.allData.find(i => i.id === id);
    if (item?.lat && item?.lon && this.map) {
      this.map.flyTo([item.lat, item.lon], 12, { duration: 0.8 });
    }
  }

  closeDrawer() { this.drawerInfraId = null; }

  openDrawerByCode(code: string) {
    const item = this.allData.find(i => i.code === code);
    if (item) this.openDrawer(item.id);
  }

  drawerPrev() {
    const idx = this.drawerIndex;
    if (idx > 0) this.openDrawer(this.allData[idx - 1].id);
  }
  drawerNext() {
    const idx = this.drawerIndex;
    if (idx < this.allData.length - 1) this.openDrawer(this.allData[idx + 1].id);
  }

  onListItemClick(item: InfraItem) {
    this.selectedId = item.id;
    if (item.lat && item.lon && this.map) {
      this.map.flyTo([item.lat, item.lon], 12, { duration: 0.8 });
    }
    this.openDrawer(item.id);
  }

  selectById(id: string) {
    this.selectedId = id;
    this.scrollToItem(id);
    this.openDrawer(id);
  }

  private scrollToItem(id: string) {
    setTimeout(() => {
      const el = this.listRef?.nativeElement
        .querySelector(`[data-if-id="${id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
  }

  zoomIn()     { this.map?.zoomIn(); }
  zoomOut()    { this.map?.zoomOut(); }
  recenter() {
    if (this.scope?.dept) { this.applyScopeView(); return; }
    this.map?.flyTo([18.9, -72.7], 8, { duration: 0.8 });
  }
  toggleChain() { this.chainView = !this.chainView; }

  openAddModal() {
    this.wizDraft = this.emptyDraft();
    if (this.scope?.dept) {
      this.wizDraft.department = this.scope.dept;
    }
    if (this.scope?.commune) {
      this.wizDraft.commune = this.scope.commune;   // TEPAC : commune verrouillée
    }
    // Géoloc pré-remplie depuis le point cliqué sur la carte (étape « Géolocalisation »).
    if (this.initialCoords) {
      this.wizDraft.lat = this.initialCoords.lat.toFixed(6);
      this.wizDraft.lon = this.initialCoords.lng.toFixed(6);
    }
    this.wizStep = 1;
    this.wizDraftSaved = false;
    this.wizResourceSearch = '';
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    if (this.wizMap) { this.wizMap.remove(); this.wizMap = null; }
    this._wizMapNeedsInit = false;
    if (this.overlayMode) this.overlayClose.emit();   // rend la main à la carte
  }

  private emptyDraft(): WizDraft {
    return {
      type:'', name:'', code:'', status:'operationnel', notes:'',
      lat:'', lon:'', altitude:'', department:'', commune:'', section:'', adresse:'',
      capaciteM3h:'', anneeConstruction:'', profondeur:'', resourceId:'', resourceName:'',
    };
  }

  wizSelectType(t: InfraType) {
    this.wizDraft.type = t;
  }

  wizAutoCode() {
    if (!this.wizDraft.type) return;
    const prefix: Record<string, string> = {
      captage:'CAP', forage:'F', puits:'P', pompage:'PUMP',
      traitement:'STA', reservoir:'TANK', reseau:'NET', borne:'BF',
    };
    const comm = (this.wizDraft.commune || 'XX').substring(0, 3).toUpperCase();
    const n = String(this.allData.filter(i => i.type === this.wizDraft.type).length + 1).padStart(2, '0');
    this.wizDraft.code = `${prefix[this.wizDraft.type] ?? 'OUV'}-${comm}-${n}`;
  }

  wizUpdateCoords() {
    this.updateWizMarker();
    if (this.wizMap && this.wizLocValid) {
      this.wizMap.setView([parseFloat(this.wizDraft.lat), parseFloat(this.wizDraft.lon)], 14);
    }
  }

  wizSelectResource(r: { id: string; name: string }) {
    this.wizDraft.resourceId = r.id;
    this.wizDraft.resourceName = r.name;
  }

  wizClearResource() {
    this.wizDraft.resourceId = '';
    this.wizDraft.resourceName = '';
  }

  wizLinkNearby(item: InfraItem) {
    // connect to nearby: store as a note
    this.wizDraft.notes = (this.wizDraft.notes ? this.wizDraft.notes + ' · ' : '') +
      `Connecté à ${item.code}`;
  }

  wizNext() {
    if (this.wizStep === 1 && !this.wizDraft.type) return;
    if (this.wizStep === 2 && !this.wizDraft.name) return;
    if (this.wizStep < 6) {
      this.wizStep++;
      this.wizDraftSaved = true;
      if (this.wizStep === 3) {
        if (this.wizMap) { this.wizMap.remove(); this.wizMap = null; }
        this._wizMapNeedsInit = true;
      }
    } else {
      this.wizSave();
    }
  }

  wizPrev() {
    if (this.wizStep > 1) {
      this.wizStep--;
      if (this.wizStep === 3) {
        if (this.wizMap) { this.wizMap.remove(); this.wizMap = null; }
        this._wizMapNeedsInit = true;
      }
    }
  }

  wizSave() {
    const lat = parseFloat(this.wizDraft.lat);
    const lon = parseFloat(this.wizDraft.lon);
    const newItem: InfraItem = {
      id: 'if-' + Date.now(),
      code: this.wizDraft.code || 'OUV-???-01',
      name: this.wizDraft.name,
      type: this.wizDraft.type as InfraType,
      status: this.wizDraft.status,
      department: this.wizDraft.department,
      commune: this.wizDraft.commune,
      section: this.wizDraft.section || undefined,
      lat: isNaN(lat) ? undefined : lat,
      lon: isNaN(lon) ? undefined : lon,
      capaciteM3h: this.wizDraft.capaciteM3h ? parseInt(this.wizDraft.capaciteM3h) : undefined,
      anneeConstruction: this.wizDraft.anneeConstruction ? parseInt(this.wizDraft.anneeConstruction) : undefined,
      resourceId: this.wizDraft.resourceId || undefined,
      resourceName: this.wizDraft.resourceName || undefined,
      notes: this.wizDraft.notes || undefined,
      // TEPAC : entre dans le cycle de validation (soumission) ; superviseur/admin : officiel d'office.
      validation: this.isTepac ? 'en_attente' : 'validee',
      createdBy: this.isTepac ? (this.scope?.commune ? 'TEPAC ' + this.scope.commune : undefined) : undefined,
    };
    this._allData = [...this._allData, newItem];
    this.persistCustom();

    // Persistance durable côté backend (le serveur impose dept/commune + statut pour un TEPAC).
    this.bff.createOuvrage(this.toBackend(newItem)).pipe(catchError(() => of(null)))
      .subscribe(dto => { if (dto) this.mergeBackend([dto]); });

    // ── Connexions persistantes ──────────────────────────────────
    // C1 : ressource naturelle → cet ouvrage
    if (newItem.resourceId) {
      GestidloStore.addConnection({
        type: 'C1',
        fromKind: 'resource', fromId: newItem.resourceId, fromLabel: newItem.resourceName,
        toKind: 'infra',     toId: newItem.id,           toLabel: newItem.name,
        meta: { code: newItem.code, status: newItem.status },
      });
    }
    // C2 : liaisons avec les ouvrages proches sélectionnés
    for (const near of this.wizNearby) {
      GestidloStore.addConnection({
        type: 'C2',
        fromKind: 'infra', fromId: newItem.id,  fromLabel: newItem.name,
        toKind:   'infra', toId:   near.id,     toLabel:   near.name,
      });
    }

    if (newItem.lat && newItem.lon && this.map) {
      const icon = L.divIcon({ html: this.markerSvg(newItem), className: '', iconSize: [30,30], iconAnchor: [15,15] });
      const m = L.marker([newItem.lat, newItem.lon], { icon })
        .addTo(this.map)
        .bindPopup(this.popupHtml(newItem), { maxWidth: 230, className: 'in-leaflet-popup' });
      m.on('click', () => this.ngZone.run(() => { this.selectedId = newItem.id; this.scrollToItem(newItem.id); }));
      this.markers[newItem.id] = m;
      this.map.flyTo([newItem.lat, newItem.lon], 13, { duration: 0.8 });
    }
    this.closeModal();
    this.selectedId = newItem.id;
    setTimeout(() => this.scrollToItem(newItem.id), 300);
  }

  private initWizMap() {
    if (!this.wizMapRef?.nativeElement || typeof L === 'undefined') return;
    const lat = parseFloat(this.wizDraft.lat) || 18.9;
    const lon = parseFloat(this.wizDraft.lon) || -72.7;
    this.wizMap = L.map(this.wizMapRef.nativeElement, {
      center: [lat, lon], zoom: 13, zoomControl: false, attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.wizMap);
    if (this.wizLocValid) {
      L.circleMarker([lat, lon], { radius: 8, color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.9, weight: 2 })
        .addTo(this.wizMap);
    }
  }

  private updateWizMarker() {
    if (!this.wizMap || !this.wizLocValid) return;
    const lat = parseFloat(this.wizDraft.lat);
    const lon = parseFloat(this.wizDraft.lon);
    this.wizMap.eachLayer((l: any) => {
      if (l instanceof L.CircleMarker) this.wizMap.removeLayer(l);
    });
    L.circleMarker([lat, lon], { radius: 8, color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.9, weight: 2 })
      .addTo(this.wizMap);
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  get wizLocValid(): boolean {
    const lat = parseFloat(this.wizDraft.lat), lon = parseFloat(this.wizDraft.lon);
    return !isNaN(lat) && !isNaN(lon) && lat > 17 && lat < 21 && lon > -75 && lon < -71;
  }

  get wizNearby(): InfraItem[] {
    if (!this.wizLocValid) return [];
    const lat = parseFloat(this.wizDraft.lat), lon = parseFloat(this.wizDraft.lon);
    return this.allData.filter(i => i.lat && i.lon && this.haversineKm(lat, lon, i.lat, i.lon) <= 0.5);
  }

  get wizFilteredResources() {
    const q = this.wizResourceSearch.toLowerCase();
    return this.WIZ_RESOURCES.filter(r =>
      r.name.toLowerCase().includes(q) || r.commune.toLowerCase().includes(q) || r.dept.toLowerCase().includes(q)
    );
  }

  wizStepDoneSub(i: number): string {
    const subs = [
      this.wizDraft.type ? this.typeFullLabel(this.wizDraft.type as InfraType) : '',
      this.wizDraft.code,
      [this.wizDraft.commune, this.wizDraft.department].filter(Boolean).join(' · '),
      this.wizDraft.capaciteM3h ? this.wizDraft.capaciteM3h + ' m³/h' : '',
      this.wizDraft.resourceName || '',
      '',
    ];
    return subs[i] ?? '';
  }

  get wizTypeLabel(): string { return this.wizDraft.type ? this.typeFullLabel(this.wizDraft.type as InfraType) : '—'; }
  get wizTypeIcon():  string { return this.wizDraft.type ? this.typeIcon(this.wizDraft.type as InfraType) : ''; }
  get wizTypeLabelFallback(): string { return this.typeFullLabel((this.wizDraft.type || 'reseau') as InfraType); }

  wizTypeCards(): Array<{ type: InfraType; icon: string; label: string; desc: string }> {
    return [
      { type: 'captage',    icon: 'square',   label: 'Captage',         desc: 'Prise d\'eau en surface' },
      { type: 'forage',     icon: 'circle',   label: 'Forage',          desc: 'Puits foré profond' },
      { type: 'puits',      icon: 'circle',   label: 'Puits',           desc: 'Puits à faible profondeur' },
      { type: 'pompage',    icon: 'plus',     label: 'Pompage',         desc: 'Station de pompage' },
      { type: 'traitement', icon: 'triangle', label: 'Traitement',      desc: 'Station de traitement' },
      { type: 'reservoir',  icon: 'rect',     label: 'Réservoir',       desc: 'Château d\'eau / citerne' },
      { type: 'reseau',     icon: 'wave',     label: 'Réseau',          desc: 'Conduite / réseau AEP' },
      { type: 'borne',      icon: 'dot',      label: 'Borne-fontaine',  desc: 'Point de distribution' },
    ];
  }

  /* ── Display helpers ──────────────────────────────────────── */
  formatFlow(n: number): string { return n.toLocaleString('fr-FR'); }

  statusLabel(s: InfraStatus): string {
    return { operationnel:'OPÉR.', maintenance:'MAINT.', panne:'PANNE', vetuste:'VÉTUSTE' }[s];
  }

  typeFullLabel(t: InfraType): string {
    const map: Record<InfraType, string> = {
      captage:'Captage', forage:'Forage', puits:'Puits',
      pompage:'Pompage', traitement:'Traitement', reservoir:'Réservoir',
      reseau:'Réseau', borne:'Borne-fontaine',
    };
    return map[t] ?? t;
  }

  typeIcon(t: InfraType): string {
    if (t === 'captage') return `
      <svg viewBox="0 0 14 14" width="12" height="12">
        <rect x="2" y="2" width="10" height="10" fill="#F59E0B" rx="1"/>
      </svg>`;
    if (t === 'forage' || t === 'puits') return `
      <svg viewBox="0 0 14 14" width="12" height="12">
        <circle cx="7" cy="7" r="5.5" fill="#A5A4DC"/>
        <circle cx="7" cy="7" r="2.5" fill="#6B7785"/>
      </svg>`;
    if (t === 'pompage') return `
      <svg viewBox="0 0 14 14" width="12" height="12">
        <circle cx="7" cy="7" r="5.5" fill="#F59E0B"/>
        <path d="M4,7 L10,7 M7,4 L7,10" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
    if (t === 'traitement') return `
      <svg viewBox="0 0 14 14" width="12" height="12">
        <polygon points="7,2 12,11 2,11" fill="#06B6D4"/>
      </svg>`;
    if (t === 'reservoir') return `
      <svg viewBox="0 0 10 14" width="8" height="12">
        <rect x="1" y="0" width="8" height="14" fill="#60A5FA" rx="1"/>
      </svg>`;
    if (t === 'reseau') return `
      <svg viewBox="0 0 14 8" width="13" height="8">
        <path d="M1,4 Q3.5,1 7,4 Q10.5,7 13,4" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    return `
      <svg viewBox="0 0 14 14" width="12" height="12">
        <circle cx="7" cy="7" r="5.5" fill="#34D399"/>
        <circle cx="7" cy="7" r="2.5" fill="white" opacity="0.6"/>
      </svg>`;
  }

  subText(item: InfraItem): string {
    const yr   = item.anneeConstruction ? `${item.anneeConstruction} · ${CY - item.anneeConstruction} ans` : '';
    const cap  = item.capaciteM3h ? `${item.capaciteM3h} m³/h` : '';
    if (item.type === 'reservoir') return [item.commune, cap, yr].filter(Boolean).join(' · ');
    if (item.type === 'traitement') return [item.commune, item.notes?.split('·')[0]?.trim() || 'traitement', yr].filter(Boolean).join(' · ');
    if (item.type === 'reseau' || item.type === 'borne') return [item.commune, yr].filter(Boolean).join(' · ');
    return [item.commune, cap, yr].filter(Boolean).join(' · ');
  }
}

import { Component, AfterViewInit, OnDestroy, OnInit, Input, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BffApiService, CapteurDto } from '../api/bff-api.service';
import { DEPT_BOUNDS, HAITI_DEPARTMENTS } from '../haiti-geo.service';

declare const L: any;

type CapType = 'pression' | 'niveau' | 'debit' | 'qualite';

/**
 * Page Capteurs IoT — un seul composant, scopé par rôle via `[scope]` :
 *   - TEPAC (scope.commune) : capteurs de sa commune, bouton « Déclarer un capteur » (→ EN_ATTENTE).
 *   - Superviseur (scope.dept) : capteurs du département + Valider/Rejeter les déclarations.
 *   - Admin (pas de scope) : national.
 * Le serveur impose le périmètre (TerritorialScope) ; cette page n'est que l'UX. Rafraîchissement
 * périodique (10 s) pour suivre les valeurs live alimentées par l'ingestion temps réel (HTTP).
 */
@Component({
  selector: 'app-capteurs-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="cp-shell">

  <!-- HEADER -->
  <div class="cp-head">
    <div class="cp-head__left">
      <div class="cp-head__icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#60A5FA" stroke-width="1.7" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <h2 class="cp-title">Capteurs IoT</h2>
        <p class="cp-sub">{{ scopeLabel }} · état en direct du réseau</p>
      </div>
    </div>
    <div class="cp-head__right">
      <span class="cp-kit"><span class="cp-kit__dot" [class.cp-kit__dot--off]="!anyFresh"></span>{{ anyFresh ? 'Flux temps réel actif' : 'En attente de données' }}</span>
      <button class="cp-btn cp-btn--primary" type="button" (click)="openDeclare()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        {{ isTepac ? 'Déclarer un capteur' : 'Ajouter un capteur' }}
      </button>
    </div>
  </div>

  <!-- STATS -->
  <div class="cp-kpis">
    <div class="cp-kpi"><div class="cp-kpi__k">{{ isTepac ? 'Capteurs assignés' : 'Capteurs' }}</div><div class="cp-kpi__v">{{ all.length }}</div></div>
    <div class="cp-kpi cp-kpi--green"><div class="cp-kpi__k">En ligne</div><div class="cp-kpi__v">{{ enLigne.length }}</div></div>
    <div class="cp-kpi cp-kpi--red"><div class="cp-kpi__k">En alerte</div><div class="cp-kpi__v">{{ enAlerte.length }}</div></div>
    <div class="cp-kpi cp-kpi--grey"><div class="cp-kpi__k">Hors ligne</div><div class="cp-kpi__v">{{ horsLigne.length }}</div></div>
    <div class="cp-kpi cp-kpi--blue"><div class="cp-kpi__k">En attente</div><div class="cp-kpi__v">{{ enAttente.length }}</div></div>
  </div>

  <!-- FILTERS -->
  <div class="cp-filters">
    <input class="cp-search" type="text" placeholder="Rechercher code, capteur, ouvrage…" [(ngModel)]="search" />
    <select *ngIf="!scope?.dept" class="cp-search" style="min-width:160px" [(ngModel)]="deptFilter" (ngModelChange)="onDeptFilter()">
      <option value="">Tous les départements</option>
      <option *ngFor="let d of DEPTS" [value]="d">{{ d }}</option>
    </select>
    <span class="cp-flbl">Type</span>
    <button class="cp-chip" [class.cp-chip--on]="typeFilter==='all'" (click)="typeFilter='all'">Tous <b>{{ all.length }}</b></button>
    <button class="cp-chip" [class.cp-chip--on]="typeFilter==='pression'" (click)="typeFilter='pression'">Pression <b>{{ byType('pression') }}</b></button>
    <button class="cp-chip" [class.cp-chip--on]="typeFilter==='niveau'" (click)="typeFilter='niveau'">Niveau <b>{{ byType('niveau') }}</b></button>
    <button class="cp-chip" [class.cp-chip--on]="typeFilter==='debit'" (click)="typeFilter='debit'">Débit <b>{{ byType('debit') }}</b></button>
    <button class="cp-chip" [class.cp-chip--on]="typeFilter==='qualite'" (click)="typeFilter='qualite'">Qualité <b>{{ byType('qualite') }}</b></button>
    <span class="cp-flbl">Validation</span>
    <button class="cp-chip" [class.cp-chip--on]="valFilter==='en-attente'" (click)="toggleVal('en-attente')"><span class="cp-dot cp-dot--blue"></span>En attente <b>{{ enAttente.length }}</b></button>
    <button class="cp-chip" [class.cp-chip--on]="valFilter==='validee'" (click)="toggleVal('validee')"><span class="cp-dot cp-dot--green"></span>Validés <b>{{ validees.length }}</b></button>
    <button class="cp-chip" [class.cp-chip--on]="valFilter==='rejete'" (click)="toggleVal('rejete')"><span class="cp-dot cp-dot--red"></span>Rejetés <b>{{ rejetes.length }}</b></button>
  </div>

  <div class="cp-split">
    <!-- MAP -->
    <div class="cp-card cp-map-card">
      <div class="cp-card-head"><span class="cp-card-title">Carte des capteurs</span><span class="cp-card-meta">{{ filtered.length }} capteurs</span></div>
      <div class="cp-map-wrap"><div #capMap class="cp-map"></div></div>
    </div>

    <!-- LIST -->
    <div class="cp-card cp-list-card">
      <div class="cp-card-head"><span class="cp-card-title">Liste synchronisée</span><span class="cp-card-meta">{{ filtered.length }}</span></div>
      <div class="cp-list">
        <div class="cp-empty" *ngIf="loading">Chargement…</div>
        <div class="cp-empty" *ngIf="!loading && filtered.length===0">Aucun capteur sur ce périmètre.</div>
        <div class="cp-item" *ngFor="let c of filtered" [class.cp-item--sel]="c.id===selectedId" (click)="ouvrirCapteur(c)">
          <div class="cp-item__top">
            <span class="cp-type" [attr.data-t]="c.type">{{ typeShort(c.type) }}</span>
            <span class="cp-item__name">{{ c.nom }}</span>
            <span class="cp-pill" [ngClass]="'cp-pill--'+c.etat">{{ etatLabel(c.etat) }}</span>
          </div>
          <div class="cp-item__sub">{{ c.ouvrageNom || '—' }}<span *ngIf="c.commune"> · {{ c.commune }}</span></div>
          <div class="cp-item__row">
            <span class="cp-mesure">{{ c.mesure }}</span>
            <span class="cp-meta" *ngIf="c.battery != null">🔋 {{ c.battery }}%</span>
            <span class="cp-meta" *ngIf="c.derniereMesure">· {{ ago(c.derniereMesure) }}</span>
            <span class="cp-code">{{ c.code }}</span>
          </div>

          <div class="cp-val" *ngIf="c.statut !== 'VALIDEE'"
               [class.cp-val--wait]="c.statut==='EN_ATTENTE_VALIDATION'" [class.cp-val--rej]="c.statut==='REJETEE'">
            <span class="cp-val__tag">{{ c.statut==='EN_ATTENTE_VALIDATION' ? 'En attente' : 'Rejeté' }}</span>
            <span class="cp-val__by" *ngIf="c.statut==='EN_ATTENTE_VALIDATION' && c.createdBy">déclaré par {{ c.createdBy }}</span>
            <span class="cp-val__by" *ngIf="c.statut==='REJETEE' && c.motifRejet">{{ c.motifRejet }}</span>
          </div>

          <div class="cp-actions" *ngIf="canValidate && c.statut==='EN_ATTENTE_VALIDATION'">
            <button class="cp-btn cp-btn--ok" type="button" (click)="valider(c, $event)">Valider</button>
            <button class="cp-btn cp-btn--ko" type="button" (click)="rejeter(c, $event)">Rejeter</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- REAL-TIME PANEL -->
  <div class="cp-rt" *ngIf="selected as c">
    <div class="cp-rt__head">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><path d="M2 12h2l3-7 4 14 3-7 3 5 2-5h3"/></svg>
      Flux temps réel · {{ c.nom }}
      <span class="cp-rt__live" *ngIf="isFresh(c)"><span class="cp-rt__dot"></span>live</span>
      <button class="cp-btn" type="button" style="margin-left:auto;font-size:11px;padding:4px 10px;" (click)="voirLive(c)">
        <i class="ti ti-maximize" style="font-size:13px;vertical-align:-2px;margin-right:3px;"></i> En direct
      </button>
    </div>
    <div class="cp-rt__grid">
      <div><span class="cp-rt__k">Topic MQTT</span><span class="cp-rt__v cp-rt__v--mono">{{ c.mqttTopic || '—' }}</span></div>
      <div><span class="cp-rt__k">Device</span><span class="cp-rt__v cp-rt__v--mono">{{ c.deviceId || '—' }}</span></div>
      <div><span class="cp-rt__k">Dernière valeur</span><span class="cp-rt__v" [ngClass]="'cp-fg--'+c.etat">{{ c.mesure }}</span></div>
      <div><span class="cp-rt__k">État calculé</span><span class="cp-rt__v" [ngClass]="'cp-fg--'+c.etat">{{ etatLabel(c.etat) }}</span></div>
      <div><span class="cp-rt__k">Signal</span><span class="cp-rt__v">{{ c.signal != null ? c.signal + ' dBm' : '—' }}</span></div>
      <div><span class="cp-rt__k">Reçu</span><span class="cp-rt__v">{{ c.derniereMesure ? ago(c.derniereMesure) : 'jamais' }}</span></div>
    </div>
  </div>
</div>

<!-- DECLARE MODAL -->
<div class="cp-overlay" *ngIf="declareOpen" (click)="declareOpen=false">
  <div class="cp-modal" (click)="$event.stopPropagation()">
    <div class="cp-modal__head">
      <h3>{{ isTepac ? 'Déclarer un capteur' : 'Ajouter un capteur' }}</h3>
      <button class="cp-x" (click)="declareOpen=false">✕</button>
    </div>
    <div class="cp-modal__body">
      <p class="cp-sec">Identité</p>
      <label class="cp-f"><span>Nom du capteur *</span><input [(ngModel)]="draft.nom" placeholder="Capteur pression Forage F-08" /></label>
      <div class="cp-f2">
        <label class="cp-f"><span>Type *</span>
          <select [(ngModel)]="draft.type">
            <option value="PRESSION">Pression</option><option value="NIVEAU">Niveau</option>
            <option value="DEBIT">Débit</option><option value="QUALITE">Qualité</option>
          </select>
        </label>
        <label class="cp-f"><span>Unité <i class="cp-auto">auto</i></span><div class="cp-ro">{{ autoUnit || '—' }}</div></label>
      </div>
      <label class="cp-f"><span>Device ID *</span><input [(ngModel)]="draft.deviceId" placeholder="ESP32-CAR-F08" /></label>

      <p class="cp-sec">Rattachement</p>
      <label class="cp-f"><span>Ouvrage concerné</span><input [(ngModel)]="draft.ouvrageNom" placeholder="Forage Carrefour F-08" /></label>
      <label class="cp-f"><span>Code capteur <i class="cp-auto">auto</i></span><div class="cp-ro cp-ro--mono">{{ autoCode }}</div></label>

      <p class="cp-sec">Localisation</p>
      <div class="cp-f2">
        <label class="cp-f"><span>Latitude</span><input [(ngModel)]="draft.lat" placeholder="18.5411" /></label>
        <label class="cp-f"><span>Longitude</span><input [(ngModel)]="draft.lon" placeholder="-72.3992" /></label>
      </div>

      <p class="cp-sec">Avancé</p>
      <label class="cp-f"><span>Topic MQTT <i class="cp-auto">métadonnée</i></span><div class="cp-ro cp-ro--mono">{{ autoTopic }}</div></label>
      <p class="cp-note">Transport réel = HTTP (POST /api/iot/measurements). Le topic est une métadonnée d'affichage, dérivée automatiquement.</p>

      <label class="cp-f" *ngIf="!isTepac"><span>Département *</span><input [(ngModel)]="draft.department" [placeholder]="scope?.dept || 'Ouest'" /></label>
      <p class="cp-hint" *ngIf="isTepac">🔒 Commune verrouillée sur {{ scope?.commune }} · cette déclaration sera soumise au superviseur pour validation.</p>
    </div>
    <div class="cp-modal__foot">
      <button class="cp-btn" (click)="declareOpen=false">Annuler</button>
      <button class="cp-btn cp-btn--primary" [disabled]="!draft.nom" (click)="submitDeclare()">
        {{ isTepac ? 'Soumettre au superviseur' : 'Enregistrer' }}
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display:block; color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; }
    .cp-shell { display:flex; flex-direction:column; gap:14px; }
    .cp-head { display:flex; align-items:center; gap:12px; }
    .cp-head__left { display:flex; align-items:center; gap:12px; flex:1; }
    .cp-head__icon { width:38px; height:38px; border-radius:10px; background:rgba(96,165,250,.12); display:flex; align-items:center; justify-content:center; }
    .cp-title { font-size:1.1rem; font-weight:600; margin:0; color:#F5F7FA; }
    .cp-sub { font-size:.78rem; color:#8B9AAB; margin:2px 0 0; }
    .cp-head__right { display:flex; align-items:center; gap:12px; }
    .cp-kit { font-size:11px; color:#8B9AAB; display:flex; align-items:center; gap:6px; }
    .cp-kit__dot { width:8px; height:8px; border-radius:50%; background:#34D399; box-shadow:0 0 0 3px rgba(52,211,153,.18); }
    .cp-kit__dot--off { background:#6B7785; box-shadow:none; }
    .cp-btn { font-size:12px; padding:7px 12px; border-radius:8px; border:1px solid #2A3744; background:#1A2530; color:#CBD5E1; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
    .cp-btn:hover:not(:disabled) { opacity:.88; } .cp-btn:disabled { opacity:.4; cursor:not-allowed; }
    .cp-btn--primary { background:#2563EB; border-color:#2563EB; color:#fff; font-weight:600; }
    .cp-btn--ok { background:rgba(16,185,129,.12); border-color:rgba(16,185,129,.4); color:#34D399; flex:1; justify-content:center; }
    .cp-btn--ko { background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.4); color:#F87171; flex:1; justify-content:center; }
    .cp-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
    @media (max-width:900px){ .cp-kpis{ grid-template-columns:repeat(2,1fr);} }
    .cp-kpi { background:#161E28; border:1px solid #1F2A33; border-left:3px solid #3B82F6; border-radius:8px; padding:10px 12px; }
    .cp-kpi--green{ border-left-color:#10B981; } .cp-kpi--red{ border-left-color:#EF4444; }
    .cp-kpi--grey{ border-left-color:#6B7785; } .cp-kpi--blue{ border-left-color:#60A5FA; }
    .cp-kpi__k { font-size:10px; color:#8B9AAB; text-transform:uppercase; letter-spacing:.04em; }
    .cp-kpi__v { font-size:1.5rem; font-weight:700; color:#F5F7FA; margin-top:2px; }
    .cp-filters { display:flex; flex-wrap:wrap; align-items:center; gap:7px; background:#0E131C; border:1px solid #1F2A33; border-radius:10px; padding:10px 12px; }
    .cp-search { background:#0B0F16; border:1px solid #1F2A33; border-radius:7px; color:#E2E8EE; font-size:12px; padding:6px 10px; min-width:220px; }
    .cp-flbl { font-size:10px; color:#6B7785; text-transform:uppercase; margin-left:6px; }
    .cp-chip { font-size:11px; padding:5px 9px; border-radius:999px; border:1px solid #2A3744; background:#131C26; color:#B9C6D3; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
    .cp-chip b { color:#7E8CA0; font-weight:600; } .cp-chip--on { border-color:#3B82F6; background:rgba(59,130,246,.14); color:#DCE7F5; }
    .cp-dot { width:7px; height:7px; border-radius:50%; } .cp-dot--blue{ background:#60A5FA;} .cp-dot--green{ background:#34D399;} .cp-dot--red{ background:#F87171;}
    .cp-split { display:grid; grid-template-columns:1.4fr 1fr; gap:14px; } @media (max-width:1000px){ .cp-split{ grid-template-columns:1fr;} }
    .cp-card { background:#0E131C; border:1px solid #1F2A33; border-radius:12px; overflow:hidden; }
    .cp-card-head { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #1F2A33; }
    .cp-card-title { font-size:12px; font-weight:600; color:#E2E8EE; } .cp-card-meta { font-size:11px; color:#6B7785; }
    .cp-map-wrap { height:380px; } .cp-map { height:100%; width:100%; }
    .cp-list { max-height:380px; overflow:auto; }
    .cp-item { padding:10px 14px; border-bottom:1px solid #16202A; cursor:pointer; border-left:3px solid transparent; }
    .cp-item:hover { background:#121A24; } .cp-item--sel { background:#13202E; border-left-color:#3B82F6; }
    .cp-item__top { display:flex; align-items:center; gap:8px; }
    .cp-type { font-size:9px; font-weight:700; padding:1px 6px; border-radius:4px; background:rgba(96,165,250,.15); color:#7FB3F8; text-transform:uppercase; }
    .cp-item__name { flex:1; font-size:12.5px; color:#E8EEF4; font-weight:500; }
    .cp-item__sub { font-size:10.5px; color:#7E8CA0; margin-top:3px; }
    .cp-item__row { display:flex; align-items:center; gap:8px; margin-top:4px; }
    .cp-mesure { font-size:12px; font-weight:600; color:#CBD5E1; } .cp-meta { font-size:10px; color:#7E8CA0; }
    .cp-code { font-size:9px; color:#5B6675; font-family:'SF Mono',monospace; margin-left:auto; }
    .cp-pill { font-size:10px; padding:2px 8px; border-radius:999px; font-weight:600; white-space:nowrap; }
    .cp-pill--en-ligne { background:rgba(52,211,153,.14); color:#34D399; }
    .cp-pill--attention { background:rgba(245,158,11,.16); color:#FBBF24; }
    .cp-pill--critique { background:rgba(248,113,113,.16); color:#F87171; }
    .cp-pill--hors-ligne { background:rgba(255,255,255,.06); color:#8B9AAB; }
    .cp-pill--en-attente { background:rgba(96,165,250,.16); color:#60A5FA; }
    .cp-pill--rejete { background:rgba(120,40,40,.3); color:#F49B9B; }
    .cp-fg--en-ligne{color:#34D399;} .cp-fg--attention{color:#FBBF24;} .cp-fg--critique{color:#F87171;} .cp-fg--hors-ligne{color:#8B9AAB;} .cp-fg--en-attente{color:#60A5FA;} .cp-fg--rejete{color:#F49B9B;}
    .cp-val { display:flex; align-items:center; gap:6px; margin-top:6px; font-size:9px; }
    .cp-val__tag { font-weight:700; text-transform:uppercase; padding:1px 6px; border-radius:999px; }
    .cp-val--wait .cp-val__tag { background:rgba(96,165,250,.16); color:#60A5FA; } .cp-val--rej .cp-val__tag { background:rgba(239,68,68,.15); color:#F87171; }
    .cp-val__by { color:#8B9AAB; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cp-actions { display:flex; gap:6px; margin-top:8px; }
    .cp-rt { background:#0E131C; border:1px solid #1F2A33; border-radius:12px; padding:12px 14px; }
    .cp-rt__head { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:#E2E8EE; margin-bottom:10px; }
    .cp-rt__live { display:inline-flex; align-items:center; gap:4px; font-size:10px; color:#34D399; font-weight:600; }
    .cp-rt__dot { width:7px; height:7px; border-radius:50%; background:#34D399; box-shadow:0 0 0 3px rgba(52,211,153,.18); }
    .cp-rt__grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; } @media (max-width:700px){ .cp-rt__grid{ grid-template-columns:repeat(2,1fr);} }
    .cp-rt__grid > div { display:flex; flex-direction:column; gap:2px; }
    .cp-rt__k { font-size:9px; color:#6B7785; text-transform:uppercase; letter-spacing:.04em; }
    .cp-rt__v { font-size:12.5px; color:#D6DEE7; font-weight:500; } .cp-rt__v--mono { font-family:'SF Mono',monospace; font-size:11px; }
    .cp-overlay { position:fixed; inset:0; background:rgba(4,8,12,.6); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .cp-modal { width:460px; max-width:94vw; max-height:90vh; overflow:auto; background:#0E131C; border:1px solid #243042; border-radius:14px; }
    .cp-modal__head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #1F2A33; }
    .cp-modal__head h3 { margin:0; font-size:14px; color:#F5F7FA; }
    .cp-x { background:none; border:none; color:#8B9AAB; cursor:pointer; font-size:14px; }
    .cp-modal__body { padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
    .cp-f { display:flex; flex-direction:column; gap:4px; font-size:11px; color:#9AA8B6; }
    .cp-f input, .cp-f select { background:#0B0F16; border:1px solid #243042; border-radius:7px; color:#E2E8EE; font-size:12px; padding:7px 9px; }
    .cp-f2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .cp-sec { font-size:10px; font-weight:600; color:#7E8CA0; text-transform:uppercase; letter-spacing:.05em; margin:6px 0 -2px; }
    .cp-sec:first-child { margin-top:0; }
    .cp-auto { font-size:9px; font-style:normal; background:rgba(96,165,250,.16); color:#7FB3F8; padding:1px 5px; border-radius:4px; margin-left:4px; }
    .cp-ro { height:34px; border:1px dashed #2A3744; border-radius:7px; display:flex; align-items:center; padding:0 10px; font-size:12px; color:#8B9AAB; background:#0B0F16; }
    .cp-ro--mono { font-family:'SF Mono',monospace; font-size:11px; }
    .cp-note { font-size:10px; color:#6B7785; margin:-2px 0 0; }
    .cp-hint { font-size:10.5px; color:#FBBF24; background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.22); border-radius:7px; padding:8px 10px; margin:0; }
    .cp-modal__foot { display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #1F2A33; }
    .cp-empty { font-size:12px; color:#6B7785; padding:18px 14px; }
  `],
})
export class CapteursPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() scope?: { dept: string; commune?: string };
  @ViewChild('capMap') mapRef?: ElementRef<HTMLDivElement>;

  readonly DEPTS = HAITI_DEPARTMENTS;
  all: CapteurDto[] = [];
  loading = true;
  search = '';
  /** Drill-down département en vue nationale (admin uniquement). */
  deptFilter = '';
  typeFilter: 'all' | CapType = 'all';
  valFilter: '' | 'en-attente' | 'validee' | 'rejete' = '';
  selectedId: string | null = null;

  declareOpen = false;
  draft: any = this.emptyDraft();

  private map: any;
  private markers: Record<string, any> = {};
  private poll: any;

  constructor(private bff: BffApiService, private ngZone: NgZone,
              private router: Router, private route: ActivatedRoute) {}

  /** Ouvre la vue STATION (live) de l'OUVRAGE du capteur — agrège les capteurs de cet ouvrage. */
  voirLive(c: CapteurDto): void {
    if (!c.ouvrageId) return;   // capteur non rattaché à un ouvrage : pas de station
    this.router.navigate(['ouvrage', c.ouvrageId], { relativeTo: this.route });
  }

  /** Clic sur une ligne capteur → page détail live de CE capteur (mesures, courbe, historique). */
  ouvrirCapteur(c: CapteurDto): void {
    this.router.navigate([c.code, 'live'], { relativeTo: this.route });
  }

  get isTepac(): boolean { return !!this.scope?.commune; }
  /** Valide qui n'est pas TEPAC commune : superviseur (dept) ET admin (national). */
  get canValidate(): boolean { return !this.scope?.commune; }
  get scopeLabel(): string {
    return this.scope?.commune ? 'Vue scopée · commune ' + this.scope.commune
      : this.scope?.dept ? 'Vue scopée · département ' + this.scope.dept : 'Vue nationale';
  }

  ngOnInit() { this.reload(); this.poll = setInterval(() => this.reload(), 5000); }
  ngAfterViewInit() { setTimeout(() => this.initMap(), 150); }
  ngOnDestroy() { if (this.poll) clearInterval(this.poll); if (this.map) { this.map.remove(); this.map = null; } }

  private reload() {
    // Admin national : drill-down par département si choisi. Sinon le serveur impose le périmètre.
    const dept = (!this.scope?.dept && this.deptFilter) ? this.deptFilter : undefined;
    this.bff.listCapteurs(dept).subscribe({
      next: list => { this.all = list ?? []; this.loading = false; this.buildMarkers(); },
      error: () => { this.loading = false; },
    });
  }

  /** Admin : changement du filtre département → recharge + recadre la carte. */
  onDeptFilter() { this.loading = true; this.reload(); }

  /* ── Derived ── */
  get validees()   { return this.all.filter(c => c.statut === 'VALIDEE'); }
  get enAttente()  { return this.all.filter(c => c.statut === 'EN_ATTENTE_VALIDATION'); }
  get rejetes()    { return this.all.filter(c => c.statut === 'REJETEE'); }
  get enLigne()    { return this.all.filter(c => c.etat === 'en-ligne'); }
  get enAlerte()   { return this.all.filter(c => c.etat === 'critique' || c.etat === 'attention'); }
  get horsLigne()  { return this.all.filter(c => c.etat === 'hors-ligne'); }
  get anyFresh()   { return this.all.some(c => this.isFresh(c)); }
  byType(t: CapType) { return this.all.filter(c => c.type.toLowerCase() === t).length; }

  get filtered(): CapteurDto[] {
    return this.all.filter(c => {
      if (this.typeFilter !== 'all' && c.type.toLowerCase() !== this.typeFilter) return false;
      if (this.valFilter === 'en-attente' && c.statut !== 'EN_ATTENTE_VALIDATION') return false;
      if (this.valFilter === 'validee' && c.statut !== 'VALIDEE') return false;
      if (this.valFilter === 'rejete' && c.statut !== 'REJETEE') return false;
      if (this.search) {
        const q = this.search.toLowerCase();
        return c.nom.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
            || (c.ouvrageNom ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }

  get selected(): CapteurDto | null { return this.all.find(c => c.id === this.selectedId) ?? null; }
  select(c: CapteurDto) { this.selectedId = c.id; if (c.lat && c.lon && this.map) this.map.panTo([c.lat, c.lon]); }
  toggleVal(v: 'en-attente' | 'validee' | 'rejete') { this.valFilter = this.valFilter === v ? '' : v; }

  /* ── Validation ── */
  valider(c: CapteurDto, ev: Event) {
    ev.stopPropagation();
    this.bff.validerCapteur(c.id).subscribe({ next: () => this.reload(), error: () => this.reload() });
  }
  rejeter(c: CapteurDto, ev: Event) {
    ev.stopPropagation();
    const motif = (window.prompt(`Motif du rejet de « ${c.nom} » :`, '') ?? '').trim();
    if (!motif) return;
    this.bff.rejeterCapteur(c.id, motif).subscribe({ next: () => this.reload(), error: () => this.reload() });
  }

  /* ── Declare ── */
  openDeclare() { this.draft = this.emptyDraft(); this.declareOpen = true; }
  submitDeclare() {
    const d = this.draft;
    this.bff.declarerCapteur({
      // code / unité / topic sont DÉRIVÉS (pas saisis) → cohérence + zéro doublon de saisie.
      code: this.autoCode, nom: d.nom, type: d.type,
      department: this.isTepac ? undefined : (d.department || this.scope?.dept),
      commune: this.isTepac ? undefined : (this.scope?.commune ?? null),
      ouvrageNom: d.ouvrageNom || null, deviceId: d.deviceId || null,
      mqttTopic: this.autoTopic, unit: this.autoUnit,
      lat: d.lat ? parseFloat(d.lat) : null, lon: d.lon ? parseFloat(d.lon) : null,
    }).subscribe({ next: () => { this.declareOpen = false; this.reload(); }, error: () => { this.declareOpen = false; this.reload(); } });
  }
  private emptyDraft() { return { nom: '', type: 'PRESSION', ouvrageNom: '', deviceId: '', lat: '', lon: '', department: '' }; }

  /** Unité dérivée du type (lecture seule). */
  get autoUnit(): string { return ({ PRESSION: 'bar', NIVEAU: '%', DEBIT: 'L/min', QUALITE: 'NTU' } as any)[this.draft.type] ?? ''; }

  /** Topic MQTT = métadonnée d'affichage dérivée (l'ingestion réelle est en HTTP). */
  get autoTopic(): string {
    const dept = this.slug(this.scope?.dept || this.draft.department || 'dept');
    const com  = this.slug(this.scope?.commune || 'commune');
    const ouv  = this.slug(this.draft.ouvrageNom || 'ouvrage');
    const t = ({ PRESSION: 'pression', NIVEAU: 'niveau', DEBIT: 'debit', QUALITE: 'qualite' } as any)[this.draft.type] ?? 'mesure';
    return `gestidlo/${dept}/${com}/${ouv}/${t}`;
  }

  /** Code capteur auto : CPT-<type>-<COMMUNE3>-<seq>. Unicité finale garantie par le backend. */
  get autoCode(): string {
    const pfx = ({ PRESSION: 'PR', NIVEAU: 'NV', DEBIT: 'DB', QUALITE: 'QL' } as any)[this.draft.type] ?? 'XX';
    const base = this.scope?.commune || this.draft.department || 'GEN';
    const com = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
    const n = this.all.filter(c => c.type === this.draft.type).length + 1;
    return `CPT-${pfx}-${com}-${String(n).padStart(3, '0')}`;
  }

  private slug(s: string): string {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /* ── Map ── */
  private initMap() {
    if (!this.mapRef?.nativeElement || typeof L === 'undefined') return;
    this.map = L.map(this.mapRef.nativeElement, { center: [18.9, -72.7], zoom: 8, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(this.map);
    this.buildMarkers();
    this.applyScopeView();
  }
  private buildMarkers() {
    if (!this.map) return;
    Object.values(this.markers).forEach((m: any) => m.remove());
    this.markers = {};
    for (const c of this.all) {
      if (c.lat == null || c.lon == null) continue;
      const m = L.circleMarker([c.lat, c.lon], { radius: 8, weight: 2, color: '#0B0F16', fillColor: this.etatColor(c.etat), fillOpacity: .95 })
        .addTo(this.map).bindPopup(`<b>${c.nom}</b><br/>${c.mesure} · ${this.etatLabel(c.etat)}`);
      m.on('click', () => this.ngZone.run(() => this.select(c)));
      this.markers[c.id] = m;
    }
    this.applyScopeView();
  }
  private applyScopeView() {
    if (!this.map) return;
    if (this.scope?.commune) {
      const pts = this.all.filter(c => c.lat != null && c.lon != null).map(c => [c.lat as number, c.lon as number] as [number, number]);
      if (pts.length) {
        const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const pad = 0.11;
        if (pts.length === 1) this.map.setView([lat, lon], 13);
        else this.map.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom: 14 });
        this.map.setMaxBounds(L.latLngBounds([lat - pad, lon - pad], [lat + pad, lon + pad]));
        return;
      }
    }
    if (this.scope?.dept) {
      const b = DEPT_BOUNDS[this.scope.dept];
      if (b) { this.map.fitBounds(b); this.map.setMaxBounds(L.latLngBounds(b).pad(0.3)); }
      return;
    }
    // Admin national : pas de verrou ; on recadre sur le département filtré, sinon Haïti entier.
    this.map.setMaxBounds(null);
    const b = this.deptFilter ? DEPT_BOUNDS[this.deptFilter] : null;
    if (b) this.map.fitBounds(b);
    else this.map.setView([18.9, -72.7], 8);
  }

  /* ── Display helpers ── */
  isFresh(c: CapteurDto): boolean {
    if (!c.derniereMesure) return false;
    return Date.now() - new Date(c.derniereMesure).getTime() < 5 * 60 * 1000;
  }
  ago(iso: string): string {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'il y a ' + s + ' s';
    if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    return 'il y a ' + Math.round(s / 3600) + ' h';
  }
  typeShort(t: string): string { return { pression: 'PR', niveau: 'NV', debit: 'DB', qualite: 'QL' }[t.toLowerCase()] ?? t.slice(0, 2).toUpperCase(); }
  etatLabel(e: string): string {
    return { 'en-ligne': 'En ligne', attention: 'Attention', critique: 'Critique', 'hors-ligne': 'Hors ligne', 'en-attente': 'En attente', rejete: 'Rejeté' }[e] ?? e;
  }
  etatColor(e: string): string {
    return { 'en-ligne': '#34D399', attention: '#FBBF24', critique: '#F87171', 'hors-ligne': '#8B9AAB', 'en-attente': '#60A5FA', rejete: '#B45B5B' }[e] ?? '#8B9AAB';
  }
}

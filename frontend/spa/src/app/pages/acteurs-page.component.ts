import { ChangeDetectionStrategy, Component, Input, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { InstitutionsStore, InstitutionData, InstitutionType } from '../institutions.store';
import { ZoneRegistreService } from '../zone-registre.service';
import { InfrastructureStore } from '../infrastructure.store';
import { AlertStore } from '../alert.store';
import { InterventionStore } from '../intervention.store';
import { ActeurStore, ActeurDto } from '../acteur.store';
import { ActeurTypeDto, BffApiService } from '../api/bff-api.service';
import { ActeurFormModalComponent } from './acteur-form-modal.component';
import { TEPAC_MAP } from '../tepac.data';

export type ActeurFamily = 'tepac' | 'operateur' | 'caepa' | 'mairie' | 'partenaire';
export type ActeurEtat   = 'actif' | 'vacant' | 'suspendu';

export interface Acteur {
  id: string;
  family: ActeurFamily;
  nom: string;
  initiales: string;
  typeLabel: string;
  rattachement: string;
  etat: ActeurEtat;
  isPerson: boolean;
  commune?: string;
}

interface FamilyDef { key: ActeurFamily; label: string; sub: string; icon: string; }

const FAMILIES: FamilyDef[] = [
  { key: 'tepac',      label: 'TEPAC',       sub: "relais communal de l'URD", icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5z' },
  { key: 'operateur',  label: 'Opérateurs',  sub: 'exploitants des ouvrages', icon: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-3' },
  { key: 'caepa',      label: 'CAEPA',       sub: 'comités de zone',          icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M23 21v-2a4 4 0 0 0-3-3.87' },
  { key: 'mairie',     label: 'Mairies',     sub: "maître d'ouvrage",         icon: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6' },
  { key: 'partenaire', label: 'Partenaires', sub: 'ONG · bailleurs',          icon: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM2 12h20' },
];

function familyOf(type: InstitutionType): ActeurFamily | null {
  switch (type) {
    case 'operateur':    return 'operateur';
    case 'caepa':        return 'caepa';
    case 'municipalite': return 'mairie';
    case 'ong':
    case 'bailleur':     return 'partenaire';
    default:             return null;
  }
}

function initiales(nom: string): string {
  return (nom ?? '').split(/[\s.\-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

@Component({
  selector: 'app-acteurs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ActeurFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ac-shell" [class.ac-shell--embedded]="!!_scope()">

  <!-- En-tête scopé -->
  <div class="ac-scope-header" *ngIf="_scope() as sc">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
    <span>Vue scopée · département {{ sc.dept }}</span>
    <span class="ac-scope-count">{{ acteurs().length }} acteur{{ acteurs().length !== 1 ? 's' : '' }}</span>
    <div class="ac-actions">
      <button type="button" class="ac-btn" (click)="openCreate('TEPAC')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Affecter TEPAC
      </button>
      <button type="button" class="ac-btn ac-btn--primary" (click)="openCreate()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Enregistrer un acteur
      </button>
    </div>
  </div>

  <!-- Résumé par famille -->
  <div class="ac-kpis">
    <div class="ac-kpi" *ngFor="let f of families">
      <div class="ac-kpi__label">{{ f.label }}</div>
      <div class="ac-kpi__val">{{ f.key === 'tepac' ? tepacActifs() : familyCount(f.key) }}</div>
      <div class="ac-kpi__sub" *ngIf="f.key === 'tepac'; else famSub">{{ communesCouvertes() }} / {{ communesTotal() }} communes couvertes</div>
      <ng-template #famSub><div class="ac-kpi__sub">{{ f.sub }}</div></ng-template>
    </div>
  </div>

  <!-- Bannière couverture TEPAC -->
  <div class="ac-banner" *ngIf="vacantTepac() > 0">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span>{{ vacantTepac() }} commune{{ vacantTepac() !== 1 ? 's' : '' }} sans couverture TEPAC active — couverture incomplète</span>
  </div>

  <!-- Recherche -->
  <div class="ac-search">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6B7785" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" placeholder="Rechercher un acteur, une commune…" [ngModel]="search()" (ngModelChange)="search.set($event)"/>
  </div>

  <!-- Chips type -->
  <div class="ac-chips">
    <span class="ac-chips__lbl">TYPE</span>
    <button type="button" class="ac-chip" [class.ac-chip--on]="typeFilter()==='all'" (click)="typeFilter.set('all')">Tous <span class="ac-chip__n">{{ acteurs().length }}</span></button>
    <button type="button" class="ac-chip" *ngFor="let f of families" [class.ac-chip--on]="typeFilter()===f.key" (click)="typeFilter.set(f.key)">
      {{ f.label }} <span class="ac-chip__n">{{ familyCount(f.key) }}</span>
    </button>
  </div>

  <!-- Chips état -->
  <div class="ac-chips">
    <span class="ac-chips__lbl">ÉTAT</span>
    <button type="button" class="ac-chip ac-chip--ok"   [class.ac-chip--on]="etatFilter()==='actif'"    (click)="toggleEtat('actif')"><span class="ac-dot ac-dot--green"></span>Actif <span class="ac-chip__n">{{ etatCount('actif') }}</span></button>
    <button type="button" class="ac-chip ac-chip--warn" [class.ac-chip--on]="etatFilter()==='vacant'"   (click)="toggleEtat('vacant')"><span class="ac-dot ac-dot--amber"></span>Vacant <span class="ac-chip__n">{{ etatCount('vacant') }}</span></button>
    <button type="button" class="ac-chip ac-chip--bad"  [class.ac-chip--on]="etatFilter()==='suspendu'" (click)="toggleEtat('suspendu')"><span class="ac-dot ac-dot--red"></span>Suspendu <span class="ac-chip__n">{{ etatCount('suspendu') }}</span></button>
  </div>

  <div class="ac-notice" *ngIf="notice()">{{ notice() }}</div>

  <!-- Listes groupées par famille -->
  <ng-container *ngFor="let f of families">
    <ng-container *ngIf="groupFor(f.key) as group">
      <div class="ac-group-lbl" *ngIf="group.length > 0">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path [attr.d]="f.icon"/></svg>
        {{ f.label }} · {{ f.sub }}
      </div>
      <div class="ac-list" *ngIf="group.length > 0">
        <div class="ac-row" *ngFor="let a of group" (click)="open(a)">
          <div class="ac-avatar" [class.ac-avatar--vacant]="a.etat==='vacant'">
            <span *ngIf="a.initiales">{{ a.initiales }}</span>
            <svg *ngIf="!a.initiales" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>
          </div>
          <div class="ac-row__body">
            <div class="ac-row__name" [class.ac-row__name--muted]="a.etat==='vacant'">{{ a.nom }}</div>
            <div class="ac-row__sub">{{ a.typeLabel }} · {{ a.rattachement }}</div>
          </div>
          <span class="ac-badge"
                [class.ac-badge--ok]="a.etat==='actif'"
                [class.ac-badge--warn]="a.etat==='vacant'"
                [class.ac-badge--bad]="a.etat==='suspendu'">{{ a.etat }}</span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#6B7785" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </ng-container>
  </ng-container>

  <div class="ac-empty" *ngIf="filtered().length === 0">Aucun acteur ne correspond aux filtres.</div>
</div>

<!-- ════════════ Fiche acteur (drawer) — coquille unique ════════════ -->
<div class="af-overlay" *ngIf="ficheVM() as vm" (click)="close()">
  <div class="af-panel" (click)="$event.stopPropagation()">

    <!-- En-tête commun -->
    <div class="af-head">
      <div class="af-avatar" [class.af-avatar--inst]="vm.kind==='institution'" [class.af-avatar--vacant]="vm.acteur.etat==='vacant'">
        <span *ngIf="vm.acteur.initiales">{{ vm.acteur.initiales }}</span>
        <svg *ngIf="!vm.acteur.initiales" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      </div>
      <div class="af-head__body">
        <div class="af-head__row">
          <span class="af-head__name">{{ vm.acteur.nom }}</span>
          <span class="af-tag">{{ vm.acteur.typeLabel }}</span>
          <span class="af-badge" [class.af-badge--ok]="vm.acteur.etat==='actif'" [class.af-badge--warn]="vm.acteur.etat==='vacant'" [class.af-badge--bad]="vm.acteur.etat==='suspendu'">{{ vm.acteur.etat }}</span>
        </div>
        <div class="af-head__sub" *ngIf="vm.kind==='person'">{{ vm.acteur.rattachement }} · rattaché à URD {{ vm.dept }}</div>
        <div class="af-head__sub" *ngIf="vm.kind==='institution'">{{ vm.acteur.typeLabel }} · {{ vm.acteur.rattachement }}</div>
      </div>
      <div class="af-head__actions">
        <button type="button" class="ac-btn" *ngIf="vm.kind==='person'" (click)="notify('Contacter — module à brancher')">Contacter</button>
        <button type="button" class="ac-btn" *ngIf="vm.kind==='institution'" (click)="notify('Voir contrat — module à brancher')">Voir contrat</button>
        <button type="button" class="ac-btn" *ngIf="estGerable(vm.acteur)" (click)="basculerSuspension(vm.acteur)">
          {{ vm.acteur.etat === 'suspendu' ? 'Réactiver' : 'Suspendre' }}
        </button>
        <button type="button" class="ac-btn af-del" *ngIf="estGerable(vm.acteur)" (click)="pendingDelete.set(true)">Archiver</button>
        <button type="button" class="af-close" (click)="close()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Confirmation de suppression (admin, soft-delete) -->
    <div class="af-confirm" *ngIf="pendingDelete()">
      <span>Retirer « {{ vm.acteur.nom }} » de l'annuaire ? (archivé, récupérable par un admin)</span>
      <div class="af-confirm__actions">
        <button type="button" class="ac-btn" (click)="pendingDelete.set(false)">Annuler</button>
        <button type="button" class="ac-btn af-del" (click)="confirmerSuppression(vm.acteur)">Confirmer</button>
      </div>
    </div>

    <!-- Bande KPI (agrégats live) -->
    <div class="af-kpis">
      <div class="af-kpi" *ngFor="let k of vm.kpis">
        <div class="af-kpi__l">{{ k.label }}</div>
        <div class="af-kpi__v">{{ k.val }}</div>
      </div>
    </div>

    <!-- Panneaux : contenu par archétype -->
    <div class="af-grid">

      <!-- Archétype PERSONNE (TEPAC) -->
      <ng-container *ngIf="vm.kind==='person'">
        <div class="af-card">
          <div class="af-card__h">Périmètre · commune de {{ vm.commune }}</div>
          <div class="af-card__sub">Zones supervisées</div>
          <div class="af-chips-wrap">
            <span class="af-chip" *ngFor="let z of vm.zones">{{ z.nom }}</span>
            <span class="af-muted" *ngIf="!vm.zones.length">Aucune zone supervisée</span>
          </div>
          <div class="af-card__sub">Ouvrages suivis</div>
          <div class="af-mini" *ngFor="let o of vm.ouvrages">{{ o.name }} <span class="af-muted">· {{ o.commune }}</span></div>
          <div class="af-muted" *ngIf="!vm.ouvrages.length">Aucun ouvrage</div>
        </div>
        <div class="af-card">
          <div class="af-card__h">Compte & accès</div>
          <table class="af-table" *ngIf="vm.hasAccount && vm.compte; else noCompte">
            <tr><td>Identifiant</td><td>{{ vm.compte.username }}</td></tr>
            <tr><td>Rôle</td><td>tepac</td></tr>
            <tr><td>Périmètre</td><td>commune {{ vm.compte.commune }}</td></tr>
            <tr><td>Statut</td><td>{{ vm.compte.statut }}</td></tr>
            <tr *ngIf="vm.contact"><td>Contact</td><td>{{ vm.contact }}</td></tr>
          </table>
          <ng-template #noCompte>
            <div class="af-muted">Aucun compte associé — relais terrain sans accès à la plateforme.</div>
          </ng-template>
        </div>
      </ng-container>

      <!-- Archétype INSTITUTION (opérateur / CAEPA / mairie / partenaire) -->
      <ng-container *ngIf="vm.kind==='institution'">
        <div class="af-card">
          <div class="af-card__h">{{ vm.ouvragesLabel }}</div>
          <div class="af-mini" *ngFor="let o of vm.ouvrages">
            {{ o.name }} <span class="af-muted">· {{ o.commune }}</span>
            <span class="af-st" [class.af-st--ok]="o.status==='en-service'" [class.af-st--bad]="o.status==='hors-service'||o.status==='critique'" [class.af-st--warn]="o.status==='maintenance'||o.status==='a-inspecter'">{{ o.status }}</span>
          </div>
          <div class="af-muted" *ngIf="!vm.ouvrages.length">Aucun ouvrage</div>
          <div class="af-note" *ngIf="vm.ouvragesDerived">Aucun ouvrage exploité saisi — liste dérivée du département.</div>
        </div>
        <div class="af-card">
          <div class="af-card__h">Contrat & délégation</div>
          <table class="af-table">
            <tr><td>Type</td><td>{{ vm.contrat.type }}</td></tr>
            <tr *ngIf="vm.contrat.sousType !== '—'"><td>Sous-type</td><td>{{ vm.contrat.sousType }}</td></tr>
            <tr *ngIf="vm.contrat.maitre !== '—'"><td>Maître d'ouvrage</td><td>{{ vm.contrat.maitre }}</td></tr>
            <tr *ngIf="vm.contrat.periode !== '—'"><td>Période</td><td>{{ vm.contrat.periode }}</td></tr>
            <tr><td>Responsable</td><td>{{ vm.contrat.responsable }}</td></tr>
            <tr *ngIf="vm.contrat.contact !== '—'"><td>Contact</td><td>{{ vm.contrat.contact }}</td></tr>
            <tr><td>Localisation</td><td>{{ vm.contrat.localisation }}</td></tr>
            <tr><td>Statut</td><td>{{ vm.acteur.etat }}</td></tr>
          </table>
          <div class="af-note" *ngIf="!vm.isStored">Acteur dérivé du référentiel — contrat détaillé saisi à l'enregistrement.</div>
        </div>
      </ng-container>
    </div>

    <!-- Activité récente (archétype personne) — dérivée, jamais stockée -->
    <div class="af-card" *ngIf="vm.kind==='person'">
      <div class="af-card__h">Activité récente · commune de {{ vm.commune }}</div>
      <div class="af-act" *ngFor="let ev of vm.activite">
        <span class="af-act__dot" [class.af-act__dot--alert]="ev.kind==='alert'" [class.af-act__dot--inter]="ev.kind==='inter'"></span>
        <div class="af-act__body">
          <div>{{ ev.label }}</div>
          <div class="af-muted">{{ timeSince(ev.date) }} · {{ ev.meta }}</div>
        </div>
      </div>
      <div class="af-muted" *ngIf="!vm.activite.length">Aucune activité récente dans la commune</div>
    </div>

  </div>
</div>

<!-- ════════════ Modal : enregistrer un acteur ════════════ -->
<app-acteur-form-modal
  [visible]="showModal()"
  [scope]="_scope() ?? undefined"
  [initialType]="modalInitialType()"
  [communes]="communesAll()"
  [communesTepac]="communesTepac()"
  [ouvrages]="ouvragesDept()"
  [maitresOuvrage]="maitresOuvrage()"
  (fermer)="showModal.set(false)">
</app-acteur-form-modal>
`,
  styles: [`
    .ac-shell { display:flex; flex-direction:column; gap:12px; color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; }
    .ac-shell--embedded { padding:0; background:transparent; }
    .ac-scope-header { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:10px;
      background:rgba(96,165,250,.08); border:1px solid rgba(96,165,250,.25); font-size:12.5px; color:#CBD5E1; }
    .ac-scope-count { font-size:11px; color:#8B9AAB; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,.05); }
    .ac-actions { margin-left:auto; display:flex; gap:8px; }
    .ac-btn { display:inline-flex; align-items:center; gap:5px; font-size:12px; padding:6px 11px; border-radius:8px;
      border:1px solid #2A3744; background:#1A222C; color:#CBD5E1; cursor:pointer; }
    .ac-btn--primary { background:#2563EB; border-color:#2563EB; color:#fff; }
    .ac-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
    .ac-kpi { background:#161D26; border:1px solid #1F2A33; border-radius:10px; padding:10px 11px; }
    .ac-kpi__label { font-size:11px; color:#8B9AAB; }
    .ac-kpi__val { font-size:20px; font-weight:600; margin-top:2px; }
    .ac-kpi__sub { font-size:10px; color:#6B7785; margin-top:1px; }
    .ac-banner { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:8px;
      background:rgba(251,191,36,.1); border:1px solid rgba(251,191,36,.25); font-size:12.5px; color:#FBBF24; }
    .ac-search { display:flex; align-items:center; gap:8px; padding:8px 11px; border-radius:8px; background:#10161D; border:1px solid #1F2A33; }
    .ac-search input { flex:1; background:transparent; border:0; outline:0; color:#E2E8EE; font-size:13px; }
    .ac-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .ac-chips__lbl { font-size:11px; color:#6B7785; margin-right:2px; }
    .ac-chip { display:inline-flex; align-items:center; gap:5px; font-size:12px; padding:4px 11px; border-radius:8px;
      border:1px solid #2A3744; background:transparent; color:#8B9AAB; cursor:pointer; }
    .ac-chip--on { background:rgba(96,165,250,.14); border-color:rgba(96,165,250,.4); color:#93C5FD; }
    .ac-chip__n { font-size:11px; opacity:.8; }
    .ac-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
    .ac-dot--green { background:#4ADE80; } .ac-dot--amber { background:#FBBF24; } .ac-dot--red { background:#FB7185; }
    .ac-notice { font-size:12px; color:#93C5FD; background:rgba(96,165,250,.08); border:1px solid rgba(96,165,250,.2); padding:7px 11px; border-radius:8px; }
    .ac-group-lbl { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:500; color:#8B9AAB; margin-top:6px; }
    .ac-list { border:1px solid #1F2A33; border-radius:10px; overflow:hidden; }
    .ac-row { display:flex; align-items:center; gap:11px; padding:9px 11px; border-top:1px solid #1F2A33; cursor:pointer; }
    .ac-row:first-child { border-top:0; }
    .ac-row:hover { background:rgba(255,255,255,.02); }
    .ac-avatar { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:600; background:rgba(96,165,250,.15); color:#93C5FD; }
    .ac-avatar--vacant { background:#1A222C; color:#6B7785; }
    .ac-row__body { flex:1; min-width:0; }
    .ac-row__name { font-size:13.5px; font-weight:500; }
    .ac-row__name--muted { color:#8B9AAB; font-weight:400; }
    .ac-row__sub { font-size:11.5px; color:#8B9AAB; margin-top:1px; }
    .ac-badge { font-size:11px; font-weight:500; padding:3px 9px; border-radius:8px; text-transform:capitalize; }
    .ac-badge--ok { background:rgba(74,222,128,.14); color:#4ADE80; }
    .ac-badge--warn { background:rgba(251,191,36,.14); color:#FBBF24; }
    .ac-badge--bad { background:rgba(251,113,133,.14); color:#FB7185; }
    .ac-empty { font-size:13px; color:#6B7785; padding:14px; text-align:center; }

    /* ── Fiche acteur (drawer) ── */
    .af-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1000; display:flex; justify-content:flex-end; }
    .af-panel { width:560px; max-width:94vw; height:100%; overflow-y:auto; background:#0F1419; border-left:1px solid #1F2A33;
      padding:16px 18px 28px; display:flex; flex-direction:column; gap:14px; color:#E2E8EE; }
    .af-head { display:flex; align-items:flex-start; gap:12px; }
    .af-avatar { width:46px; height:46px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
      font-size:15px; font-weight:600; background:rgba(96,165,250,.15); color:#93C5FD; }
    .af-avatar--inst { border-radius:12px; background:#1A222C; color:#8B9AAB; }
    .af-avatar--vacant { background:#1A222C; color:#6B7785; }
    .af-head__body { flex:1; min-width:0; }
    .af-head__row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .af-head__name { font-size:17px; font-weight:600; }
    .af-tag { font-size:11px; border:1px solid #2A3744; color:#8B9AAB; padding:2px 8px; border-radius:7px; }
    .af-badge { font-size:11px; font-weight:500; padding:2px 9px; border-radius:7px; text-transform:capitalize; }
    .af-badge--ok { background:rgba(74,222,128,.14); color:#4ADE80; }
    .af-badge--warn { background:rgba(251,191,36,.14); color:#FBBF24; }
    .af-badge--bad { background:rgba(251,113,133,.14); color:#FB7185; }
    .af-head__sub { font-size:12.5px; color:#8B9AAB; margin-top:4px; }
    .af-head__actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
    .af-close { width:30px; height:30px; border-radius:8px; border:1px solid #2A3744; background:#1A222C; color:#CBD5E1; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .af-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; }
    .af-kpi { background:#161D26; border:1px solid #1F2A33; border-radius:9px; padding:8px 9px; }
    .af-kpi__l { font-size:10px; color:#8B9AAB; line-height:1.25; }
    .af-kpi__v { font-size:17px; font-weight:600; margin-top:3px; }
    .af-grid { display:grid; grid-template-columns:1.3fr 1fr; gap:10px; }
    .af-card { border:1px solid #1F2A33; border-radius:11px; padding:11px 13px; }
    .af-card__h { font-size:13px; font-weight:500; margin-bottom:8px; }
    .af-card__sub { font-size:11px; color:#8B9AAB; margin:9px 0 5px; }
    .af-chips-wrap { display:flex; gap:6px; flex-wrap:wrap; }
    .af-chip { font-size:11.5px; border:1px solid #2A3744; padding:3px 9px; border-radius:7px; color:#CBD5E1; }
    .af-mini { font-size:12.5px; padding:3px 0; }
    .af-muted { font-size:11.5px; color:#6B7785; }
    .af-note { font-size:10.5px; color:#6B7785; margin-top:9px; font-style:italic; }
    .af-st { font-size:10px; padding:1px 7px; border-radius:6px; margin-left:4px; }
    .af-st--ok { background:rgba(74,222,128,.14); color:#4ADE80; }
    .af-st--warn { background:rgba(251,191,36,.14); color:#FBBF24; }
    .af-st--bad { background:rgba(251,113,133,.14); color:#FB7185; }
    .af-table { width:100%; font-size:12.5px; }
    .af-table td { padding:3px 0; }
    .af-table td:first-child { color:#8B9AAB; }
    .af-table td:last-child { text-align:right; }
    .af-act { display:flex; gap:9px; align-items:flex-start; padding:7px 0; border-top:1px solid #1F2A33; }
    .af-act:first-of-type { border-top:0; }
    .af-act__dot { width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; background:#6B7785; }
    .af-act__dot--alert { background:#FBBF24; } .af-act__dot--inter { background:#60A5FA; }
    .af-act__body { flex:1; font-size:12.5px; }
    .af-del { border-color:rgba(251,113,133,.4); color:#FB7185; }
    .af-confirm { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:9px 12px; border-radius:9px;
      background:rgba(251,113,133,.1); border:1px solid rgba(251,113,133,.3); font-size:12.5px; color:#FCA5B4; }
    .af-confirm__actions { margin-left:auto; display:flex; gap:6px; }
    @media (max-width:640px) { .af-kpis { grid-template-columns:repeat(2,1fr); } .af-grid { grid-template-columns:1fr; } }
  `],
})
export class ActeursPageComponent implements OnInit {
  readonly _scope = signal<{ dept: string; urdId?: string } | null>(null);
  @Input() set scope(v: { dept: string; urdId?: string } | undefined) { this._scope.set(v ?? null); }

  readonly families = FAMILIES;

  readonly typeFilter = signal<'all' | ActeurFamily>('all');
  readonly etatFilter = signal<'all' | ActeurEtat>('all');
  readonly search     = signal('');
  readonly notice     = signal('');

  readonly selected = signal<Acteur | null>(null);

  readonly showModal        = signal(false);
  readonly modalInitialType = signal<ActeurTypeDto | undefined>(undefined);
  readonly pendingDelete    = signal(false);

  constructor(
    private readonly instStore: InstitutionsStore,
    private readonly zones: ZoneRegistreService,
    private readonly infraStore: InfrastructureStore,
    private readonly alertStore: AlertStore,
    private readonly interventionStore: InterventionStore,
    private readonly acteurStore: ActeurStore,
    private readonly auth: AuthService,
    private readonly bff: BffApiService,
  ) {}

  /** Communes du département, source serveur scopée (GET /api/communes, verrou JWT).
   * `aUnTepac` = déjà pourvu d'un TEPAC (calculé serveur) → on affiche tout, on marque les pourvues. */
  readonly _communesApi = signal<{ nom: string; aUnTepac: boolean }[]>([]);

  /** Règle « recharger au montage » : chaque ouverture de l'onglet refait le GET. */
  ngOnInit(): void { this.acteurStore.reload(); this.chargerCommunes(); }

  private chargerCommunes(): void {
    this.bff.communes(this._scope()?.dept ?? undefined)
      .subscribe(list => this._communesApi.set(list.map(c => ({ nom: c.nom, aUnTepac: c.aUnTepac }))));
  }

  openCreate(type?: ActeurTypeDto): void {
    this.chargerCommunes();                 // rafraîchit la liste à l'ouverture du formulaire
    this.modalInitialType.set(type);
    this.showModal.set(true);
  }

  // ── Gestion d'équipe (admin partout, superviseur sur son département) ─────
  get peutGerer(): boolean { return this.auth.hasRole('ADMIN') || this.auth.hasRole('SUPERVISEUR_URD'); }

  /** Suspendre/réactiver/archiver ne vise que les acteurs PERSISTÉS (pas les vacants ni les seeds). */
  estGerable(a: Acteur): boolean {
    return this.peutGerer && this.acteurStore.snapshot.some(x => x.id === a.id);
  }

  /** Bascule actif ↔ suspendu (le serveur coupe/rétablit le compte de connexion lié). */
  basculerSuspension(a: Acteur): void {
    const cible: 'actif' | 'suspendu' = a.etat === 'suspendu' ? 'actif' : 'suspendu';
    this.acteurStore.changerStatut(a.id, cible).subscribe({
      next: (dto) => this.selected.update(cur =>
        cur ? { ...cur, etat: dto.statut === 'suspendu' ? 'suspendu' : 'actif' } : cur),
      error: (err) => this.notify(err?.error?.message ?? err?.error ?? 'Action refusée.'),
    });
  }

  confirmerSuppression(a: Acteur): void {
    this.acteurStore.supprimerActeur(a.id).subscribe({
      next: () => { this.pendingDelete.set(false); this.close(); },
      error: (err) => { this.pendingDelete.set(false); this.notify(err?.error?.message ?? err?.error ?? 'Archivage refusé.'); },
    });
  }

  // ── Listes scopées passées au modal ─────────────────────────────────────
  /** Noms de communes (mairie / caepa). */
  readonly communesAll = computed(() => this._communesApi().map(c => c.nom));

  /** Pour le TEPAC : TOUTES les communes du département, avec le drapeau « déjà pourvu »
   * (calculé serveur). On n'en masque aucune ; le modal grise les pourvues. */
  readonly communesTepac = computed(() => this._communesApi());

  readonly ouvragesDept = computed(() => {
    const dept = this._scope()?.dept;
    if (!dept) return [];
    return this.infraStore.snapshot
      .filter(i => i.department === dept && i.status !== 'archive')
      .map(i => ({ id: i.id, name: i.name }));
  });

  readonly maitresOuvrage = computed(() => {
    const urdId = this._scope()?.urdId;
    const seed = this.instStore.list()
      .filter(i => i.type === 'municipalite' && (!urdId || i.parentId === urdId))
      .map(i => ({ id: i.id, nom: i.nom }));
    const crees = this.acteurStore.forDept(this._scope()?.dept)
      .filter(a => a.type === 'MAIRIE')
      .map(a => ({ id: a.id, nom: a.nom }));
    return [...seed, ...crees];
  });

  /** Liste complète scopée — source unique des KPI, chips et listes (agrégats live). */
  readonly acteurs = computed<Acteur[]>(() => {
    const sc = this._scope();
    const dept  = sc?.dept ?? '';
    const urdId = sc?.urdId;
    void this.zones.version();           // réactif aux changements de zones/communes
    const out: Acteur[] = [];

    // Acteurs enregistrés (persistés) du département.
    const stored = this.acteurStore.forDept(dept);
    // Une commune peut compter PLUSIEURS TEPAC : on les regroupe par commune (liste, pas Map).
    const tepacStored = new Map<string, ActeurDto[]>();
    for (const a of stored) if (a.type === 'TEPAC' && a.commune) {
      (tepacStored.get(a.commune) ?? tepacStored.set(a.commune, []).get(a.commune)!).push(a);
    }

    // Famille TEPAC : tous les TEPAC enregistrés de la commune (1..n), sinon repli TEPAC_MAP,
    // sinon une ligne « vacant » unique pour signaler la commune sans couverture.
    if (dept) {
      for (const commune of this.zones.getCommunesForDept(dept)) {
        const duStock = tepacStored.get(commune) ?? [];
        if (duStock.length) {
          for (const st of duStock) {
            out.push({ id: st.id, family: 'tepac', nom: st.nom, initiales: initiales(st.nom),
              typeLabel: 'TEPAC', rattachement: 'commune de ' + commune,
              etat: st.statut === 'suspendu' ? 'suspendu' : 'actif', isPerson: true, commune });
          }
        } else if (TEPAC_MAP[commune]) {
          const name = TEPAC_MAP[commune];
          out.push({ id: 'tepac-' + commune, family: 'tepac', nom: name, initiales: initiales(name),
            typeLabel: 'TEPAC', rattachement: 'commune de ' + commune, etat: 'actif', isPerson: true, commune });
        } else {
          out.push({ id: 'tepac-vacant-' + commune, family: 'tepac', nom: 'Poste à pourvoir', initiales: '',
            typeLabel: 'TEPAC', rattachement: 'commune de ' + commune, etat: 'vacant', isPerson: true, commune });
        }
      }
    }

    // Familles institutionnelles dérivées (seed) : scopées par parentId === urdId.
    const insts = this.instStore.list().filter(i =>
      urdId ? i.parentId === urdId : !!familyOf(i.type));
    for (const i of insts) {
      const fam = familyOf(i.type);
      if (!fam) continue;
      out.push({
        id: i.id, family: fam, nom: i.nom,
        initiales: i.responsableInitiales && i.responsableInitiales !== '?' ? i.responsableInitiales : initiales(i.nom),
        typeLabel: i.typeLabel,
        rattachement: this.rattachement(fam, i),
        etat: i.statut === 'active' ? 'actif' : 'vacant',
        isPerson: false,
        commune: i.city,
      });
    }

    // Acteurs enregistrés non-TEPAC (opérateur / CAEPA / mairie / partenaire).
    for (const a of stored) {
      if (a.type === 'TEPAC') continue;
      out.push(this.fromDto(a));
    }
    return out;
  });

  readonly filtered = computed<Acteur[]>(() => {
    const type = this.typeFilter();
    const etat = this.etatFilter();
    const q = this.search().trim().toLowerCase();
    return this.acteurs().filter(a => {
      if (type !== 'all' && a.family !== type) return false;
      if (etat !== 'all' && a.etat !== etat)   return false;
      if (q && !(a.nom.toLowerCase().includes(q)
              || a.rattachement.toLowerCase().includes(q)
              || a.typeLabel.toLowerCase().includes(q))) return false;
      return true;
    });
  });

  /** Nombre de communes du département (référentiel zones) — dénominateur de couverture. */
  readonly communesTotal = computed(() => {
    const dept = this._scope()?.dept;
    void this.zones.version();
    return dept ? this.zones.getCommunesForDept(dept).length : 0;
  });
  /** TEPAC réellement présents (personnes actives ou suspendues, hors postes vacants). */
  readonly tepacActifs = computed(() =>
    this.acteurs().filter(a => a.family === 'tepac' && a.etat !== 'vacant').length);
  /** Communes distinctes disposant d'au moins un TEPAC non vacant. */
  readonly communesCouvertes = computed(() => {
    const set = new Set<string>();
    for (const a of this.acteurs())
      if (a.family === 'tepac' && a.etat !== 'vacant' && a.commune) set.add(a.commune);
    return set.size;
  });
  /** Communes sans aucun TEPAC (une ligne « vacant » = une commune non couverte). */
  readonly vacantTepac = computed(() => this.acteurs().filter(a => a.family === 'tepac' && a.etat === 'vacant').length);

  familyCount(key: ActeurFamily): number { return this.acteurs().filter(a => a.family === key).length; }
  etatCount(etat: ActeurEtat): number    { return this.acteurs().filter(a => a.etat === etat).length; }
  groupFor(key: ActeurFamily): Acteur[]  { return this.filtered().filter(a => a.family === key); }

  toggleEtat(e: ActeurEtat): void { this.etatFilter.update(cur => cur === e ? 'all' : e); }

  notify(msg: string): void { this.notice.set(msg); }

  // ── Fiche acteur (drawer) — coquille unique, contenu par archétype ──────
  open(a: Acteur): void { this.pendingDelete.set(false); this.selected.set(a); }
  close(): void { this.pendingDelete.set(false); this.selected.set(null); }

  /** Vue-modèle de la fiche : KPI + panneaux dérivés en live des stores. */
  readonly ficheVM = computed(() => {
    const a = this.selected();
    if (!a) return null;
    const dept = this._scope()?.dept ?? '';

    if (a.isPerson) {
      const commune = a.commune ?? '';
      const storedTepac = this.acteurStore.snapshot.find(x => x.id === a.id);
      void this.zones.version();
      const zones   = this.zones.getZonesByCommune(commune);
      const ouvrages = this.infraStore.snapshot.filter(i => i.commune === commune && i.status !== 'archive');
      const alerts  = this.alertStore.snapshot.filter(al => al.commune === commune);
      const cutoff  = Date.now() - 30 * 24 * 3_600_000;
      const recent  = alerts.filter(al => new Date(al.createdAt).getTime() >= cutoff);
      const resolus = recent.filter(al => ['resolue', 'archivee', 'ignoree'].includes(al.status));
      const reactivite = recent.length ? Math.round(resolus.length / recent.length * 100) : 100;
      const inters  = this.interventionStore.snapshot.filter(i => i.commune === commune);
      const activite = [
        ...alerts.map(al => ({ kind: 'alert' as const, label: 'Alerte « ' + al.title + ' »', date: al.updatedAt ?? al.createdAt, meta: al.status })),
        ...inters.map(i  => ({ kind: 'inter' as const, label: 'Intervention « ' + i.title + ' »', date: i.createdAt, meta: i.status })),
      ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime()).slice(0, 6);

      return {
        kind: 'person' as const, acteur: a, commune, dept,
        kpis: [
          { label: 'Zones supervisées',   val: String(zones.length) },
          { label: 'Ouvrages suivis',     val: String(ouvrages.length) },
          { label: 'Alertes traitées 30j', val: String(resolus.length) },
          { label: 'Réactivité',          val: reactivite + '%' },
          { label: 'Rapports soumis',     val: '—' },
        ],
        zones, ouvrages, activite,
        hasAccount: !!storedTepac?.compteUsername,
        compte: storedTepac?.compteUsername
          ? { username: storedTepac.compteUsername, commune, statut: storedTepac.statut }
          : null,
        contact: storedTepac?.contactTel ?? null,
      };
    }

    // Institution (opérateur / CAEPA / mairie / partenaire)
    const inst   = this.instStore.getById(a.id);
    const stored = this.acteurStore.snapshot.find(x => x.id === a.id);

    // Ouvrages : exploités réels (ouvrageIds de l'acteur stocké) sinon dérivés du dept.
    let ouvrages; let ouvragesLabel: string; const derived = !stored?.ouvrageIds;
    if (stored?.ouvrageIds) {
      const ids = new Set(stored.ouvrageIds.split(',').map(s => s.trim()).filter(Boolean));
      ouvrages = this.infraStore.snapshot.filter(i => ids.has(i.id) && i.status !== 'archive');
      ouvragesLabel = 'Ouvrages exploités';
    } else {
      ouvrages = this.infraStore.snapshot.filter(i => i.department === dept && i.status !== 'archive');
      ouvragesLabel = 'Ouvrages dans le périmètre';
    }
    const enService = ouvrages.filter(i => i.status === 'en-service').length;
    const pannes    = ouvrages.filter(i => i.status === 'hors-service' || i.status === 'critique').length;
    const fonct     = ouvrages.length ? Math.round(enService / ouvrages.length * 100) : 0;

    const periode = stored?.periodeDebut
      ? stored.periodeDebut + (stored.periodeFin ? ' – ' + stored.periodeFin : '')
      : '—';
    const contrat = {
      type:         stored?.typeContrat || inst?.typeLabel || a.typeLabel || '—',
      maitre:       stored?.maitreOuvrage || '—',
      periode,
      sousType:     stored?.sousType || '—',
      responsable:  stored?.responsable || inst?.responsable || '—',
      contact:      stored?.contactTel || '—',
      localisation: a.commune || inst?.city || dept || '—',
    };

    return {
      kind: 'institution' as const, acteur: a, commune: a.commune ?? '', dept, inst,
      isStored: !!stored, ouvragesLabel, ouvragesDerived: derived,
      kpis: [
        { label: stored?.ouvrageIds ? 'Ouvrages exploités' : 'Ouvrages (périmètre)', val: String(ouvrages.length) },
        { label: 'Population desservie', val: '—' },
        { label: 'Fonctionnement',       val: ouvrages.length ? fonct + '%' : '—' },
        { label: 'Conformité eau',       val: '—' },
        { label: 'Pannes en cours',      val: String(pannes) },
      ],
      ouvrages, contrat,
    };
  });

  timeSince(iso: string): string {
    const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
    if (h < 1)  return 'il y a ' + Math.max(1, Math.round(h * 60)) + ' min';
    if (h < 24) return 'il y a ' + Math.round(h) + ' h';
    return 'il y a ' + Math.round(h / 24) + ' j';
  }

  private fromDto(a: ActeurDto): Acteur {
    const famMap = { TEPAC: 'tepac', OPERATEUR: 'operateur', CAEPA: 'caepa', MAIRIE: 'mairie', PARTENAIRE: 'partenaire' } as const;
    const labelMap: Record<ActeurFamily, string> = { tepac: 'TEPAC', operateur: 'Opérateur', caepa: 'CAEPA', mairie: 'Municipalité', partenaire: 'Partenaire' };
    const fam = famMap[a.type];
    return {
      id: a.id, family: fam, nom: a.nom, initiales: initiales(a.nom),
      typeLabel: fam === 'operateur' && a.sousType ? 'Opérateur · ' + a.sousType : labelMap[fam],
      rattachement: a.commune ? 'commune de ' + a.commune : (a.sousType ?? a.departementId),
      etat: a.statut === 'suspendu' ? 'suspendu' : 'actif',
      isPerson: fam === 'tepac',
      commune: a.commune ?? undefined,
    };
  }

  private rattachement(fam: ActeurFamily, i: InstitutionData): string {
    const lieu = i.city || i.dept || '';
    switch (fam) {
      case 'operateur':  return 'exploite · ' + lieu;
      case 'mairie':     return "maître d'ouvrage · " + lieu;
      case 'caepa':      return 'comité · ' + lieu;
      default:           return lieu;
    }
  }
}

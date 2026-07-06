import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InfrastructureStateService } from '../../infrastructure-state.service';
import { InfraStatus, InfraType } from '../../infrastructure.store';
import { INFRA_TYPE_COLORS, STATUS_COLORS } from '../../map.config';

interface TypeOption  { value: InfraType;   label: string; color: string; }
interface EtatOption  { value: InfraStatus; label: string; color: string; }

@Component({
  selector: 'app-filtres-panneau',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    /* ── Overlay ──────────────────────────────────────────────── */
    .fp-overlay {
      position:fixed; inset:0; z-index:900;
      background:rgba(0,0,0,.5); backdrop-filter:blur(2px);
      animation:fp-fade .15s ease;
    }
    @keyframes fp-fade { from{opacity:0} to{opacity:1} }

    /* ── Drawer ───────────────────────────────────────────────── */
    .fp-drawer {
      position:absolute; top:0; left:0; bottom:0;
      width:340px; max-width:92vw;
      background:#0b1220; border-right:.5px solid rgba(255,255,255,.1);
      display:flex; flex-direction:column;
      box-shadow:4px 0 24px rgba(0,0,0,.5);
      animation:fp-slide .2s cubic-bezier(.4,0,.2,1);
    }
    @keyframes fp-slide { from{transform:translateX(-100%)} to{transform:none} }

    /* ── Header ───────────────────────────────────────────────── */
    .fp-header {
      display:flex; align-items:center; gap:.6rem;
      padding:1rem 1.25rem;
      border-bottom:.5px solid rgba(255,255,255,.08);
      flex-shrink:0;
    }
    .fp-header-title {
      flex:1; display:flex; align-items:center; gap:.5rem;
      font-size:.88rem; font-weight:600; color:#fff;
    }
    .fp-badge {
      padding:1px 8px; background:rgba(96,165,250,.18);
      border:.5px solid rgba(96,165,250,.3); border-radius:999px;
      font-size:.67rem; font-weight:700; color:#60A5FA;
    }
    .fp-action-btn {
      width:28px; height:28px; border:0;
      background:rgba(255,255,255,.05); border-radius:7px;
      color:rgba(255,255,255,.5); cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s,color .15s;
    }
    .fp-action-btn:hover { background:rgba(255,255,255,.1); color:#fff; }
    .fp-reset-btn {
      padding:4px 12px; border:0;
      background:rgba(239,68,68,.1); border-radius:6px;
      color:#F87171; font-size:.72rem; font-weight:600;
      cursor:pointer; font-family:inherit;
      transition:background .15s;
    }
    .fp-reset-btn:hover { background:rgba(239,68,68,.18); }

    /* ── Body ─────────────────────────────────────────────────── */
    .fp-body {
      flex:1; overflow-y:auto; padding:.75rem 1.25rem;
      scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.07) transparent;
    }
    .fp-body::-webkit-scrollbar { width:3px; }
    .fp-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:2px; }

    /* ── Sections ─────────────────────────────────────────────── */
    .fp-section { margin-bottom:1.25rem; }

    .fp-section-label {
      font-size:.6rem; font-weight:600; letter-spacing:.12em;
      text-transform:uppercase; color:rgba(255,255,255,.3);
      margin-bottom:.6rem; display:flex; align-items:center; gap:5px;
    }

    /* Search input */
    .fp-search {
      width:100%; padding:8px 11px;
      background:rgba(255,255,255,.04); border:.5px solid rgba(255,255,255,.12);
      border-radius:8px; color:rgba(255,255,255,.88); font-size:.81rem;
      font-family:inherit; outline:none; box-sizing:border-box;
      transition:border-color .15s,box-shadow .15s;
    }
    .fp-search::placeholder { color:rgba(255,255,255,.25); }
    .fp-search:focus {
      border-color:rgba(96,165,250,.5); box-shadow:0 0 0 3px rgba(96,165,250,.08);
    }

    /* Checkbox rows */
    .fp-check-list { display:flex; flex-direction:column; gap:.3rem; }
    .fp-check-row {
      display:flex; align-items:center; gap:.55rem;
      padding:5px 8px; border-radius:6px; cursor:pointer;
      transition:background .1s;
    }
    .fp-check-row:hover { background:rgba(255,255,255,.04); }
    .fp-check-dot {
      width:9px; height:9px; border-radius:50%; flex-shrink:0;
    }
    .fp-check-label {
      flex:1; font-size:.78rem; color:rgba(255,255,255,.7); cursor:pointer;
    }
    .fp-check-count {
      font-size:.67rem; color:rgba(255,255,255,.3); flex-shrink:0;
    }
    input[type=checkbox] {
      width:14px; height:14px; accent-color:#3B82F6; cursor:pointer;
    }

    /* Three-state toggle */
    .fp-trio {
      display:flex; gap:4px;
    }
    .fp-trio-btn {
      flex:1; padding:6px 4px; border:0;
      background:rgba(255,255,255,.04); border-radius:7px;
      color:rgba(255,255,255,.45); font-size:.72rem; font-weight:500;
      cursor:pointer; font-family:inherit; text-align:center;
      transition:background .15s,color .15s;
      border:.5px solid transparent;
    }
    .fp-trio-btn:hover { background:rgba(255,255,255,.08); color:rgba(255,255,255,.7); }
    .fp-trio-btn--active {
      background:rgba(96,165,250,.15); color:#60A5FA;
      border-color:rgba(96,165,250,.3);
    }

    /* Select */
    .fp-select {
      width:100%; padding:8px 11px;
      background:rgba(255,255,255,.04); border:.5px solid rgba(255,255,255,.12);
      border-radius:8px; color:rgba(255,255,255,.88); font-size:.81rem;
      font-family:inherit; outline:none; box-sizing:border-box;
    }
    .fp-select option { background:#111827; color:#fff; }

    /* Couches toggles */
    .fp-couche-list { display:flex; flex-direction:column; gap:.3rem; }
    .fp-couche-row {
      display:flex; align-items:center; justify-content:space-between;
      padding:6px 8px; border-radius:6px; cursor:pointer;
      transition:background .1s;
    }
    .fp-couche-row:hover { background:rgba(255,255,255,.04); }
    .fp-couche-name { font-size:.78rem; color:rgba(255,255,255,.65); }
    .fp-toggle {
      width:32px; height:18px; border-radius:9px; cursor:pointer;
      position:relative; border:0; transition:background .2s;
      flex-shrink:0;
    }
    .fp-toggle--on  { background:#3B82F6; }
    .fp-toggle--off { background:rgba(255,255,255,.12); }
    .fp-toggle-thumb {
      position:absolute; top:2px; width:14px; height:14px;
      background:#fff; border-radius:50%; transition:left .2s;
    }
    .fp-toggle--on  .fp-toggle-thumb { left:16px; }
    .fp-toggle--off .fp-toggle-thumb { left:2px; }

    /* Footer */
    .fp-footer {
      flex-shrink:0; padding:.85rem 1.25rem;
      border-top:.5px solid rgba(255,255,255,.08);
      display:flex; gap:.5rem;
    }
    .fp-footer-btn {
      flex:1; padding:8px;
      background:rgba(255,255,255,.04); border:.5px solid rgba(255,255,255,.1);
      border-radius:8px; color:rgba(255,255,255,.6); font-size:.75rem; font-weight:500;
      cursor:pointer; font-family:inherit; display:flex; align-items:center;
      justify-content:center; gap:5px; transition:background .15s,color .15s;
    }
    .fp-footer-btn:hover { background:rgba(255,255,255,.09); color:#fff; }
    .fp-footer-btn--copied { background:rgba(52,211,153,.1); border-color:rgba(52,211,153,.25); color:#34D399; }

    /* Separator */
    .fp-sep { height:.5px; background:rgba(255,255,255,.06); margin:.25rem 0 1.25rem; }
  `],
  template: `
<div class="fp-overlay" *ngIf="state.filtrePanneauOuvert()" (click)="state.fermerFiltrePanneau()">
  <div class="fp-drawer" (click)="$event.stopPropagation()">

    <!-- HEADER -->
    <div class="fp-header">
      <div class="fp-header-title">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        Filtres
        <span class="fp-badge" *ngIf="state.nombreFiltresActifs()">
          {{ state.nombreFiltresActifs() }}
        </span>
      </div>
      <button type="button" class="fp-reset-btn"
        *ngIf="state.nombreFiltresActifs()"
        (click)="state.reinitialiserFiltres()">
        Réinitialiser
      </button>
      <button type="button" class="fp-action-btn" title="Fermer" (click)="state.fermerFiltrePanneau()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- BODY -->
    <div class="fp-body">

      <!-- Recherche -->
      <div class="fp-section">
        <div class="fp-section-label">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>
          </svg>
          Recherche
        </div>
        <input type="search" class="fp-search"
          placeholder="Nom, code, commune, système AEP…"
          [ngModel]="state.filtres().recherche"
          (ngModelChange)="state.modifierFiltre('recherche', $event)" />
      </div>

      <!-- Type d'ouvrage -->
      <div class="fp-section">
        <div class="fp-section-label">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          </svg>
          Type d'ouvrage
        </div>
        <div class="fp-check-list">
          <label class="fp-check-row" *ngFor="let opt of typeOptions">
            <input type="checkbox"
              [checked]="state.filtres().types.includes(opt.value)"
              (change)="state.toggleType(opt.value)" />
            <span class="fp-check-dot" [style.background]="opt.color"></span>
            <span class="fp-check-label">{{ opt.label }}</span>
            <span class="fp-check-count">{{ countByType(opt.value) }}</span>
          </label>
        </div>
      </div>

      <div class="fp-sep"></div>

      <!-- Statut -->
      <div class="fp-section">
        <div class="fp-section-label">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          Statut
        </div>
        <div class="fp-check-list">
          <label class="fp-check-row" *ngFor="let opt of etatOptions">
            <input type="checkbox"
              [checked]="state.filtres().etats.includes(opt.value)"
              (change)="state.toggleEtat(opt.value)" />
            <span class="fp-check-dot" [style.background]="opt.color"></span>
            <span class="fp-check-label">{{ opt.label }}</span>
            <span class="fp-check-count">{{ countByEtat(opt.value) }}</span>
          </label>
        </div>
      </div>

      <div class="fp-sep"></div>

      <!-- Département -->
      <div class="fp-section" *ngIf="state.departementsDisponibles().length > 1">
        <div class="fp-section-label">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Département
        </div>
        <div class="fp-check-list">
          <label class="fp-check-row" *ngFor="let dept of state.departementsDisponibles()">
            <input type="checkbox"
              [checked]="state.filtres().departements.includes(dept)"
              (change)="state.toggleDepartement(dept)" />
            <span class="fp-check-label">{{ dept }}</span>
            <span class="fp-check-count">{{ countByDept(dept) }}</span>
          </label>
        </div>
      </div>

      <div class="fp-sep" *ngIf="state.departementsDisponibles().length > 1"></div>

      <!-- Capteurs IoT -->
      <div class="fp-section">
        <div class="fp-section-label">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
          </svg>
          Capteurs IoT
        </div>
        <div class="fp-trio">
          <button type="button" class="fp-trio-btn"
            [class.fp-trio-btn--active]="state.filtres().avecCapteurs === null"
            (click)="state.modifierFiltre('avecCapteurs', null)">Tous</button>
          <button type="button" class="fp-trio-btn"
            [class.fp-trio-btn--active]="state.filtres().avecCapteurs === true"
            (click)="state.modifierFiltre('avecCapteurs', true)">Avec</button>
          <button type="button" class="fp-trio-btn"
            [class.fp-trio-btn--active]="state.filtres().avecCapteurs === false"
            (click)="state.modifierFiltre('avecCapteurs', false)">Sans</button>
        </div>
      </div>

      <!-- Système AEP -->
      <div class="fp-section" *ngIf="state.systemesAepDisponibles().length > 0">
        <div class="fp-section-label">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
          Système AEP
        </div>
        <select class="fp-select"
          [ngModel]="state.filtres().systemeAep"
          (ngModelChange)="state.modifierFiltre('systemeAep', $event)">
          <option value="">Tous les systèmes</option>
          <option *ngFor="let s of state.systemesAepDisponibles()" [value]="s">{{ s }}</option>
        </select>
      </div>

      <div class="fp-sep"></div>

      <!-- Couches carte -->
      <div class="fp-section">
        <div class="fp-section-label">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          Couches de la carte
        </div>
        <div class="fp-couche-list">
          <div class="fp-couche-row" *ngFor="let c of couches" (click)="state.toggleCouche(c.id)">
            <span class="fp-couche-name">{{ c.label }}</span>
            <button type="button" class="fp-toggle"
              [class.fp-toggle--on]="state.coucheActive(c.id)"
              [class.fp-toggle--off]="!state.coucheActive(c.id)">
              <span class="fp-toggle-thumb"></span>
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="fp-footer">
      <button type="button" class="fp-footer-btn"
        [class.fp-footer-btn--copied]="copied"
        (click)="copierLien()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        {{ copied ? 'Copié !' : 'Copier le lien' }}
      </button>
    </div>

  </div>
</div>
  `,
})
export class FiltrePanneauComponent {
  readonly state = inject(InfrastructureStateService);

  copied = false;

  readonly typeOptions: TypeOption[] = [
    { value: 'captage',    label: 'Captage',       color: INFRA_TYPE_COLORS['captage'] },
    { value: 'reservoir',  label: 'Réservoir',      color: INFRA_TYPE_COLORS['reservoir'] },
    { value: 'pompe',      label: 'Pompage',         color: INFRA_TYPE_COLORS['pompe'] },
    { value: 'traitement', label: 'Traitement',      color: INFRA_TYPE_COLORS['traitement'] },
    { value: 'point-eau',  label: "Point d'eau",     color: INFRA_TYPE_COLORS['point-eau'] },
    { value: 'borne',      label: 'Borne-fontaine',  color: INFRA_TYPE_COLORS['borne'] },
    { value: 'kiosque',    label: 'Kiosque',         color: INFRA_TYPE_COLORS['kiosque'] },
    { value: 'conduite',   label: 'Conduite',        color: INFRA_TYPE_COLORS['conduite'] },
    { value: 'passerelle', label: 'Supervision',     color: INFRA_TYPE_COLORS['passerelle'] },
  ];

  readonly etatOptions: EtatOption[] = [
    { value: 'en-service',   label: 'En service',   color: STATUS_COLORS['en-service'] },
    { value: 'a-inspecter',  label: 'À inspecter',  color: STATUS_COLORS['a-inspecter'] },
    { value: 'maintenance',  label: 'Maintenance',  color: STATUS_COLORS['maintenance'] },
    { value: 'hors-service', label: 'Hors service', color: STATUS_COLORS['hors-service'] },
    { value: 'critique',     label: 'Critique',     color: STATUS_COLORS['critique'] },
    { value: 'archive',      label: 'Archivé',      color: STATUS_COLORS['archive'] },
  ];

  readonly couches = [
    { id: 'marqueurs', label: 'Marqueurs infrastructure' },
    { id: 'liaisons',  label: 'Liaisons AEP (amont→aval)' },
    { id: 'alertes',   label: 'Zones d\'alerte' },
  ];

  countByType(type: InfraType): number {
    return this.state.toutesLesInfras().filter(i => i.type === type).length;
  }

  countByEtat(etat: InfraStatus): number {
    return this.state.toutesLesInfras().filter(i => i.status === etat).length;
  }

  countByDept(dept: string): number {
    return this.state.toutesLesInfras().filter(i => i.department === dept).length;
  }

  copierLien(): void {
    const encoded = this.state.exporterFiltres();
    const url = `${window.location.origin}${window.location.pathname}?f=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2200);
    });
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';

import { BffApiService, CapteurDto, MeasurementMetaDto, MeasurementMetaUpsert } from '../api/bff-api.service';
import { CodeItemDto, MeasurementTypesService } from '../measurement-types.service';
import { ToastService } from '../ui/toast.service';

/**
 * Types de mesures — référentiel réel (codelist MEASUREMENT_TYPE via BFF), présenté
 * comme une vraie page de configuration : header explicatif, KPIs, unité/catégorie
 * DÉRIVÉES du code (table de réf. front, la codelist backend ne les stocke pas encore),
 * comptes « utilisée dans » RÉELS (seuils + capteurs), garde-fou suppression (désactiver
 * si utilisée), validation, et amorçage des mesures standard.
 *
 * Persistance réelle = labels / couleur / ordre / actif (inchangé). Unité & catégorie
 * sont affichées en lecture seule (dérivées) — les persister est un lot backend séparé.
 */

type Cat = 'Hydraulique' | 'Qualité de l’eau' | 'Consommation' | 'État capteur' | 'Énergie' | '—';
interface Meta { unit: string; cat: Cat; vtype: string; dec: number | null; desc: string; }
/** Vue fusionnée présentée à l'UI : la meta persistée prime, sinon repli sur REF. */
interface MetaView { unit: string; cat: Cat; vtype: string; dec: number | null; desc: string; min: number | null; max: number | null; alerts: boolean; reports: boolean; persisted: boolean; }

const CATEGORIES: Cat[] = ['Hydraulique', 'Qualité de l’eau', 'Consommation', 'État capteur', 'Énergie'];
const VALUE_TYPES = ['Numérique', 'Booléen', 'Texte'];

/** Métadonnées dérivées par code (variantes FR + EN). La codelist ne les stocke pas. */
const REF: Record<string, Meta> = {
  PRESSURE:     { unit: 'bar',   cat: 'Hydraulique',     vtype: 'Numérique', dec: 2, desc: 'Pression dans le réseau ou les conduites.' },
  PRESSION:     { unit: 'bar',   cat: 'Hydraulique',     vtype: 'Numérique', dec: 2, desc: 'Pression dans le réseau ou les conduites.' },
  LEVEL:        { unit: '%',     cat: 'Hydraulique',     vtype: 'Numérique', dec: 0, desc: 'Niveau de remplissage d’un réservoir.' },
  NIVEAU:       { unit: '%',     cat: 'Hydraulique',     vtype: 'Numérique', dec: 0, desc: 'Niveau de remplissage d’un réservoir.' },
  FLOW:         { unit: 'm³/h',  cat: 'Hydraulique',     vtype: 'Numérique', dec: 1, desc: 'Débit transporté dans une conduite.' },
  DEBIT:        { unit: 'm³/h',  cat: 'Hydraulique',     vtype: 'Numérique', dec: 1, desc: 'Débit transporté dans une conduite.' },
  VOLUME:       { unit: 'm³',    cat: 'Consommation',    vtype: 'Numérique', dec: 0, desc: 'Volume d’eau consommé ou produit.' },
  TURBIDITY:    { unit: 'NTU',   cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 1, desc: 'Turbidité de l’eau.' },
  TURBIDITE:    { unit: 'NTU',   cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 1, desc: 'Turbidité de l’eau.' },
  PH:           { unit: 'pH',    cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 2, desc: 'Potentiel hydrogène de l’eau.' },
  CHLORINE:     { unit: 'mg/L',  cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 2, desc: 'Chlore résiduel dans l’eau traitée.' },
  CHLORE:       { unit: 'mg/L',  cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 2, desc: 'Chlore résiduel dans l’eau traitée.' },
  TEMPERATURE:  { unit: '°C',    cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 1, desc: 'Température de l’eau.' },
  CONDUCTIVITY: { unit: 'µS/cm', cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 0, desc: 'Conductivité électrique de l’eau.' },
  CONDUCTIVITE: { unit: 'µS/cm', cat: 'Qualité de l’eau', vtype: 'Numérique', dec: 0, desc: 'Conductivité électrique de l’eau.' },
  BATTERY_LEVEL:{ unit: '%',     cat: 'État capteur',    vtype: 'Numérique', dec: 0, desc: 'Niveau de batterie du capteur.' },
  SIGNAL_STRENGTH:{ unit: 'dBm', cat: 'État capteur',    vtype: 'Numérique', dec: 0, desc: 'Qualité du signal radio du capteur.' },
  PUMP_STATUS:  { unit: '—',     cat: 'État capteur',    vtype: 'Booléen',   dec: null, desc: 'État de marche d’une pompe.' },
  VALVE_STATUS: { unit: '—',     cat: 'État capteur',    vtype: 'Booléen',   dec: null, desc: 'État d’ouverture d’une vanne.' },
  ENERGY:       { unit: 'kWh',   cat: 'Énergie',         vtype: 'Numérique', dec: 1, desc: 'Énergie consommée.' },
  ENERGIE:      { unit: 'kWh',   cat: 'Énergie',         vtype: 'Numérique', dec: 1, desc: 'Énergie consommée.' },
};
const META_VIDE: Meta = { unit: '—', cat: '—', vtype: '—', dec: null, desc: '' };

const CAT_KIND: Record<string, string> = {
  'Hydraulique': 'info', 'Qualité de l’eau': 'teal', 'Consommation': 'violet',
  'État capteur': 'mut', 'Énergie': 'warn', '—': 'mut',
};

/** capteur.type (PRESSION/NIVEAU/DEBIT/QUALITE) → codes de mesure équivalents. */
const CAPTEUR_SYN: Record<string, string[]> = {
  PRESSION: ['PRESSURE', 'PRESSION'],
  NIVEAU:   ['LEVEL', 'NIVEAU'],
  DEBIT:    ['FLOW', 'DEBIT'],
};

/** Mesures standard d'un réseau AEP (amorçage via upsert — codes anglais). */
const STANDARD: { code: string; fr: string; ht: string; en: string; color: string }[] = [
  { code: 'PRESSURE', fr: 'Pression', ht: 'Presyon', en: 'Pressure', color: '#2563eb' },
  { code: 'LEVEL', fr: 'Niveau', ht: 'Nivo', en: 'Level', color: '#0891b2' },
  { code: 'FLOW', fr: 'Débit', ht: 'Debi', en: 'Flow', color: '#0d9488' },
  { code: 'VOLUME', fr: 'Volume', ht: 'Volim', en: 'Volume', color: '#7c3aed' },
  { code: 'TURBIDITY', fr: 'Turbidité', ht: 'Tibidite', en: 'Turbidity', color: '#d97706' },
  { code: 'PH', fr: 'pH', ht: 'pH', en: 'pH', color: '#16a34a' },
  { code: 'CHLORINE', fr: 'Chlore résiduel', ht: 'Klò rezidyèl', en: 'Chlorine', color: '#059669' },
  { code: 'TEMPERATURE', fr: 'Température', ht: 'Tanperati', en: 'Temperature', color: '#ea580c' },
  { code: 'CONDUCTIVITY', fr: 'Conductivité', ht: 'Kondiktivite', en: 'Conductivity', color: '#0284c7' },
  { code: 'BATTERY_LEVEL', fr: 'Niveau batterie', ht: 'Nivo batri', en: 'Battery level', color: '#64748b' },
  { code: 'SIGNAL_STRENGTH', fr: 'Qualité du signal', ht: 'Kalite siyal', en: 'Signal strength', color: '#94a3b8' },
];

@Component({
  selector: 'app-measurement-types-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="mt-shell">

  <!-- Header -->
  <div class="mt-head">
    <div>
      <h1 class="mt-h1">Types de mesures</h1>
      <p class="mt-sub">Configurer les mesures utilisées par les capteurs IoT, les alertes, les rapports et les tableaux de bord.</p>
    </div>
    <div class="mt-head__act">
      <button class="mt-btn" (click)="seedStandard()"><i class="ti ti-sparkles"></i> Ajouter les mesures standard</button>
      <button class="mt-btn mt-btn--primary" (click)="ouvrirCreate()"><i class="ti ti-plus"></i> Ajouter une mesure</button>
    </div>
  </div>

  <!-- KPIs -->
  <div class="mt-kpis">
    <div class="mt-kpi"><span class="mt-kpi__v">{{ kpiActives() }}</span><span class="mt-kpi__l">Mesures actives</span></div>
    <div class="mt-kpi mt-kpi--info"><span class="mt-kpi__v">{{ kpiCat('Hydraulique') }}</span><span class="mt-kpi__l">Hydrauliques</span></div>
    <div class="mt-kpi mt-kpi--teal"><span class="mt-kpi__v">{{ kpiCat('Qualité de l’eau') }}</span><span class="mt-kpi__l">Qualité de l’eau</span></div>
    <div class="mt-kpi mt-kpi--warn"><span class="mt-kpi__v">{{ kpiAvecSeuils() }}</span><span class="mt-kpi__l">Avec seuils configurés</span></div>
  </div>

  <!-- Create/Edit form -->
  <div class="mt-form" *ngIf="formOuvert()">
    <div class="mt-form__h">
      <span>{{ editCode() ? 'Modifier ' + editCode() : 'Nouvelle mesure' }}</span>
      <i class="ti ti-x mt-form__x" (click)="fermerForm()"></i>
    </div>
    <div class="mt-form__grid">
      <label class="mt-field">Code <span class="mt-req">*</span>
        <input [(ngModel)]="draft.code" [disabled]="!!editCode()" placeholder="PRESSURE" (ngModelChange)="onCodeChange($event)">
        <span class="mt-hint">Majuscules, unique.</span>
      </label>
      <label class="mt-field">Label FR <span class="mt-req">*</span><input [(ngModel)]="draft.labelFr" placeholder="Pression"></label>
      <label class="mt-field">Label HT<input [(ngModel)]="draft.labelHt" placeholder="Presyon"></label>
      <label class="mt-field">Label EN<input [(ngModel)]="draft.labelEn" placeholder="Pressure"></label>
      <label class="mt-field">Couleur
        <span class="mt-color"><input type="color" [(ngModel)]="draft.color"><input [(ngModel)]="draft.color" placeholder="#2563eb"></span>
      </label>
      <label class="mt-field">Ordre<input type="number" [(ngModel)]="draft.sortOrder"></label>
      <label class="mt-field mt-field--chk"><input type="checkbox" [(ngModel)]="draft.active"> Active</label>
    </div>
    <!-- Métadonnées persistées (table measurement_type_meta) -->
    <div class="mt-metahead"><i class="ti ti-database-cog"></i> Métadonnées — persistées, utilisées par les graphiques, alertes et rapports</div>
    <div class="mt-form__grid">
      <label class="mt-field">Unité <span class="mt-req">*</span><input [(ngModel)]="draftMeta.unit" placeholder="bar"></label>
      <label class="mt-field">Catégorie
        <select [(ngModel)]="draftMeta.category"><option value="">—</option><option *ngFor="let c of CATEGORIES" [value]="c">{{ c }}</option></select>
      </label>
      <label class="mt-field">Type de valeur
        <select [(ngModel)]="draftMeta.valueType"><option *ngFor="let v of VALUE_TYPES" [value]="v">{{ v }}</option></select>
      </label>
      <label class="mt-field">Décimales<input type="number" min="0" max="6" [(ngModel)]="draftMeta.decimals"></label>
      <label class="mt-field">Valeur min<input type="number" [(ngModel)]="draftMeta.minValue"></label>
      <label class="mt-field">Valeur max<input type="number" [(ngModel)]="draftMeta.maxValue"></label>
      <label class="mt-field mt-field--chk"><input type="checkbox" [(ngModel)]="draftMeta.usableInAlerts"> Utilisable dans alertes</label>
      <label class="mt-field mt-field--chk"><input type="checkbox" [(ngModel)]="draftMeta.usableInReports"> Utilisable dans rapports</label>
      <label class="mt-field" style="grid-column:1/-1">Description<input [(ngModel)]="draftMeta.description" placeholder="Mesure de pression dans le réseau ou les conduites."></label>
    </div>
    <div class="mt-form__foot">
      <button class="mt-btn" (click)="fermerForm()">Annuler</button>
      <button class="mt-btn mt-btn--primary" (click)="submit()"><i class="ti ti-device-floppy"></i> {{ editCode() ? 'Enregistrer' : 'Ajouter' }}</button>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="mt-toolbar">
    <div class="mt-search"><i class="ti ti-search"></i><input [(ngModel)]="q" placeholder="Rechercher une mesure (code, label)…"></div>
    <span class="mt-count">{{ filtered().length }} mesure(s)</span>
  </div>

  <!-- Table -->
  <div class="mt-table-wrap">
    <table class="mt-table">
      <thead><tr>
        <th>Code</th><th>Label FR</th><th>Unité</th><th>Catégorie</th><th>Couleur</th>
        <th>Seuils</th><th>Utilisée dans</th><th>Statut</th><th class="mt-r">Actions</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let t of filtered()">
          <td><code class="mt-code">{{ t.code }}</code></td>
          <td class="mt-strong">{{ t.labelFr || '—' }}</td>
          <td><span class="mt-unit">{{ metaOf(t.code).unit }}</span></td>
          <td><span class="mt-tag mt-tag--{{ catKind(t.code) }}">{{ metaOf(t.code).cat }}</span></td>
          <td><span class="mt-swatch" [style.background]="t.color || 'transparent'"></span><span class="mt-mono">{{ t.color || '—' }}</span></td>
          <td>
            <span class="mt-seuil" [class.mt-seuil--on]="seuilsCount(t.code) > 0">{{ seuilsCount(t.code) }}</span>
          </td>
          <td>
            <span class="mt-usage" [class.mt-usage--0]="usageTotal(t.code) === 0">
              {{ capteursCount(t.code) }} capteur(s) · {{ seuilsCount(t.code) }} seuil(s)
            </span>
          </td>
          <td>
            <button class="mt-status" [class.mt-status--on]="t.active" (click)="toggleActive(t)">
              <span class="mt-status__dot"></span>{{ t.active ? 'Actif' : 'Inactif' }}
            </button>
          </td>
          <td class="mt-r">
            <div class="mt-rowact">
              <button class="mt-ico" title="Modifier" (click)="ouvrirEdit(t)"><i class="ti ti-edit"></i></button>
              <button class="mt-ico" title="Voir utilisation" (click)="usageItem.set(t)"><i class="ti ti-eye"></i></button>
              <button class="mt-ico" [class.mt-ico--warn]="true" [title]="t.active ? 'Désactiver' : 'Activer'" (click)="toggleActive(t)">
                <i class="ti" [ngClass]="t.active ? 'ti-toggle-right' : 'ti-toggle-left'"></i>
              </button>
              <button class="mt-ico mt-ico--danger" [disabled]="usageTotal(t.code) > 0"
                      [title]="usageTotal(t.code) > 0 ? 'Utilisée — désactiver plutôt que supprimer' : 'Supprimer'" (click)="remove(t)">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </td>
        </tr>
        <tr *ngIf="filtered().length === 0"><td colspan="9" class="mt-empty">Aucune mesure. Cliquez « Ajouter les mesures standard » pour amorcer le référentiel.</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- Modale « Voir utilisation » -->
<div class="mt-modal" *ngIf="usageItem() as u" (click)="usageItem.set(null)">
  <div class="mt-card" (click)="$event.stopPropagation()">
    <div class="mt-card__h">
      <div><div class="mt-card__t"><code class="mt-code">{{ u.code }}</code> {{ u.labelFr }}</div>
        <div class="mt-card__s">{{ metaOf(u.code).unit }} · {{ metaOf(u.code).cat }}</div></div>
      <i class="ti ti-x mt-card__x" (click)="usageItem.set(null)"></i>
    </div>
    <div class="mt-card__b">
      <p class="mt-card__desc" *ngIf="metaOf(u.code).desc">{{ metaOf(u.code).desc }}</p>
      <div class="mt-meta-grid" *ngIf="metaOf(u.code) as mv">
        <span class="mt-chip">Unité <b>{{ mv.unit }}</b></span>
        <span class="mt-chip">Catégorie <b>{{ mv.cat }}</b></span>
        <span class="mt-chip">Type <b>{{ mv.vtype }}</b></span>
        <span class="mt-chip" *ngIf="mv.dec !== null">Décimales <b>{{ mv.dec }}</b></span>
        <span class="mt-chip" *ngIf="mv.min !== null">Min <b>{{ mv.min }}</b></span>
        <span class="mt-chip" *ngIf="mv.max !== null">Max <b>{{ mv.max }}</b></span>
        <span class="mt-chip" [class.mt-chip--off]="!mv.alerts">Alertes <b>{{ mv.alerts ? 'oui' : 'non' }}</b></span>
        <span class="mt-chip" [class.mt-chip--off]="!mv.reports">Rapports <b>{{ mv.reports ? 'oui' : 'non' }}</b></span>
        <span class="mt-chip" [class.mt-chip--off]="!mv.persisted">{{ mv.persisted ? 'persistée' : 'dérivée (non persistée)' }}</span>
      </div>
      <div class="mt-use-row"><i class="ti ti-cpu"></i> <b>{{ capteursCount(u.code) }}</b> capteur(s) de ce type</div>
      <div class="mt-use-row"><i class="ti ti-gauge"></i> <b>{{ seuilsCount(u.code) }}</b> borne(s) de seuil configurée(s)
        <a class="mt-link" routerLink="/admin/config/thresholds" (click)="usageItem.set(null)">Configurer les seuils</a></div>
      <div class="mt-use-caps" *ngIf="capteursOf(u.code).length">
        <span class="mt-use-caps__t">Capteurs rattachés</span>
        <span class="mt-cap" *ngFor="let c of capteursOf(u.code)">{{ c.nom || c.code }} <span class="mt-cap__z">{{ c.commune || c.departement }}</span></span>
      </div>
      <div class="mt-note" *ngIf="usageTotal(u.code) > 0"><i class="ti ti-lock"></i> Cette mesure est utilisée : la suppression est bloquée. Désactivez-la pour la retirer des nouveaux usages sans casser l'existant.</div>
    </div>
  </div>
</div>
  `,
  styles: [`
:host { display:block; }
.mt-shell { color:var(--text); max-width:1180px; }
.mt-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.1rem; flex-wrap:wrap; }
.mt-h1 { font-size:1.3rem; font-weight:800; margin:0; }
.mt-sub { font-size:.8rem; color:var(--muted); margin:.25rem 0 0; max-width:640px; line-height:1.5; }
.mt-head__act { display:flex; gap:.5rem; flex-shrink:0; }

.mt-btn { display:inline-flex; align-items:center; gap:.4rem; padding:.5rem .85rem; border-radius:9px; font-size:.78rem; font-weight:600; border:var(--border); background:var(--surface); color:var(--text); cursor:pointer; font-family:inherit; }
.mt-btn:hover { border-color:color-mix(in srgb, var(--primary) 40%, var(--border-color)); }
.mt-btn i { font-size:15px; }
.mt-btn--primary { background:var(--primary); color:#fff; border-color:transparent; }
.mt-btn--primary:hover { filter:brightness(1.06); }

.mt-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:.7rem; margin-bottom:1.1rem; }
.mt-kpi { background:var(--surface); border:var(--border); border-radius:12px; padding:.8rem .9rem; display:flex; flex-direction:column; gap:.15rem; }
.mt-kpi__v { font-size:1.5rem; font-weight:800; line-height:1; }
.mt-kpi__l { font-size:.72rem; color:var(--muted); }
.mt-kpi--info .mt-kpi__v { color:var(--primary); }
.mt-kpi--teal .mt-kpi__v { color:#0d9488; }
.mt-kpi--warn .mt-kpi__v { color:var(--warning); }

/* Form */
.mt-form { background:var(--surface); border:var(--border); border-radius:12px; margin-bottom:1.1rem; overflow:hidden; }
.mt-form__h { display:flex; align-items:center; justify-content:space-between; padding:.75rem 1rem; border-bottom:1px solid var(--border-color); font-size:.85rem; font-weight:700; }
.mt-form__x { cursor:pointer; color:var(--muted); font-size:18px; }
.mt-form__grid { display:grid; grid-template-columns:repeat(4,1fr); gap:.8rem; padding:1rem; }
.mt-field { display:flex; flex-direction:column; gap:.35rem; font-size:.74rem; font-weight:600; color:var(--muted); }
.mt-field input { height:36px; border-radius:8px; background:var(--bg); border:var(--border); color:var(--text); padding:0 .6rem; font-size:.82rem; font-family:inherit; outline:none; }
.mt-field input:focus { border-color:var(--primary); }
.mt-field input:disabled { opacity:.55; }
.mt-field--chk { flex-direction:row; align-items:center; gap:.4rem; align-self:end; height:36px; }
.mt-req { color:var(--danger); }
.mt-hint { font-size:.68rem; font-weight:400; color:var(--muted); }
.mt-color { display:flex; gap:.4rem; }
.mt-color input[type=color] { width:36px; padding:2px; cursor:pointer; }
.mt-derived { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; padding:.6rem 1rem; background:var(--bg); border-top:1px solid var(--border-color); }
.mt-derived__lbl { display:flex; align-items:center; gap:.35rem; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
.mt-derived__lbl i { color:var(--primary); }
.mt-chip { font-size:.74rem; color:var(--muted); background:var(--surface); border:var(--border); border-radius:20px; padding:.2rem .6rem; }
.mt-chip b { color:var(--text); }
.mt-chip--off { opacity:.55; }
.mt-metahead { display:flex; align-items:center; gap:.4rem; padding:.55rem 1rem; background:var(--bg); border-top:1px solid var(--border-color); font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
.mt-metahead i { color:var(--primary); font-size:14px; }
.mt-meta-grid { display:flex; flex-wrap:wrap; gap:.4rem; }
.mt-form__foot { display:flex; justify-content:flex-end; gap:.5rem; padding:.75rem 1rem; border-top:1px solid var(--border-color); }

/* Toolbar */
.mt-toolbar { display:flex; align-items:center; gap:.7rem; margin-bottom:.6rem; }
.mt-search { flex:1; max-width:380px; display:flex; align-items:center; gap:.5rem; background:var(--bg); border:var(--border); border-radius:8px; padding:0 .7rem; height:34px; }
.mt-search i { color:var(--muted); font-size:15px; }
.mt-search input { flex:1; border:0; background:none; color:var(--text); font-size:.8rem; outline:none; font-family:inherit; }
.mt-count { font-size:.74rem; color:var(--muted); margin-left:auto; }

/* Table */
.mt-table-wrap { border:var(--border); border-radius:12px; overflow:auto; background:var(--surface); }
.mt-table { width:100%; border-collapse:collapse; font-size:.8rem; }
.mt-table th { text-align:left; font-size:.65rem; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--muted); padding:.6rem .8rem; border-bottom:1px solid var(--border-color); white-space:nowrap; background:var(--bg); }
.mt-table td { padding:.55rem .8rem; border-bottom:1px solid var(--border-color); color:var(--muted); vertical-align:middle; }
.mt-table tbody tr:last-child td { border-bottom:none; }
.mt-table tbody tr:hover td { background:color-mix(in srgb, var(--text) 3%, transparent); }
.mt-r { text-align:right; }
.mt-strong { color:var(--text); font-weight:600; }
.mt-code { font-family:monospace; font-size:.72rem; color:#0891b2; background:rgba(8,145,178,.1); border:1px solid rgba(8,145,178,.22); padding:.1rem .45rem; border-radius:6px; }
.mt-unit { font-family:monospace; font-size:.76rem; color:var(--text); }
.mt-mono { font-family:monospace; font-size:.72rem; }
.mt-swatch { display:inline-block; width:13px; height:13px; border-radius:4px; border:var(--border); vertical-align:-2px; margin-right:.35rem; }
.mt-tag { display:inline-flex; align-items:center; font-size:.68rem; font-weight:600; padding:.14rem .5rem; border-radius:20px; white-space:nowrap; }
.mt-tag--info { color:#2563eb; background:#eff6ff; }
.mt-tag--teal { color:#0d9488; background:#f0fdfa; }
.mt-tag--violet { color:#7c3aed; background:#f5f3ff; }
.mt-tag--warn { color:#d97706; background:#fffbeb; }
.mt-tag--mut { color:#64748b; background:#f1f5f9; }
.mt-seuil { display:inline-grid; place-items:center; min-width:22px; height:22px; border-radius:6px; font-size:.72rem; font-weight:700; color:var(--muted); background:var(--bg); border:var(--border); }
.mt-seuil--on { color:var(--warning); background:#fffbeb; border-color:#fde68a; }
.mt-usage { font-size:.74rem; color:var(--text); }
.mt-usage--0 { color:var(--muted); }
.mt-status { display:inline-flex; align-items:center; gap:.35rem; font-size:.72rem; font-weight:600; padding:.2rem .55rem; border-radius:20px; border:var(--border); background:var(--bg); color:var(--muted); cursor:pointer; font-family:inherit; }
.mt-status__dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
.mt-status--on { color:#16a34a; background:#f0fdf4; border-color:#bbf7d0; }
.mt-rowact { display:flex; gap:.2rem; justify-content:flex-end; }
.mt-ico { width:28px; height:28px; border-radius:7px; display:grid; place-items:center; color:var(--muted); border:1px solid transparent; background:none; cursor:pointer; }
.mt-ico i { font-size:16px; }
.mt-ico:hover { background:var(--bg); color:var(--text); border-color:var(--border-color); }
.mt-ico--danger:hover:not(:disabled) { color:var(--danger); border-color:color-mix(in srgb, var(--danger) 30%, transparent); }
.mt-ico:disabled { opacity:.35; cursor:not-allowed; }
.mt-empty { text-align:center; color:var(--muted); padding:2rem; font-size:.82rem; }

/* Usage modal */
.mt-modal { position:fixed; inset:0; background:rgba(2,6,23,.6); backdrop-filter:blur(3px); display:flex; align-items:flex-start; justify-content:center; padding:6vh 1rem; z-index:1100; }
.mt-card { width:480px; max-width:100%; background:var(--surface); border:var(--border); border-radius:14px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.5); }
.mt-card__h { display:flex; align-items:flex-start; justify-content:space-between; padding:.9rem 1.1rem; border-bottom:1px solid var(--border-color); }
.mt-card__t { font-size:.95rem; font-weight:700; display:flex; align-items:center; gap:.4rem; }
.mt-card__s { font-size:.74rem; color:var(--muted); margin-top:.2rem; }
.mt-card__x { cursor:pointer; color:var(--muted); font-size:18px; }
.mt-card__b { padding:1rem 1.1rem; display:flex; flex-direction:column; gap:.7rem; }
.mt-card__desc { font-size:.8rem; color:var(--muted); margin:0; line-height:1.5; }
.mt-use-row { display:flex; align-items:center; gap:.5rem; font-size:.82rem; color:var(--text); }
.mt-use-row i { color:var(--primary); font-size:16px; }
.mt-use-row b { font-weight:800; }
.mt-link { margin-left:auto; font-size:.74rem; color:var(--primary); cursor:pointer; text-decoration:none; }
.mt-link:hover { text-decoration:underline; }
.mt-use-caps { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; }
.mt-use-caps__t { font-size:.68rem; font-weight:700; text-transform:uppercase; color:var(--muted); width:100%; }
.mt-cap { font-size:.74rem; background:var(--bg); border:var(--border); border-radius:8px; padding:.25rem .55rem; }
.mt-cap__z { color:var(--muted); font-size:.7rem; }
.mt-note { display:flex; gap:.5rem; font-size:.76rem; color:var(--warning); background:#fffbeb; border:1px solid #fde68a; border-radius:9px; padding:.55rem .7rem; line-height:1.45; }
.mt-note i { flex-shrink:0; margin-top:1px; }

@media (max-width:900px) { .mt-kpis { grid-template-columns:repeat(2,1fr); } .mt-form__grid { grid-template-columns:1fr 1fr; } }
  `],
})
export class MeasurementTypesPageComponent implements OnDestroy {
  private readonly api = inject(BffApiService);
  private readonly service = inject(MeasurementTypesService);
  private readonly toast = inject(ToastService);

  readonly items = signal<CodeItemDto[]>([]);
  private readonly thresholds = signal<{ type: string; minWarn: number | null; minCrit: number | null }[]>([]);
  private readonly capteurs = signal<CapteurDto[]>([]);
  private readonly meta = signal<MeasurementMetaDto[]>([]);

  readonly CATEGORIES = CATEGORIES;
  readonly VALUE_TYPES = VALUE_TYPES;

  q = '';
  readonly formOuvert = signal(false);
  readonly editCode = signal<string | null>(null);
  readonly usageItem = signal<CodeItemDto | null>(null);
  draft: Partial<CodeItemDto> = this.blank();
  draftMeta: MeasurementMetaUpsert = this.blankMeta();

  private readonly subs: Subscription[] = [];

  constructor() {
    this.subs.push(this.service.stream().subscribe(rows => this.items.set((rows ?? []).map(r => ({ ...r })))));
    this.service.reload().subscribe();
    this.reloadMeta();
    this.api.referenceThresholds().subscribe({
      next: rows => this.thresholds.set((rows ?? []).map(r => ({ type: String(r.type), minWarn: r.minWarn ?? null, minCrit: r.minCrit ?? null }))),
      error: () => {},
    });
    this.api.listCapteurs().subscribe({ next: rows => this.capteurs.set(rows ?? []), error: () => {} });
  }

  private reloadMeta(): void {
    this.api.referenceMeasurementMeta().subscribe({ next: rows => this.meta.set(rows ?? []), error: () => {} });
  }

  // ── Dérivations : la meta persistée prime, sinon repli sur REF ──
  metaOf(code: string): MetaView {
    const ref = REF[(code || '').toUpperCase()] ?? META_VIDE;
    const p = this.meta().find(m => m.code.toUpperCase() === (code || '').toUpperCase());
    return {
      unit: (p?.unit ?? '') || ref.unit,
      cat: (((p?.category ?? '') as Cat) || ref.cat),
      vtype: (p?.valueType ?? '') || ref.vtype,
      dec: p?.decimals ?? ref.dec,
      desc: (p?.description ?? '') || ref.desc,
      min: p?.minValue ?? null,
      max: p?.maxValue ?? null,
      alerts: p?.usableInAlerts ?? true,
      reports: p?.usableInReports ?? true,
      persisted: !!p,
    };
  }
  catKind(code: string): string { return CAT_KIND[this.metaOf(code).cat] ?? 'mut'; }

  seuilsCount(code: string): number {
    const r = this.thresholds().find(t => t.type.toUpperCase() === code.toUpperCase());
    if (!r) return 0;
    return (r.minWarn != null ? 1 : 0) + (r.minCrit != null ? 1 : 0);
  }
  capteursOf(code: string): CapteurDto[] {
    const c = code.toUpperCase();
    return this.capteurs().filter(cap => (CAPTEUR_SYN[cap.type] ?? [cap.type]).some(s => s.toUpperCase() === c));
  }
  capteursCount(code: string): number { return this.capteursOf(code).length; }
  usageTotal(code: string): number { return this.capteursCount(code) + this.seuilsCount(code); }

  readonly filtered = computed(() => {
    const q = this.q.trim().toLowerCase();
    return [...this.items()]
      .filter(t => !q || t.code.toLowerCase().includes(q) || (t.labelFr ?? '').toLowerCase().includes(q))
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.code.localeCompare(b.code));
  });

  // ── KPIs ──
  kpiActives(): number { return this.items().filter(t => t.active).length; }
  kpiCat(cat: Cat): number { return this.items().filter(t => t.active && this.metaOf(t.code).cat === cat).length; }
  kpiAvecSeuils(): number { return this.items().filter(t => this.seuilsCount(t.code) > 0).length; }

  // ── Form ──
  up(v: string): string { return (v || '').toUpperCase().replace(/\s+/g, '_'); }
  private blank(): Partial<CodeItemDto> { return { code: '', labelFr: '', labelHt: '', labelEn: '', color: '#2563eb', sortOrder: 50, active: true }; }
  private blankMeta(): MeasurementMetaUpsert { return { unit: '', category: '', description: '', valueType: 'Numérique', decimals: null, minValue: null, maxValue: null, usableInAlerts: true, usableInReports: true }; }

  onCodeChange(v: string): void {
    this.draft.code = this.up(v);
    const ref = REF[this.draft.code];
    if (!ref) return;
    if (!this.draftMeta.unit) this.draftMeta.unit = ref.unit === '—' ? '' : ref.unit;
    if (!this.draftMeta.category) this.draftMeta.category = ref.cat === '—' ? '' : ref.cat;
    if (!this.draftMeta.description) this.draftMeta.description = ref.desc;
    if (this.draftMeta.decimals == null) this.draftMeta.decimals = ref.dec;
  }

  ouvrirCreate(): void { this.draft = this.blank(); this.draftMeta = this.blankMeta(); this.editCode.set(null); this.formOuvert.set(true); }
  ouvrirEdit(t: CodeItemDto): void {
    this.draft = { ...t };
    const mv = this.metaOf(t.code);
    this.draftMeta = {
      unit: mv.unit === '—' ? '' : mv.unit,
      category: mv.cat === '—' ? '' : mv.cat,
      description: mv.desc,
      valueType: mv.vtype === '—' ? 'Numérique' : mv.vtype,
      decimals: mv.dec,
      minValue: mv.min,
      maxValue: mv.max,
      usableInAlerts: mv.alerts,
      usableInReports: mv.reports,
    };
    this.editCode.set(t.code);
    this.formOuvert.set(true);
  }
  fermerForm(): void { this.formOuvert.set(false); }

  submit(): void {
    const code = this.up(this.draft.code ?? '');
    if (!code) { this.toast.push('error', 'Le code est obligatoire.'); return; }
    if (!(this.draft.labelFr ?? '').trim()) { this.toast.push('error', 'Le label FR est obligatoire.'); return; }
    if (!(this.draftMeta.unit ?? '').trim()) { this.toast.push('error', 'L’unité de mesure est obligatoire.'); return; }
    if (!this.editCode() && this.items().some(i => i.code.toUpperCase() === code)) {
      this.toast.push('error', `Le code ${code} existe déjà.`); return;
    }
    const editing = !!this.editCode();
    // 1) Codelist (labels/couleur/ordre/actif) — flux existant inchangé.
    this.api.upsertCodeItem('MEASUREMENT_TYPE', code, {
      labelFr: this.draft.labelFr ?? null, labelHt: this.draft.labelHt ?? null, labelEn: this.draft.labelEn ?? null,
      color: this.draft.color ?? null, sortOrder: this.draft.sortOrder ?? null, active: this.draft.active ?? true,
    }).subscribe({
      next: () => {
        this.service.reload().subscribe();
        // 2) Métadonnées (table dédiée) — écriture INDÉPENDANTE. Erreur visible même si les labels ont été sauvegardés.
        this.api.upsertMeasurementMeta(code, this.normalizeMeta(this.draftMeta)).subscribe({
          next: () => { this.reloadMeta(); this.toast.push('success', editing ? 'Mesure enregistrée' : 'Mesure ajoutée'); this.formOuvert.set(false); },
          error: (e) => { this.reloadMeta(); this.toast.push('error', 'Labels enregistrés, mais métadonnées NON enregistrées : ' + (e?.error?.message || 'échec du serveur')); },
        });
      },
      error: (e) => this.toast.push('error', e?.error?.message || 'Échec de l’enregistrement des labels'),
    });
  }

  private normalizeMeta(m: MeasurementMetaUpsert): MeasurementMetaUpsert {
    const num = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
    return {
      unit: (m.unit ?? '').trim() || null,
      category: (m.category ?? '') || null,
      description: (m.description ?? '').trim() || null,
      valueType: m.valueType || null,
      decimals: num(m.decimals),
      minValue: num(m.minValue),
      maxValue: num(m.maxValue),
      usableInAlerts: !!m.usableInAlerts,
      usableInReports: !!m.usableInReports,
    };
  }

  private persist(code: string, d: Partial<CodeItemDto>, done?: () => void): void {
    this.api.upsertCodeItem('MEASUREMENT_TYPE', code, {
      labelFr: d.labelFr ?? null, labelHt: d.labelHt ?? null, labelEn: d.labelEn ?? null,
      color: d.color ?? null, sortOrder: d.sortOrder ?? null, active: d.active ?? true,
    }).subscribe({
      next: () => { this.service.reload().subscribe(); done?.(); },
      error: (e) => this.toast.push('error', e?.error?.message || 'Échec de l’enregistrement'),
    });
  }

  toggleActive(t: CodeItemDto): void {
    this.persist(t.code, { ...t, active: !t.active }, () => this.toast.push('success', !t.active ? 'Mesure activée' : 'Mesure désactivée'));
  }

  remove(t: CodeItemDto): void {
    if (this.usageTotal(t.code) > 0) {
      this.toast.push('error', `${t.code} est utilisée (${this.capteursCount(t.code)} capteur·s, ${this.seuilsCount(t.code)} seuil·s) — désactivez-la plutôt.`);
      return;
    }
    this.api.deleteCodeItem('MEASUREMENT_TYPE', t.code).subscribe({
      next: () => { this.toast.push('success', 'Mesure supprimée'); this.service.reload().subscribe(); },
      error: (e) => this.toast.push('error', e?.error?.message || 'Échec de la suppression'),
    });
  }

  seedStandard(): void {
    const existing = new Set(this.items().map(i => i.code.toUpperCase()));
    const missing = STANDARD.filter(s => !existing.has(s.code));
    if (!missing.length) { this.toast.push('info', 'Toutes les mesures standard sont déjà présentes.'); return; }
    const calls = missing.map((s, i) => this.api.upsertCodeItem('MEASUREMENT_TYPE', s.code, {
      labelFr: s.fr, labelHt: s.ht, labelEn: s.en, color: s.color, sortOrder: (i + 1) * 10, active: true,
    }));
    forkJoin(calls.length ? calls : [of(null)]).subscribe({
      next: () => { this.toast.push('success', `${missing.length} mesure(s) standard ajoutée(s)`); this.service.reload().subscribe(); },
      error: (e) => this.toast.push('error', e?.error?.message || 'Échec de l’amorçage'),
    });
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }
}

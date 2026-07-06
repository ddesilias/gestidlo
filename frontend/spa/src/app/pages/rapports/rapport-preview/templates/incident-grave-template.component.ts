import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportEntry } from '../../rapport.types';

@Component({
  selector: 'app-incident-grave-template',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="a4">
  <div class="a4-header">
    <div class="a4-header__brand">
      <div class="a4-logo">DINEPA</div>
      <div class="a4-header__org">
        <div class="a4-header__org-name">Direction Nationale de l'Eau Potable et de l'Assainissement</div>
        <div class="a4-header__org-sub">République d'Haïti</div>
      </div>
    </div>
    <div class="a4-header__meta">
      <div class="a4-ref">Réf : {{ rapport.id }}</div>
      <div class="a4-ver">Version {{ rapport.version }}</div>
      <div class="a4-date">{{ rapport.createdAt }}</div>
    </div>
  </div>
  <div class="a4-accent"></div>

  <!-- Bandeau alerte -->
  <div class="a4-alert-banner">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
    <span>RAPPORT D'INCIDENT — TRAITEMENT PRIORITAIRE</span>
  </div>

  <div class="a4-title-block">
    <h1 class="a4-title">{{ rapport.title }}</h1>
    <p class="a4-subtitle">{{ rapport.subtitle }}</p>
  </div>

  <div class="a4-sheet">
    <div class="a4-sheet__row"><span class="a4-sheet__k">Période</span><span class="a4-sheet__v">{{ rapport.periodLabel }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Zone affectée</span><span class="a4-sheet__v">{{ rapport.zone }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Rapporté par</span><span class="a4-sheet__v">{{ rapport.author }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Institution</span><span class="a4-sheet__v">{{ rapport.institution }}</span></div>
  </div>

  <!-- Sections d'incident -->
  <div class="a4-section" *ngFor="let s of rapport.sections; let i = index">
    <div class="a4-section__head">
      <span class="a4-section__num">{{ i + 1 }}</span>
      <span class="a4-section__title">{{ s }}</span>
    </div>
    <div class="a4-section__body">
      <div class="a4-placeholder"></div>
      <div class="a4-placeholder a4-placeholder--sm"></div>
      <div *ngIf="i === 0" class="a4-incident-box">
        <div class="a4-incident-row">
          <span class="a4-incident-k">Sévérité</span>
          <span class="a4-incident-v a4-incident-v--crit">Critique</span>
        </div>
        <div class="a4-incident-row">
          <span class="a4-incident-k">Statut initial</span>
          <span class="a4-incident-v">Ouvert</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Tableau zones affectées -->
  <div class="a4-section">
    <div class="a4-section__head">
      <span class="a4-section__title" style="margin-left:0">Carte de répartition des incidents</span>
    </div>
    <div class="a4-map-placeholder">Zone cartographique</div>
  </div>

  <div class="a4-footer">
    <span>DINEPA — GEstiDlo — Rapport d'incident</span>
    <span>{{ rapport.periodLabel }}</span>
    <span>Page 1</span>
  </div>
</div>
  `,
  styles: [`
.a4 { width:210mm; min-height:297mm; background:#fff; color:#1e293b; font-family:'Segoe UI',sans-serif; font-size:9pt; padding:18mm 16mm 14mm; box-sizing:border-box; position:relative; }
.a4-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4mm; }
.a4-header__brand { display:flex; align-items:center; gap:6mm; }
.a4-logo { font-size:18pt; font-weight:800; color:#dc2626; letter-spacing:-.02em; }
.a4-header__org-name { font-size:8pt; font-weight:600; color:#1e293b; }
.a4-header__org-sub  { font-size:7pt; color:#64748b; }
.a4-header__meta { text-align:right; font-size:7pt; color:#64748b; line-height:1.6; }
.a4-ref { font-family:monospace; font-weight:700; color:#1e293b; }
.a4-accent { height:2px; background:#dc2626; margin-bottom:5mm; }
.a4-alert-banner { display:flex; align-items:center; gap:3mm; background:#fef2f2; border:1px solid #fecaca; border-left:3px solid #dc2626; border-radius:4px; padding:3mm 5mm; margin-bottom:5mm; color:#dc2626; font-size:8pt; font-weight:700; letter-spacing:.04em; }
.a4-title-block { margin-bottom:5mm; }
.a4-title    { margin:0 0 1.5mm; font-size:14pt; font-weight:700; color:#0f172a; line-height:1.2; }
.a4-subtitle { margin:0; font-size:9pt; color:#475569; }
.a4-sheet { background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm 5mm; margin-bottom:5mm; }
.a4-sheet__row { display:flex; gap:5mm; padding:1.5mm 0; border-bottom:1px solid #f1f5f9; }
.a4-sheet__row:last-child { border-bottom:none; }
.a4-sheet__k { font-size:7.5pt; color:#64748b; min-width:38mm; flex-shrink:0; }
.a4-sheet__v { font-size:8pt; color:#1e293b; font-weight:500; }
.a4-section { margin-bottom:4mm; break-inside:avoid; }
.a4-section__head { display:flex; align-items:center; gap:2.5mm; padding-bottom:1.5mm; border-bottom:1.5px solid #fecaca; margin-bottom:2mm; }
.a4-section__num { width:5mm; height:5mm; border-radius:50%; font-size:6pt; font-weight:700; color:#fff; background:#dc2626; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.a4-section__title { font-size:9.5pt; font-weight:600; color:#0f172a; }
.a4-section__body { padding-left:7.5mm; }
.a4-placeholder { height:2.5mm; background:#f1f5f9; border-radius:2px; margin-bottom:1.5mm; width:85%; }
.a4-placeholder--sm { width:55%; }
.a4-incident-box { background:#fef2f2; border:1px solid #fecaca; border-radius:3px; padding:2mm 3mm; margin-top:2mm; }
.a4-incident-row { display:flex; gap:4mm; padding:.75mm 0; }
.a4-incident-k { font-size:7pt; color:#64748b; min-width:28mm; }
.a4-incident-v { font-size:7.5pt; color:#1e293b; font-weight:600; }
.a4-incident-v--crit { color:#dc2626; }
.a4-map-placeholder { background:#fafafa; border:1px dashed #e2e8f0; border-radius:4px; height:35mm; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:8pt; }
.a4-footer { position:absolute; bottom:10mm; left:16mm; right:16mm; display:flex; justify-content:space-between; font-size:6.5pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:2mm; }
  `],
})
export class IncidentGraveTemplateComponent {
  @Input({ required: true }) rapport!: ReportEntry;
}

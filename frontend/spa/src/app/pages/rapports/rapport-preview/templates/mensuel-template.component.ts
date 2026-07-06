import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportEntry } from '../../rapport.types';

@Component({
  selector: 'app-mensuel-template',
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

  <!-- Bandeau période -->
  <div class="a4-period-banner">
    <div class="a4-period-banner__icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    </div>
    <div>
      <div class="a4-period-banner__lbl">Période couverte</div>
      <div class="a4-period-banner__val">{{ rapport.periodLabel }}</div>
    </div>
    <div class="a4-period-banner__right">
      <div class="a4-period-banner__lbl">Zone</div>
      <div class="a4-period-banner__val">{{ rapport.zone }}</div>
    </div>
  </div>

  <div class="a4-title-block">
    <div class="a4-type-badge">RAPPORT MENSUEL — {{ rapport.module.toUpperCase() }}</div>
    <h1 class="a4-title">{{ rapport.title }}</h1>
    <p class="a4-subtitle">{{ rapport.subtitle }}</p>
  </div>

  <!-- KPI boxes -->
  <div class="a4-kpi-row">
    <div class="a4-kpi"><div class="a4-kpi__val">—</div><div class="a4-kpi__lbl">Indicateur 1</div></div>
    <div class="a4-kpi"><div class="a4-kpi__val">—</div><div class="a4-kpi__lbl">Indicateur 2</div></div>
    <div class="a4-kpi"><div class="a4-kpi__val">—</div><div class="a4-kpi__lbl">Indicateur 3</div></div>
    <div class="a4-kpi"><div class="a4-kpi__val">—</div><div class="a4-kpi__lbl">Indicateur 4</div></div>
  </div>

  <div class="a4-sheet">
    <div class="a4-sheet__row"><span class="a4-sheet__k">Auteur</span><span class="a4-sheet__v">{{ rapport.author }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Institution</span><span class="a4-sheet__v">{{ rapport.institution }}</span></div>
  </div>

  <div class="a4-section" *ngFor="let s of rapport.sections; let i = index">
    <div class="a4-section__head">
      <span class="a4-section__num">{{ i + 1 }}</span>
      <span class="a4-section__title">{{ s }}</span>
    </div>
    <div class="a4-section__body">
      <div class="a4-placeholder"></div>
      <div class="a4-placeholder a4-placeholder--sm"></div>
    </div>
  </div>

  <div class="a4-footer">
    <span>DINEPA — GEstiDlo — {{ rapport.institution }}</span>
    <span>{{ rapport.periodLabel }}</span>
    <span>Page 1</span>
  </div>
</div>
  `,
  styles: [`
.a4 { width:210mm; min-height:297mm; background:#fff; color:#1e293b; font-family:'Segoe UI',sans-serif; font-size:9pt; padding:18mm 16mm 14mm; box-sizing:border-box; position:relative; }
.a4-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4mm; }
.a4-header__brand { display:flex; align-items:center; gap:6mm; }
.a4-logo { font-size:18pt; font-weight:800; color:#2563eb; letter-spacing:-.02em; }
.a4-header__org-name { font-size:8pt; font-weight:600; color:#1e293b; }
.a4-header__org-sub  { font-size:7pt; color:#64748b; }
.a4-header__meta { text-align:right; font-size:7pt; color:#64748b; line-height:1.6; }
.a4-ref { font-family:monospace; font-weight:700; color:#1e293b; }
.a4-accent { height:2px; background:#2563eb; margin-bottom:5mm; }
.a4-period-banner { display:flex; align-items:center; gap:4mm; background:#eff6ff; border:1px solid #bfdbfe; border-radius:4px; padding:3mm 5mm; margin-bottom:5mm; color:#1e40af; }
.a4-period-banner__icon { color:#2563eb; flex-shrink:0; }
.a4-period-banner__lbl { font-size:7pt; color:#93c5fd; }
.a4-period-banner__val { font-size:9.5pt; font-weight:700; }
.a4-period-banner__right { margin-left:auto; text-align:right; }
.a4-title-block { margin-bottom:5mm; }
.a4-type-badge { display:inline-block; font-size:6.5pt; font-weight:700; letter-spacing:.06em; padding:2px 8px; border-radius:10px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; margin-bottom:3mm; }
.a4-title    { margin:0 0 1.5mm; font-size:14pt; font-weight:700; color:#0f172a; line-height:1.2; }
.a4-subtitle { margin:0; font-size:9pt; color:#475569; }
.a4-kpi-row { display:flex; gap:3mm; margin-bottom:5mm; }
.a4-kpi { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm; text-align:center; }
.a4-kpi__val { font-size:16pt; font-weight:700; color:#2563eb; }
.a4-kpi__lbl { font-size:6.5pt; color:#64748b; margin-top:1mm; }
.a4-sheet { background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm 5mm; margin-bottom:5mm; }
.a4-sheet__row { display:flex; gap:5mm; padding:1.5mm 0; border-bottom:1px solid #f1f5f9; }
.a4-sheet__row:last-child { border-bottom:none; }
.a4-sheet__k { font-size:7.5pt; color:#64748b; min-width:38mm; flex-shrink:0; }
.a4-sheet__v { font-size:8pt; color:#1e293b; font-weight:500; }
.a4-section { margin-bottom:4mm; break-inside:avoid; }
.a4-section__head { display:flex; align-items:center; gap:2.5mm; padding-bottom:1.5mm; border-bottom:1.5px solid #bfdbfe; margin-bottom:2mm; }
.a4-section__num { width:5mm; height:5mm; border-radius:50%; font-size:6pt; font-weight:700; color:#fff; background:#2563eb; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.a4-section__title { font-size:9.5pt; font-weight:600; color:#0f172a; }
.a4-section__body { padding-left:7.5mm; }
.a4-placeholder { height:2.5mm; background:#f1f5f9; border-radius:2px; margin-bottom:1.5mm; width:85%; }
.a4-placeholder--sm { width:55%; }
.a4-footer { position:absolute; bottom:10mm; left:16mm; right:16mm; display:flex; justify-content:space-between; font-size:6.5pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:2mm; }
  `],
})
export class MensuelTemplateComponent {
  @Input({ required: true }) rapport!: ReportEntry;
}

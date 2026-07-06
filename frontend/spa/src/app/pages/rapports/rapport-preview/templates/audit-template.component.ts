import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportEntry } from '../../rapport.types';

@Component({
  selector: 'app-audit-template',
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
        <div class="a4-header__org-sub">République d'Haïti — Usage officiel exclusif</div>
      </div>
    </div>
    <div class="a4-header__meta">
      <div class="a4-ref">Réf audit : {{ rapport.id }}</div>
      <div class="a4-ver">Version {{ rapport.version }}</div>
      <div class="a4-date">Émis le {{ rapport.createdAt }}</div>
    </div>
  </div>
  <div class="a4-accent"></div>

  <!-- Bandeau confidentiel -->
  <div class="a4-confidential">
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
    RAPPORT D'AUDIT INTERNE — CONFIDENTIEL
  </div>

  <div class="a4-title-block">
    <h1 class="a4-title">{{ rapport.title }}</h1>
    <p class="a4-subtitle">{{ rapport.subtitle }}</p>
  </div>

  <!-- Fiche audit -->
  <div class="a4-sheet a4-sheet--audit">
    <div class="a4-sheet__row"><span class="a4-sheet__k">Période d'audit</span><span class="a4-sheet__v">{{ rapport.periodLabel }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Périmètre</span><span class="a4-sheet__v">{{ rapport.zone }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Auditeur</span><span class="a4-sheet__v">{{ rapport.author }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Institution</span><span class="a4-sheet__v">{{ rapport.institution }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Statut audit</span><span class="a4-sheet__v a4-sheet__v--status">{{ rapport.status === 'valide' ? 'Validé' : 'En cours' }}</span></div>
  </div>

  <!-- KPI audit -->
  <div class="a4-audit-kpis">
    <div class="a4-audit-kpi"><div class="a4-audit-kpi__val">—</div><div class="a4-audit-kpi__lbl">Actions auditées</div></div>
    <div class="a4-audit-kpi a4-audit-kpi--warn"><div class="a4-audit-kpi__val">—</div><div class="a4-audit-kpi__lbl">Anomalies</div></div>
    <div class="a4-audit-kpi a4-audit-kpi--ok"><div class="a4-audit-kpi__val">—</div><div class="a4-audit-kpi__lbl">Conformes</div></div>
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

  <!-- Table journal simplifié -->
  <div class="a4-journal">
    <div class="a4-journal__head">
      <span>Horodatage</span><span>Utilisateur</span><span>Action</span><span>Résultat</span>
    </div>
    <div class="a4-journal__row" *ngFor="let _ of [1,2,3]">
      <span class="a4-placeholder a4-placeholder--line"></span>
      <span class="a4-placeholder a4-placeholder--line"></span>
      <span class="a4-placeholder a4-placeholder--line"></span>
      <span class="a4-placeholder a4-placeholder--line"></span>
    </div>
  </div>

  <div class="a4-footer">
    <span>DINEPA — GEstiDlo — Rapport d'audit</span>
    <span>{{ rapport.periodLabel }}</span>
    <span>Page 1 — CONFIDENTIEL</span>
  </div>
</div>
  `,
  styles: [`
.a4 { width:210mm; min-height:297mm; background:#fff; color:#1e293b; font-family:'Segoe UI',sans-serif; font-size:9pt; padding:18mm 16mm 14mm; box-sizing:border-box; position:relative; }
.a4-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4mm; }
.a4-header__brand { display:flex; align-items:center; gap:6mm; }
.a4-logo { font-size:18pt; font-weight:800; color:#4f46e5; letter-spacing:-.02em; }
.a4-header__org-name { font-size:8pt; font-weight:600; color:#1e293b; }
.a4-header__org-sub  { font-size:7pt; color:#64748b; }
.a4-header__meta { text-align:right; font-size:7pt; color:#64748b; line-height:1.6; }
.a4-ref { font-family:monospace; font-weight:700; color:#1e293b; }
.a4-accent { height:2px; background:#4f46e5; margin-bottom:5mm; }
.a4-confidential { display:flex; align-items:center; gap:3mm; background:#eef2ff; border:1px solid #c7d2fe; border-radius:4px; padding:2.5mm 5mm; margin-bottom:5mm; color:#4338ca; font-size:7.5pt; font-weight:700; letter-spacing:.05em; }
.a4-title-block { margin-bottom:5mm; }
.a4-title    { margin:0 0 1.5mm; font-size:14pt; font-weight:700; color:#0f172a; line-height:1.2; }
.a4-subtitle { margin:0; font-size:9pt; color:#475569; }
.a4-sheet { background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm 5mm; margin-bottom:5mm; }
.a4-sheet--audit { border-left:3px solid #4f46e5; }
.a4-sheet__row { display:flex; gap:5mm; padding:1.5mm 0; border-bottom:1px solid #f1f5f9; }
.a4-sheet__row:last-child { border-bottom:none; }
.a4-sheet__k { font-size:7.5pt; color:#64748b; min-width:38mm; flex-shrink:0; }
.a4-sheet__v { font-size:8pt; color:#1e293b; font-weight:500; }
.a4-sheet__v--status { color:#4f46e5; }
.a4-audit-kpis { display:flex; gap:3mm; margin-bottom:5mm; }
.a4-audit-kpi { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm; text-align:center; }
.a4-audit-kpi--warn { border-color:#fde68a; background:#fffbeb; }
.a4-audit-kpi--ok { border-color:#bbf7d0; background:#f0fdf4; }
.a4-audit-kpi__val { font-size:16pt; font-weight:700; color:#4f46e5; }
.a4-audit-kpi--warn .a4-audit-kpi__val { color:#d97706; }
.a4-audit-kpi--ok .a4-audit-kpi__val { color:#16a34a; }
.a4-audit-kpi__lbl { font-size:6.5pt; color:#64748b; margin-top:1mm; }
.a4-section { margin-bottom:4mm; break-inside:avoid; }
.a4-section__head { display:flex; align-items:center; gap:2.5mm; padding-bottom:1.5mm; border-bottom:1.5px solid #c7d2fe; margin-bottom:2mm; }
.a4-section__num { width:5mm; height:5mm; border-radius:50%; font-size:6pt; font-weight:700; color:#fff; background:#4f46e5; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.a4-section__title { font-size:9.5pt; font-weight:600; color:#0f172a; }
.a4-section__body { padding-left:7.5mm; }
.a4-placeholder { height:2.5mm; background:#f1f5f9; border-radius:2px; margin-bottom:1.5mm; width:85%; }
.a4-placeholder--sm { width:55%; }
.a4-placeholder--line { height:2mm; width:100%; display:block; }
.a4-journal { border:1px solid #e2e8f0; border-radius:4px; overflow:hidden; margin-top:3mm; font-size:7pt; }
.a4-journal__head { display:grid; grid-template-columns:30mm 30mm 1fr 20mm; gap:3mm; background:#f1f5f9; padding:2mm 3mm; font-weight:600; color:#475569; }
.a4-journal__row { display:grid; grid-template-columns:30mm 30mm 1fr 20mm; gap:3mm; padding:2mm 3mm; border-top:1px solid #f1f5f9; }
.a4-footer { position:absolute; bottom:10mm; left:16mm; right:16mm; display:flex; justify-content:space-between; font-size:6.5pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:2mm; }
  `],
})
export class AuditTemplateComponent {
  @Input({ required: true }) rapport!: ReportEntry;
}

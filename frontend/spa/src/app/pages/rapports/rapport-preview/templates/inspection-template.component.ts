import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportEntry } from '../../rapport.types';

@Component({
  selector: 'app-inspection-template',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="a4">
  <!-- En-tête DINEPA -->
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
  <div class="a4-accent" style="background:#0d9488"></div>

  <!-- Titre -->
  <div class="a4-title-block">
    <div class="a4-type-badge" style="background:#f0fdfa;color:#0d9488;border-color:#0d9488">
      RAPPORT D'INSPECTION / INTERVENTION
    </div>
    <h1 class="a4-title">{{ rapport.title }}</h1>
    <p class="a4-subtitle">{{ rapport.subtitle }}</p>
  </div>

  <!-- Fiche signalétique -->
  <div class="a4-sheet">
    <div class="a4-sheet__row"><span class="a4-sheet__k">Période couverte</span><span class="a4-sheet__v">{{ rapport.periodLabel }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Zone / Portée</span><span class="a4-sheet__v">{{ rapport.zone }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Auteur</span><span class="a4-sheet__v">{{ rapport.author }}</span></div>
    <div class="a4-sheet__row"><span class="a4-sheet__k">Institution</span><span class="a4-sheet__v">{{ rapport.institution }}</span></div>
    <div class="a4-sheet__row" *ngIf="rapport.interventionCode"><span class="a4-sheet__k">Intervention liée</span><span class="a4-sheet__v a4-sheet__v--code">{{ rapport.interventionCode }}</span></div>
  </div>

  <!-- Sections -->
  <div class="a4-section" *ngFor="let s of rapport.sections; let i = index">
    <div class="a4-section__head" style="border-color:#0d9488">
      <span class="a4-section__num" style="background:#0d9488">{{ i + 1 }}</span>
      <span class="a4-section__title">{{ s }}</span>
    </div>
    <div class="a4-section__body">
      <div class="a4-placeholder"></div>
      <div class="a4-placeholder a4-placeholder--sm"></div>
    </div>
  </div>

  <!-- Signatures -->
  <div class="a4-signatures">
    <div class="a4-sig"><div class="a4-sig__line"></div><div class="a4-sig__lbl">Technicien responsable</div></div>
    <div class="a4-sig"><div class="a4-sig__line"></div><div class="a4-sig__lbl">Superviseur DINEPA</div></div>
    <div class="a4-sig"><div class="a4-sig__line"></div><div class="a4-sig__lbl">Validation institutionnelle</div></div>
  </div>

  <!-- Pied de page -->
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
.a4-logo { font-size:18pt; font-weight:800; color:#0d9488; letter-spacing:-.02em; }
.a4-header__org-name { font-size:8pt; font-weight:600; color:#1e293b; }
.a4-header__org-sub  { font-size:7pt; color:#64748b; }
.a4-header__meta { text-align:right; font-size:7pt; color:#64748b; line-height:1.6; }
.a4-ref { font-family:monospace; font-weight:700; color:#1e293b; }
.a4-accent { height:2px; margin-bottom:6mm; }
.a4-title-block { margin-bottom:5mm; }
.a4-type-badge { display:inline-block; font-size:6.5pt; font-weight:700; letter-spacing:.06em; padding:2px 8px; border-radius:10px; border:1px solid; margin-bottom:3mm; }
.a4-title    { margin:0 0 1.5mm; font-size:14pt; font-weight:700; color:#0f172a; line-height:1.2; }
.a4-subtitle { margin:0; font-size:9pt; color:#475569; }
.a4-sheet { background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:4mm 5mm; margin-bottom:5mm; }
.a4-sheet__row { display:flex; gap:5mm; padding:1.5mm 0; border-bottom:1px solid #f1f5f9; }
.a4-sheet__row:last-child { border-bottom:none; }
.a4-sheet__k { font-size:7.5pt; color:#64748b; min-width:38mm; flex-shrink:0; }
.a4-sheet__v { font-size:8pt; color:#1e293b; font-weight:500; }
.a4-sheet__v--code { font-family:monospace; color:#0d9488; }
.a4-section { margin-bottom:4mm; break-inside:avoid; }
.a4-section__head { display:flex; align-items:center; gap:2.5mm; padding-bottom:1.5mm; border-bottom:1.5px solid; margin-bottom:2mm; }
.a4-section__num { width:5mm; height:5mm; border-radius:50%; font-size:6pt; font-weight:700; color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.a4-section__title { font-size:9.5pt; font-weight:600; color:#0f172a; }
.a4-section__body { padding-left:7.5mm; }
.a4-placeholder { height:2.5mm; background:#f1f5f9; border-radius:2px; margin-bottom:1.5mm; width:85%; }
.a4-placeholder--sm { width:55%; }
.a4-signatures { display:flex; gap:8mm; margin:6mm 0 4mm; }
.a4-sig { flex:1; }
.a4-sig__line { border-top:1px solid #cbd5e1; margin-bottom:1.5mm; }
.a4-sig__lbl { font-size:7pt; color:#64748b; }
.a4-footer { position:absolute; bottom:10mm; left:16mm; right:16mm; display:flex; justify-content:space-between; font-size:6.5pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:2mm; }
  `],
})
export class InspectionTemplateComponent {
  @Input({ required: true }) rapport!: ReportEntry;
}

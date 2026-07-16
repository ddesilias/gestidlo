import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportActionKey, ReportPreviewData, ReportViewerRole } from './report-preview.model';
import { ToastService } from '../../../ui/toast.service';

/**
 * APERÇU A4 OFFICIEL — le composant UNIQUE de tout GEstiDlo.
 *
 * Peu importe le rôle ou le type, cliquer « Aperçu » ouvre CETTE feuille : en-tête
 * DINEPA, bandeau période/zone, sections numérotées avec CONTENU RÉEL (plus de barres
 * grises), signatures, footer. Il ne connaît que `ReportPreviewData` (cf. adaptateurs) ;
 * les actions offertes se dérivent du `viewerRole` (ou sont imposées via `actions`).
 *
 * Impression : `window.print()` bascule `body.rp-printing`, une règle globale (styles.scss)
 * ne laisse imprimer QUE la feuille `.rp-a4` — pas la barre d'outils ni le reste de l'app.
 */
@Component({
  selector: 'app-report-a4-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="rp-overlay" (click)="fermer.emit()">
  <div class="rp-wrapper" (click)="$event.stopPropagation()">

    <!-- Barre d'outils : actions selon le rôle/statut -->
    <div class="rp-toolbar">
      <span class="rp-toolbar__title">Aperçu — {{ report.title }}</span>
      <div class="rp-toolbar__actions">
        <button *ngIf="has('imprimer')" class="rp-tb-btn" type="button" (click)="imprimer()">
          <i class="ti ti-printer"></i> Imprimer
        </button>
        <button *ngIf="has('exporter')" class="rp-tb-btn" type="button" (click)="exporterPdf.emit()">
          <i class="ti ti-file-export"></i> Exporter PDF
        </button>
        <button *ngIf="has('signer')" class="rp-tb-btn rp-tb-btn--go" type="button" (click)="signer.emit()">
          <i class="ti ti-signature"></i> {{ viewerRole === 'DINEPA' ? 'Signer DINEPA' : 'Signer URD' }}
        </button>
        <button *ngIf="has('renvoyer')" class="rp-tb-btn rp-tb-btn--warn" type="button" (click)="ouvrirMotif()">
          <i class="ti ti-corner-up-left"></i> Renvoyer
        </button>
        <button *ngIf="has('archiver')" class="rp-tb-btn" type="button" (click)="archiver.emit()">
          <i class="ti ti-archive"></i> Archiver
        </button>
        <button *ngIf="has('fermer')" class="rp-tb-btn rp-tb-btn--close" type="button" (click)="fermer.emit()">
          <i class="ti ti-x"></i> Fermer
        </button>
      </div>
    </div>

    <!-- Formulaire de renvoi (motif obligatoire) -->
    <div *ngIf="motifOuvert()" class="rp-motif">
      <label class="rp-motif__lbl">Motif du renvoi <span>(obligatoire)</span></label>
      <textarea class="rp-motif__in" rows="3" [(ngModel)]="motif"
                placeholder="Ex. Le rapport ne contient pas les photos de l'intervention…"></textarea>
      <div class="rp-motif__act">
        <button class="rp-tb-btn" type="button" (click)="motifOuvert.set(false)">Annuler</button>
        <button class="rp-tb-btn rp-tb-btn--warn" type="button" [disabled]="!motif.trim()" (click)="confirmerRenvoi()">
          Confirmer le renvoi
        </button>
      </div>
    </div>

    <!-- Zone de défilement + feuille A4 -->
    <div class="rp-scroll">
      <div class="rp-page-shadow">
        <div class="rp-a4" [style.--accent]="report.accent">

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
              <div class="a4-ref">Réf : {{ report.refCode }}</div>
              <div>Version {{ report.version }}</div>
              <div>Émis le {{ report.emittedAt }}</div>
            </div>
          </div>
          <div class="a4-accent"></div>

          <!-- Bandeau période / zone -->
          <div class="a4-period-banner">
            <i class="ti ti-calendar-event a4-period-banner__icon"></i>
            <div>
              <div class="a4-period-banner__lbl">Période couverte</div>
              <div class="a4-period-banner__val">{{ report.periodLabel || '—' }}</div>
            </div>
            <div class="a4-period-banner__right">
              <div class="a4-period-banner__lbl">Zone</div>
              <div class="a4-period-banner__val">{{ report.zone || '—' }}</div>
            </div>
          </div>

          <!-- Titre -->
          <div class="a4-title-block">
            <div class="a4-type-badge">{{ report.typeBadge }}</div>
            <span class="a4-status">{{ report.statusLabel }}</span>
            <h1 class="a4-title">{{ report.title }}</h1>
            <p class="a4-subtitle" *ngIf="report.subtitle">{{ report.subtitle }}</p>
          </div>

          <!-- KPI (seulement s'ils existent) -->
          <div class="a4-kpi-row" *ngIf="report.kpis?.length">
            <div class="a4-kpi" *ngFor="let k of report.kpis">
              <div class="a4-kpi__val">{{ k.value }}</div>
              <div class="a4-kpi__lbl">{{ k.label }}</div>
            </div>
          </div>

          <!-- Bloc contexte -->
          <div class="a4-sheet">
            <div class="a4-sheet__row"><span class="a4-sheet__k">Auteur</span><span class="a4-sheet__v">{{ report.author || '—' }}</span></div>
            <div class="a4-sheet__row"><span class="a4-sheet__k">Institution</span><span class="a4-sheet__v">{{ report.institution || '—' }}</span></div>
            <div class="a4-sheet__row" *ngIf="report.urd"><span class="a4-sheet__k">URD</span><span class="a4-sheet__v">{{ report.urd }}</span></div>
          </div>

          <!-- Sections numérotées avec contenu réel -->
          <div class="a4-section" *ngFor="let s of report.sections; let i = index">
            <div class="a4-section__head">
              <span class="a4-section__num">{{ i + 1 }}</span>
              <span class="a4-section__title">{{ s.title }}</span>
            </div>
            <div class="a4-section__body">
              <ng-container *ngIf="s.facts?.length">
                <div class="a4-fact" *ngFor="let f of s.facts">
                  <span class="a4-fact__k">{{ f.k }}</span><span class="a4-fact__v">{{ f.v }}</span>
                </div>
              </ng-container>
              <p class="a4-prose" *ngIf="s.body">{{ s.body }}</p>
              <ng-container *ngIf="!s.body && !s.facts?.length">
                <div class="a4-placeholder"></div>
                <div class="a4-placeholder a4-placeholder--sm"></div>
              </ng-container>
            </div>
          </div>

          <!-- Signatures -->
          <div class="a4-signatures" *ngIf="report.signatureUrd || report.signatureDinepa">
            <div class="a4-sig" *ngIf="report.signatureUrd as s">
              <i class="ti ti-signature"></i>
              <div>
                <div class="a4-sig__n">{{ s.name }}</div>
                <div class="a4-sig__r">{{ s.role }}<span *ngIf="s.date"> · {{ s.date }}</span></div>
              </div>
            </div>
            <div class="a4-sig" *ngIf="report.signatureDinepa as s">
              <i class="ti ti-stamp"></i>
              <div>
                <div class="a4-sig__n">{{ s.name }}</div>
                <div class="a4-sig__r">{{ s.role }}<span *ngIf="s.date"> · {{ s.date }}</span></div>
              </div>
            </div>
          </div>

          <div class="a4-footer">
            <span>DINEPA — GEstiDlo — {{ report.institution }}</span>
            <span>{{ report.periodLabel }}</span>
            <span>Page 1</span>
          </div>

        </div>
      </div>
    </div>

  </div>
</div>
  `,
  styles: [`
:host { display: contents; }
@keyframes rp-in { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: none; } }

.rp-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(0,0,0,.75); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center; padding: 12px 0 24px; overflow-y: auto; }
.rp-wrapper { display: flex; flex-direction: column; min-width: 232mm; max-width: 232mm; animation: rp-in .22s cubic-bezier(.2,0,.3,1); }

.rp-toolbar { display: flex; align-items: center; justify-content: space-between; background: #1e293b;
  border-radius: 10px 10px 0 0; padding: 10px 14px; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.rp-toolbar__title { font-size: .78rem; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 42%; }
.rp-toolbar__actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

.rp-tb-btn { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 7px; font-size: .74rem; font-weight: 500;
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); color: #cbd5e1; cursor: pointer; transition: all .15s; font-family: inherit; }
.rp-tb-btn i { font-size: 15px; }
.rp-tb-btn:hover { background: rgba(255,255,255,.12); color: #f1f5f9; }
.rp-tb-btn:disabled { opacity: .4; cursor: not-allowed; }
.rp-tb-btn--go { color: #34d399; border-color: rgba(52,211,153,.35); background: rgba(16,185,129,.12); }
.rp-tb-btn--go:hover { background: rgba(16,185,129,.22); color: #6ee7b7; }
.rp-tb-btn--warn { color: #fbbf24; border-color: rgba(251,191,36,.3); }
.rp-tb-btn--warn:hover { background: rgba(251,191,36,.15); color: #fcd34d; }
.rp-tb-btn--close { color: #f87171; } .rp-tb-btn--close:hover { background: rgba(239,68,68,.15); color: #fca5a5; }

.rp-motif { background: #172033; border-bottom: 1px solid rgba(255,255,255,.06); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.rp-motif__lbl { font-size: .74rem; font-weight: 600; color: #e2e8f0; }
.rp-motif__lbl span { color: #f87171; font-weight: 500; }
.rp-motif__in { background: #0e1626; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; color: #e2e8f0; padding: 8px 10px;
  font-size: .8rem; font-family: inherit; resize: vertical; outline: none; }
.rp-motif__in:focus { border-color: rgba(251,191,36,.5); }
.rp-motif__act { display: flex; gap: 8px; justify-content: flex-end; }

.rp-scroll { background: #2d3748; padding: 20px; border-radius: 0 0 10px 10px; overflow-y: auto; max-height: calc(100vh - 120px); }
.rp-page-shadow { box-shadow: 0 4px 32px rgba(0,0,0,.5); border-radius: 2px; display: inline-block; }

/* ── Feuille A4 ── */
.rp-a4 { width:210mm; min-height:297mm; background:#fff; color:#1e293b; font-family:'Segoe UI',sans-serif; font-size:9pt; padding:18mm 16mm 16mm; box-sizing:border-box; position:relative; }
.a4-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4mm; }
.a4-header__brand { display:flex; align-items:center; gap:6mm; }
.a4-logo { font-size:18pt; font-weight:800; color:var(--accent,#2563eb); letter-spacing:-.02em; }
.a4-header__org-name { font-size:8pt; font-weight:600; color:#1e293b; }
.a4-header__org-sub  { font-size:7pt; color:#64748b; }
.a4-header__meta { text-align:right; font-size:7pt; color:#64748b; line-height:1.6; }
.a4-ref { font-family:monospace; font-weight:700; color:#1e293b; }
.a4-accent { height:2px; background:var(--accent,#2563eb); margin-bottom:5mm; }
.a4-period-banner { display:flex; align-items:center; gap:4mm; background:#f5f8ff; border:1px solid #dbe4f5; border-radius:4px; padding:3mm 5mm; margin-bottom:5mm; color:#1e40af; }
.a4-period-banner__icon { font-size:18pt; color:var(--accent,#2563eb); flex-shrink:0; }
.a4-period-banner__lbl { font-size:7pt; color:#94a3b8; }
.a4-period-banner__val { font-size:9.5pt; font-weight:700; }
.a4-period-banner__right { margin-left:auto; text-align:right; }
.a4-title-block { margin-bottom:5mm; }
.a4-type-badge { display:inline-block; font-size:6.5pt; font-weight:700; letter-spacing:.06em; padding:2px 8px; border-radius:10px; background:color-mix(in srgb, var(--accent,#2563eb) 10%, #fff); color:var(--accent,#2563eb); border:1px solid color-mix(in srgb, var(--accent,#2563eb) 30%, #fff); margin-bottom:3mm; }
.a4-status { display:inline-block; margin-left:6px; font-size:6.5pt; font-weight:700; letter-spacing:.05em; padding:2px 8px; border-radius:10px; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; vertical-align:top; }
.a4-title    { margin:0 0 1.5mm; font-size:14pt; font-weight:700; color:#0f172a; line-height:1.2; }
.a4-subtitle { margin:0; font-size:9pt; color:#475569; }
.a4-kpi-row { display:flex; gap:3mm; margin-bottom:5mm; }
.a4-kpi { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm; text-align:center; }
.a4-kpi__val { font-size:16pt; font-weight:700; color:var(--accent,#2563eb); }
.a4-kpi__lbl { font-size:6.5pt; color:#64748b; margin-top:1mm; }
.a4-sheet { background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm 5mm; margin-bottom:5mm; }
.a4-sheet__row { display:flex; gap:5mm; padding:1.5mm 0; border-bottom:1px solid #f1f5f9; }
.a4-sheet__row:last-child { border-bottom:none; }
.a4-sheet__k { font-size:7.5pt; color:#64748b; min-width:38mm; flex-shrink:0; }
.a4-sheet__v { font-size:8pt; color:#1e293b; font-weight:500; }
.a4-section { margin-bottom:4mm; break-inside:avoid; }
.a4-section__head { display:flex; align-items:center; gap:2.5mm; padding-bottom:1.5mm; border-bottom:1.5px solid color-mix(in srgb, var(--accent,#2563eb) 30%, #fff); margin-bottom:2mm; }
.a4-section__num { width:5mm; height:5mm; border-radius:50%; font-size:6pt; font-weight:700; color:#fff; background:var(--accent,#2563eb); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.a4-section__title { font-size:9.5pt; font-weight:600; color:#0f172a; }
.a4-section__body { padding-left:7.5mm; }
.a4-prose { margin:0; font-size:8.5pt; line-height:1.6; color:#334155; white-space:pre-line; }
.a4-fact { display:flex; gap:4mm; padding:1mm 0; border-bottom:1px dashed #eef2f7; }
.a4-fact:last-child { border-bottom:none; }
.a4-fact__k { font-size:7.5pt; color:#64748b; min-width:42mm; flex-shrink:0; }
.a4-fact__v { font-size:8pt; color:#1e293b; font-weight:500; }
.a4-placeholder { height:2.5mm; background:#f1f5f9; border-radius:2px; margin-bottom:1.5mm; width:85%; }
.a4-placeholder--sm { width:55%; }
.a4-signatures { display:flex; gap:4mm; margin:5mm 0 3mm; }
.a4-sig { flex:1; display:flex; align-items:center; gap:3mm; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:3mm 4mm; }
.a4-sig i { font-size:16pt; color:var(--accent,#2563eb); }
.a4-sig__n { font-size:9pt; font-weight:600; color:#0f172a; }
.a4-sig__r { font-size:7pt; color:#64748b; margin-top:.5mm; }
.a4-footer { position:absolute; bottom:10mm; left:16mm; right:16mm; display:flex; justify-content:space-between; font-size:6.5pt; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:2mm; }
  `],
})
export class ReportA4PreviewComponent {
  @Input({ required: true }) report!: ReportPreviewData;
  @Input() viewerRole: ReportViewerRole = 'LECTURE';
  /** Force la liste d'actions ; sinon dérivée du rôle + statut. */
  @Input() actions: ReportActionKey[] | null = null;

  @Output() fermer      = new EventEmitter<void>();
  @Output() exporterPdf = new EventEmitter<void>();
  @Output() archiver    = new EventEmitter<void>();
  @Output() signer      = new EventEmitter<void>();
  @Output() renvoyer    = new EventEmitter<string>();

  private readonly toast = inject(ToastService);

  readonly motifOuvert = signal(false);
  motif = '';

  private readonly effectives = computed<ReportActionKey[]>(() =>
    this.actions ?? defaultActions(this.viewerRole, this.report?.statusKey ?? ''));

  has(a: ReportActionKey): boolean { return this.effectives().includes(a); }

  imprimer(): void {
    this.toast.push('info', 'Impression en cours…');
    document.body.classList.add('rp-printing');
    const done = () => { document.body.classList.remove('rp-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    // Filet de sécurité si afterprint ne se déclenche pas (certains navigateurs).
    setTimeout(done, 1500);
  }

  ouvrirMotif(): void { this.motif = ''; this.motifOuvert.set(true); }
  confirmerRenvoi(): void {
    const m = this.motif.trim();
    if (!m) return;
    this.renvoyer.emit(m);
    this.motifOuvert.set(false);
  }
}

/** Actions par défaut selon le rôle (et le statut, pour les nuances futures). */
function defaultActions(role: ReportViewerRole, _status: string): ReportActionKey[] {
  switch (role) {
    case 'ADMIN':      return ['imprimer', 'exporter', 'archiver', 'fermer'];
    case 'DINEPA':     return ['imprimer', 'exporter', 'signer', 'renvoyer', 'fermer'];
    case 'URD':        return ['imprimer', 'signer', 'renvoyer', 'fermer'];
    case 'TECHNICIEN': return ['imprimer', 'fermer'];
    default:           return ['imprimer', 'fermer'];
  }
}

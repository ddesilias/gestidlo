import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExecCard } from './governance-signals.service';
import { STATUT_COULEUR } from './governance-status.util';

/**
 * « Résumé exécutif » (§ wireframe) — rangée de cartes KPI décisionnelles. Purement présentationnel :
 * les valeurs viennent déjà scopées/dérivées du service. Une carte porte SOIT un `route` (RouterLink),
 * SOIT un `scopeDept` → bouton qui émet `drill` pour piloter le scope (carte « URD la plus critique »).
 */
@Component({
  selector: 'app-governance-exec-summary',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="exec">
      <ng-container *ngFor="let c of cards">
        <a *ngIf="c.route" class="exec__card" [class]="'exec__card--' + c.statut" [routerLink]="c.route">
          <ng-container *ngTemplateOutlet="body; context: { c: c }"></ng-container>
        </a>
        <button *ngIf="!c.route" type="button" class="exec__card" [class]="'exec__card--' + c.statut"
          (click)="c.scopeDept && drill.emit(c.scopeDept)">
          <ng-container *ngTemplateOutlet="body; context: { c: c }"></ng-container>
        </button>
      </ng-container>
    </div>

    <ng-template #body let-c="c">
      <div class="exec__top">
        <span class="exec__label">{{ c.label }}</span>
        <span *ngIf="c.tag" class="exec__tag" [style.color]="tagColor(c)"
          [style.background]="'color-mix(in srgb, ' + tagColor(c) + ' 16%, transparent)'">{{ c.tag }}</span>
      </div>
      <div class="exec__val">{{ c.value }}</div>
      <div class="exec__sub">{{ c.sub1 }}<span *ngIf="c.sub2"> · {{ c.sub2 }}</span></div>
      <div class="exec__act">{{ c.actionLabel }} →</div>
    </ng-template>
  `,
  styles: [`
    .exec { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; }
    @media (max-width:1199px){ .exec { grid-template-columns:repeat(3,1fr); } }
    @media (max-width:700px){ .exec { grid-template-columns:repeat(2,1fr); } }

    .exec__card { display:flex; flex-direction:column; align-items:stretch; gap:2px; text-align:left;
      background:var(--surface-1); border:0.5px solid var(--border-color); border-left-width:3px;
      border-left-color:var(--text-accent); border-radius:12px; padding:13px 14px; cursor:pointer;
      text-decoration:none; transition:transform .15s, border-color .15s; width:100%; font:inherit; }
    .exec__card:hover { transform:translateY(-1px); }
    .exec__card--critique { border-left-color:var(--text-danger); }
    .exec__card--attention { border-left-color:var(--text-warning); }
    .exec__card--ok { border-left-color:var(--text-success); }
    .exec__card--neutre { border-left-color:var(--text-accent); }

    .exec__top { display:flex; align-items:center; justify-content:space-between; gap:6px; }
    .exec__label { font-size:11.5px; color:var(--text-secondary); }
    .exec__tag { font-size:9px; font-weight:600; border-radius:4px; padding:1px 6px; white-space:nowrap; }
    .exec__val { font-size:27px; font-weight:700; color:var(--text-primary); line-height:1.1; margin:5px 0 1px; }
    .exec__sub { font-size:11px; color:var(--text-muted); min-height:15px; }
    .exec__act { font-size:11.5px; color:var(--text-accent); margin-top:8px; }
    .exec__card:hover .exec__act { text-decoration:underline; }
  `],
})
export class GovernanceExecSummaryComponent {
  @Input() cards: ExecCard[] = [];
  @Output() drill = new EventEmitter<string>();

  tagColor(c: ExecCard): string {
    return c.tagStatut ? STATUT_COULEUR[c.tagStatut] : 'var(--text-accent)';
  }
}

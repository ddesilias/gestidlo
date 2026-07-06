import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeptCoverage } from './governance-signals.service';
import { STATUT_COULEUR } from './governance-status.util';

/**
 * Zone 3 · Couverture par département (barres horizontales, pondérées population).
 * Montre OÙ sont les trous plutôt que la seule stat globale enterrée.
 */
@Component({
  selector: 'app-coverage-by-dept',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cov">
      <div class="cov__head">
        <span class="cov__title">Couverture / département</span>
        <span class="cov__pct">{{ nationale }}%</span>
      </div>
      <div class="cov__list" *ngIf="rows.length; else vide">
        <div class="cov__row" *ngFor="let r of rows">
          <div class="cov__meta"><span>{{ r.nom }}</span><span>{{ r.pct }}%</span></div>
          <div class="cov__track">
            <div class="cov__fill" [style.width.%]="r.pct" [style.background]="couleur(r)"></div>
          </div>
        </div>
      </div>
      <ng-template #vide><p class="cov__empty">Aucune zone active supervisée.</p></ng-template>
    </div>
  `,
  styles: [`
    .cov { background:var(--surface-1); border-radius:var(--radius); padding:12px; }
    .cov__head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; }
    .cov__title { font-size:12px; color:var(--text-primary); }
    .cov__pct { font-size:11px; color:var(--text-secondary); }
    .cov__list { display:flex; flex-direction:column; gap:8px; }
    .cov__meta { display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary); margin-bottom:3px; }
    .cov__track { height:5px; background:var(--surface-2); border-radius:3px; overflow:hidden; }
    .cov__fill { height:100%; border-radius:3px; transition:width .3s; }
    .cov__empty { font-size:11px; color:var(--text-muted); margin:0; }
  `],
})
export class CoverageByDeptComponent {
  @Input() rows: DeptCoverage[] = [];
  @Input() nationale = 0;
  couleur(r: DeptCoverage): string { return STATUT_COULEUR[r.statut]; }
}

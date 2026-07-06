import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineChartComponent } from '../../../ui/line-chart.component';

/**
 * Zone 3 · Tendance conformité 30 j. Réutilise le composant chart existant (app-line-chart) ;
 * la carte n'ajoute que le chrome + la référence de cible.
 */
@Component({
  selector: 'app-compliance-trend',
  standalone: true,
  imports: [CommonModule, LineChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trend">
      <div class="trend__head">
        <span class="trend__title">Tendance conformité</span>
        <span class="trend__pct">{{ score }}%</span>
      </div>
      <app-line-chart [values]="points" title="" subtitle="30 derniers jours"
        [decimals]="0" valueSuffix="%"></app-line-chart>
      <div class="trend__foot">estimation · cible {{ cible }}% · 30 derniers jours</div>
    </div>
  `,
  styles: [`
    .trend { background:var(--surface-1); border-radius:var(--radius); padding:12px; color:var(--text-success); }
    .trend__head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; }
    .trend__title { font-size:12px; color:var(--text-primary); }
    .trend__pct { font-size:11px; color:var(--text-success); }
    .trend__foot { font-size:10px; color:var(--text-muted); margin-top:4px; }
    :host ::ng-deep .chart-svg { height:110px; }
  `],
})
export class ComplianceTrendComponent {
  @Input() points: Array<{ timestamp: string; value: number }> = [];
  @Input() score = 0;
  @Input() cible = 95;
}

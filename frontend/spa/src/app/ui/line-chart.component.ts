import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LinePoint = { x: number; y: number };

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart" *ngIf="values?.length; else empty">
      <div class="chart-header">
        <div class="chart-title">{{ title }}</div>
        <div class="chart-meta">{{ subtitle }}</div>
      </div>

      <svg class="chart-svg" viewBox="0 0 520 180" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.30" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <path class="chart-grid" d="M40 20 H500 M40 60 H500 M40 100 H500 M40 140 H500" />
        <path class="chart-grid" d="M40 20 V160 M160 20 V160 M280 20 V160 M400 20 V160 M500 20 V160" />

        <path class="chart-area" [attr.d]="areaPath" />
        <path class="chart-line" [attr.d]="linePath" />

        <text class="chart-axis" x="40" y="175">{{ minLabel }}</text>
        <text class="chart-axis" x="500" y="175" text-anchor="end">{{ maxLabel }}</text>
      </svg>
    </div>

    <ng-template #empty>
      <div class="muted">Pas de données (sélectionne un point et ingère des mesures).</div>
    </ng-template>
  `,
  styles: [
    `
      .chart-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.35rem;
      }
      .chart-title {
        font-weight: 900;
      }
      .chart-meta {
        color: var(--muted);
        font-size: 0.85rem;
      }
      .chart-svg {
        width: 100%;
        height: 180px;
        color: var(--primary);
      }
      .chart-grid {
        stroke: rgba(2, 6, 23, 0.08);
        stroke-width: 1;
        fill: none;
      }
      :host-context(html[data-theme='dark']) .chart-grid {
        stroke: rgba(226, 232, 240, 0.10);
      }
      .chart-line {
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
      }
      .chart-area {
        fill: url(#area);
        stroke: none;
      }
      .chart-axis {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
          monospace;
        fill: var(--muted);
        font-size: 11px;
      }
    `
  ]
})
export class LineChartComponent {
  @Input({ required: true }) values: Array<{ timestamp: string; value: number }> = [];
  @Input() title = 'Trend';
  @Input() subtitle = '';
  /** Format des étiquettes d'axe (min/max). Défauts rétro-compatibles : 2 décimales, sans suffixe. */
  @Input() decimals = 2;
  @Input() valueSuffix = '';

  get min(): number {
    return Math.min(...this.values.map((v) => v.value));
  }

  get max(): number {
    return Math.max(...this.values.map((v) => v.value));
  }

  get minLabel(): string {
    return Number.isFinite(this.min) ? `${this.min.toFixed(this.decimals)}${this.valueSuffix}` : '';
  }

  get maxLabel(): string {
    return Number.isFinite(this.max) ? `${this.max.toFixed(this.decimals)}${this.valueSuffix}` : '';
  }

  get linePath(): string {
    const points = this.toPoints();
    if (points.length < 2) {
      return '';
    }
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  }

  get areaPath(): string {
    const points = this.toPoints();
    if (points.length < 2) {
      return '';
    }
    const start = points[0];
    const end = points[points.length - 1];
    return `M${start.x.toFixed(2)} 160 ${this.linePath.slice(1)} L${end.x.toFixed(2)} 160 Z`;
  }

  private toPoints(): LinePoint[] {
    const values = this.values;
    if (!values || values.length < 2) {
      return [];
    }
    const min = this.min;
    const max = this.max;
    const range = Math.max(1e-9, max - min);

    const chartLeft = 40;
    const chartRight = 500;
    const chartTop = 20;
    const chartBottom = 160;

    return values.map((v, i) => {
      const x = chartLeft + (i / (values.length - 1)) * (chartRight - chartLeft);
      const y = chartBottom - ((v.value - min) / range) * (chartBottom - chartTop);
      return { x, y };
    });
  }
}


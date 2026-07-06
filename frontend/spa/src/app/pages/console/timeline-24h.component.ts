import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineHour, SEV_COLOR } from './console.types';

interface Seg { color: string; y: number; h: number; }
interface Bar { x: number; segs: Seg[]; label: string; showLabel: boolean; }

@Component({
  selector: 'app-timeline-24h',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="tl">
  <svg viewBox="0 0 1200 68" width="100%" height="68"
       preserveAspectRatio="none" style="display:block;overflow:visible">
    <line *ngFor="let g of gridLines"
          [attr.x1]="g" y1="0" [attr.x2]="g" y2="54"
          stroke="rgba(255,255,255,.05)" stroke-width="1"/>
    <ng-container *ngFor="let b of bars">
      <rect *ngIf="b.segs.length === 0"
            [attr.x]="b.x" y="52" [attr.width]="BW" height="2"
            fill="rgba(255,255,255,.07)" rx="1"/>
      <rect *ngFor="let s of b.segs"
            [attr.x]="b.x" [attr.y]="s.y" [attr.width]="BW" [attr.height]="s.h"
            [attr.fill]="s.color" rx="1"/>
      <text *ngIf="b.showLabel"
            [attr.x]="b.x + BW / 2" y="66" text-anchor="middle"
            font-size="9" fill="#475569" style="font-family:system-ui">{{ b.label }}</text>
    </ng-container>
    <line x1="1198" y1="0" x2="1198" y2="54"
          stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="3,2"/>
    <text x="1194" y="9" text-anchor="end" font-size="9" fill="#3b82f6"
          style="font-family:system-ui">Now</text>
  </svg>
</div>
  `,
  styles: [`.tl { padding: 6px 0; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Timeline24hComponent implements OnChanges {
  @Input() timeline: TimelineHour[] = [];

  readonly BW = 48;
  readonly CH = 54;

  bars: Bar[] = [];
  gridLines: number[] = [];

  ngOnChanges(): void {
    const max = Math.max(1, ...this.timeline.map(h => h.total));
    const sevs: Array<'critique' | 'haute' | 'moyenne' | 'basse'> =
      ['critique', 'haute', 'moyenne', 'basse'];

    this.bars = this.timeline.map((h, i) => {
      const segs: Seg[] = [];
      let cumY = this.CH;
      for (const sev of sevs) {
        const count = h[sev];
        if (!count) continue;
        const barH = Math.max(2, (count / max) * this.CH);
        cumY -= barH;
        segs.push({ color: SEV_COLOR[sev], y: cumY, h: barH });
      }
      return { x: i * (this.BW + 2), segs, label: h.label, showLabel: h.hour % 4 === 0 };
    });

    this.gridLines = this.bars.filter(b => b.showLabel).map(b => b.x);
  }
}

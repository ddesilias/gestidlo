import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/** Un module = une porte de navigation + un éventuel badge d'attention (JAMAIS la mesure). */
export interface GovModule {
  key: string;
  label: string;
  hint: string;        // sous-texte descriptif (pas une métrique)
  icon: string;        // classe Tabler
  route: string;
  badge?: number;      // compteur « à traiter » — 0/undefined ⇒ chevron seul
  badgeTone?: 'attention' | 'critique';
}

export interface GovModuleFamily { titre: string; modules: GovModule[]; }

/**
 * Strip §5.5 — les 8 modules conservés, groupés en 3 familles, compacts. Règle anti-redondance :
 * la tuile-signal (Zone 1) porte la MESURE ; ici, seulement un badge d'attention issu d'un computed().
 */
@Component({
  selector: 'app-governance-module-strip',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip">
      <div class="strip__head">
        <span class="strip__title">Modules de gouvernance</span>
      </div>

      <ng-container *ngFor="let fam of families">
        <div class="strip__fam">{{ fam.titre }}</div>
        <div class="strip__grid">
          <a class="mod" *ngFor="let m of fam.modules" [routerLink]="m.route"
             [attr.aria-label]="m.label + (m.badge ? ', ' + m.badge + ' à traiter' : '')">
            <span class="mod__ico" [class.mod__ico--warn]="m.badgeTone === 'attention'"
                  [class.mod__ico--crit]="m.badgeTone === 'critique'">
              <i class="ti {{ m.icon }}" aria-hidden="true"></i>
            </span>
            <span class="mod__body">
              <span class="mod__label">{{ m.label }}</span>
              <span class="mod__hint">{{ m.hint }}</span>
            </span>
            <span class="mod__badge" *ngIf="m.badge; else chevron"
                  [class.mod__badge--crit]="m.badgeTone === 'critique'">{{ m.badge }}</span>
            <ng-template #chevron><i class="ti ti-chevron-right mod__chev" aria-hidden="true"></i></ng-template>
          </a>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .strip { background:var(--surface-0); border:0.5px solid var(--border-color); border-radius:12px; padding:14px 16px; }
    .strip__head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px; }
    .strip__title { font-size:13px; font-weight:500; color:var(--text-primary); }
    .strip__hint { font-size:11px; color:var(--text-muted); }
    .strip__fam { font-size:10px; letter-spacing:.07em; text-transform:uppercase; color:var(--text-secondary); margin:0 0 6px; }
    .strip__grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
    .strip__grid:last-child { margin-bottom:0; }
    .mod { display:flex; align-items:center; gap:10px; background:var(--surface-1); border-radius:var(--radius);
      padding:9px 11px; text-decoration:none; border:0.5px solid transparent; transition:border-color .15s; }
    .mod:hover { border-color:var(--text-accent); }
    .mod:focus-visible { outline:2px solid var(--text-accent); outline-offset:2px; }
    .mod__ico { width:30px; height:30px; border-radius:var(--radius); background:var(--bg-accent);
      display:flex; align-items:center; justify-content:center; color:var(--text-accent); flex:none; font-size:16px; }
    .mod__ico--warn { background:var(--bg-warning); color:var(--text-warning); }
    .mod__ico--crit { background:var(--bg-danger); color:var(--text-danger); }
    .mod__body { flex:1; min-width:0; display:flex; flex-direction:column; }
    .mod__label { font-size:13px; color:var(--text-primary); }
    .mod__hint { font-size:10px; color:var(--text-muted); }
    .mod__badge { font-size:10px; color:var(--text-warning); background:var(--bg-warning);
      border-radius:20px; padding:1px 7px; flex:none; }
    .mod__badge--crit { color:var(--text-danger); background:var(--bg-danger); }
    .mod__chev { font-size:15px; color:var(--text-muted); flex:none; }
    @media (max-width:760px) { .strip__grid { grid-template-columns:1fr; } }
  `],
})
export class GovernanceModuleStripComponent {
  @Input({ required: true }) families: GovModuleFamily[] = [];
}

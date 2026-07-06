import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { GOVERNANCE_MODULES, GOV_GROUP_LABELS, GovGroup } from './governance-modules.config';
import { GovernanceSignalsService } from './governance-signals.service';

/**
 * Shell de la section Gouvernance : un LANCEUR en tiroir (« Domaines ») remplace la barre d'onglets
 * horizontale — le haut reste net. Le bouton « ▦ Domaines » ouvre un panneau latéral qui liste la
 * Vue d'ensemble + les 8 domaines groupés (même config `GOVERNANCE_MODULES` que le strip → source
 * unique). Se ferme sur navigation, Échap, ou clic dehors. Palette sombre en dur (shell admin toujours sombre).
 */
@Component({
  selector: 'app-governance-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gshell">
      <div class="gshell__scrim" *ngIf="sig.drawerOpen()" (click)="close()"></div>

      <aside class="gdrawer" [class.gdrawer--open]="sig.drawerOpen()" role="dialog" aria-label="Domaines de gouvernance">
        <div class="gdrawer__head">
          <span class="gdrawer__title"><i class="ti ti-apps" aria-hidden="true"></i> Domaines de gouvernance</span>
          <button type="button" class="gdrawer__x" (click)="close()" aria-label="Fermer"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>

        <a class="gdrawer__item" routerLink="." [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="gdrawer__item--on">
          <i class="ti ti-layout-grid" aria-hidden="true"></i> Vue d'ensemble
        </a>

        <ng-container *ngFor="let g of groups">
          <div class="gdrawer__grp">{{ label(g) }}</div>
          <a class="gdrawer__item" *ngFor="let m of modulesOf(g)" [routerLink]="m.path" routerLinkActive="gdrawer__item--on">
            <i class="ti ti-{{ m.icon }}" aria-hidden="true"></i>
            <span class="gdrawer__lbl">{{ m.label }}</span>
            <span class="gdrawer__badge" *ngIf="m.badgeKey && badges()[m.badgeKey] as n"
                  [class.gdrawer__badge--crit]="m.badgeKey === 'conformite'">{{ n }}</span>
          </a>
        </ng-container>
      </aside>

      <router-outlet />
    </div>
  `,
  styles: [`
    .gshell { position:relative; min-height:100%; }
    .gshell__scrim { position:absolute; inset:0; background:rgba(4,7,13,.5); z-index:30; }

    .gdrawer {
      position:absolute; top:0; left:0; bottom:0; width:250px; z-index:31;
      background:#161e28; border-right:0.5px solid rgba(226,232,240,.24); box-shadow:8px 0 24px rgba(0,0,0,.35);
      padding:12px 10px; overflow-y:auto;
      transform:translateX(-100%); transition:transform .2s ease; visibility:hidden;
    }
    .gdrawer--open { transform:translateX(0); visibility:visible; }
    .gdrawer__head { display:flex; align-items:center; justify-content:space-between; padding:2px 6px 10px; }
    .gdrawer__title { display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:600; color:#e2e8ee;
      i { font-size:16px; color:#3b82f6; } }
    .gdrawer__x { background:none; border:0; color:#64748b; cursor:pointer; i { font-size:15px; } }
    .gdrawer__grp { font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:#94a3b8; padding:10px 6px 4px; }
    .gdrawer__item {
      display:flex; align-items:center; gap:9px; padding:7px 9px; border-radius:8px; text-decoration:none;
      color:#94a3b8; font-size:12.5px;
      i { font-size:15px; color:#64748b; }
      &:hover { background:rgba(255,255,255,.04); color:#e2e8ee; }
    }
    .gdrawer__lbl { flex:1; }
    .gdrawer__item--on { background:rgba(59,130,246,.14); color:#e2e8ee; font-weight:500; box-shadow:inset 3px 0 0 #3b82f6;
      i { color:#3b82f6; } }
    .gdrawer__badge { font-size:9px; color:#f59e0b; background:rgba(234,179,8,.14); border-radius:20px; padding:0 5px; }
    .gdrawer__badge--crit { color:#e24b4a; background:rgba(226,75,74,.14); }
  `],
})
export class GovernanceShellComponent {
  readonly sig = inject(GovernanceSignalsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly groups: GovGroup[] = ['organisation', 'cadre', 'systeme'];

  /** Badges = signaux d'attention (computed), même source que le strip. */
  readonly badges = computed<Record<string, number>>(() => ({
    regles: this.sig.badgeRegles(),
    conformite: this.sig.badgeConformite(),
  }));

  constructor() {
    // Fermeture automatique à chaque navigation (le tiroir est un lanceur, pas une nav persistante).
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.sig.closeDrawer());
  }

  label(g: GovGroup): string { return GOV_GROUP_LABELS[g]; }
  modulesOf(g: GovGroup) { return GOVERNANCE_MODULES.filter(m => m.group === g); }

  close(): void { this.sig.closeDrawer(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.sig.drawerOpen()) this.close(); }
}

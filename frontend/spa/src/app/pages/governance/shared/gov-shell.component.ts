import { Component, Input } from '@angular/core';

/**
 * Conteneur de module de gouvernance : cadre sombre paddé pour les 8 pages-modules.
 *
 * Le fil d'Ariane « Gouvernance › X · Module N/8 » a été RETIRÉ : la navigation de section est
 * désormais assurée par les onglets du GovernanceShellComponent (au-dessus du <router-outlet>),
 * qui rendaient ce breadcrumb redondant (double chrome). Les @Input `title`/`moduleNum` restent
 * acceptés (no-op) pour ne pas toucher les 8 modules appelants.
 */
@Component({
  selector: 'app-gov-shell',
  standalone: true,
  template: `<div class="gs-shell"><ng-content></ng-content></div>`,
  styles: [`
    .gs-shell { display:flex; flex-direction:column; gap:16px; padding:20px 24px; min-height:100%;
      background:#0F1419; color:#E2E8EE; font-family:system-ui,sans-serif; font-size:13px; box-sizing:border-box; }
  `],
})
export class GovShellComponent {
  @Input() title = '';
  @Input() moduleNum = 1;
}

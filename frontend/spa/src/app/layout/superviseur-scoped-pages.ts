import { Component, inject } from '@angular/core';

import { ResourcesPageComponent } from '../pages/resources-page.component';
import { ActeursPageComponent } from '../pages/acteurs-page.component';
import { InfrastructuresPageComponent } from '../pages/infrastructures-page.component';
import { AlertesPageComponent } from '../pages/alertes/alertes-page.component';
import { CapteursPageComponent } from '../pages/capteurs-page.component';
import { ScopeService } from '../scope.service';

/**
 * Montages des pages de module dans le shell superviseur.
 *
 * Ce ne sont pas de nouvelles pages : on réutilise les composants existants
 * (resources-page, acteurs-page) en leur passant `[scope]` dérivé du token via
 * ScopeService. Le scope ne vient donc pas d'un clic admin mais de la session —
 * et le serveur reste l'autorité du périmètre. Verrou garanti en amont par
 * `superviseurGuard` (urdId non nul requis), donc `autoScope` est toujours défini ici.
 */

@Component({
  selector: 'app-sup-ressources',
  standalone: true,
  imports: [ResourcesPageComponent],
  template: `<app-resources-page [scope]="scope" />`,
})
export class SupRessourcesPageComponent {
  private readonly scopeSvc = inject(ScopeService);
  get scope() { return this.scopeSvc.autoScope ?? undefined; }
}

@Component({
  selector: 'app-sup-acteurs',
  standalone: true,
  imports: [ActeursPageComponent],
  template: `<app-acteurs-page [scope]="scope" />`,
})
export class SupActeursPageComponent {
  private readonly scopeSvc = inject(ScopeService);
  get scope() { return this.scopeSvc.autoScope ?? undefined; }
}

@Component({
  selector: 'app-sup-infrastructures',
  standalone: true,
  imports: [InfrastructuresPageComponent],
  template: `<app-infrastructures-page [scope]="scope" />`,
})
export class SupInfrastructuresPageComponent {
  private readonly scopeSvc = inject(ScopeService);
  get scope() { return this.scopeSvc.autoScope ?? undefined; }
}

@Component({
  selector: 'app-sup-alertes',
  standalone: true,
  imports: [AlertesPageComponent],
  template: `<app-alertes-page [scope]="scope" />`,
})
export class SupAlertesPageComponent {
  private readonly scopeSvc = inject(ScopeService);
  get scope() { return this.scopeSvc.autoScope ?? undefined; }
}

@Component({
  selector: 'app-sup-capteurs',
  standalone: true,
  imports: [CapteursPageComponent],
  template: `<app-capteurs-page [scope]="scope" />`,
})
export class SupCapteursPageComponent {
  private readonly scopeSvc = inject(ScopeService);
  get scope() { return this.scopeSvc.autoScope ?? undefined; }
}
// La page /terrain/capteurs (comme /superviseur/capteurs) affiche TOUJOURS la liste/carte
// scopée — jamais de redirection automatique vers une station. La station live
// (capteurs/ouvrage/:id) ne s'ouvre que sur clic d'un ouvrage/capteur dans la liste.

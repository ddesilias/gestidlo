import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { SharedDrawersService } from '../shared/shared-drawers.service';
import { GovernanceSignalsService } from './governance/dashboard/governance-signals.service';
import { GovernanceSignalTileComponent } from './governance/dashboard/governance-signal-tile.component';
import { GovernanceMapComponent } from './governance/dashboard/governance-map.component';
import { DeptRankingComponent } from './governance/dashboard/dept-ranking.component';
import { ComplianceTrendComponent } from './governance/dashboard/compliance-trend.component';
import { GovernancePilotageComponent } from './governance/dashboard/governance-pilotage.component';

/**
 * Tableau de bord Gouvernance — « command center national » (cahier v2). Le directeur DINEPA vient
 * SAVOIR, pas traiter : état national → carte (quel département va mal) → classement → tendance →
 * points d'attention. La file de validation vit sur la page Rapports ; ici, seulement un lien.
 * Tout chiffre est un computed() AGRÉGÉ des stores partagés (DepartementsStore en tête) — zéro littéral.
 * La navigation vers les 8 domaines passe par le lanceur « Domaines » (plus de strip redondant).
 */
@Component({
  selector: 'app-governance-page',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    GovernanceSignalTileComponent, GovernanceMapComponent, DeptRankingComponent,
    ComplianceTrendComponent, GovernancePilotageComponent,
  ],
  templateUrl: './governance-page.component.html',
  styleUrls: ['./governance-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GovernancePageComponent implements OnInit {
  private readonly router = inject(Router);
  readonly drawers = inject(SharedDrawersService);
  readonly sig = inject(GovernanceSignalsService);

  ngOnInit(): void {
    this.sig.charger();
  }

  /** Sélecteur d'en-tête : bascule National ↔ URD ; recharge les données scopées. */
  changerScope(nom: string): void {
    this.sig.setScope(nom);
    this.sig.charger();
  }

  /** Clic carte / classement = drill-down vers le département (bascule le scope, sans recharger :
   *  les données sont déjà nationales, le Pilotage filtre côté client). */
  drillDown(nom: string): void {
    this.sig.setScope(nom);
  }

  /** Retour à la vue nationale (bouton « Réinitialiser national »). */
  reinitialiser(): void {
    this.sig.setScope(null);
  }

  nouveauReglement(): void { this.drawers.openNouveauReglement(); }

  ouvrirRapports(): void { this.router.navigateByUrl('/admin/rapports'); }
}

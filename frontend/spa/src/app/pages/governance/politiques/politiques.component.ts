import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GovShellComponent } from '../shared/gov-shell.component';

@Component({
  selector: 'app-politiques',
  standalone: true,
  imports: [CommonModule, GovShellComponent],
  templateUrl: './politiques.component.html',
  styleUrls: ['./politiques.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolitiquesComponent {
  readonly POLITIQUES = [
    { ref:'POL-2026-001', titre:'Politique de confidentialité des données WASH',         version:'v2.1', statut:'active',   revue:'janv. 2027', categorie:'Données'         },
    { ref:'POL-2026-002', titre:'Procédure de gestion des accès et identités',           version:'v1.4', statut:'active',   revue:'mars 2027',  categorie:'Sécurité'        },
    { ref:'POL-2026-003', titre:'Politique de rétention et archivage des rapports',      version:'v1.0', statut:'revision', revue:'juin 2026',  categorie:'Archivage'       },
    { ref:'POL-2026-004', titre:'Procédure de communication de crise (contamination)',   version:'v3.0', statut:'active',   revue:'déc. 2026',  categorie:'Urgence'         },
    { ref:'POL-2026-005', titre:'Politique d\'utilisation des données IoT DINEPA',       version:'v1.2', statut:'active',   revue:'août 2026',  categorie:'IoT'             },
    { ref:'POL-2026-006', titre:'Charte des techniciens terrain et déontologie',         version:'v2.0', statut:'active',   revue:'janv. 2027', categorie:'RH'              },
    { ref:'POL-2026-007', titre:'Politique de sauvegarde environnementale et sociale',   version:'v1.1', statut:'revision', revue:'juil. 2026', categorie:'Environnement'   },
    { ref:'POL-2026-008', titre:'Procédure de notification aux usagers (interruptions)', version:'v1.5', statut:'active',   revue:'oct. 2026',  categorie:'Communication'   },
  ];

  statutCls(s: string): string {
    return s === 'active' ? 'pol-stat--green' : 'pol-stat--amber';
  }
}

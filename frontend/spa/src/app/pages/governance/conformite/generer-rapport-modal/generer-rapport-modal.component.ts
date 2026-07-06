import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface RapportSection {
  num: number;
  titre: string;
  statut: 'ok' | 'active' | 'pending' | 'warning';
  count?: number;
}

interface NonConf {
  badge: string;
  titre: string;
  sous: string;
  justification: string;
}

@Component({
  selector: 'app-generer-rapport-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './generer-rapport-modal.component.html',
  styleUrls: ['./generer-rapport-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenererRapportModalComponent {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();

  readonly sections: RapportSection[] = [
    { num: 1,  titre: 'Couverture territoriale',  statut: 'ok'      },
    { num: 2,  titre: 'Infrastructures actives',   statut: 'ok'      },
    { num: 3,  titre: 'Volumes distribués',        statut: 'ok'      },
    { num: 4,  titre: "Qualité de l'eau",          statut: 'active'  },
    { num: 5,  titre: 'Alertes & incidents',       statut: 'pending' },
    { num: 6,  titre: 'Interventions terrain',     statut: 'pending' },
    { num: 7,  titre: 'Indicateurs SLA',           statut: 'pending' },
    { num: 8,  titre: 'Non-conformités',           statut: 'warning', count: 3 },
    { num: 9,  titre: "Plan d'action",             statut: 'pending' },
    { num: 10, titre: 'Annexes',                   statut: 'pending' },
  ];

  nonConformites: NonConf[] = [
    {
      badge: 'SLA dépassé',
      titre: 'Intervention INT-2026-0124 — 6h de retard',
      sous: 'Coupure totale Dessources · délai 2h · résolu en 8h · cause : pièce indisponible',
      justification: '',
    },
    {
      badge: 'Turbidité limite',
      titre: 'Capteur CPT-QA-007 · 11/04 · pic 5.3 NTU',
      sous: 'Dépassement de 0.3 NTU pendant 12 min · pluies torrentielles · capteur calibré',
      justification: '',
    },
    {
      badge: 'Calibration tardive',
      titre: '3 capteurs · calibration retardée de 8 jours',
      sous: 'CPT-PR-003, CPT-NV-005, CPT-DB-009 · technicien en congé · à régulariser',
      justification: '',
    },
  ];

  get doneCount(): number { return this.sections.filter(s => s.statut === 'ok').length; }
  get progressPct(): number { return Math.round((this.doneCount / this.sections.length) * 100); }

  sectionCls(s: RapportSection): string {
    if (s.statut === 'ok')      return 'sec-ok';
    if (s.statut === 'active')  return 'sec-active';
    if (s.statut === 'warning') return 'sec-warning';
    return 'sec-pending';
  }
}

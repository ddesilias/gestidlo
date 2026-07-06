import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type InstitutionTypeChoice = 'dinepa' | 'orepa' | 'municipalite' | 'caepa' | 'ong' | 'bailleur' | 'operateur';

interface TypeOption {
  id: InstitutionTypeChoice; label: string; sub: string;
  cls: string; icon: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { id: 'orepa',        label: 'OREPA',              sub: 'Office régional eau potable',       cls: 'blue',   icon: 'map'      },
  { id: 'municipalite', label: 'Municipalité',        sub: 'Commune / mairie',                  cls: 'green',  icon: 'city'     },
  { id: 'caepa',        label: 'CAEPA',               sub: 'Comité usagers section communale',  cls: 'amber',  icon: 'users'    },
  { id: 'ong',          label: 'ONG',                 sub: 'Organisation non gouvernementale',  cls: 'blue',   icon: 'globe'    },
  { id: 'bailleur',     label: 'Bailleur',            sub: 'Financeur / agence internationale', cls: 'green',  icon: 'coin'     },
  { id: 'operateur',    label: 'Opérateur privé',     sub: 'Exploitant délégué',                cls: 'amber',  icon: 'gear'     },
];

const STEP_LABELS: { num: Step; label: string }[] = [
  { num: 1, label: 'Type'       },
  { num: 2, label: 'Identité'  },
  { num: 3, label: 'Hiérarchie'},
  { num: 4, label: 'Périmètre' },
  { num: 5, label: 'Pouvoirs'  },
  { num: 6, label: 'Admin'     },
  { num: 7, label: 'Docs'      },
];

@Component({
  selector: 'app-nouvelle-institution-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nouvelle-institution-modal.component.html',
  styleUrls: ['./nouvelle-institution-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NouvelleInstitutionModalComponent {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();

  readonly TYPE_OPTIONS = TYPE_OPTIONS;
  readonly STEP_LABELS  = STEP_LABELS;

  readonly activeStep      = signal<Step>(3);
  readonly selectedType    = signal<InstitutionTypeChoice>('municipalite');

  // Step 2 fields
  nom         = 'Municipalité de Carrefour';
  sigle       = 'MUN-CARREFOUR';
  description = '19 sections communales · Département Ouest';

  // Step 3 fields
  rattachement = 'orepa-ouest';

  // Step 4 fields
  readonly zonesSelectionnees = signal<string[]>([]);

  // Step 5 — pouvoirs hérités
  heriter_sla       = signal(true);
  heriter_rapports  = signal(true);
  heriter_workflows = signal(true);
  heriter_notifs    = signal(false);

  readonly CHECKLIST_ITEMS = [
    { step: 1, label: 'Type sélectionné',       done: true,  current: false },
    { step: 2, label: 'Nom et sigle saisis',    done: true,  current: false },
    { step: 3, label: 'Rattachement en cours',  done: false, current: true  },
    { step: 4, label: 'Définir périmètre',      done: false, current: false },
    { step: 5, label: 'Configurer pouvoirs',    done: false, current: false },
    { step: 6, label: 'Nommer admin',           done: false, current: false },
    { step: 7, label: 'Joindre documents',      done: false, current: false },
  ];

  get typeLabel(): string {
    return TYPE_OPTIONS.find(t => t.id === this.selectedType())?.label ?? '';
  }

  get stepLabel(): string {
    return STEP_LABELS.find(s => s.num === this.activeStep())?.label ?? '';
  }

  selectType(t: InstitutionTypeChoice): void { this.selectedType.set(t); }
  goTo(s: Step): void { this.activeStep.set(s); }
  next(): void { if (this.activeStep() < 7) this.activeStep.update(s => (s + 1) as Step); }
  prev(): void { if (this.activeStep() > 1) this.activeStep.update(s => (s - 1) as Step); }

  enregistrerBrouillon(): void { alert('Brouillon enregistré — vous pouvez reprendre plus tard'); }

  creer(): void {
    alert(`Institution "${this.nom}" créée avec succès\nType: ${this.typeLabel}\nUn email a été envoyé au chef OREPA Ouest pour approbation du rattachement.`);
    this.fermer.emit();
  }
}

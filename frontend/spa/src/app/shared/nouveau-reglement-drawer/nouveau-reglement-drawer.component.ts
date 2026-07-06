import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SharedDrawersService } from '../shared-drawers.service';

type RegleType = 'sla' | 'seuil' | 'workflow' | 'escalade' | 'politique';
type Step = 1 | 2 | 3 | 4;

interface RegleTypeOption { id: RegleType; label: string; sub: string; icon: string; cls: string; }
interface ZoneTag { label: string; }

const RULE_TYPES: RegleTypeOption[] = [
  { id: 'sla',       label: 'Règle SLA',           sub: "Délais d'intervention par niveau",     icon: 'clock',   cls: 'blue'   },
  { id: 'seuil',     label: 'Seuil capteur',        sub: 'Seuils d\'alerte IoT (pression, niveau)', icon: 'gauge',   cls: 'amber'  },
  { id: 'workflow',  label: 'Workflow',              sub: "Séquence d'étapes d'intervention",    icon: 'flow',    cls: 'green'  },
  { id: 'escalade',  label: 'Escalade',              sub: 'Notification automatique par délai',  icon: 'alert',   cls: 'red'    },
  { id: 'politique', label: 'Politique données',     sub: 'Rétention, accès, archivage',         icon: 'docs',    cls: 'purple' },
];

@Component({
  selector: 'app-nouveau-reglement-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nouveau-reglement-drawer.component.html',
  styleUrls: ['./nouveau-reglement-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NouveauReglementDrawerComponent {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();

  private readonly router  = inject(Router);
  private readonly drawers = inject(SharedDrawersService);

  readonly RULE_TYPES = RULE_TYPES;

  readonly activeStep   = signal<Step>(1);
  readonly selectedType = signal<RegleType>('sla');

  nom   = 'Pression critique zones rurales';
  code  = 'SLA-PRES-RUR-001';
  priorite = 'haute';
  description = 'Délai de résolution réduit pour les capteurs en zone rurale à faible débit.';

  slaC = '2h'; slaH = '4h'; slaM = '8h'; slaB = '24h';

  readonly zones = signal<string[]>(['Dessources', 'Petite Rivière']);

  actionIntervention = signal(true);
  actionSms          = signal(true);
  actionDeclaration  = signal(false);
  actionCapteurs     = signal(false);

  activerImmediatement = signal(true);
  notifierCreateur     = signal(true);

  readonly STEPS: { num: Step; label: string }[] = [
    { num: 1, label: 'Identification' },
    { num: 2, label: 'Déclencheur'   },
    { num: 3, label: 'Actions'       },
    { num: 4, label: 'Validation'    },
  ];

  selectType(t: RegleType): void { this.selectedType.set(t); }

  next(): void { if (this.activeStep() < 4) this.activeStep.update(s => (s + 1) as Step); }
  prev(): void { if (this.activeStep() > 1) this.activeStep.update(s => (s - 1) as Step); }

  goTo(s: Step): void { this.activeStep.set(s); }

  removeZone(z: string): void {
    this.zones.update(list => list.filter(x => x !== z));
  }

  addZone(): void {
    const z = prompt('Ajouter une zone :');
    if (z?.trim()) this.zones.update(list => [...list, z.trim()]);
  }

  sauvegarder(): void {
    const code = this.code || 'SLA-PRES-LEO-001';
    this.drawers.setLastCreatedRule(code);
    this.fermer.emit();
    this.router.navigate(['/governance/regles-sla']);
  }

  get typeOption(): RegleTypeOption {
    return RULE_TYPES.find(r => r.id === this.selectedType()) ?? RULE_TYPES[0];
  }

  get codeLower(): string { return this.code.toLowerCase(); }
}

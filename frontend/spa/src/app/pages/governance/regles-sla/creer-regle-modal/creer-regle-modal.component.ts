import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Escalade {
  delai: string; unite: string; notifier: string; canal: string;
}

@Component({
  selector: 'app-creer-regle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creer-regle-modal.component.html',
  styleUrls: ['./creer-regle-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreerRegleModalComponent {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();

  nomRegle = 'Pression critique zones rurales';
  codeRegle = 'SLA-PRES-RUR-001';
  slaC = '2h'; slaH = '4h'; slaM = '8h'; slaB = '24h';

  zones = signal<string[]>(['Dessources', 'Petite Rivière']);
  activerImmediatement = signal(true);
  actionIntervention = signal(true);
  actionSms = signal(true);
  actionDeclaration = signal(false);
  actionCapteurs = signal(false);

  escalades: Escalade[] = [
    { delai: '15', unite: 'min', notifier: 'Dispatcher', canal: '' },
    { delai: '30', unite: 'min', notifier: 'Chef de centre', canal: 'SMS' },
  ];

  removeZone(z: string): void { this.zones.update(arr => arr.filter(x => x !== z)); }
  addEscalade(): void { this.escalades = [...this.escalades, { delai: '60', unite: 'min', notifier: 'Admin OREPA', canal: '' }]; }
  removeEscalade(i: number): void { this.escalades = this.escalades.filter((_, idx) => idx !== i); }
}

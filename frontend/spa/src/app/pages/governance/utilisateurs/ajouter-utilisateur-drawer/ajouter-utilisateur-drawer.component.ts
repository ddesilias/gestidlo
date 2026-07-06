import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface RoleOption {
  id: string; label: string; sous: string; iconCls: string; colorCls: string;
}

@Component({
  selector: 'app-ajouter-utilisateur-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajouter-utilisateur-drawer.component.html',
  styleUrls: ['./ajouter-utilisateur-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjouterUtilisateurDrawerComponent {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();

  readonly activeStep = signal(1);
  readonly selectedRole = signal('technicien');

  prenom = '';
  nom = '';
  email = '';
  phone = '';
  mfa = signal(true);
  sendEmail = signal(true);
  sendSms = signal(true);

  readonly skills = signal<string[]>(['Capteurs IoT', 'Plomberie']);

  readonly ROLES: RoleOption[] = [
    { id: 'superadmin', label: 'Super Admin',     sous: 'Tous droits · national',       iconCls: 'ico-violet', colorCls: 'role-violet' },
    { id: 'adminorepa', label: 'Admin OREPA',     sous: 'Régional · 1 OREPA',           iconCls: 'ico-violet', colorCls: 'role-violet' },
    { id: 'chef',       label: 'Chef de centre',  sous: 'Communal · gestion équipe',    iconCls: 'ico-green',  colorCls: 'role-green'  },
    { id: 'dispatcher', label: 'Dispatcher',       sous: 'Alertes · interventions',      iconCls: 'ico-blue',   colorCls: 'role-blue'   },
    { id: 'technicien', label: 'Technicien terrain',sous: 'Interventions · ses capteurs',iconCls: 'ico-amber',  colorCls: 'role-amber'  },
    { id: 'auditeur',   label: 'Auditeur',         sous: 'Lecture seule · audit',        iconCls: 'ico-purple', colorCls: 'role-purple' },
  ];

  readonly ALL_SKILLS = ['Réservoirs', 'Capteurs IoT', 'Plomberie', 'Électricité', 'Pompes', 'Qualité eau'];

  hasSkill(s: string): boolean { return this.skills().includes(s); }

  toggleSkill(s: string): void {
    const current = this.skills();
    this.skills.set(current.includes(s) ? current.filter(x => x !== s) : [...current, s]);
  }

  get initiales(): string {
    return ((this.prenom[0] ?? '') + (this.nom[0] ?? '')).toUpperCase() || 'MJ';
  }

  get nomComplet(): string {
    return (this.prenom + ' ' + this.nom).trim() || 'Marie Joseph';
  }

  get emailDisplay(): string {
    return this.email || 'prenom.nom@dinepa.gouv.ht';
  }

  get roleLabel(): string {
    return this.ROLES.find(r => r.id === this.selectedRole())?.label ?? 'Technicien';
  }

  selectRole(id: string): void { this.selectedRole.set(id); }
  next(): void { if (this.activeStep() < 4) this.activeStep.update(s => s + 1); }
  prev(): void { if (this.activeStep() > 1) this.activeStep.update(s => s - 1); }
}

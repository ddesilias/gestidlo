import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserRegistryService } from '../../../../user-registry.service';
import { InstitutionsStore } from '../../../../institutions.store';

export interface CompteCreeData {
  nom: string; username: string; initiales: string; orepa: string;
  email: string; phone: string; role: string;
}

const OREPA_DEPTS: Record<string, string[]> = {
  'OREPA Nord':   ['Nord', 'Nord-Est', 'Nord-Ouest'],
  'OREPA Ouest':  ['Ouest', 'Artibonite'],
  'OREPA Sud':    ['Sud', 'Sud-Est', "Grand'Anse", 'Nippes'],
  'OREPA Centre': ['Centre', 'Plateau Central'],
};

interface PermDef {
  id: string; icon: string; color: string; label: string;
}

const PERMS: PermDef[] = [
  { id: 'recenser',    icon: 'ti-droplet',          color: '#34D399', label: 'Recenser des ressources'      },
  { id: 'ouvrages',    icon: 'ti-building-cottage',  color: '#FBBF24', label: 'Enregistrer des ouvrages'     },
  { id: 'techniciens', icon: 'ti-user-plus',         color: '#60A5FA', label: 'Affecter des techniciens'      },
  { id: 'rapports',    icon: 'ti-file-check',        color: '#A5A4DC', label: 'Valider des rapports'          },
  { id: 'comptes',     icon: 'ti-user-cog',          color: '#6B7785', label: 'Créer des comptes techniciens' },
  { id: 'zones',       icon: 'ti-map-pin-plus',      color: '#6B7785', label: 'Activer de nouvelles zones'    },
];

@Component({
  selector: 'app-creer-superviseur-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creer-superviseur-modal.component.html',
  styleUrls: ['./creer-superviseur-modal.component.scss'],
})
export class CreerSuperviseurModalComponent {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();
  @Output() compteCree = new EventEmitter<CompteCreeData>();

  readonly OREPA_LIST = Object.keys(OREPA_DEPTS);
  readonly ROLES_LIST = ['Superviseur régional', 'Admin OREPA'];
  readonly permDefs = PERMS;

  nom = 'Marc-André Désir';
  email = 'ma.desir@dinepa.gouv.ht';
  telephone = '+509 3742 8810';
  fonction = 'Responsable supervision régionale';

  selectedOrepa = 'OREPA Sud';
  selectedRole = 'Superviseur régional';
  selectedDepts: string[] = ['Sud', 'Sud-Est', "Grand'Anse", 'Nippes'];

  username = 'sup.sud';
  password = 'superviseur';
  forceChange = true;

  enabledPerms: string[] = ['recenser', 'ouvrages', 'techniciens', 'rapports'];

  loading = false;
  errorMsg: string | null = null;

  constructor(
    private readonly userRegistry: UserRegistryService,
    private readonly instStore: InstitutionsStore,
  ) {}

  get deptOptions(): string[] { return OREPA_DEPTS[this.selectedOrepa] ?? []; }

  onOrepaChange(): void {
    this.selectedDepts = [...this.deptOptions];
    this.username = 'sup.' + this.selectedOrepa.replace('OREPA ', '').toLowerCase();
  }

  hasDept(d: string): boolean { return this.selectedDepts.includes(d); }
  toggleDept(d: string): void {
    const i = this.selectedDepts.indexOf(d);
    if (i >= 0) this.selectedDepts.splice(i, 1); else this.selectedDepts.push(d);
  }

  hasPerm(id: string): boolean { return this.enabledPerms.includes(id); }
  togglePerm(id: string): void {
    const i = this.enabledPerms.indexOf(id);
    if (i >= 0) this.enabledPerms.splice(i, 1); else this.enabledPerms.push(id);
  }

  generatePassword(): void {
    const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    this.password = Array.from({ length: 12 }, () => c[Math.floor(Math.random() * c.length)]).join('');
  }

  onCreer(): void {
    this.errorMsg = null;
    if (!this.nom.trim() || !this.username.trim() || !this.password.trim()) {
      this.errorMsg = 'Nom, identifiant et mot de passe sont requis.';
      return;
    }
    if (this.userRegistry.isUsernameTaken(this.username.trim())) {
      this.errorMsg = `L'identifiant « ${this.username.trim()} » est déjà utilisé.`;
      return;
    }
    if (this.email.trim() && this.userRegistry.isEmailTaken(this.email)) {
      this.errorMsg = `L'adresse email est déjà associée à un compte.`;
      return;
    }
    if (this.telephone.trim() && this.userRegistry.isPhoneTaken(this.telephone)) {
      this.errorMsg = `Ce numéro de téléphone est déjà associé à un compte.`;
      return;
    }

    // Un responsable supervise UNE URD = UN département. On résout un urdId réel
    // depuis le registre des institutions (pas un slug forgé), et on envoie le rôle
    // métier que le backend mappe vers SUPERVISEUR_URD — sinon le compte serait OPERATOR
    // et bloqué par le guard. L'admin OREPA, lui, n'est pas scopé à une URD.
    const isAdmin = this.selectedRole === 'Admin OREPA';
    const dept = this.selectedDepts[0] ?? '';
    let urdId: string | undefined;
    if (!isAdmin) {
      if (!dept) { this.errorMsg = 'Sélectionne au moins un département.'; return; }
      const urd = this.instStore.getByType('urd').find(u => u.dept === dept);
      if (!urd) { this.errorMsg = `Aucune URD trouvée pour le département « ${dept} ».`; return; }
      urdId = urd.id;
    }

    this.loading = true;
    this.userRegistry.createUser({
      username:    this.username.trim(),
      password:    this.password.trim(),
      nom:         this.nom.trim(),
      email:       this.email.trim(),
      telephone:   this.telephone.trim(),
      fonction:    this.fonction,
      role:        isAdmin ? 'admin_dinepa' : 'superviseur_urd',
      urdId,
      dept:        isAdmin ? this.selectedDepts.join(',') : dept,
      permissions: this.enabledPerms.join(','),
    }).subscribe({
      next: (profile) => {
        this.loading = false;
        this.userRegistry.addToCache(profile);
        const fullNom   = profile.nom;
        const initiales = profile.initiales;
        this.compteCree.emit({
          nom: fullNom, username: profile.username, initiales,
          orepa: this.selectedOrepa, role: this.selectedRole,
          email: profile.email, phone: profile.telephone,
        });
        this.fermer.emit();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message ?? 'Erreur lors de la création du compte.';
      },
    });
  }
}

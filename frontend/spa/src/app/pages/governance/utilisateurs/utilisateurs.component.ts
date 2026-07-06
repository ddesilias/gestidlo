import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GovShellComponent } from '../shared/gov-shell.component';
import { AjouterUtilisateurDrawerComponent } from './ajouter-utilisateur-drawer/ajouter-utilisateur-drawer.component';
import { CreerSuperviseurModalComponent, CompteCreeData } from './creer-superviseur-modal/creer-superviseur-modal.component';
import { CreerSuperviseurUrdModalComponent, CompteCreeUrdData } from './creer-superviseur-urd-modal/creer-superviseur-urd-modal.component';
import { UserRegistryService } from '../../../user-registry.service';

interface User {
  id: string; initiales: string; nom: string; email: string; phone?: string;
  role: string; roleCls: string; zone: string; institution: string; instCls: string;
  statut: string; statutCls: string; online: boolean;
}

const USERS: User[] = [
  { id:'u1', initiales:'AS', nom:'Admin Super',    email:'admin@dinepa.gouv.ht',                role:'Super Admin', roleCls:'violet', zone:'National',             institution:'DINEPA',       instCls:'violet', statut:'Actif · en ligne',    statutCls:'green',  online:true  },
  { id:'u2', initiales:'MR', nom:'Maria Romain',   email:'mromain@dinepa.gouv.ht',              role:'Chef de centre', roleCls:'green', zone:'Léogâne',           institution:'OREPA Ouest',  instCls:'green',  statut:'Actif · en ligne',    statutCls:'green',  online:true  },
  { id:'u3', initiales:'MD', nom:'Marc Désir',     email:'mdesir@dinepa.gouv.ht',    phone:'+509 38 12 4567', role:'Dispatcher', roleCls:'blue',  zone:'Léogâne · Petit-Goâve',institution:'OREPA Ouest',  instCls:'blue',   statut:'Actif · en ligne',    statutCls:'green',  online:true  },
  { id:'u4', initiales:'JP', nom:'Jean Pierre',    email:'jpierre@dinepa.gouv.ht',   phone:'+509 32 45 7890', role:'Technicien', roleCls:'amber', zone:'Léogâne · Dessources',  institution:'DINEPA Ouest', instCls:'amber',  statut:'En intervention',     statutCls:'green',  online:true  },
  { id:'u5', initiales:'SC', nom:'Sara Cadet',     email:'scadet@dinepa.gouv.ht',    phone:'+509 31 22 1100', role:'Technicien', roleCls:'amber', zone:'Léogâne',               institution:'DINEPA Ouest', instCls:'amber',  statut:'Hors ligne · 14h',    statutCls:'gray',   online:false },
  { id:'u6', initiales:'PL', nom:'Pierre Léger',   email:'pleger@audit.dinepa.gouv.ht',         role:'Auditeur',   roleCls:'purple', zone:'National (lecture)',    institution:'DINEPA',       instCls:'purple', statut:'Suspendu · 2FA requis',statutCls:'amber',  online:false },
];

interface PermRow { module: string; superAdmin: 'all'|'rest'|'read'|'none'; adminOrepa: 'all'|'rest'|'read'|'none'; chef: 'all'|'rest'|'read'|'none'; dispatcher: 'all'|'rest'|'read'|'none'; tech: 'all'|'rest'|'tool'|'read'|'none'; auditeur: 'all'|'rest'|'read'|'none'; citoyen: 'all'|'rest'|'read'|'none'; highlight?: boolean; }

const PERM_MATRIX: PermRow[] = [
  { module:'Gouvernance',          superAdmin:'all',  adminOrepa:'rest', chef:'read',  dispatcher:'none', tech:'none', auditeur:'read', citoyen:'none', highlight:true },
  { module:'Ressources naturelles',superAdmin:'all',  adminOrepa:'all',  chef:'all',   dispatcher:'read', tech:'read', auditeur:'read', citoyen:'read' },
  { module:'Infrastructures',      superAdmin:'all',  adminOrepa:'all',  chef:'all',   dispatcher:'rest', tech:'read', auditeur:'read', citoyen:'none' },
  { module:'Capteurs IoT',         superAdmin:'all',  adminOrepa:'all',  chef:'all',   dispatcher:'rest', tech:'tool', auditeur:'read', citoyen:'none' },
  { module:'Alertes',              superAdmin:'all',  adminOrepa:'all',  chef:'all',   dispatcher:'all',  tech:'rest', auditeur:'read', citoyen:'read' },
  { module:'Interventions terrain',superAdmin:'all',  adminOrepa:'all',  chef:'all',   dispatcher:'all',  tech:'tool', auditeur:'read', citoyen:'none' },
  { module:'Rapports',             superAdmin:'all',  adminOrepa:'all',  chef:'rest',  dispatcher:'read', tech:'none', auditeur:'all',  citoyen:'read' },
  { module:'Suppression (sensible)',superAdmin:'all', adminOrepa:'rest', chef:'none',  dispatcher:'none', tech:'none', auditeur:'none', citoyen:'none', highlight:true },
];

@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, GovShellComponent, AjouterUtilisateurDrawerComponent, CreerSuperviseurModalComponent, CreerSuperviseurUrdModalComponent],
  templateUrl: './utilisateurs.component.html',
  styleUrls: ['./utilisateurs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UtilisateursComponent {
  readonly permMatrix = PERM_MATRIX;
  readonly selectedRole = signal('tous');
  readonly recherche = signal('');
  readonly showAjouterDrawer       = signal(false);
  readonly showCreerSuperviseur    = signal(false);
  readonly showCreerSuperviseurUrd = signal(false);

  constructor(private readonly userRegistry: UserRegistryService) {}

  // Fusionne les utilisateurs statiques de démo avec les profils chargés depuis l'API
  readonly allUsers = computed(() => [
    ...USERS,
    ...this.userRegistry.list().map(p => this.userRegistry.toDisplayRow(p)),
  ]);

  onSuperviseurOreparCree(_data: CompteCreeData): void {
    // Le profil a déjà été ajouté au cache par le modal via userRegistry.addToCache()
    // Rien à faire ici — allUsers() se met à jour automatiquement via le signal
  }

  onSuperviseurUrdCree(_data: CompteCreeUrdData): void {
    // Idem — cache mis à jour par le modal
  }

  readonly ROLES = [
    { id: 'tous',      label: 'Tous les rôles',   count: 24, cls: 'blue' },
    { id: 'superadmin',label: 'Super Admin',        count: 1,  cls: 'violet' },
    { id: 'adminorepa',label: 'Admin OREPA',        count: 2,  cls: 'violet' },
    { id: 'chef',      label: 'Chef de centre',     count: 2,  cls: 'green'  },
    { id: 'dispatcher',label: 'Dispatcher',          count: 3,  cls: 'blue'   },
    { id: 'technicien',label: 'Technicien',          count: 12, cls: 'amber'  },
    { id: 'auditeur',  label: 'Auditeur',            count: 2,  cls: 'purple' },
    { id: 'citoyen',   label: 'Citoyen (lecture)',   count: 2,  cls: 'gray'   },
  ];

  permIcon(v: string): { label: string; cls: string } {
    const MAP: Record<string, { label: string; cls: string }> = {
      all:  { label: '✓', cls: 'perm-all'  },
      rest: { label: '✓', cls: 'perm-rest' },
      tool: { label: '⚙', cls: 'perm-tool' },
      read: { label: '👁', cls: 'perm-read' },
      none: { label: '✕', cls: 'perm-none' },
    };
    return MAP[v] ?? { label: '?', cls: '' };
  }
}

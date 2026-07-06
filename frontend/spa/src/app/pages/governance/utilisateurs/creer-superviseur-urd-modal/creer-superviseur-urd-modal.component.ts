import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InstitutionsStore, InstitutionData } from '../../../../institutions.store';
import { UserRegistryService } from '../../../../user-registry.service';

export interface CompteCreeUrdData {
  nom: string; username: string; initiales: string;
  urdId: string; urdNom: string; dept: string;
  email: string; phone: string;
}

interface PermDef { id: string; icon: string; color: string; label: string; }

const PERMS: PermDef[] = [
  { id: 'recenser',    icon: 'ti-droplet',         color: '#34D399', label: 'Recenser des ressources'      },
  { id: 'ouvrages',    icon: 'ti-building-cottage', color: '#FBBF24', label: 'Enregistrer des ouvrages'      },
  { id: 'techniciens', icon: 'ti-user-plus',        color: '#60A5FA', label: 'Affecter des techniciens'      },
  { id: 'rapports',    icon: 'ti-file-check',       color: '#A5A4DC', label: 'Valider des rapports'          },
  { id: 'comptes',     icon: 'ti-user-cog',         color: '#6B7785', label: 'Créer des comptes techniciens' },
  { id: 'zones',       icon: 'ti-map-pin-plus',     color: '#6B7785', label: 'Activer de nouvelles zones'    },
];

const DEFAULT_PERMS = ['recenser', 'ouvrages', 'techniciens', 'rapports'];

function toSlug(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/'/g, '').replace(/\s+/g, '-');
}

@Component({
  selector: 'app-creer-superviseur-urd-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creer-superviseur-urd-modal.component.html',
  styleUrls: ['./creer-superviseur-urd-modal.component.scss'],
})
export class CreerSuperviseurUrdModalComponent implements OnChanges {
  @Input() visible = false;
  /** Pre-fill + lock the URD when opened from a URD detail page. */
  @Input() urdId: string | null = null;
  @Output() fermer     = new EventEmitter<void>();
  @Output() compteCree = new EventEmitter<CompteCreeUrdData>();

  readonly urdList: InstitutionData[];
  readonly permDefs = PERMS;

  selectedUrdId = '';
  derivedDept   = '';

  nom       = '';
  email     = '';
  telephone = '';
  fonction  = 'Responsable supervision départementale';
  username  = '';
  password  = '';
  forceChange = true;

  enabledPerms: string[] = [...DEFAULT_PERMS];
  loading  = false;
  errorMsg: string | null = null;

  constructor(
    private readonly instStore:    InstitutionsStore,
    private readonly userRegistry: UserRegistryService,
  ) {
    this.urdList = this.instStore.getByType('urd');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.reset();
    }
  }

  get isLocked(): boolean { return !!this.urdId; }

  get selectedUrd(): InstitutionData | undefined {
    return this.instStore.getById(this.selectedUrdId);
  }

  onUrdChange(): void { this.deriveFromSelected(); }

  // ── Helpers ────────────────────────────────────────────────────────

  private reset(): void {
    this.nom         = '';
    this.email       = '';
    this.telephone   = '';
    this.fonction    = 'Responsable supervision départementale';
    this.password    = '';
    this.forceChange = true;
    this.enabledPerms = [...DEFAULT_PERMS];
    this.errorMsg    = null;

    if (this.urdId) {
      this.selectedUrdId = this.urdId;
    } else if (!this.selectedUrdId && this.urdList.length > 0) {
      this.selectedUrdId = this.urdList[0].id;
    }
    this.deriveFromSelected();
  }

  private deriveFromSelected(): void {
    const urd = this.instStore.getById(this.selectedUrdId);
    if (!urd) return;
    this.derivedDept = urd.dept ?? urd.nom.replace('URD ', '');
    this.username = 'superviseur.' + toSlug(this.derivedDept);
  }

  generatePassword(): void {
    const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    this.password = Array.from({ length: 12 }, () => c[Math.floor(Math.random() * c.length)]).join('');
  }

  hasPerm(id: string): boolean { return this.enabledPerms.includes(id); }
  togglePerm(id: string): void {
    const i = this.enabledPerms.indexOf(id);
    if (i >= 0) this.enabledPerms.splice(i, 1); else this.enabledPerms.push(id);
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

    this.loading = true;
    const urd = this.selectedUrd;
    this.userRegistry.createUser({
      username:    this.username.trim(),
      password:    this.password.trim(),
      nom:         this.nom.trim(),
      email:       this.email.trim(),
      telephone:   this.telephone.trim(),
      fonction:    this.fonction,
      role:        'superviseur_urd',
      urdId:       this.selectedUrdId,
      dept:        this.derivedDept,
      permissions: this.enabledPerms.join(','),
    }).subscribe({
      next: (profile) => {
        this.loading = false;
        this.userRegistry.addToCache(profile);
        this.compteCree.emit({
          nom:      profile.nom,
          username: profile.username,
          initiales: profile.initiales,
          urdId:    this.selectedUrdId,
          urdNom:   urd?.nom ?? this.selectedUrdId,
          dept:     this.derivedDept,
          email:    profile.email,
          phone:    profile.telephone,
        });
        this.fermer.emit();
      },
      error: (err) => {
        this.loading  = false;
        this.errorMsg = err?.error?.message ?? 'Erreur lors de la création du compte.';
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstitutionData, ALL_INSTITUTIONS } from '../institutions.component';
import { CreerSuperviseurModalComponent, CompteCreeData } from '../../utilisateurs/creer-superviseur-modal/creer-superviseur-modal.component';

type DrawerTab = 'overview' | 'perimetre' | 'equipe' | 'infrastructures' | 'performance' | 'documents' | 'compte' | 'communes' | 'caepa';

interface Pouvoir { label: string; ok: boolean; note: string; cls: 'green' | 'amber' | 'red'; }
interface Quota   { label: string; current: number; max: number; unit: string; pct: number; cls: string; }

@Component({
  selector: 'app-detail-institution-drawer',
  standalone: true,
  imports: [CommonModule, CreerSuperviseurModalComponent],
  templateUrl: './detail-institution-drawer.component.html',
  styleUrls: ['./detail-institution-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailInstitutionDrawerComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() institution: InstitutionData | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() fermer = new EventEmitter<void>(); // backward compat

  readonly activeTab           = signal<DrawerTab>('overview');
  readonly showCreerSuperviseur = signal(false);
  readonly createdSuperviseur  = signal<CompteCreeData | null>(null);
  readonly showToast           = signal(false);
  private toastTimer?: ReturnType<typeof setTimeout>;

  get isUrd(): boolean { return this.institution?.type === 'urd'; }

  get isADeployer(): boolean {
    if (this.createdSuperviseur()) return false;
    return this.institution?.statut === 'adeployer';
  }

  get superviseurData(): { nom: string; username: string; initiales: string; cls: string; email: string } {
    const s = this.createdSuperviseur();
    if (s) return { nom: s.nom, username: s.username, initiales: s.initiales, cls: 'blue', email: s.username + '@dinepa.gouv.ht' };
    const sigle = this.institution?.sigle?.toLowerCase() ?? '';
    const username = sigle.replace('orepa-', 'sup.');
    return {
      nom: this.institution?.responsable ?? '',
      username,
      initiales: this.institution?.responsableInitiales ?? '',
      cls: this.institution?.responsableCls ?? 'blue',
      email: username + '@dinepa.gouv.ht',
    };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['institution']) {
      this.activeTab.set('overview');
      this.createdSuperviseur.set(null);
      this.showToast.set(false);
    }
  }

  ngOnDestroy(): void { clearTimeout(this.toastTimer); }

  onCompteCree(data: CompteCreeData): void {
    this.showCreerSuperviseur.set(false);
    this.createdSuperviseur.set(data);
    if (this.institution) {
      this.institution.statut = 'active';
      this.institution.responsable = data.nom;
      this.institution.responsableInitiales = data.initiales;
      this.institution.responsableCls = 'blue';
    }
    clearTimeout(this.toastTimer);
    this.showToast.set(true);
    this.toastTimer = setTimeout(() => { this.showToast.set(false); }, 5000);
  }

  readonly GENERAL_TABS: { id: DrawerTab; label: string; badge?: string; badgeCls?: string }[] = [
    { id: 'overview',        label: "Vue d'ensemble"  },
    { id: 'perimetre',       label: 'Périmètre',       badge: '2/20', badgeCls: 'green' },
    { id: 'equipe',          label: 'Équipe',           badge: '18',   badgeCls: 'blue'  },
    { id: 'infrastructures', label: 'Infrastructures',  badge: '47',   badgeCls: 'gray'  },
    { id: 'performance',     label: 'Performance'       },
    { id: 'documents',       label: 'Documents',        badge: '!',    badgeCls: 'amber' },
  ];

  get tabs(): { id: DrawerTab; label: string; badge?: string; badgeCls?: string }[] {
    if (this.isUrd) {
      return [
        { id: 'overview', label: "Vue d'ensemble" },
        { id: 'compte',   label: 'Compte superviseur', badge: this.isADeployer ? '!' : undefined, badgeCls: 'amber' },
        { id: 'communes', label: 'Communes', badge: this.institution ? String(this.institution.communes) : undefined, badgeCls: 'gray' },
        { id: 'caepa',    label: 'CAEPA rattachés' },
      ];
    }
    return this.GENERAL_TABS;
  }

  readonly POUVOIRS: Pouvoir[] = [
    { label: 'Gérer infrastructures',  ok: true,  note: 'Créer, modifier, archiver dans son périmètre', cls: 'green' },
    { label: 'Inviter utilisateurs',    ok: true,  note: 'Quota : 18/50 utilisateurs utilisés',          cls: 'green' },
    { label: 'Configurer SLA locaux',   ok: true,  note: 'Sous validation DINEPA national',              cls: 'green' },
    { label: 'Valider interventions',   ok: true,  note: 'Seuil au-delà de 50 000 HTG = validation DINEPA', cls: 'amber' },
    { label: 'Générer rapports',        ok: true,  note: 'Mensuels OREPA + trimestriels DINEPA',          cls: 'green' },
    { label: 'Modifier territoire',     ok: false, note: 'Réservé Super Admin DINEPA',                   cls: 'red'   },
  ];

  readonly QUOTAS: Quota[] = [
    { label: 'Utilisateurs', current: 18,  max: 50,   unit: '',    pct: 36, cls: 'green' },
    { label: 'Capteurs IoT', current: 20,  max: 30,   unit: '',    pct: 66, cls: 'amber' },
    { label: 'Stockage',     current: 12,  max: 200,  unit: ' Go', pct: 6,  cls: 'green' },
    { label: 'SMS/mois',     current: 847, max: 1000, unit: '',    pct: 84, cls: 'amber' },
  ];

  readonly COMMUNES_ACTIVES   = ['Léogâne (active)', 'Petit-Goâve (active)'];
  readonly COMMUNES_INACTIVES = ['Port-au-Prince', 'Carrefour', 'Delmas', 'Pétion-Ville', 'Croix-des-Bouquets', 'Cabaret'];

  readonly LIAISONS = [
    { label: 'DINEPA (parent)',          cls: 'violet', icon: 'up'        },
    { label: '2 municipalités',          cls: 'green',  icon: 'down'      },
    { label: '20 capteurs IoT',          cls: 'gray',   icon: 'sensor'    },
    { label: '47 infrastructures',       cls: 'gray',   icon: 'building'  },
    { label: '2 alertes en cours',       cls: 'gray',   icon: 'alert'     },
    { label: '8 interventions/mois',     cls: 'gray',   icon: 'tool'      },
    { label: '3 rapports DINEPA',        cls: 'gray',   icon: 'doc'       },
    { label: 'Helvetas (partenaire)',    cls: 'gray',   icon: 'handshake' },
  ];

  get allInstitutions(): InstitutionData[] { return ALL_INSTITUTIONS; }
  get totalCount(): number { return ALL_INSTITUTIONS.length; }
  get currentIndex(): number { return this.institution ? this.institution.index : 1; }

  navigateTo(idx: number): void {
    const inst = ALL_INSTITUTIONS.find(i => i.index === idx);
    if (inst) { /* emit with the new institution — parent will update the input */ }
  }

  inviterUtilisateur(): void  { alert('Ouverture du drawer Inviter un utilisateur…'); }
  modifier(): void            { alert('Modification de l\'institution en cours…'); }
  deleguerPouvoirs(): void    { alert('Délégation de pouvoirs — module en préparation'); }
  etendrePerimetre(): void    { alert('Extension du périmètre territorial — module en préparation'); }
  exporterFiche(): void       { alert('Export de la fiche institution en PDF…'); }
  initierRenouvellement(): void { alert('Initiation du renouvellement de la convention DINEPA…'); }
  voirTousUtilisateurs(): void  { alert('Navigation vers l\'onglet Équipe…'); this.activeTab.set('equipe'); }
  voirDoc(): void { alert('Ouverture de la documentation…'); }
}

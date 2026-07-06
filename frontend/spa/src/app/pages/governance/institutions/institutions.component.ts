import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GovShellComponent } from '../shared/gov-shell.component';
import { DetailInstitutionDrawerComponent } from './detail-institution-drawer/detail-institution-drawer.component';
import { NouvelleInstitutionModalComponent } from './nouvelle-institution-modal/nouvelle-institution-modal.component';
import { InstitutionsStore } from '../../../institutions.store';

export type InstitutionType =
  | 'dinepa' | 'urd' | 'tepac'
  | 'municipalite' | 'caepa' | 'ong' | 'bailleur' | 'operateur';

type MainFilter = 'tout' | 'national' | 'urd' | 'deploye' | 'adeployer';

export interface InstitutionData {
  id: string; code: string; nom: string; sigle: string;
  type: InstitutionType; typeCls: string; typeLabel: string;
  statut: 'active' | 'adeployer';
  city: string; dept?: string;
  communes: number; activesCommunes: number;
  tepacCount?: number;
  users: number; sla: number; conformite: number;
  responsable: string; responsableInitiales: string; responsableCls: string;
  parentId?: string;
  index: number;
}

// ── Données canoniques ────────────────────────────────────────────
// communes par URD : 20+19+15+12+18+13+10+11+12+12 = 142 (référentiel DINEPA)

export const ALL_INSTITUTIONS: InstitutionData[] = [
  // ── Niveau national ────────────────────────────────────────────
  {
    id:'dinepa', code:'INST-DINEPA-01', nom:'DINEPA', sigle:'DINEPA',
    type:'dinepa', typeCls:'violet', typeLabel:'National',
    statut:'active', city:'Port-au-Prince',
    communes:142, activesCommunes:8, tepacCount:0,
    users:4, sla:100, conformite:100,
    responsable:'Directeur National', responsableInitiales:'DN', responsableCls:'violet',
    index:1,
  },

  // ── 10 URD (une par département) ────────────────────────────────
  {
    id:'urd-ouest', code:'INST-URD-OUEST-01', nom:'URD Ouest', sigle:'URD-OUEST',
    type:'urd', typeCls:'blue', typeLabel:'URD',
    statut:'active', city:'Port-au-Prince', dept:'Ouest',
    communes:20, activesCommunes:2, tepacCount:7,
    users:18, sla:92, conformite:92,
    responsable:'Maria Romain', responsableInitiales:'MR', responsableCls:'green',
    parentId:'dinepa', index:2,
  },
  {
    id:'urd-nord', code:'INST-URD-NORD-01', nom:'URD Nord', sigle:'URD-NORD',
    type:'urd', typeCls:'blue', typeLabel:'URD',
    statut:'active', city:'Cap-Haïtien', dept:'Nord',
    communes:19, activesCommunes:1, tepacCount:3,
    users:5, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:3,
  },
  {
    id:'urd-sudest', code:'INST-URD-SUDEST-01', nom:'URD Sud-Est', sigle:'URD-SUDEST',
    type:'urd', typeCls:'blue', typeLabel:'URD',
    statut:'active', city:'Jacmel', dept:'Sud-Est',
    communes:12, activesCommunes:1, tepacCount:2,
    users:3, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:4,
  },
  {
    id:'urd-artibo', code:'INST-URD-ARTIBO-01', nom:'URD Artibonite', sigle:'URD-ARTIBO',
    type:'urd', typeCls:'gray', typeLabel:'URD',
    statut:'adeployer', city:'Gonaïves', dept:'Artibonite',
    communes:15, activesCommunes:0, tepacCount:0,
    users:0, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:5,
  },
  {
    id:'urd-centre', code:'INST-URD-CENTRE-01', nom:'URD Centre', sigle:'URD-CENTRE',
    type:'urd', typeCls:'gray', typeLabel:'URD',
    statut:'adeployer', city:'Hinche', dept:'Centre',
    communes:12, activesCommunes:0, tepacCount:0,
    users:0, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:6,
  },
  {
    id:'urd-sud', code:'INST-URD-SUD-01', nom:'URD Sud', sigle:'URD-SUD',
    type:'urd', typeCls:'gray', typeLabel:'URD',
    statut:'adeployer', city:'Les Cayes', dept:'Sud',
    communes:18, activesCommunes:0, tepacCount:0,
    users:0, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:7,
  },
  {
    id:'urd-nordest', code:'INST-URD-NORDEST-01', nom:'URD Nord-Est', sigle:'URD-NORDEST',
    type:'urd', typeCls:'gray', typeLabel:'URD',
    statut:'adeployer', city:'Fort-Liberté', dept:'Nord-Est',
    communes:13, activesCommunes:0, tepacCount:0,
    users:0, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:8,
  },
  {
    id:'urd-nordouest', code:'INST-URD-NORDOUEST-01', nom:'URD Nord-Ouest', sigle:'URD-NORDOUEST',
    type:'urd', typeCls:'gray', typeLabel:'URD',
    statut:'adeployer', city:'Port-de-Paix', dept:'Nord-Ouest',
    communes:10, activesCommunes:0, tepacCount:0,
    users:0, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:9,
  },
  {
    id:'urd-nippes', code:'INST-URD-NIPPES-01', nom:'URD Nippes', sigle:'URD-NIPPES',
    type:'urd', typeCls:'gray', typeLabel:'URD',
    statut:'adeployer', city:'Miragoâne', dept:'Nippes',
    communes:11, activesCommunes:0, tepacCount:0,
    users:0, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:10,
  },
  {
    id:'urd-grandanse', code:'INST-URD-GRANDANSE-01', nom:"URD Grand'Anse", sigle:'URD-GRANDANSE',
    type:'urd', typeCls:'gray', typeLabel:'URD',
    statut:'adeployer', city:'Jérémie', dept:"Grand'Anse",
    communes:12, activesCommunes:0, tepacCount:0,
    users:0, sla:0, conformite:0,
    responsable:'À désigner', responsableInitiales:'?', responsableCls:'gray',
    parentId:'dinepa', index:11,
  },

  // ── Acteurs communaux / partenaires (zone_acteur) ────────────────
  {
    id:'caepa-dessources', code:'INST-CAEPA-DESS-01', nom:'CAEPA Dessources', sigle:'CAEPA-DESS',
    type:'caepa', typeCls:'amber', typeLabel:'CAEPA',
    statut:'active', city:'Léogâne · 1ère section',
    communes:1, activesCommunes:1, users:8, sla:0, conformite:0,
    responsable:'Pierre Joseph', responsableInitiales:'PJ', responsableCls:'amber',
    parentId:'urd-ouest', index:12,
  },
  {
    id:'mun-leogane', code:'INST-MUN-LEOGANE-01', nom:'Mairie de Léogâne', sigle:'MUN-LEOGANE',
    type:'municipalite', typeCls:'green', typeLabel:'Municipalité',
    statut:'active', city:'Léogâne',
    communes:13, activesCommunes:2, users:8, sla:95, conformite:95,
    responsable:'Pierre Joseph', responsableInitiales:'PJ', responsableCls:'green',
    parentId:'urd-ouest', index:13,
  },
  {
    id:'mun-petitgoave', code:'INST-MUN-PETITGOAVE-01', nom:'Mairie de Petit-Goâve', sigle:'MUN-PETITGOAVE',
    type:'municipalite', typeCls:'green', typeLabel:'Municipalité',
    statut:'active', city:'Petit-Goâve',
    communes:12, activesCommunes:1, users:5, sla:88, conformite:88,
    responsable:'Jean-Marc Beaubrun', responsableInitiales:'JB', responsableCls:'green',
    parentId:'urd-ouest', index:14,
  },
  {
    id:'ong-helvetas', code:'INST-ONG-HEL-01', nom:'Helvetas Haïti', sigle:'HELVETAS',
    type:'ong', typeCls:'blue', typeLabel:'ONG',
    statut:'active', city:'National',
    communes:0, activesCommunes:0, users:2, sla:0, conformite:0,
    responsable:'Représentant', responsableInitiales:'RH', responsableCls:'blue',
    index:15,
  },
  {
    id:'bailleur-usaid', code:'INST-BAILLEUR-USAID-01', nom:'USAID', sigle:'USAID',
    type:'bailleur', typeCls:'green', typeLabel:'Bailleur',
    statut:'active', city:'National',
    communes:0, activesCommunes:0, users:1, sla:0, conformite:0,
    responsable:'Representative', responsableInitiales:'US', responsableCls:'green',
    index:16,
  },
  {
    id:'op-aqua-ht', code:'INST-OP-AQUA-01', nom:'Aqua-HT', sigle:'AQUA-HT',
    type:'operateur', typeCls:'amber', typeLabel:'Opérateur privé',
    statut:'active', city:'Léogâne',
    communes:0, activesCommunes:0, users:2, sla:0, conformite:0,
    responsable:'Directeur', responsableInitiales:'DI', responsableCls:'amber',
    parentId:'urd-ouest', index:17,
  },
];

const URD_LIST  = ALL_INSTITUTIONS.filter(i => i.type === 'urd');
const DINEPA_INST = ALL_INSTITUTIONS.find(i => i.type === 'dinepa')!;

const FILTERS: { id: MainFilter; label: string; count: number }[] = [
  { id: 'tout',       label: 'Tout',          count: 11 },
  { id: 'national',   label: 'National',       count: 1  },
  { id: 'urd',        label: 'URD',            count: 10 },
  { id: 'deploye',    label: 'Déployées',      count: URD_LIST.filter(u => u.statut === 'active').length },
  { id: 'adeployer',  label: 'À déployer',     count: URD_LIST.filter(u => u.statut === 'adeployer').length },
];

@Component({
  selector: 'app-institutions',
  standalone: true,
  imports: [CommonModule, FormsModule, GovShellComponent, DetailInstitutionDrawerComponent, NouvelleInstitutionModalComponent],
  templateUrl: './institutions.component.html',
  styleUrls: ['./institutions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstitutionsComponent {
  readonly mainFilter   = signal<MainFilter>('tout');
  readonly showDetail   = signal(false);
  readonly detailInst   = signal<InstitutionData | null>(null);
  readonly showNouvelle = signal(false);

  readonly filters = FILTERS;

  // Source réactive : responsables dérivés du UserRegistry via le store.
  private readonly urdAll = computed(() => this.store.list().filter(i => i.type === 'urd'));

  // DINEPA lue depuis le store (getter → suit le signal lors du rendu).
  get dinepa(): InstitutionData {
    return this.store.list().find(i => i.type === 'dinepa') ?? DINEPA_INST;
  }

  readonly filteredList = computed((): InstitutionData[] => {
    const dinepa = this.dinepa;
    const urds   = this.urdAll();
    switch (this.mainFilter()) {
      case 'national':  return [dinepa];
      case 'urd':       return urds;
      case 'deploye':   return urds.filter(u => u.statut === 'active');
      case 'adeployer': return urds.filter(u => u.statut === 'adeployer');
      default:          return [dinepa, ...urds];
    }
  });

  readonly showDinepa = computed(() =>
    this.mainFilter() === 'tout' || this.mainFilter() === 'national'
  );

  readonly showUrds = computed(() =>
    this.mainFilter() !== 'national'
  );

  readonly urdList = computed(() => {
    const f = this.mainFilter();
    const urds = this.urdAll();
    if (f === 'deploye')   return urds.filter(u => u.statut === 'active');
    if (f === 'adeployer') return urds.filter(u => u.statut === 'adeployer');
    return urds;
  });

  constructor(private router: Router, private store: InstitutionsStore) {}

  openDetail(inst: InstitutionData): void {
    if (inst.type === 'urd') {
      this.router.navigate(['/admin/governance/institutions/urd', inst.id]);
      return;
    }
    this.detailInst.set(inst);
    this.showDetail.set(true);
  }

  deployer(urd: InstitutionData): void { this.openDetail(urd); }

  importer(): void { alert('Import CSV / Excel — module en préparation'); }
  exporter(): void { alert('Export de la hiérarchie institutionnelle en cours…'); }

  // Kept for backward compatibility with InstitutionsStore
  get allInstitutions(): InstitutionData[] { return ALL_INSTITUTIONS; }
}

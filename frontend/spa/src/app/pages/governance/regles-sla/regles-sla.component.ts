import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GovShellComponent } from '../shared/gov-shell.component';
import { CreerRegleModalComponent } from './creer-regle-modal/creer-regle-modal.component';
import { SharedDrawersService } from '../../../shared/shared-drawers.service';

type SlaTab = 'liste' | 'matrice' | 'seuils' | 'workflow' | 'escalades';

interface RegleItem {
  code: string; iconCls: string; categorie: string; catCls: string;
  nom: string; desc: string;
  declencheur: string; declencheurCls: string;
  sla: string; perimetre: string; declenchee: string;
  statut: 'active' | 'brouillon'; isNew?: boolean;
}

const REGLES_LIST: RegleItem[] = [
  { code:'SLA-PRES-RUR-001', iconCls:'clock',  categorie:'SLA',      catCls:'blue',
    nom:'Pression critique zones rurales',      desc:'Délai réduit pour capteurs en zone rurale à faible débit',
    declencheur:'Pression < 1.0 bar',           declencheurCls:'amber',
    sla:'2h critique · 4h haute',               perimetre:'Dessources, Petite Rivière',
    declenchee:'3 fois ce mois',                statut:'active', isNew:true },
  { code:'SLA-COUP-001',     iconCls:'clock',  categorie:'SLA',      catCls:'blue',
    nom:'Coupure totale eau',                   desc:'Résolution prioritaire de toute interruption de distribution',
    declencheur:'Débit = 0 L/min',              declencheurCls:'red',
    sla:'2h critique · 4h haute',               perimetre:'Toutes zones',
    declenchee:'8 fois ce mois',                statut:'active' },
  { code:'SEUIL-QA-007',    iconCls:'gauge',  categorie:'Seuil',    catCls:'amber',
    nom:'Qualité eau pH anormal',               desc:"Détection d'anomalie pH ou turbidité hors normes OMS",
    declencheur:'pH < 6.5 ou > 8.5',            declencheurCls:'red',
    sla:'1h critique',                          perimetre:'Réseau national',
    declenchee:'2 fois ce mois',                statut:'active' },
  { code:'WF-INTV-STD',     iconCls:'flow',   categorie:'Workflow', catCls:'green',
    nom:'Workflow intervention standard',        desc:'Séquence complète 8 étapes pour toute intervention terrain',
    declencheur:'Toute intervention',            declencheurCls:'blue',
    sla:'N/A — flux process',                   perimetre:'Toutes zones',
    declenchee:'12 interventions',              statut:'active' },
  { code:'ESC-CRIT-001',    iconCls:'alert',  categorie:'Escalade', catCls:'red',
    nom:'Escalade urgences nocturnes',           desc:'Notification SMS + appel technicien de garde (22h–6h)',
    declencheur:'22h–6h + critique',             declencheurCls:'gray',
    sla:'15 min notif',                         perimetre:'Réseau national',
    declenchee:'Activée',                       statut:'active' },
];

interface SlaRow {
  type: string; desc: string;
  critique: { val: string; ok: string; cls: string; };
  haute: { val: string; ok: string; };
  moyenne: { val: string; ok: string; };
  basse: { val: string; ok: string; };
  perf: string; perfCls: string;
}

const SLA_ROWS: SlaRow[] = [
  { type:"Coupure totale d'eau",    desc:"aucune distribution dans la zone",
    critique:{val:"2h",  ok:"8/8",   cls:"red-bg"},  haute:{val:"4h",  ok:"12/14"}, moyenne:{val:"8h",  ok:"5/5"},  basse:{val:"24h", ok:"2/2"},  perf:"93%", perfCls:"green" },
  { type:"Pression faible",         desc:"pression sous le seuil critique",
    critique:{val:"4h",  ok:"6/7",   cls:""},         haute:{val:"8h",  ok:"9/10"},  moyenne:{val:"24h", ok:"14/15"},basse:{val:"72h", ok:"3/3"},  perf:"89%", perfCls:"amber" },
  { type:"Qualité eau dégradée",    desc:"pH · turbidité · chlore hors normes",
    critique:{val:"1h",  ok:"urgence",cls:"red-bdr"}, haute:{val:"2h",  ok:"3/3"},   moyenne:{val:"6h",  ok:"2/2"},  basse:{val:"24h", ok:"1/1"},  perf:"100%",perfCls:"green" },
  { type:"Capteur hors service",    desc:"aucune transmission · panne",
    critique:{val:"24h", ok:"4/5",   cls:""},         haute:{val:"48h", ok:"8/8"},   moyenne:{val:"72h", ok:"6/6"},  basse:{val:"7j",  ok:"4/4"},  perf:"96%", perfCls:"green" },
  { type:"Fuite détectée",          desc:"corrélation pression + débit",
    critique:{val:"3h",  ok:"2/2",   cls:""},         haute:{val:"6h",  ok:"5/6"},   moyenne:{val:"12h", ok:"3/3"},  basse:{val:"48h", ok:"1/1"},  perf:"92%", perfCls:"green" },
];

const WORKFLOW_STEPS = [
  { num:1, label:'Planifiée',           sub:'création auto depuis alerte',          tag:'AUTO', tagCls:'green',  done:true  },
  { num:2, label:'Acceptée',            sub:'technicien accepte la tâche',          tag:'TECH', tagCls:'amber',  done:true  },
  { num:3, label:'En route',            sub:'GPS technicien activé',                tag:'TECH', tagCls:'amber',  done:true  },
  { num:4, label:'Sur site · en cours', sub:'diagnostic · réparation · test',       tag:'3 étapes', tagCls:'amber', done:false, current:true },
  { num:5, label:'Test capteur',        sub:'vérification mesure post-intervention', tag:'IoT',  tagCls:'gray',   done:false },
  { num:6, label:'Validation dispatcher',sub:'contrôle qualité de l\'intervention', tag:'DISP', tagCls:'blue',   done:false },
  { num:7, label:'PV intervention',     sub:'PDF généré · photos · signatures',      tag:'AUTO', tagCls:'gray',   done:false },
  { num:8, label:'Clôturée',            sub:'alerte fermée · rapport au registre',   tag:'AUTO', tagCls:'green',  done:false },
];

@Component({
  selector: 'app-regles-sla',
  standalone: true,
  imports: [CommonModule, GovShellComponent, CreerRegleModalComponent],
  templateUrl: './regles-sla.component.html',
  styleUrls: ['./regles-sla.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReglesSlaComponent implements OnDestroy {
  private readonly drawers = inject(SharedDrawersService);

  readonly activeTab         = signal<SlaTab>('matrice');
  readonly showCreerRegleModal = signal(false);
  readonly slaRows           = SLA_ROWS;
  readonly workflowSteps     = WORKFLOW_STEPS;

  // toast
  readonly showToast = signal(false);
  readonly toastCode = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // list filters
  readonly listSearch = signal('');
  readonly listCat    = signal('');

  readonly filteredRegles = computed(() => {
    const q   = this.listSearch().toLowerCase();
    const cat = this.listCat();
    return REGLES_LIST.filter(r =>
      (!cat || r.categorie === cat) &&
      (!q   || r.nom.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
    );
  });

  readonly TABS: { id: SlaTab; label: string }[] = [
    { id:'liste',     label:'Toutes les règles' },
    { id:'matrice',   label:'Matrice SLA'       },
    { id:'seuils',    label:"Seuils d'alerte"   },
    { id:'workflow',  label:'Workflow'           },
    { id:'escalades', label:'Escalades'          },
  ];

  constructor() {
    effect(() => {
      const code = this.drawers.lastCreatedRuleCode();
      if (code) {
        this.toastCode.set(code);
        this.showToast.set(true);
        this.activeTab.set('liste');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.dismissToast(), 6000);
      }
    });
  }

  ngOnDestroy(): void { clearTimeout(this.toastTimer); }

  dismissToast(): void {
    this.showToast.set(false);
    this.drawers.clearLastCreatedRule();
  }
}

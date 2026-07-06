import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ContentItem { id: string; label: string; checked: boolean; }
interface PdfSection  { id: string; label: string; checked: boolean; }

@Component({
  selector: 'app-exporter-rapport-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exporter-rapport-modal.component.html',
  styleUrls: ['./exporter-rapport-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExporterRapportModalComponent implements OnChanges {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();

  readonly phase       = signal<'config' | 'generating' | 'done'>('config');
  readonly genProgress = signal(0);
  readonly genStep     = signal(0);
  private genInterval?: ReturnType<typeof setInterval>;

  readonly GEN_STEPS = [
    'Collecte des données (1 247 enregistrements)',
    'Génération graphiques et tableaux',
    'Mise en page PDF',
    'Signature numérique + QR code',
    'Chiffrement et préparation du téléchargement',
  ];

  readonly RECENT_EXPORTS = [
    { nom: 'rapport-gouvernance-2026-05-14.pdf', size: '2.4 Mo',  date: 'À l\'instant',  icon: 'pdf',  isNew: true  },
    { nom: 'rapport-dinepa-avril-2026.pdf',      size: '2.8 Mo',  date: '14/04',         icon: 'pdf',  isNew: false },
    { nom: 'capteurs-leogane-export.xlsx',       size: '412 Ko',  date: '10/04',         icon: 'xlsx', isNew: false },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && changes['visible'].currentValue === false) {
      clearInterval(this.genInterval);
      this.phase.set('config');
      this.genProgress.set(0);
      this.genStep.set(0);
    }
  }

  readonly Math = Math;

  readonly format   = signal<'pdf'|'excel'|'csv'|'json'>('pdf');
  readonly periode  = signal<'7j'|'30j'|'trim'|'annee'>('30j');
  readonly destination = signal<'download'|'email'|'dinepa'>('download');

  emailDest = 'admin@dinepa.gouv.ht';
  includeAnonymisation = signal(false);
  includeSignature     = signal(true);

  contents: ContentItem[] = [
    { id: 'kpi',         label: 'KPIs opérationnels & tableaux de bord',   checked: true  },
    { id: 'alertes',     label: 'Journal des alertes & incidents',          checked: true  },
    { id: 'sla',         label: 'Conformité SLA — matrice de performance', checked: true  },
    { id: 'inventaire',  label: 'Inventaire des infrastructures',           checked: false },
    { id: 'interventions',label: 'Rapport d\'interventions terrain',        checked: true  },
    { id: 'qualite',     label: 'Qualité de l\'eau — mesures IoT',          checked: false },
  ];

  pdfSections: PdfSection[] = [
    { id: 'resume',      label: 'Résumé exécutif',               checked: true  },
    { id: 'cartographie',label: 'Cartographie des zones',         checked: true  },
    { id: 'graphiques',  label: 'Graphiques & évolutions',        checked: true  },
    { id: 'nonconf',     label: 'Non-conformités détaillées',     checked: true  },
    { id: 'recomm',      label: 'Recommandations',                checked: false },
    { id: 'annexes',     label: 'Annexes & données brutes',       checked: false },
    { id: 'signature',   label: 'Page de signatures',             checked: true  },
    { id: 'audit',       label: 'Piste d\'audit DINEPA',          checked: false },
  ];

  readonly PERIODE_OPTIONS: { id: '7j'|'30j'|'trim'|'annee'; label: string }[] = [
    { id: '7j',    label: '7 derniers jours'   },
    { id: '30j',   label: '30 derniers jours'  },
    { id: 'trim',  label: 'Trimestre en cours' },
    { id: 'annee', label: 'Année 2026'         },
  ];

  readonly FORMAT_OPTIONS: { id: 'pdf'|'excel'|'csv'|'json'; label: string; sub: string; icon: string }[] = [
    { id: 'pdf',   label: 'PDF',   sub: 'Rapport mis en forme', icon: '📄' },
    { id: 'excel', label: 'Excel', sub: 'Tableaux & données',   icon: '📊' },
    { id: 'csv',   label: 'CSV',   sub: 'Données brutes',       icon: '📋' },
    { id: 'json',  label: 'JSON',  sub: 'API / intégration',    icon: '{}' },
  ];

  get selectedCount(): number { return this.contents.filter(c => c.checked).length; }
  get pdfCount(): number      { return this.pdfSections.filter(s => s.checked).length; }

  get periodeLabel(): string {
    const m: Record<string,string> = { '7j':'7 derniers jours', '30j':'30 derniers jours', 'trim':'Trimestre en cours', 'annee':'Année 2026' };
    return m[this.periode()];
  }

  setFormat(f: 'pdf'|'excel'|'csv'|'json'): void { this.format.set(f); }
  setPeriode(p: '7j'|'30j'|'trim'|'annee'): void { this.periode.set(p); }
  setDestination(d: 'download'|'email'|'dinepa'): void { this.destination.set(d); }

  exporter(): void {
    this.phase.set('generating');
    this.genProgress.set(0);
    this.genStep.set(0);

    let progress = 0;
    this.genInterval = setInterval(() => {
      progress += Math.random() * 12 + 6;
      if (progress >= 100) {
        clearInterval(this.genInterval);
        this.genProgress.set(100);
        this.genStep.set(5);
        setTimeout(() => this.phase.set('done'), 500);
      } else {
        this.genProgress.set(Math.round(progress));
        this.genStep.set(
          progress < 20 ? 0 : progress < 40 ? 1 : progress < 60 ? 2 : progress < 80 ? 3 : 4
        );
      }
    }, 350);
  }

  telecharger(): void {
    alert('Téléchargement de rapport-gouvernance-2026-05-14.pdf déclenché');
  }

  previsualiser(): void {
    alert('Prévisualisation du rapport dans le navigateur');
  }

  envoyerEmail(): void {
    alert('Envoi du rapport par email — ' + this.emailDest);
  }

  soumettreA(): void {
    alert('Soumission du rapport au registre DINEPA via API officielle');
  }

  continuerEnArrierePlan(): void {
    this.fermer.emit();
  }

  resetAndClose(): void {
    clearInterval(this.genInterval);
    this.phase.set('config');
    this.genProgress.set(0);
    this.genStep.set(0);
    this.fermer.emit();
  }

  nouvelExport(): void {
    this.phase.set('config');
    this.genProgress.set(0);
    this.genStep.set(0);
  }
}

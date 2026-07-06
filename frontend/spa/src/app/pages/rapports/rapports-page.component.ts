import { ChangeDetectionStrategy, Component, Input, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../ui/toast.service';
import { RapportStateService, filtrerRapports } from './rapport-state.service';
import { RapportPreviewComponent } from './rapport-preview/rapport-preview.component';
import { RapportsFiltersDrawerComponent } from './rapports-filters-drawer/rapports-filters-drawer.component';
import { ReportEntry, ReportType, ReportStatus, FiltresRapport, FILTRES_VIDES_RAPPORT, TYPE_LABELS, STATUS_LABELS, TYPES_URD } from './rapport.types';

@Component({
  selector: 'app-rapports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RapportPreviewComponent,
    RapportsFiltersDrawerComponent,
  ],
  templateUrl: './rapports-page.component.html',
  styleUrls: ['./rapports-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RapportsPageComponent implements OnInit {
  @Input() scope?: { dept: string };

  readonly state = inject(RapportStateService);
  readonly toast = inject(ToastService);

  readonly TYPES: ReportType[]     = ['service', 'alertes', 'interventions', 'infrastructures', 'iot', 'qualite', 'traceabilite', 'executif'];
  readonly STATUTS: ReportStatus[] = ['brouillon', 'genere', 'valide', 'transmis', 'archive', 'echec'];

  readonly TYPE_LABELS   = TYPE_LABELS;
  readonly STATUS_LABELS = STATUS_LABELS;

  /** Types disponibles en mode scopé (exclut les types nationaux-uniquement). */
  readonly typesDisponibles = computed((): ReportType[] =>
    this.scope ? TYPES_URD : this.TYPES
  );

  currentPage = signal(1);
  pageSize    = signal(10);

  // ── Local state (scoped mode) ────────────────────────────────────
  private readonly _sFiltres        = signal<FiltresRapport>({ ...FILTRES_VIDES_RAPPORT });
  private readonly _sCreateOuvert   = signal(false);
  private readonly _sPreviewOuvert  = signal(false);

  // ── Scoped base ─────────────────────────────────────────────────
  private readonly _sBase = computed((): ReportEntry[] => {
    if (!this.scope) return [];
    return this.state.rapports().filter(r => r.departement === this.scope!.dept);
  });

  // ── Unified read computeds ───────────────────────────────────────
  readonly effRapports = computed(() =>
    this.scope ? filtrerRapports(this._sBase(), this._sFiltres()) : this.state.rapportsFiltres()
  );

  readonly effKpis = computed(() => {
    if (!this.scope) return this.state.kpis();
    const r = this._sBase();
    return {
      total:        r.length,
      generesMois:  r.filter(x => x.status === 'genere' || x.status === 'valide').length,
      enAttente:    r.filter(x => x.status === 'brouillon').length,
      transmis:     r.filter(x => x.status === 'transmis').length,
      valides:      r.filter(x => x.status === 'valide').length,
      archives:     r.filter(x => x.status === 'archive').length,
    };
  });

  readonly effFiltres    = computed(() => this.scope ? this._sFiltres()              : this.state.filtres());
  readonly effNbFiltres  = computed(() => this.scope ? countFiltresActifs(this._sFiltres()) : this.state.nombreFiltresActifs());
  readonly effCreateOuvert  = computed(() => this.scope ? this._sCreateOuvert()  : this.state.createOuvert());
  readonly effPreviewOuvert = computed(() => this.scope ? this._sPreviewOuvert() : this.state.previewOuvert());

  /** File de validation : rapports transmis au superviseur, en attente. */
  readonly aValider = computed((): ReportEntry[] =>
    this.scope ? this._sBase().filter(r => r.status === 'transmis') : []
  );

  // ── Unified action methods ───────────────────────────────────────
  ouvrirCreateEff():  void { this.scope ? this._sCreateOuvert.set(true)  : this.state.ouvrirCreate(); }
  fermerCreateEff():  void { this.scope ? this._sCreateOuvert.set(false) : this.state.fermerCreate(); }
  ouvrirPreviewEff(): void { this.scope ? this._sPreviewOuvert.set(true)  : this.state.ouvrirPreview(); }
  fermerPreviewEff(): void { this.scope ? this._sPreviewOuvert.set(false) : this.state.fermerPreview(); }
  ouvrirFiltresEff(): void { if (!this.scope) this.state.ouvrirFiltres(); }
  modifierRechercheEff(q: string): void {
    this.scope
      ? this._sFiltres.update(f => ({ ...f, recherche: q }))
      : this.state.modifierRecherche(q);
  }
  toggleStatutEff(s: ReportStatus): void {
    this.scope
      ? this._sFiltres.update(f => ({ ...f, statuts: f.statuts.includes(s) ? f.statuts.filter(x => x !== s) : [...f.statuts, s] }))
      : this.state.toggleStatut(s);
  }
  toggleTypeEff(t: ReportType): void {
    this.scope
      ? this._sFiltres.update(f => ({ ...f, types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t] }))
      : this.state.toggleType(t);
  }

  createForm = {
    type: '' as ReportType | '',
    scopeType: 'commune' as 'national' | 'departement' | 'commune' | 'section' | 'infrastructure' | 'point',
    zone: 'Léogâne',
    periodPreset: 'month' as 'today' | '7days' | '30days' | 'month' | 'custom',
    dateFrom: '2026-04-01', dateTo: '2026-04-29',
    inclResume: true, inclCarte: true, inclTableaux: true, inclGraphiques: false,
    inclAlertes: true, inclInterventions: true, inclPhotos: false,
    inclIoT: true, inclTrace: false, inclAnnexes: false, inclSignatures: true,
    format: 'pdf' as 'pdf' | 'docx' | 'xlsx',
    sourceInterventionId: '',
  };

  readonly PERIOD_PRESETS = [
    { v: 'today',   l: "Aujourd'hui" },
    { v: '7days',   l: '7 jours' },
    { v: '30days',  l: '30 jours' },
    { v: 'month',   l: 'Mois en cours' },
    { v: 'custom',  l: 'Personnalisée' },
  ] as const;

  readonly templates = [
    { name: 'Modèle institutionnel DINEPA', desc: 'En-tête officiel DINEPA, structure complète, signature.', bg: '#eff6ff', color: '#2563eb' },
    { name: 'Modèle intervention terrain',  desc: 'Tâches, mesures, photos avant/après, signature technicien.', bg: '#f0fdfa', color: '#0d9488' },
    { name: 'Modèle audit interne',          desc: 'Journal actions sensibles, modifications, traçabilité complète.', bg: '#eef2ff', color: '#4f46e5' },
    { name: 'Modèle résumé exécutif',        desc: 'Synthèse courte pour décideurs, 2 pages maximum.', bg: '#fffbeb', color: '#d97706' },
  ];

  ngOnInit(): void {
    if (this.scope?.dept) {
      this.createForm.zone      = `Département ${this.scope.dept}`;
      this.createForm.scopeType = 'departement';
    }
    const donnees = this.state.donneesPreremplies();
    if (!donnees) return;
    this.createForm.type                = donnees.type;
    this.createForm.zone                = donnees.commune || donnees.departement || (this.scope ? `Département ${this.scope.dept}` : 'National');
    this.createForm.sourceInterventionId = donnees.sourceInterventionId;
    this.state.ouvrirCreate();
  }

  // ── Pagination helpers ────────────────────────────────────────────────────
  pagedReports(): ReportEntry[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.effRapports().slice(start, start + +this.pageSize());
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.state.rapportsFiltres().length / +this.pageSize()));
  }

  // ── Create form ───────────────────────────────────────────────────────────
  nextStep(): void  { this.state.avancerEtape(); }
  prevStep(): void  { this.state.reculerEtape(); }

  submitCreate(): void {
    this.state.fermerCreate();
    this.toast.push('success', 'Rapport en cours de génération — vous serez notifié');
  }

  useTemplate(name: string): void {
    this.state.fermerTemplates();
    this.state.ouvrirCreate();
    this.toast.push('info', `Modèle chargé : ${name}`);
  }

  createTypeLabel(): string {
    return this.createForm.type ? (TYPE_LABELS[this.createForm.type] ?? '—') : '—';
  }

  periodLabel(): string {
    const map: Record<string, string> = {
      today: "Aujourd'hui", '7days': '7 derniers jours',
      '30days': '30 derniers jours', month: 'Mois en cours',
      custom: `${this.createForm.dateFrom} – ${this.createForm.dateTo}`,
    };
    return map[this.createForm.periodPreset] ?? '';
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  notifyExportList():    void { this.toast.push('info', 'Export de la liste en cours…'); }
  notifyDownloadPDF():   void { this.toast.push('success', 'Téléchargement PDF en cours…'); }
  notifyDownloadWord():  void { this.toast.push('info', 'Téléchargement Word en cours…'); }
  notifyDownloadExcel(): void { this.toast.push('info', 'Téléchargement Excel en cours…'); }
  notifyEmail():         void { this.toast.push('success', 'Rapport envoyé par email'); }
  notifyDuplicate():     void { this.toast.push('info', 'Rapport dupliqué — brouillon créé'); }
  notifyArchive():       void { this.toast.push('info', 'Rapport archivé'); }
}

function countFiltresActifs(f: FiltresRapport): number {
  return [f.recherche !== '', f.statuts.length > 0, f.types.length > 0,
          f.auteurs.length > 0, f.institutions.length > 0, f.formats.length > 0,
          f.dateFrom !== '', f.dateTo !== ''].filter(Boolean).length;
}

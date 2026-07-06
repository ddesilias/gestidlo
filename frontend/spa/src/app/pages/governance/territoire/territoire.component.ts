import {
  ChangeDetectionStrategy, Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone, computed, signal, inject
} from '@angular/core';
import { DepartementsStore } from '../../../departements.store';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GovShellComponent } from '../shared/gov-shell.component';
import { ZoneRegistreService } from '../../../zone-registre.service';
import { ZoneLiaisonService } from '../../../zone-liaison.service';
import { InfrastructureStore } from '../../../infrastructure.store';
import { InstitutionsStore } from '../../../institutions.store';
import { LienActeurRole } from '../../../zone.models';
import { ZONE_FICHES as FICHES, ZONE_DEPARTMENTS as DEPARTMENTS } from '../../../zone-seed.data';
import { ZoneEtape2Component } from '../liaison/zone-etape2/zone-etape2.component';
import { TepacItem } from '../../../tepac-registry.service';

declare const L: any;

type AccessType = 'Bonne · route' | 'Moyenne · piste' | 'Difficile · chemin';
type TabId = 'overview' | 'liens' | 'actifs' | 'journal';
type MapMode = 'coverage' | 'status' | 'alerts' | 'ouvrages';

interface JournalEntry { date: string; label: string; author: string; type: 'sync'|'add'|'update'|'activate'; }

interface ZoneFiche {
  id: string; code: string; codeIhsi: string;
  nom: string; dept: string; commune: string;
  superficie: number; population: number; foyers: number; densiteHabKm2: number;
  coverageAep: number; continuiteService: number; accessibilite: AccessType; localites: number;
  activeLe?: string;
  resources: number; infras: number; capteurs: number; alertes: number;
  responsable?: string; responsableInitiales?: string;
  caepa?: string; orepa?: string; mairie?: string; tepac?: string;
  responsableTepacId?: string | null;   // lien vers un TEPAC existant (FK), null si commune vacante
  status?: 'deploying' | 'supervised' | 'recensement-en-cours' | 'archivee';
  // Données opérationnelles
  typeSource?: string; debitSourceLs?: number;
  typeReservoir?: string; reservoirM3?: number;
  typeReseau?: string; reseauKm?: number;
  qmj?: number; qpj?: number; horizonRef?: number;
  journal: JournalEntry[];
  lat: number; lon: number;
}
interface SectionNode { id: string; nom: string; ficheId?: string; }
interface CommuneNode {
  id: string; nom: string; active: boolean;
  ficheId?: string; lat: number; lon: number;
  sections: SectionNode[];
}
interface DepartmentNode {
  id: string; nom: string; lat: number; lon: number;
  totalCommunes: number; communes: CommuneNode[];
}

/* Average coverage per dept based on active fiches */
const DEPT_COVERAGE: Record<string,number> = {
  artibonite:38, centre:0, grandanse:0, nippes:0,
  nord:55, nordest:0, nordouest:0,
  ouest:Math.round((62+45+42+12+22)/5),
  sud:0, sudest:78,
};

const STORAGE_KEY = 'gestidlo_territoire_v1';

const OREPA_MAP: Record<string, string> = {
  'Ouest': 'OREPA Ouest',
  'Nord': 'OREPA Nord', 'Nord-Est': 'OREPA Nord', 'Nord-Ouest': 'OREPA Nord',
  'Sud': 'OREPA Sud', 'Nippes': 'OREPA Sud',
  'Sud-Est': 'OREPA Sud-Est', "Grand'Anse": 'OREPA Sud-Est',
  'Artibonite': 'OREPA Artibonite', 'Centre': 'OREPA Artibonite',
};

@Component({
  selector: 'app-territoire',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GovShellComponent, ZoneEtape2Component],
  templateUrl: './territoire.component.html',
  styleUrls: ['./territoire.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerritoireComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terMapEl', { static: false }) terMapRef?: ElementRef<HTMLDivElement>;

  private map: any = null;
  private selMarker: any = null;
  private focusMarker: any = null;
  private activeMarkers: any[] = [];

  /* ── reactive state ─────────────────────────────────────────── */
  // Incrémenté après chaque mutation sur FICHES / DEPARTMENTS pour forcer le re-calcul
  private readonly _v = signal(0);
  private bump(): void { this._v.update(n => n + 1); }

  // Toast
  readonly toastVisible = signal(false);
  readonly toastMsg     = signal('');
  private _toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly search        = signal('');
  readonly filterStatus  = signal<'all'|'active'|'inactive'>('all');
  readonly filterRes     = signal(false);
  readonly filterInfra   = signal(false);
  readonly filterAlerts  = signal(false);
  readonly filterLowCov  = signal(false);
  readonly selectedId    = signal<string>(FICHES[0].id);
  readonly focusedCommune = signal<string | null>(null);   // commune inactive mise au point sur la carte
  readonly expandedDepts = signal<string[]>(['ouest']);
  readonly expandedComms = signal<string[]>(['leogane']);
  readonly showActModal  = signal(false);
  readonly activeTab     = signal<TabId>('overview');
  readonly mapMode       = signal<MapMode>('coverage');
  readonly favIds        = signal<string[]>([]);
  readonly hoveredDept   = signal<string>('');

  /* modal form */
  actStep = 1; actNom = ''; actDept = ''; actCommune = ''; actSection = '';
  actResponsable = ''; actCaepa = ''; actOperateurType = 'CAEPA'; actErr = '';
  /** TEPAC lié à la zone (étape 2) — un lien vers un technicien existant, jamais une création. */
  responsableTepac: TepacItem | null = null;

  /* ── computed ───────────────────────────────────────────────── */
  readonly selectedFiche = computed(() =>
    FICHES.find(f => f.id === this.selectedId()) ?? FICHES[0]
  );

  // ── KPI d'en-tête : lus depuis le STORE PARTAGÉ (DepartementsStore), plus de littéral local.
  // La population desservie (numérateur) est IDENTIQUE à la Vue d'ensemble (test « 2 pages, 113 k »).
  // La couverture affichée est celle du PÉRIMÈTRE (desservie / déployés), volontairement ≠ du national.
  private readonly gov = inject(DepartementsStore);

  readonly kpiActives      = computed(() => this.gov.zonesActivesTotal());
  readonly kpiTotalCommunes = computed(() => this.gov.communesTotal());
  readonly kpiPop          = computed(() => this.gov.populationCiblePerimetre());
  readonly kpiDesservie    = computed(() => this.gov.populationDesservie());
  readonly kpiCovPerimsup  = computed(() => this.gov.couverturePerimetrePct());
  readonly kpiBlancs       = computed(() => this.kpiTotalCommunes() - this.kpiActives());
  readonly kpiCritiques    = computed(() => this.gov.zonesCritiques());

  readonly filteredDepts = computed(() => {
    void this._v();
    const q   = this.search().toLowerCase().trim();
    const fs  = this.filterStatus();
    const fR  = this.filterRes();
    const fI  = this.filterInfra();
    const fA  = this.filterAlerts();
    const fLC = this.filterLowCov();

    return DEPARTMENTS.map(d => {
      const comms = d.communes.filter(c => {
        if (fs === 'active'   && !c.active) return false;
        if (fs === 'inactive' &&  c.active) return false;
        if (q && !c.nom.toLowerCase().includes(q) && !d.nom.toLowerCase().includes(q)) return false;
        if (fR || fI || fA || fLC) {
          if (!c.active) return false;
          const f = FICHES.find(x => x.id === c.ficheId);
          if (!f) return false;
          if (fR  && f.resources === 0)   return false;
          if (fI  && f.infras    === 0)   return false;
          if (fA  && f.alertes   === 0)   return false;
          if (fLC && f.coverageAep >= 30) return false;
        }
        return true;
      });
      return { ...d, communes: comms };
    }).filter(d => d.communes.length > 0 || (q && d.nom.toLowerCase().includes(q)));
  });

  /* filter counts */
  get cntActive()  { return DEPARTMENTS.flatMap(d=>d.communes).filter(c=>c.active).length; }
  get cntInactive(){ return DEPARTMENTS.flatMap(d=>d.communes).filter(c=>!c.active).length; }
  get cntRes()     { return FICHES.filter(f=>f.resources>0).length; }
  get cntInfra()   { return FICHES.filter(f=>f.infras>0).length; }
  get cntAlerts()  { return FICHES.filter(f=>f.alertes>0).length; }
  get cntLowCov()  { return FICHES.filter(f=>f.coverageAep<30).length; }

  readonly allDepts  = DEPARTMENTS;
  readonly deptNames = DEPARTMENTS.map(d => d.nom);

  // ── Liens live ─────────────────────────────────────────────────────

  readonly selectedFicheLiens = computed(() => {
    const f = this.selectedFiche();
    return this.liaisonService.liens()
      .filter(l => l.zoneId === f.id && l.statut === 'actif')
      .map(l => ({ lien: l, infra: this.infraStore.snapshot.find(i => i.id === l.infrastructureId) }))
      .filter(x => !!x.infra) as Array<{ lien: any; infra: any }>;
  });

  readonly selectedActeurLiens = computed(() => {
    const f = this.selectedFiche();
    return this.liaisonService.liensActeur()
      .filter(l => l.zoneId === f.id && l.statut === 'actif')
      .map(l => ({ lien: l, inst: this.instStore.getById(l.institutionId) }))
      .filter(x => !!x.inst) as Array<{ lien: any; inst: any }>;
  });

  // Acteurs disponibles à rattacher (pas encore liés à cette zone)
  readonly acteursDisponibles = computed(() => {
    const f = this.selectedFiche();
    void this.liaisonService.version();
    return this.instStore.snapshot.filter(i => !this.liaisonService.isActeurAttached(f.id, i.id));
  });

  // Form state pour ajouter un acteur
  readonly showAddActeur = signal(false);
  addActeurInstId   = '';
  addActeurRole: LienActeurRole = 'orepa';

  readonly acteurRoles: { value: LienActeurRole; label: string }[] = [
    { value: 'orepa',     label: 'OREPA' },
    { value: 'caepa',     label: 'CAEPA' },
    { value: 'tepac',     label: 'TEPAC' },
    { value: 'mairie',    label: 'Mairie' },
    { value: 'operateur', label: 'Opérateur' },
    { value: 'ong',       label: 'ONG' },
    { value: 'bailleur',  label: 'Bailleur' },
  ];

  constructor(
    private ngZone: NgZone,
    private router: Router,
    private zoneService: ZoneRegistreService,
    private liaisonService: ZoneLiaisonService,
    private infraStore: InfrastructureStore,
    private instStore: InstitutionsStore,
  ) {
    this.zoneService.register(FICHES, DEPARTMENTS);
  }

  naviguerLiaison(zoneId: string): void {
    this.router.navigate(['/admin/governance/zones', zoneId, 'liaison']);
  }

  confirmAddActeur(zoneId: string): void {
    if (!this.addActeurInstId) return;
    this.liaisonService.attachActeur(zoneId, this.addActeurInstId, this.addActeurRole);
    this.zoneService.addJournal(zoneId,
      `Acteur rattaché · ${this.instStore.getById(this.addActeurInstId)?.nom ?? this.addActeurInstId} · rôle ${this.addActeurRole}`
    );
    this.addActeurInstId = '';
    this.showAddActeur.set(false);
  }

  detachActeur(zoneId: string, lienId: string, nomInst: string): void {
    this.liaisonService.detachActeur(lienId);
    this.zoneService.addJournal(zoneId, `Acteur détaché · ${nomInst}`);
  }

  archiveZone(zoneId: string): void {
    this.zoneService.archiveZone(zoneId);
    this.bump();
  }

  ngAfterViewInit(): void { this.initMap(); }

  ngOnDestroy(): void {
    if (this.map) { this.map.remove(); this.map = null; }
    if (this._toastTimer) clearTimeout(this._toastTimer);
  }

  showToast(msg: string, duration = 5000): void {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this.toastMsg.set(msg);
    this.toastVisible.set(true);
    this._toastTimer = setTimeout(() => this.toastVisible.set(false), duration);
  }
  dismissToast(): void {
    this.toastVisible.set(false);
    if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null; }
  }

  // La persistence est désormais gérée par ZoneRegistreService.persistAll()

  private initMap(): void {
    if (!this.terMapRef?.nativeElement || typeof L === 'undefined') return;
    this.map = L.map(this.terMapRef.nativeElement, { zoomControl: false })
                .setView([18.9, -72.7], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 16, attribution: '© OSM · CNIGS'
    }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    for (const d of DEPARTMENTS) {
      for (const c of d.communes) {
        if (!c.active) continue;
        const f = FICHES.find(x => x.id === c.ficheId);
        const alertColor = f && f.alertes > 0 ? '#F87171' : '#34D399';
        const icon = L.divIcon({
          html: `<div style="width:10px;height:10px;border-radius:50%;background:${alertColor};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`,
          className: '', iconSize:[10,10], iconAnchor:[5,5]
        });
        const m = L.marker([c.lat, c.lon], { icon })
          .addTo(this.map)
          .bindTooltip(`${c.nom} · ${d.nom}`, { direction:'top', offset:[0,-4] });
        m.on('click', () => this.ngZone.run(() => {
          if (c.ficheId) this.selectFiche(c.ficheId);
        }));
        this.activeMarkers.push(m);
      }
    }
    this.flyToSelected();
  }

  private flyToSelected(): void {
    if (!this.map) return;
    if (this.selMarker) { this.map.removeLayer(this.selMarker); this.selMarker = null; }
    const f = this.selectedFiche();
    const icon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#A5A4DC;border:2.5px solid #fff;box-shadow:0 0 8px rgba(165,164,220,.6)"></div>`,
      className: '', iconSize:[14,14], iconAnchor:[7,7]
    });
    this.selMarker = L.marker([f.lat, f.lon], { icon }).addTo(this.map);
    this.map.flyTo([f.lat, f.lon], 12, { duration: 0.8 });
  }

  /* ── tree helpers ────────────────────────────────────────────── */
  isDeptExpanded(id: string) { return this.expandedDepts().includes(id); }
  isCommExpanded(id: string) { return this.expandedComms().includes(id); }

  toggleDept(id: string): void {
    this.expandedDepts.update(d => d.includes(id) ? d.filter(x=>x!==id) : [...d, id]);
  }
  toggleComm(id: string): void {
    this.expandedComms.update(d => d.includes(id) ? d.filter(x=>x!==id) : [...d, id]);
  }

  selectFiche(ficheId: string): void {
    this.clearFocusCommune();
    this.selectedId.set(ficheId);
    this.activeTab.set('overview');
    this.flyToSelected();
    const f = FICHES.find(x => x.id === ficheId);
    if (!f) return;
    const dept = DEPARTMENTS.find(d => d.nom === f.dept);
    if (dept) {
      if (!this.isDeptExpanded(dept.id)) this.expandedDepts.update(d => [...d, dept.id]);
      const comm = dept.communes.find(c => c.nom === f.commune);
      if (comm && !this.isCommExpanded(comm.id)) this.expandedComms.update(d => [...d, comm.id]);
    }
  }

  selectSection(s: SectionNode): void { if (s.ficheId) this.selectFiche(s.ficheId); }

  /**
   * Clic sur une commune INACTIVE / non déployée : aucune zone à ouvrir (ex. Saint-Marc en
   * Artibonite, « à déployer »), mais le clic ne doit plus être mort. On donne un RETOUR clair —
   * recadrage carte sur la commune + surbrillance dans l'arbre + message. Pas de fausse zone créée.
   */
  focusCommune(comm: CommuneNode, dept: DepartmentNode): void {
    if (comm.ficheId) { this.selectFiche(comm.ficheId); return; }
    this.focusedCommune.set(comm.id);
    if (this.map && typeof L !== 'undefined') {
      if (this.focusMarker) { this.map.removeLayer(this.focusMarker); this.focusMarker = null; }
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;border-radius:50%;background:#6B7785;border:2px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.5)"></div>`,
        className: '', iconSize: [12, 12], iconAnchor: [6, 6],
      });
      this.focusMarker = L.marker([comm.lat, comm.lon], { icon }).addTo(this.map);
      this.map.flyTo([comm.lat, comm.lon], 11, { duration: 0.7 });
    }
    this.showToast(`${comm.nom} · ${dept.nom} — commune non déployée · aucune zone renseignée dans le périmètre`);
  }

  private clearFocusCommune(): void {
    this.focusedCommune.set(null);
    if (this.focusMarker && this.map) { this.map.removeLayer(this.focusMarker); this.focusMarker = null; }
  }

  isSectionSelected(s: SectionNode): boolean {
    return !!s.ficheId && s.ficheId === this.selectedId();
  }

  nbActiveInDept(d: DepartmentNode): number {
    return d.communes.filter(c => c.active).length;
  }
  nbInactiveHidden(d: DepartmentNode): number {
    return d.totalCommunes - d.communes.length;
  }

  /* ── choropleth helpers ──────────────────────────────────────── */
  deptCoverage(deptId: string): number { return DEPT_COVERAGE[deptId] ?? 0; }

  deptColor(deptId: string): string {
    const cov = this.deptCoverage(deptId);
    if (cov === 0) return 'rgba(148,163,184,0.12)';
    if (cov >= 70) return 'rgba(74,222,128,0.35)';
    if (cov >= 40) return 'rgba(251,191,36,0.30)';
    return 'rgba(251,113,133,0.30)';
  }

  deptStroke(deptId: string): string {
    const cov = this.deptCoverage(deptId);
    const sel = this.selectedFiche();
    const dept = DEPARTMENTS.find(d => d.id === deptId);
    if (dept && sel && dept.nom === sel.dept) return '#60A5FA';
    if (cov === 0) return '#2A3744';
    if (cov >= 70) return '#4ADE80';
    if (cov >= 40) return '#FBBF24';
    return '#FB7185';
  }

  deptStrokeWidth(deptId: string): number {
    const sel = this.selectedFiche();
    const dept = DEPARTMENTS.find(d => d.id === deptId);
    return dept && sel && dept.nom === sel.dept ? 1.4 : 0.7;
  }

  isSelectedDept(deptId: string): boolean {
    const sel = this.selectedFiche();
    const dept = DEPARTMENTS.find(d => d.id === deptId);
    return !!(dept && sel && dept.nom === sel.dept);
  }

  clickDept(deptId: string): void {
    const dept = DEPARTMENTS.find(d => d.id === deptId);
    if (!dept) return;
    const firstActive = dept.communes.find(c => c.active && c.ficheId);
    if (firstActive?.ficheId) {
      this.selectFiche(firstActive.ficheId);
    } else {
      if (!this.isDeptExpanded(deptId)) this.expandedDepts.update(d => [...d, deptId]);
    }
  }

  /* ── utility ─────────────────────────────────────────────────── */
  getFiche(ficheId?: string): ZoneFiche | undefined {
    return ficheId ? FICHES.find(f => f.id === ficheId) : undefined;
  }

  coverageColor(p: number): string {
    return p >= 70 ? '#4ADE80' : p >= 40 ? '#FBBF24' : '#F87171';
  }
  accessColor(a: AccessType): string {
    return a === 'Bonne · route' ? '#34D399' : a === 'Moyenne · piste' ? '#FBBF24' : '#F87171';
  }
  fmtPop(n: number): string {
    return n >= 1_000_000 ? (n/1_000_000).toFixed(1) + ' M'
         : n >= 1000      ? (n/1000).toFixed(n%1000===0?0:1) + ' k'
         : String(n);
  }
  fmtPct(p: number): string { return Math.round(p) + '%'; }

  journalDot(type: JournalEntry['type']): string {
    return type === 'sync' ? '#4ADE80' : type === 'add' ? '#60A5FA'
         : type === 'update' ? '#FBBF24' : '#A78BFA';
  }

  toggleFavorite(id: string): void {
    this.favIds.update(ids => ids.includes(id) ? ids.filter(x=>x!==id) : [...ids, id]);
  }
  isFavorite(id: string): boolean { return this.favIds().includes(id); }

  centerMap(): void { this.flyToSelected(); }

  demarrerRecensement(zoneId?: string): void {
    const id = zoneId ?? this.selectedId();
    if (id) this.router.navigate(['/admin/governance/zones', id, 'recensement']);
  }

  getDeptIdByName(name: string): string {
    return DEPARTMENTS.find(d => d.nom === name)?.id ?? '';
  }

  /* ── modal ───────────────────────────────────────────────────── */
  openModal(): void {
    this.showActModal.set(true);
    this.actStep=1; this.actNom=''; this.actDept=''; this.actCommune=''; this.actSection='';
    this.actResponsable=''; this.actCaepa=''; this.actOperateurType='CAEPA'; this.actErr='';
    this.responsableTepac = null;
  }
  closeModal(): void { this.showActModal.set(false); }

  /** URD dérivée du département (1 URD = 1 département), id réel du registre — pas un slug forgé. */
  get actUrdId(): string {
    return this.instStore.getByType('urd').find(u => u.dept === this.actDept)?.id ?? '';
  }

  /** « + Désigner » sur la carte responsable URD : la désignation vit dans Utilisateurs. */
  designerResponsableUrd(): void {
    this.router.navigate(['/admin/governance/utilisateurs']);
  }

  get modalSections(): string[] {
    const dept = DEPARTMENTS.find(d => d.nom === this.actDept);
    const comm = dept?.communes.find(c => c.nom === this.actCommune);
    return comm?.sections.map(s => s.nom) ?? [];
  }

  get modalOrepa(): string { return OREPA_MAP[this.actDept] ?? ''; }

  get modalCaepaList(): string[] {
    return [...new Set(
      FICHES.filter(f => f.commune === this.actCommune && f.caepa).map(f => f.caepa!)
    )];
  }

  // Toutes les communes du département (active + inactive) — pas de filtre
  get modalCommunes(): string[] {
    const dept = DEPARTMENTS.find(d => d.nom === this.actDept);
    return dept ? dept.communes.map(c => c.nom) : [];
  }

  // État d'une commune active : supervisée / à déployer / aucun
  communeStatus(comm: CommuneNode): 'supervised' | 'deploying' | 'none' {
    if (!comm.active || !comm.ficheId) return 'none';
    const f = FICHES.find(x => x.id === comm.ficheId);
    return (f?.status ?? 'supervised') as 'supervised' | 'deploying';
  }

  // Auto-code zone : TER-{DEPT_5}-{COMM_3}-S{SEQ}
  get actCodePreview(): string {
    if (!this.actDept || !this.actCommune) return '';
    const clean = (s: string) =>
      s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
    const d = clean(this.actDept).substring(0, 5);
    const c = clean(this.actCommune).substring(0, 3);
    const seq = String(FICHES.length + 1).padStart(2, '0');
    return `TER-${d}-${c}-S${seq}`;
  }

  get step1Valid(): boolean {
    return !!this.actNom.trim() && !!this.actDept && !!this.actCommune;
  }

  activerZone(goToRecensement = false): void {
    if (!this.actNom.trim()) { this.actErr = 'Le nom de la zone est requis.'; return; }
    if (!this.actDept || !this.actCommune) { this.actErr = 'Sélectionnez un département et une commune.'; return; }

    const dept = DEPARTMENTS.find(d => d.nom === this.actDept);
    const comm = dept?.communes.find(c => c.nom === this.actCommune);
    if (!comm) { this.actErr = 'Commune introuvable.'; return; }

    const code = this.actCodePreview;
    const newId = 'fz-' + code.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const newFiche: ZoneFiche = {
      id: newId, code, codeIhsi: code,
      nom: this.actNom.trim(), dept: this.actDept, commune: this.actCommune,
      superficie: 0, population: 0, foyers: 0, densiteHabKm2: 0,
      coverageAep: 0, continuiteService: 0, accessibilite: 'Difficile · chemin', localites: 0,
      activeLe: new Date().toLocaleDateString('fr-FR'),
      resources: 0, infras: 0, capteurs: 0, alertes: 0,
      // Gouvernance dérivée à l'étape 2 : on lie un TEPAC existant (pas de création).
      responsable: this.responsableTepac?.nomComplet || undefined,
      tepac: this.responsableTepac?.nomComplet || undefined,
      responsableTepacId: this.responsableTepac?.id ?? null,
      orepa: this.modalOrepa || undefined,
      status: 'deploying',
      journal: [{ date: new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }), label: 'Zone enregistrée dans GEstiDlo', author: 'Admin', type: 'activate' }],
      lat: comm.lat, lon: comm.lon,
    };

    FICHES.push(newFiche);
    comm.active = true;
    comm.ficheId = newId;

    this.zoneService.persistAll();
    this.bump();
    this.closeModal();

    // Auto-expand l'arbre jusqu'à la nouvelle zone et ouvre son panneau
    this.selectFiche(newId);

    // Toast de confirmation avec CTA "Démarrer le recensement"
    this.showToast(`Zone « ${newFiche.nom} » enregistrée · à déployer`);
  }
}

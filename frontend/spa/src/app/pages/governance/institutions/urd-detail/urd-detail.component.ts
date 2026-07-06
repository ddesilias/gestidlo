import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, computed, signal, effect, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GovShellComponent } from '../../shared/gov-shell.component';
import { CreerSuperviseurUrdModalComponent, CompteCreeUrdData } from '../../utilisateurs/creer-superviseur-urd-modal/creer-superviseur-urd-modal.component';
import { InfrastructuresPageComponent } from '../../../infrastructures-page.component';
import { ResourcesPageComponent } from '../../../resources-page.component';
import { ActeursPageComponent } from '../../../acteurs-page.component';
import { TEPAC_MAP } from '../../../../tepac.data';
import { AlertesPageComponent } from '../../../alertes/alertes-page.component';
import { RapportsPageComponent } from '../../../rapports/rapports-page.component';
import { InstitutionsStore } from '../../../../institutions.store';
import { InstitutionData } from '../institutions.component';
import { ZoneFiche } from '../../../../zone.models';
import { ZoneRegistreService } from '../../../../zone-registre.service';
import { AlertStore, GestAlert } from '../../../../alert.store';
import { InterventionStore, Intervention } from '../../../../intervention.store';
import { InfrastructureStore } from '../../../../infrastructure.store';
import { AlerteStateService } from '../../../alertes/alerte-state.service';
import { InterventionStateService, DonneesPreremplies } from '../../../interventions/intervention-state.service';
import { SUGGESTION_PAR_SEVERITE } from '../../../alertes/alerte.types';
import { DEPT_BOUNDS } from '../../../../haiti-geo.service';
import { UserRegistryService } from '../../../../user-registry.service';
import { ActeurStore } from '../../../../acteur.store';
import { DepartementsStore, norm } from '../../../../departements.store';

declare const L: any;

const OPEN_STATUSES = new Set(['ouverte', 'assignee', 'en-cours']);
const ACTIVE_INTERVENTION_STATUSES = new Set(['creee', 'assignee', 'en-cours', 'en-attente']);

export interface AlertWithInter {
  alert: GestAlert;
  intervention?: Intervention;
  sansSuite: boolean;
  slaStatus: 'ok' | 'warning' | 'breach';
  slaLabel: string;
}

export interface CommuneRow {
  nom: string;
  tepac: string;
  zones: ZoneFiche[];
  zonesCount: number;
  coveragePct: number | null;
  alertesOuvertes: AlertWithInter[];
  sansSuiteCount: number;
  sansSuiteAlerts: GestAlert[];
}

type CommuneFilter = 'toutes' | 'sans-tepac' | 'sans-suite';
type DrawerTab = 'zones' | 'alertes';
export type PageTab = 'overview' | 'territoire' | 'infrastructures' | 'ressources' | 'acteurs' | 'equipe' | 'supervision' | 'conformite' | 'journal';

const SEV_WEIGHT: Record<string, number> = { critique: 40, haute: 25, moyenne: 10, basse: 3 };

const MOTIFS_ESCALADE = [
  'Matériel insuffisant sur place',
  'Zone inaccessible — sécurité',
  'Hors compétence technique',
  'Infrastructure hors périmètre TEPAC',
  'Besoin de renfort humain',
];

interface TerritoireScope {
  dept: string;
  communeIds: string[];
  bounds: [[number, number], [number, number]] | null;
}

interface TerritoireTreeNode {
  commune: string;
  zones: ZoneFiche[];
  zoneCount: number;
}

@Component({
  selector: 'app-urd-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, GovShellComponent, CreerSuperviseurUrdModalComponent, InfrastructuresPageComponent, ResourcesPageComponent, ActeursPageComponent, AlertesPageComponent, RapportsPageComponent],
  templateUrl: './urd-detail.component.html',
  styleUrls: ['./urd-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrdDetailComponent implements OnInit, OnDestroy {
  private readonly _urdId = signal<string>('');
  // Dérivé du store (→ UserRegistry persistant) : se met à jour automatiquement
  // quand un superviseur est désigné, et survit au reload.
  readonly urd     = computed<InstitutionData | null>(() => {
    const id = this._urdId();
    return id ? (this.instStore.getById(id) ?? null) : null;
  });
  readonly loading = signal(true);

  readonly activeTab              = signal<PageTab>('overview');
  readonly showCreerSuperviseur   = signal(false);
  readonly communeFilter    = signal<CommuneFilter>('toutes');
  readonly selectedCommune  = signal<CommuneRow | null>(null);
  readonly drawerTab        = signal<DrawerTab>('zones');
  readonly escaladeAlertId  = signal<string | null>(null);
  readonly escaladeMotif    = signal('');
  readonly motifsPredefined = MOTIFS_ESCALADE;

  // ── Territoire tab state ──────────────────────────────────────────
  readonly territoireCommune  = signal<string>('');
  readonly territoireStatuts  = signal(new Set(['actif', 'panne', 'maintenance']));
  readonly treeExpandedComms  = signal(new Set<string>());
  readonly showActiverZone    = signal(false);
  readonly actZoneSuccessMsg  = signal('');

  // Activation form (plain fields — bound via ngModel)
  actZoneNom         = '';
  actZoneCommune     = '';
  actZoneResponsable = '';
  actZoneErr         = '';

  private _terMap: any      = null;
  private _terMarkers: any[] = [];

  readonly pageTabs: { id: PageTab; label: string }[] = [
    { id: 'overview',        label: "Vue d'ensemble" },
    { id: 'territoire',      label: 'Territoire & carte' },
    { id: 'infrastructures', label: 'Infrastructures' },
    { id: 'ressources',      label: 'Ressources' },
    { id: 'acteurs',         label: 'Acteurs' },
    { id: 'equipe',          label: 'Équipe' },
    { id: 'supervision',     label: 'Supervision' },
    { id: 'conformite',      label: 'Conformité & rapports' },
    { id: 'journal',         label: 'Journal' },
  ];

  constructor(
    private route:             ActivatedRoute,
    private router:            Router,
    private instStore:         InstitutionsStore,
    private zoneService:       ZoneRegistreService,
    private alertStore:        AlertStore,
    private interventionStore: InterventionStore,
    private infraStore:        InfrastructureStore,
    private alerteState:       AlerteStateService,
    private intState:          InterventionStateService,
    private ngZone:            NgZone,
    private userRegistry:      UserRegistryService,
    private acteurStore:       ActeurStore,
    private deps:              DepartementsStore,
  ) {
    // Init/destroy Leaflet map when the territoire tab activates or deactivates
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'territoire') {
        setTimeout(() => this.ngZone.run(() => this._initTerritoireMap()));
      } else if (this._terMap) {
        this._destroyTerritoireMap();
      }
    });

    // Refresh markers whenever zones or status filter changes
    effect(() => {
      const zones   = this.territoireZones();
      const statuts = this.territoireStatuts();
      if (this._terMap) {
        this._renderMarkers(zones, statuts);
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('urdId') ?? '';
    this._urdId.set(id);
    this.loading.set(false);
    // Règle « recharger au montage » : le responsable (dérivé du UserRegistry) revient du backend après un reload.
    this.userRegistry.reload();
    // Acteurs live (TEPAC enregistrés via /api/acteurs) → le tableau des communes les affichera.
    this.acteurStore.reload();
    // Escalade auto des communes sans TEPAC — hors du computed pour éviter NG0600
    this.alertStore.checkAndEscalate(commune => !!TEPAC_MAP[commune]);
  }

  // ── Computed: commune table ──────────────────────────────────────

  readonly communeRows = computed((): CommuneRow[] => {
    const urd = this.urd();
    if (!urd?.dept) return [];

    const communeNames = this.zoneService.getCommunesForDept(urd.dept);
    const allAlerts = this.alertStore.snapshot;
    const allInter  = this.interventionStore.snapshot;

    // TEPAC LIVE par commune : les acteurs de type TEPAC réellement enregistrés (backend) dans ce
    // département, indexés par nom de commune NORMALISÉ (« Saint-Marc » = « Saint Marc »). Repli sur
    // TEPAC_MAP (démos seedées) si aucun acteur live. Corrige le « TEPAC : aucun » malgré affectation.
    const deptKey = norm(urd.dept);
    const liveTepacByCommune = new Map<string, string>();
    for (const a of this.acteurStore.items()) {
      if (a.type === 'TEPAC' && a.commune
          && norm(a.departementId ?? '') === deptKey
          && (a.statut ?? '').toLowerCase() !== 'suspendu') {
        liveTepacByCommune.set(norm(a.commune), a.nom);
      }
    }

    const activeInterByAlertId = new Map<string, Intervention>();
    for (const i of allInter) {
      if (i.sourceAlertId && ACTIVE_INTERVENTION_STATUSES.has(i.status)) {
        activeInterByAlertId.set(i.sourceAlertId, i);
      }
    }

    const rows: CommuneRow[] = communeNames.map(nom => {
      const zones = this.zoneService.getZonesByCommune(nom);
      const openAlerts = allAlerts.filter(a => a.commune === nom && OPEN_STATUSES.has(a.status));
      const sansSuiteAlerts = openAlerts.filter(a => !activeInterByAlertId.has(a.id));

      const alertesOuvertes: AlertWithInter[] = openAlerts.map(a => ({
        alert:        a,
        intervention: activeInterByAlertId.get(a.id),
        sansSuite:    !activeInterByAlertId.has(a.id),
        slaStatus:    this.alertStore.slaStatus(a),
        slaLabel:     this.alertStore.slaRemainingLabel(a),
      }));

      const coveragePct = zones.length > 0
        ? Math.round(zones.reduce((s, z) => s + z.coverageAep, 0) / zones.length)
        : null;

      return {
        nom,
        tepac:         liveTepacByCommune.get(norm(nom)) ?? TEPAC_MAP[nom] ?? '',
        zones,
        zonesCount:    zones.length,
        coveragePct,
        alertesOuvertes,
        sansSuiteCount: sansSuiteAlerts.length,
        sansSuiteAlerts,
      };
    });

    rows.sort((a, b) => this.urgencyScore(b) - this.urgencyScore(a));
    return rows;
  });

  readonly filteredRows = computed((): CommuneRow[] => {
    const f = this.communeFilter();
    const rows = this.communeRows();
    if (f === 'sans-tepac') return rows.filter(r => !r.tepac);
    if (f === 'sans-suite') return rows.filter(r => r.sansSuiteCount > 0);
    return rows;
  });

  // ── KPI d'en-tête : lus depuis le DepartementsStore (= zones BACKEND) → la fiche URD raconte la
  //    MÊME histoire que le dashboard ET la page superviseur (même source, même calcul). ────────
  private readonly deptData = computed(() => {
    const u = this.urd();
    return u?.dept ? (this.deps.byNom(u.dept) ?? null) : null;
  });
  readonly kpiCommunesCouvertes = computed(() => { const d = this.deptData(); return d ? this.deps.communesCouvertesDe(d) : 0; });
  readonly kpiTepacAssignes     = computed(() => { const d = this.deptData(); return d ? this.deps.tepacDe(d) : 0; });
  readonly kpiZonesSupervisees  = computed(() => { const d = this.deptData(); return d ? this.deps.zonesActivesDe(d) : 0; });
  readonly statutDerive         = computed<'deployee' | 'en-deploiement' | 'adeployer'>(() => {
    const d = this.deptData();
    return d ? this.deps.statutDe(d) : 'adeployer';
  });
  // Reste local (par commune, table détaillée) — sera migré sur les zones backend au tour suivant.
  readonly kpiCritiques = computed(() =>
    this.communeRows().filter(r => r.coveragePct !== null && r.coveragePct < 40).length
  );

  // ── KPI: operational ────────────────────────────────────────────
  readonly kpiInfrastructures = computed(() => {
    const dept = this.urd()?.dept;
    if (!dept) return 0;
    return this.infraStore.snapshot.filter(i => i.department === dept && i.status !== 'archive').length;
  });

  // % alertes résolues dans le délai SLA sur 30j
  readonly kpiReactivite = computed(() => {
    const dept = this.urd()?.dept;
    if (!dept) return 0;
    const cutoff = new Date(Date.now() - 30 * 24 * 3_600_000);
    const recent = this.alertStore.snapshot.filter(
      a => a.department === dept && new Date(a.createdAt) >= cutoff
    );
    if (recent.length === 0) return 100;
    const treated = recent.filter(a => ['resolue', 'archivee', 'ignoree'].includes(a.status));
    return Math.round((treated.length / recent.length) * 100);
  });

  // interventions terminées en attente de validation URD
  readonly kpiValidations = computed(() => {
    const dept = this.urd()?.dept;
    if (!dept) return 0;
    return this.interventionStore.snapshot.filter(
      i => i.department === dept && i.status === 'terminee'
    ).length;
  });

  // % communes avec TEPAC — utilisé dans onglet conformité
  readonly kpiTepacRatePct = computed(() => {
    const rows = this.communeRows();
    return rows.length > 0 ? Math.round(rows.filter(r => !!r.tepac).length / rows.length * 100) : 0;
  });

  // % communes dont la couverture AEP est ≥ 40%
  readonly kpiCoverageThresholdPct = computed(() => {
    const rows = this.communeRows();
    return rows.length > 0 ? Math.round(rows.filter(r => r.coveragePct !== null && r.coveragePct >= 40).length / rows.length * 100) : 0;
  });

  // score dérivé: moyenne réactivité + couverture TEPAC + communes au seuil
  readonly kpiConformite = computed(() =>
    Math.round((this.kpiReactivite() + this.kpiTepacRatePct() + this.kpiCoverageThresholdPct()) / 3)
  );

  // ── KPI helpers (supervision tab) ───────────────────────────────
  readonly kpiSansSuite = computed(() =>
    this.communeRows().reduce((s, r) => s + r.sansSuiteCount, 0)
  );
  readonly kpiInterventionsEnCours = computed((): number => {
    const dept = this.urd()?.dept;
    if (!dept) return 0;
    return this.interventionStore.snapshot.filter(
      i => i.department === dept && ACTIVE_INTERVENTION_STATUSES.has(i.status)
    ).length;
  });

  readonly communesPrioritaires = computed(() =>
    this.communeRows().filter(r => !r.tepac && r.sansSuiteCount > 0)
  );

  // ── Territoire tab computeds ──────────────────────────────────────

  readonly deptScope = computed((): TerritoireScope | null => {
    const dept = this.urd()?.dept;
    if (!dept) return null;
    const communeIds = this.zoneService.getCommunesForDept(dept);
    const bounds = DEPT_BOUNDS[dept] ?? null;
    return { dept, communeIds, bounds };
  });

  readonly territoireZones = computed(() => {
    void this.zoneService.version();
    const scope = this.deptScope();
    if (!scope) return [];
    const commune = this.territoireCommune();
    return this.zoneService.getZonesByDept(scope.dept)
      .filter(z => z.status !== 'archivee')
      .filter(z => !commune || z.commune === commune);
  });

  readonly territoireTreeNodes = computed((): TerritoireTreeNode[] => {
    void this.zoneService.version();
    const scope = this.deptScope();
    if (!scope) return [];
    return scope.communeIds.map(commune => {
      const zones = this.zoneService.getZonesByCommune(commune)
        .filter(z => z.status !== 'archivee');
      return { commune, zones, zoneCount: zones.length };
    });
  });

  // recent alerts for the dept, sorted by updatedAt desc
  readonly activiteRecente = computed((): GestAlert[] => {
    const dept = this.urd()?.dept;
    if (!dept) return [];
    return this.alertStore.snapshot
      .filter(a => a.department === dept)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  });

  // ── Commune interaction ─────────────────────────────────────────
  openCommune(row: CommuneRow): void {
    this.selectedCommune.set(row);
    this.drawerTab.set(row.sansSuiteCount > 0 ? 'alertes' : 'zones');
  }
  closeDrawer(): void { this.selectedCommune.set(null); }

  // ── Utils ───────────────────────────────────────────────────────
  urgencyScore(row: CommuneRow): number {
    let s = row.sansSuiteCount * 100;
    s += !row.tepac ? 50 : 0;
    s += row.coveragePct !== null && row.coveragePct < 40 ? 30 : 0;
    s += row.alertesOuvertes.filter(a => a.slaStatus === 'breach').length * 20;
    s += row.alertesOuvertes.filter(a => a.slaStatus === 'warning').length * 8;
    const maxSev = row.alertesOuvertes.reduce((m, a) => Math.max(m, SEV_WEIGHT[a.alert.severity] ?? 0), 0);
    return s + maxSev;
  }

  rowClass(row: CommuneRow): string {
    if (!row.tepac && row.sansSuiteCount > 0) return 'urd-tr--critical';
    if (!row.tepac || row.sansSuiteCount > 0) return 'urd-tr--warn';
    return '';
  }

  openEscalade(alertId: string): void {
    this.escaladeAlertId.set(alertId);
    this.escaladeMotif.set('');
  }
  cancelEscalade(): void { this.escaladeAlertId.set(null); }

  confirmEscalade(): void {
    const id    = this.escaladeAlertId();
    const motif = this.escaladeMotif().trim();
    if (!id || !motif) return;
    this.alertStore.escaladeManuelle(id, motif);
    this.escaladeAlertId.set(null);
    this.escaladeMotif.set('');
    const c = this.selectedCommune();
    if (c) {
      const updated = this.communeRows().find(r => r.nom === c.nom);
      if (updated) this.selectedCommune.set(updated);
    }
  }

  palierLabel(niveau: number): string {
    return niveau === 0 ? 'TEPAC' : niveau === 1 ? 'URD' : 'DINEPA';
  }

  slaColor(status: 'ok' | 'warning' | 'breach'): string {
    return status === 'breach' ? '#FB7185' : status === 'warning' ? '#FBBF24' : '#4ADE80';
  }

  severityColor(sev: string): string {
    if (sev === 'critique') return '#FB7185';
    if (sev === 'haute')    return '#FBBF24';
    if (sev === 'moyenne')  return '#60A5FA';
    return '#8B9AAB';
  }

  timeSince(isoDate: string): string {
    const diff = (Date.now() - new Date(isoDate).getTime()) / 3_600_000;
    if (diff < 1)  return 'Il y a ' + Math.round(diff * 60) + ' min';
    if (diff < 24) return 'Il y a ' + Math.round(diff) + 'h';
    return 'Il y a ' + Math.round(diff / 24) + 'j';
  }

  coverageColor(pct: number | null): string {
    if (pct === null) return '#6B7785';
    if (pct >= 60) return '#4ADE80';
    if (pct >= 35) return '#FBBF24';
    return '#FB7185';
  }

  conformiteColor(pct: number): string {
    if (pct >= 75) return '#4ADE80';
    if (pct >= 50) return '#FBBF24';
    return '#FB7185';
  }

  activityColor(status: string): string {
    if (status === 'resolue' || status === 'archivee') return '#4ADE80';
    if (status === 'assignee' || status === 'en-cours') return '#60A5FA';
    return '#FBBF24';
  }

  // ── Navigation sortante ─────────────────────────────────────────
  voirAlertesDepart(dept?: string): void {
    this.alerteState.modifierFiltre('departements', dept ? [dept] : []);
    this.alerteState.modifierFiltre('statuts', ['ouverte', 'assignee', 'en-cours']);
    this.router.navigateByUrl('/admin/alertes');
  }

  voirAlertesCommune(commune: string): void {
    this.alerteState.modifierFiltre('departements', []);
    this.alerteState.modifierFiltre('statuts', ['ouverte', 'assignee', 'en-cours']);
    this.alerteState.modifierRecherche(commune);
    this.router.navigateByUrl('/admin/alertes');
    this.closeDrawer();
  }

  ouvrirAlerte(alert: GestAlert): void {
    this.alerteState.modifierFiltre('departements', []);
    this.alerteState.modifierRecherche('');
    this.alerteState.selectionner(alert);
    this.router.navigateByUrl('/admin/alertes');
    this.closeDrawer();
  }

  creerInterventionSurAlerte(alert: GestAlert): void {
    const suggestion = SUGGESTION_PAR_SEVERITE[alert.severity];
    const donnees: DonneesPreremplies = {
      sourceAlertId:   alert.id,
      sourceAlertCode: alert.code,
      titre:           `[${alert.code}] ${alert.title}`,
      description:     alert.description,
      type:            suggestion.type,
      priorite:        suggestion.priorite,
      departement:     alert.department ?? '',
      commune:         alert.commune ?? '',
      section:         alert.section ?? '',
      infraId:         alert.infrastructureId ?? '',
    };
    this.intState.ouvrirModalAvecDonnees(donnees);
    this.router.navigateByUrl('/admin/interventions');
    this.closeDrawer();
  }

  voirIntervention(intervention: Intervention): void {
    this.intState.selectionner(intervention);
    this.router.navigateByUrl('/admin/interventions');
    this.closeDrawer();
  }

  voirZone(_zone: ZoneFiche): void {
    this.router.navigateByUrl('/admin/governance/territoire');
    this.closeDrawer();
  }

  voirTerritoire(): void {
    this.router.navigateByUrl('/admin/governance/territoire');
  }

  onSuperviseurCree(_data: CompteCreeUrdData): void {
    // Le profil est déjà dans userRegistry (addToCache appelé par le modal) :
    // `urd` (computed dérivé du store) reflète le nouveau responsable aussitôt.
    // On recharge depuis l'API pour la cohérence multi-postes et la persistance.
    this.userRegistry.reload();
  }

  retour(): void { this.router.navigate(['/admin/governance/institutions']); }

  ngOnDestroy(): void { this._destroyTerritoireMap(); }

  // ── Territoire tab: map lifecycle ──────────────────────────────────

  private _initTerritoireMap(): void {
    if (this._terMap || typeof L === 'undefined') return;
    const el = document.getElementById('urd-ter-map');
    if (!el) return;

    const scope = this.deptScope();
    const bounds: [[number, number], [number, number]] =
      scope?.bounds ?? [[18.0, -74.5], [20.2, -71.6]];

    this._terMap = L.map(el, { zoomControl: false }).fitBounds(bounds);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 16, attribution: '© OSM · CNIGS',
    }).addTo(this._terMap);
    L.control.zoom({ position: 'bottomright' }).addTo(this._terMap);
    this._terMap.setMaxBounds(L.latLngBounds(bounds).pad(0.3));
    this._renderMarkers(this.territoireZones(), this.territoireStatuts());
  }

  private _destroyTerritoireMap(): void {
    if (this._terMap) { this._terMap.remove(); this._terMap = null; }
    this._terMarkers = [];
  }

  private _renderMarkers(zones: ZoneFiche[], statuts: Set<string>): void {
    if (!this._terMap) return;
    for (const m of this._terMarkers) this._terMap.removeLayer(m);
    this._terMarkers = [];

    for (const z of zones) {
      const st = this.zoneStatusLabel(z);
      if (!statuts.has(st)) continue;
      const color = st === 'actif' ? '#4ADE80' : st === 'maintenance' ? '#FBBF24' : '#FB7185';
      const icon = L.divIcon({
        html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`,
        className: '', iconSize: [10, 10], iconAnchor: [5, 5],
      });
      const marker = L.marker([z.lat, z.lon], { icon })
        .addTo(this._terMap)
        .bindTooltip(`${z.nom} · ${z.commune}`, { direction: 'top', offset: [0, -4] });
      this._terMarkers.push(marker);
    }
  }

  // ── Territoire tab: interaction ────────────────────────────────────

  zoneStatusLabel(z: ZoneFiche): 'actif' | 'maintenance' {
    return (!z.status || z.status === 'supervised') ? 'actif' : 'maintenance';
  }

  toggleTerritoireStatut(s: string): void {
    this.territoireStatuts.update(set => {
      const next = new Set(set);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  onCommuneFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.territoireCommune.set(val);
    if (!this._terMap) return;
    const dept = this.urd()?.dept ?? '';
    if (val) {
      const ll = this.zoneService.getCommuneLatLon(dept, val);
      if (ll) this._terMap.flyTo(ll, 12, { duration: 0.7 });
    } else {
      const b = this.deptScope()?.bounds;
      if (b) this._terMap.fitBounds(b);
    }
  }

  toggleTreeCommune(commune: string): void {
    this.treeExpandedComms.update(set => {
      const next = new Set(set);
      if (next.has(commune)) next.delete(commune); else next.add(commune);
      return next;
    });
    if (this._terMap) {
      const dept = this.urd()?.dept ?? '';
      const ll = this.zoneService.getCommuneLatLon(dept, commune);
      if (ll) this._terMap.flyTo(ll, 12, { duration: 0.7 });
    }
  }

  ouvrirActiverZone(): void {
    this.actZoneNom         = '';
    this.actZoneCommune     = '';
    this.actZoneResponsable = '';
    this.actZoneErr         = '';
    this.showActiverZone.set(true);
  }

  activerZoneSoumission(): void {
    this.actZoneErr = '';
    if (!this.actZoneNom.trim()) { this.actZoneErr = 'Le nom de la zone est requis.'; return; }
    if (!this.actZoneCommune)    { this.actZoneErr = 'Sélectionnez une commune.'; return; }
    const dept = this.urd()?.dept;
    if (!dept) return;

    const fiche = this.zoneService.activerZone(
      this.actZoneNom, dept, this.actZoneCommune,
      this.actZoneResponsable || undefined,
    );

    this.showActiverZone.set(false);
    this.actZoneSuccessMsg.set(`Zone « ${fiche.nom} » enregistrée dans ${fiche.commune} — à déployer`);
    setTimeout(() => this.actZoneSuccessMsg.set(''), 6000);

    // Expand the commune in the tree so the new zone is visible
    this.treeExpandedComms.update(set => new Set([...set, fiche.commune]));
  }

  demarrerRecensementZone(zoneId: string): void {
    this.router.navigate(['/admin/governance/zones', zoneId, 'recensement']);
  }
}

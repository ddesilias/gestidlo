import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  HostListener, Input, inject, OnDestroy, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AlertSeverity, AlertSource, AlertStore, GestAlert } from '../../../alert.store';
import { InfrastructureStore } from '../../../infrastructure.store';
import { GovernanceStore } from '../../../governance.store';
import { AuthService } from '../../../auth.service';
import { HAITI_COMMUNES, HAITI_SECTIONS } from '../../../haiti-geo.service';
import { AlerteStateService, NouvelleAlerteData } from '../alerte-state.service';
import { SEVERITY_LABELS, SOURCE_LABELS, severityDot } from '../alerte.types';

export const TYPES_ANOMALIE: string[] = [
  'Niveau bas — réservoir',
  'Pression insuffisante',
  'Débit anormal',
  'Qualité de l\'eau',
  'Coupure d\'alimentation',
  'Fuite / rupture',
  'Capteur hors ligne',
  'Vandalisme',
  'Autre',
];

const SLA_H: Record<AlertSeverity, number> = { critique: 2, haute: 8, moyenne: 24, basse: 72 };

@Component({
  selector: 'app-nouvelle-alerte',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nouvelle-alerte.component.html',
  styleUrls: ['./nouvelle-alerte.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NouvelleAlerteComponent implements OnInit, OnDestroy {
  /** Quand fourni depuis une fiche URD, pré-remplit et verrouille le département. */
  @Input() presetDept?: string;

  readonly auth       = inject(AuthService);
  readonly state      = inject(AlerteStateService);
  readonly infraStore = inject(InfrastructureStore);
  readonly govStore   = inject(GovernanceStore);
  readonly alertStore = inject(AlertStore);
  private  cdr        = inject(ChangeDetectorRef);

  // ── Constants ─────────────────────────────────────────────────────────────
  readonly SEVERITES:      AlertSeverity[] = ['critique', 'haute', 'moyenne', 'basse'];
  readonly SOURCES:        AlertSource[]   = ['iot', 'technicien', 'citoyen', 'supervision', 'systeme'];
  readonly TYPES_ANOMALIE                  = TYPES_ANOMALIE;
  readonly severiteLabels                  = SEVERITY_LABELS;
  readonly sourceLabels                    = SOURCE_LABELS;
  readonly severityDot                     = severityDot;
  readonly COMMUNES_PAR_DEPT               = HAITI_COMMUNES;
  readonly SECTIONS_PAR_COMMUNE            = HAITI_SECTIONS;

  // ── Mode ──────────────────────────────────────────────────────────────────
  mode: 'rapide' | 'complet' = 'rapide';

  // ── Form state ────────────────────────────────────────────────────────────
  titre         = '';
  typeAnomalie  = '';
  severite: AlertSeverity = 'critique';
  description   = '';
  infraId       = '';
  sousElement   = '';
  departement   = 'Ouest';
  commune       = '';
  /** TEPAC : commune verrouillée sur la sienne (champ en lecture seule, périmètre du JWT). */
  communeLocked = false;
  section       = '';
  source: AlertSource = 'iot';
  capteurCode   = '';
  valeurMesuree: number | null = null;
  seuilDepasse: number | null  = null;
  unite         = '';
  dateConstat   = '';
  technicienId  = '';
  priorite      = 1;
  creerIntervention = true;
  ressourceId   = '';
  impactQualite = false;
  conformiteReg = true;
  notifierCitoyens = false;

  // ── UI state ──────────────────────────────────────────────────────────────
  iotBannerIgnore  = false;
  doublonIgnore    = false;
  draftSavedLabel  = 'il y a 3s';

  private autoSaveTimer: any;
  private draftTimer:    any;
  private infraSub?:     Subscription;
  /** Dès que l'utilisateur touche infra/source/capteur, on cesse tout auto-remplissage. */
  private userTouched = false;

  // ── Derived: infra list ───────────────────────────────────────────────────
  // Périmètre du créateur : département (superviseur/URD) PUIS commune (TEPAC). Un technicien
  // ne doit jamais se voir proposer — ni hériter — un ouvrage hors de sa commune.
  get infraOptions() {
    let pool = this.infraStore.snapshot;
    if (this.presetDept) pool = pool.filter(i => i.department === this.presetDept);
    if (this.communeLocked && this.commune) pool = pool.filter(i => i.commune === this.commune);
    return pool;
  }
  get infraSelected()   { return this.infraStore.snapshot.find(i => i.id === this.infraId) ?? null; }
  get capteurOptions()  {
    if (!this.infraId) {
      // Capteurs proposés UNIQUEMENT dans le périmètre (mêmes infra que infraOptions).
      const all: { code: string; name: string; unit: string; value: number }[] = [];
      for (const inf of this.infraOptions) all.push(...inf.sensors.map(s => ({ code: s.code, name: s.name, unit: s.unit, value: s.value })));
      return all;
    }
    return this.infraSelected?.sensors ?? [];
  }
  get capteurSelected() {
    if (!this.capteurCode) return null;
    for (const inf of this.infraStore.snapshot) {
      const s = inf.sensors.find(s => s.code === this.capteurCode);
      if (s) return s;
    }
    return null;
  }
  /** TEPAC dont la commune ne contient aucun ouvrage/capteur référencé → saisie manuelle. */
  get aucunOuvrageDansPerimetre(): boolean {
    return this.communeLocked && this.infraOptions.length === 0;
  }
  get communeOptions()  {
    // TEPAC : commune verrouillée → n'exposer QUE la sienne (jamais les autres communes du
    // département, même dans un select désactivé). Superviseur/admin : liste complète du dept.
    if (this.communeLocked && this.commune) return [this.commune];
    return HAITI_COMMUNES[this.departement] ?? [];
  }
  get sectionOptions()  { return HAITI_SECTIONS[this.commune]    ?? []; }
  /** Techniciens assignables, bornés au territoire du créateur (TEPAC=commune, superviseur=dept,
   *  admin=tous) : un TEPAC Jacmel ne se voit jamais proposer un technicien d'une autre commune. */
  get techniciens() {
    const u = this.auth.userSnapshot();
    return this.govStore.techniciensForScope({ roles: u?.roles, dept: u?.dept, commune: u?.commune })
      .filter(t => t.status === 'actif');
  }

  // ── Derived: SLA ─────────────────────────────────────────────────────────
  get slaLabel():    string { return `${SLA_H[this.severite]}h`; }
  get slaEcheance(): string {
    const t = new Date(Date.now() + SLA_H[this.severite] * 3_600_000);
    return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  }

  // ── Derived: auto code ────────────────────────────────────────────────────
  get nextCode(): string {
    return `ALT-${new Date().getFullYear()}-${String(this.alertStore.snapshot.length + 1).padStart(3, '0')}`;
  }

  // ── Derived: doublon ─────────────────────────────────────────────────────
  get doublonAlerte(): GestAlert | null {
    if (!this.infraId || this.doublonIgnore) return null;
    const cutoff = Date.now() - 4 * 3_600_000;
    return this.alertStore.snapshot.find(a =>
      a.infrastructureId === this.infraId &&
      ['ouverte', 'assignee', 'en-cours'].includes(a.status) &&
      new Date(a.createdAt).getTime() > cutoff
    ) ?? null;
  }

  // ── Derived: IoT pre-fill banner ──────────────────────────────────────────
  get showIotBanner(): boolean {
    return this.source === 'iot' && !!this.capteurCode && !this.iotBannerIgnore;
  }

  // ── Derived: form completion ──────────────────────────────────────────────
  get champsRemplis(): number {
    return [
      !!this.titre.trim(),
      !!this.typeAnomalie,
      !!this.severite,
      !!this.commune.trim(),
      !!this.infraId,
    ].filter(Boolean).length;
  }
  get champsTotal(): number { return 5; }
  get allRequiredFilled(): boolean { return this.champsRemplis === this.champsTotal; }

  get canSubmit(): boolean {
    return this.titre.trim().length > 0 && this.commune.trim().length > 0;
  }

  // ── Derived: recommended technician ──────────────────────────────────────
  get techRecommande() {
    return this.techniciens.find(t => t.status === 'actif') ?? null;
  }

  // ── Derived: live preview ─────────────────────────────────────────────────
  get apercu() {
    return {
      code:         this.nextCode,
      titre:        this.titre   || '—',
      severite:     this.severite,
      commune:      this.commune || '—',
      section:      this.section,
      capteurCode:  this.capteurCode,
      valeur:       this.valeurMesuree,
      seuil:        this.seuilDepasse,
      unite:        this.unite,
    };
  }

  // ── Derived: impact list ──────────────────────────────────────────────────
  get impacts(): string[] {
    const list: string[] = [];
    if (this.creerIntervention)  list.push(`Intervention créée automatiquement`);
    if (this.infraId)            list.push(`Fiche infra ${this.infraSelected?.code ?? ''} mise à jour`);
    if (this.technicienId)       list.push(`Notification au technicien assigné`);
    if (this.conformiteReg)      list.push('Entrée registre réglementaire');
    list.push('Tableau de bord +1');
    if (this.capteurCode)        list.push(`Capteur ${this.capteurCode} — alerte liée`);
    return list;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Pre-fill current date/time
    const now = new Date();
    this.dateConstat = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // Verrou de périmètre par rôle (le serveur revérifie) : un superviseur/TEPAC ne crée que dans
    // SON territoire. On dérive presetDept du JWT pour les non-admins → département verrouillé ;
    // un TEPAC a en plus sa commune pré-remplie. L'admin reste libre (presetDept indéfini).
    const u = this.auth.userSnapshot();
    if (!this.presetDept && u && !u.roles?.includes('ADMIN') && u.dept) {
      this.presetDept = u.dept;
    }

    // Scope: lock département when embedded in a URD page
    if (this.presetDept) {
      this.departement = this.presetDept;
    }
    if (u?.commune) {
      this.commune = u.commune;
      this.communeLocked = true;
    }

    // Le store charge les ouvrages/capteurs depuis l'API (scopés serveur). On réagit à chaque
    // émission : tant que l'utilisateur n'a rien touché, on (re)calcule le pré-remplissage dès
    // que les données du périmètre arrivent. markForCheck car OnPush.
    this.infraSub = this.infraStore.items$.subscribe(() => {
      if (!this.userTouched) {
        this.applyIotPrefill();
        this.cdr.markForCheck();
      }
    });

    // Mock auto-save
    this.autoSaveTimer = setInterval(() => {
      this.draftSavedLabel = 'il y a 0s';
      this.cdr.markForCheck();
    }, 5000);
    this.draftTimer = setInterval(() => {
      const labels = ['il y a 2s', 'il y a 5s', 'il y a 8s', 'il y a 12s', 'il y a 20s', 'il y a 3s'];
      this.draftSavedLabel = labels[Math.floor(Math.random() * labels.length)];
      this.cdr.markForCheck();
    }, 3000);
  }

  ngOnDestroy(): void {
    clearInterval(this.autoSaveTimer);
    clearInterval(this.draftTimer);
    this.infraSub?.unsubscribe();
  }

  /**
   * Pré-remplissage IoT UNIQUEMENT si un vrai capteur existe dans le périmètre du créateur
   * (pool déjà filtré par département ET commune). Sinon → alerte manuelle : on n'invente
   * jamais une station/un capteur/une commune d'un autre territoire. Idempotent (rejouable
   * à chaque arrivée de données API tant que l'utilisateur n'a rien touché).
   */
  private applyIotPrefill(): void {
    const iotInfra = this.infraOptions.find(i =>
      i.sensors.length > 0 && (i.iotStatus === 'connecte' || i.iotStatus === 'signal-faible')
    );
    if (iotInfra) {
      this.source     = 'iot';
      this.infraId    = iotInfra.id;
      // Ne jamais écraser la commune verrouillée du TEPAC (vient du JWT, pas de l'ouvrage).
      if (!this.communeLocked) this.commune = iotInfra.commune;
      if (!this.section)       this.section = iotInfra.section ?? '';
      const firstSensor = iotInfra.sensors[0];
      this.capteurCode   = firstSensor.code;
      this.valeurMesuree = firstSensor.value;
      this.seuilDepasse  = null;
      this.unite         = firstSensor.unit;
      this.typeAnomalie  = this.inferTypeAnomalie(firstSensor.type);
    } else {
      // Commune sans capteur/ouvrage : saisie manuelle (observation terrain), rien de pré-rempli.
      this.source        = 'technicien';
      this.infraId       = '';
      this.capteurCode   = '';
      this.valeurMesuree = null;
      this.unite         = '';
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  onInfraChange(): void {
    this.userTouched = true;
    const infra = this.infraSelected;
    if (infra) {
      if (!this.commune) this.commune = infra.commune;
      if (!this.section) this.section = infra.section ?? '';
      // Auto-select first sensor if source is IoT
      if (this.source === 'iot' && infra.sensors.length > 0 && !this.capteurCode) {
        this.capteurCode    = infra.sensors[0].code;
        this.valeurMesuree  = infra.sensors[0].value;
        this.unite          = infra.sensors[0].unit;
      }
    }
  }

  onCapteurChange(): void {
    this.userTouched = true;
    const s = this.capteurSelected;
    if (s) {
      this.valeurMesuree = s.value;
      this.unite         = s.unit;
      if (!this.typeAnomalie) this.typeAnomalie = this.inferTypeAnomalie(s.type);
    }
  }

  onSourceChange(): void {
    this.userTouched = true;
    if (this.source !== 'iot') {
      this.capteurCode   = '';
      this.valeurMesuree = null;
      this.seuilDepasse  = null;
      this.unite         = '';
    }
  }

  soumettre(): void {
    if (!this.canSubmit) return;
    const data: NouvelleAlerteData = {
      titre:       this.titre.trim(),
      description: this.description.trim(),
      severite:    this.severite,
      source:      this.source,
      departement: this.departement,
      commune:     this.commune.trim(),
      infraId:     this.infraSelected?.id,
      infraName:   this.infraSelected?.name,
    };
    this.state.creerAlerte(data);
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { this.state.fermerModalCreer(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.soumettre(); }
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private inferTypeAnomalie(sensorType: string): string {
    const map: Record<string, string> = {
      'niveau':    'Niveau bas — réservoir',
      'pression':  'Pression insuffisante',
      'debit':     'Débit anormal',
      'qualite':   'Qualité de l\'eau',
      'ph':        'Qualité de l\'eau',
    };
    return map[sensorType] ?? '';
  }
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

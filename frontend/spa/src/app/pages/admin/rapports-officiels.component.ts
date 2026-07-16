import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RapportsStore, RapportDto } from '../../rapports.store';
import { ReportA4PreviewComponent } from '../rapports/report-a4/report-a4-preview.component';
import { fromRapportDto, ReportPreviewData } from '../rapports/report-a4/report-preview.model';

type Periode = 'tous' | 'journaliers' | 'hebdomadaires' | 'mensuels' | 'incidents';

/**
 * Rapports officiels reçus des URD — le bout du circuit « l'administration nationale supervise ».
 *
 * Contraste de périmètre, volontairement visible : là où le TEPAC était verrouillé sur sa commune
 * (bandeau figé) et le superviseur sur son département, l'admin a un sélecteur de zone DÉVERROUILLÉ
 * (National · toutes URD, ou filtrage par URD). Lecture seule : l'admin REÇOIT, il ne re-valide pas
 * — « Consulter » ouvre le rapport figé avec la signature du superviseur, sans panneau de décision.
 *
 * Source = le vrai circuit (RapportsStore / BFF). On n'affiche que ce qui a traversé tout le parcours :
 * TRANSMIS_ADMIN (validé + signé par l'URD, fraîchement reçu) et ARCHIVE (déjà classé).
 */
@Component({
  selector: 'app-rapports-officiels',
  standalone: true,
  imports: [CommonModule, FormsModule, ReportA4PreviewComponent],
  template: `
<div class="ro">

  <header class="ro-head">
    <div>
      <h1 class="ro-h1">Rapports officiels</h1>
      <p class="ro-sub">reçus des URD · validés et signés</p>
    </div>
    <!-- Sélecteur de zone DÉVERROUILLÉ — le miroir ouvert du bandeau verrouillé du technicien. -->
    <div class="ro-zone">
      <i class="ti ti-world"></i>
      <select class="ro-zone__sel" [ngModel]="deptFiltre()" (ngModelChange)="changerDept($event)">
        <option value="">National · toutes URD</option>
        <option *ngFor="let d of deptsDisponibles()" [value]="d">URD {{ d }}</option>
      </select>
    </div>
  </header>

  <!-- Onglets période (dérivés du type côté client tant que periode_type n'est pas en base) -->
  <div class="ro-tabs">
    <button *ngFor="let t of TABS" class="ro-tab" [class.ro-tab--on]="onglet()===t.id" (click)="onglet.set(t.id)">{{ t.label }}</button>
    <div class="ro-tabs__fill"></div>
  </div>

  <!-- Filtres par type -->
  <div class="ro-chips">
    <button class="ro-chip" [class.ro-chip--on]="typeFiltre()===''" (click)="typeFiltre.set('')">Tous types</button>
    <button *ngFor="let c of TYPES" class="ro-chip" [class.ro-chip--on]="typeFiltre()===c.id" (click)="typeFiltre.set(c.id)">{{ c.label }}</button>
  </div>

  <!-- Liste officielle -->
  <div class="ro-list">
    <div *ngIf="liste().length===0" class="ro-empty"><i class="ti ti-inbox"></i> Aucun rapport reçu pour ce filtre</div>

    <div *ngFor="let r of liste()" class="ro-row">
      <div class="ro-row__main">
        <div class="ro-row__t">{{ r.titre }}</div>
        <div class="ro-row__m">
          URD {{ r.departementId || '—' }}<span *ngIf="r.commune"> · {{ r.commune }}</span> · {{ fmtDate(r.signeLe || r.transmisLe || r.createdAt) }}
          · {{ r.auteur || '—' }} <i class="ti ti-arrow-right" style="font-size:11px;vertical-align:-1px;"></i> {{ r.signataire || '—' }}
        </div>
      </div>
      <span class="ro-badge" [ngClass]="badgeClass(r.status)">{{ badgeLabel(r.status) }}</span>
      <div class="ro-actions">
        <i class="ti ti-eye" title="Consulter" (click)="ouvrir(r)"></i>
        <i class="ti ti-file-export" title="Exporter PDF (à venir)" (click)="bientot('Export PDF')"></i>
        <i class="ti ti-archive" title="Archiver (à venir)" (click)="bientot('Archivage')"></i>
      </div>
    </div>
  </div>

  <footer class="ro-foot">
    <span class="ro-foot__c">{{ liste().length }} rapport(s) · {{ ongletLabel() }}<span *ngIf="deptFiltre()"> · URD {{ deptFiltre() }}</span></span>
    <!-- Point d'entrée discret vers la tranche suivante (agrégation), signalé sans être codé. -->
    <button class="ro-foot__btn" (click)="bientot('Génération du rapport mensuel agrégé')"><i class="ti ti-stack-2"></i> Générer rapport mensuel</button>
  </footer>

</div>

<!-- DÉTAIL LECTURE SEULE — même aperçu A4 officiel que partout ; l'admin REÇOIT (imprime / exporte / archive), il ne re-valide pas. -->
<app-report-a4-preview
  *ngIf="apercu() as p"
  [report]="p"
  viewerRole="ADMIN"
  [actions]="['imprimer','exporter','archiver','fermer']"
  (exporterPdf)="bientot('Export PDF')"
  (archiver)="bientot('Archivage')"
  (fermer)="ouvert.set(null)">
</app-report-a4-preview>
  `,
  styles: [`
    .ro { color:#e6edf3; max-width:1080px; }
    .ro-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .ro-h1 { font-size:16px; font-weight:500; margin:0; }
    .ro-sub { font-size:11px; color:#8b949e; margin:2px 0 0; }
    .ro-zone { display:flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.14); border-radius:8px; padding:6px 10px; background:#11161f; }
    .ro-zone i { font-size:15px; color:#19c3a8; }
    .ro-zone__sel { background:transparent; border:0; color:#e6edf3; font-size:13px; font-family:inherit; outline:none; cursor:pointer; }
    .ro-zone__sel option { background:#11161f; }

    .ro-tabs { display:flex; gap:2px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,.08); }
    .ro-tab { font-size:13px; color:#8b949e; background:transparent; border:0; border-bottom:2px solid transparent; padding:8px 14px; cursor:pointer; font-family:inherit; margin-bottom:-1px; }
    .ro-tab:hover { color:#c9d1d9; }
    .ro-tab--on { color:#e6edf3; font-weight:500; border-bottom-color:#19c3a8; }
    .ro-tabs__fill { flex:1; }

    .ro-chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
    .ro-chip { font-size:12px; color:#8b949e; background:transparent; border:1px solid rgba(255,255,255,.12); border-radius:20px; padding:4px 12px; cursor:pointer; font-family:inherit; }
    .ro-chip:hover { color:#c9d1d9; }
    .ro-chip--on { color:#04342c; background:#19c3a8; border-color:#19c3a8; font-weight:500; }

    .ro-list { display:flex; flex-direction:column; border:1px solid rgba(255,255,255,.08); border-radius:10px; overflow:hidden; }
    .ro-empty { display:flex; align-items:center; gap:8px; font-size:12px; color:#8b949e; padding:18px; }
    .ro-row { display:flex; align-items:center; gap:14px; padding:13px 15px; border-bottom:1px solid rgba(255,255,255,.06); }
    .ro-row:last-child { border-bottom:0; }
    .ro-row__main { flex:1; min-width:0; }
    .ro-row__t { font-size:14px; font-weight:500; }
    .ro-row__m { font-size:12px; color:#8b949e; margin-top:3px; }
    .ro-badge { font-size:11px; padding:3px 10px; border-radius:20px; white-space:nowrap; }
    .ro-badge--green { background:rgba(63,185,80,.14); color:#3fb950; }
    .ro-badge--blue  { background:rgba(96,165,250,.14); color:#60a5fa; }
    .ro-badge--grey  { background:rgba(255,255,255,.07); color:#8b949e; }
    .ro-badge--ro { align-self:flex-start; }
    .ro-actions { display:flex; gap:12px; color:#8b949e; }
    .ro-actions i { font-size:18px; cursor:pointer; }
    .ro-actions i:hover { color:#e6edf3; }

    .ro-foot { display:flex; align-items:center; justify-content:space-between; padding:12px 2px 0; }
    .ro-foot__c { font-size:12px; color:#6e7681; }
    .ro-foot__btn { display:flex; align-items:center; gap:6px; font-size:13px; color:#c9d1d9; background:transparent; border:1px solid rgba(255,255,255,.14); border-radius:8px; padding:7px 14px; cursor:pointer; font-family:inherit; }
    .ro-foot__btn:hover { border-color:rgba(25,195,168,.4); color:#e6edf3; }
    .ro-foot__btn i { font-size:15px; }

    .ro-modal { position:fixed; inset:0; background:rgba(2,5,12,.62); display:flex; align-items:flex-start; justify-content:center; padding:4vh 0; z-index:1000; overflow:auto; }
    .ro-card { width:640px; max-width:94vw; background:#0e131c; border:1px solid rgba(255,255,255,.1); border-radius:14px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.5); }
    .ro-card__head { display:flex; align-items:flex-start; justify-content:space-between; padding:14px 18px; border-bottom:1px solid rgba(255,255,255,.07); }
    .ro-card__t { font-size:15px; font-weight:500; }
    .ro-card__s { font-size:12px; color:#8b949e; margin-top:3px; }
    .ro-card__x { font-size:18px; color:#8b949e; cursor:pointer; }
    .ro-card__body { padding:16px 18px; display:flex; flex-direction:column; gap:13px; }
    .ro-preview { border:1px solid rgba(255,255,255,.1); border-radius:12px; overflow:hidden; }
    .ro-preview__h { display:flex; align-items:center; gap:7px; padding:8px 12px; background:rgba(255,255,255,.04); font-size:11px; font-weight:600; color:#8b949e; letter-spacing:.04em; }
    .ro-preview__p { font-size:13.5px; line-height:1.62; color:#e6edf3; margin:0; padding:13px; }
    .ro-evid { display:flex; gap:16px; flex-wrap:wrap; font-size:12px; color:#8b949e; }
    .ro-evid i { font-size:14px; vertical-align:-2px; margin-right:3px; }
    .ro-sign { display:flex; align-items:center; gap:12px; background:#11161f; border-radius:10px; padding:12px 14px; }
    .ro-sign i { font-size:23px; color:#19c3a8; }
    .ro-sign__txt { flex:1; } .ro-sign__n { font-size:13px; font-weight:500; } .ro-sign__r { font-size:12px; color:#8b949e; margin-top:2px; }
    .ro-sign__ok { font-size:12px; color:#3fb950; white-space:nowrap; } .ro-sign__ok i { font-size:14px; color:#3fb950; }
    .ro-card__foot { display:flex; align-items:center; justify-content:space-between; padding:13px 18px; border-top:1px solid rgba(255,255,255,.07); }
    .ro-card__note { font-size:11px; color:#6e7681; } .ro-card__note i { font-size:13px; vertical-align:-2px; margin-right:4px; }
    .ro-btn { font-size:13px; border-radius:8px; padding:8px 15px; cursor:pointer; font-family:inherit; border:1px solid transparent; }
    .ro-btn--ghost { color:#c9d1d9; border-color:rgba(255,255,255,.14); background:transparent; }
  `],
})
export class RapportsOfficielsComponent implements OnInit {
  readonly store = inject(RapportsStore);

  readonly TABS: { id: Periode; label: string }[] = [
    { id: 'tous',          label: 'Tous' },
    { id: 'journaliers',   label: 'Journaliers' },
    { id: 'hebdomadaires', label: 'Hebdomadaires' },
    { id: 'mensuels',      label: 'Mensuels' },
    { id: 'incidents',     label: 'Incidents' },
  ];
  readonly TYPES = [
    { id: 'intervention',   label: 'Intervention' },
    { id: 'incident',       label: 'Incident' },
    { id: 'iot',            label: 'IoT' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'ressource',      label: 'Ressource' },
    { id: 'journalier',     label: 'Journalier' },
  ];

  readonly onglet = signal<Periode>('tous');
  readonly typeFiltre = signal<string>('');
  readonly deptFiltre = signal<string>('');
  readonly ouvert = signal<RapportDto | null>(null);

  /** Le rapport ouvert, projeté vers le modèle A4 normalisé. */
  readonly apercu = computed<ReportPreviewData | null>(() => {
    const r = this.ouvert();
    return r ? fromRapportDto(r) : null;
  });

  /** Univers « officiel » : ce qui a traversé tout le circuit (reçu admin) ou déjà classé. */
  private readonly officiels = computed(() =>
    this.store.items().filter(r => r.status === 'TRANSMIS_ADMIN' || r.status === 'ARCHIVE'));

  readonly deptsDisponibles = computed(() =>
    [...new Set(this.officiels().map(r => r.departementId).filter((d): d is string => !!d))].sort());

  readonly liste = computed(() => this.officiels().filter(r =>
    (this.onglet() === 'tous' || this.periodeOf(r.type) === this.onglet()) &&
    (this.typeFiltre() === '' || (r.type || '').toLowerCase() === this.typeFiltre()) &&
    (this.deptFiltre() === '' || r.departementId === this.deptFiltre())));

  ngOnInit(): void { this.store.charger(); }   // admin national : tout, toutes URD

  changerDept(d: string): void {
    this.deptFiltre.set(d);
    this.store.charger(d || undefined);   // le serveur reste maître du périmètre (admin = national)
  }

  ouvrir(r: RapportDto): void { this.ouvert.set(r); }
  bientot(quoi: string): void { /* placeholder tranche suivante */ alert(`${quoi} — à venir`); }

  ongletLabel(): string { return this.TABS.find(t => t.id === this.onglet())?.label ?? ''; }

  private periodeOf(type: string | null): Periode {
    switch ((type || '').toLowerCase()) {
      case 'journalier':   return 'journaliers';
      case 'hebdomadaire': return 'hebdomadaires';
      case 'mensuel':
      case 'trimestriel':  return 'mensuels';
      case 'incident':     return 'incidents';
      default:             return 'tous';
    }
  }

  badgeLabel(s: RapportDto['status']): string {
    return s === 'TRANSMIS_ADMIN' ? 'Validé URD' : s === 'ARCHIVE' ? 'Archivé' : s;
  }
  badgeClass(s: RapportDto['status']): string {
    return s === 'TRANSMIS_ADMIN' ? 'ro-badge--green' : 'ro-badge--grey';
  }

  /** Lit le contenu guidé (GPS, ouvrage) pour l'enrichir dans le détail — affichage seul. */
  meta(r: RapportDto): { ouvrage?: string; gps?: string } | null {
    if (!r.contenuJson) return null;
    try {
      const c = JSON.parse(r.contenuJson);
      const gps = c?.gps && c.gps.latitude != null ? `${c.gps.latitude}, ${c.gps.longitude}` : undefined;
      return { ouvrage: c?.infrastructure || undefined, gps };
    } catch { return null; }
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}

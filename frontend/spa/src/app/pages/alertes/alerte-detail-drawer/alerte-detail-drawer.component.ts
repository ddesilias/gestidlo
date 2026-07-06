import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter,
  HostListener, inject, Input, OnDestroy, OnInit, Output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { GestAlert, AlertStatus, AlertStore } from '../../../alert.store';
import { AlerteStateService } from '../alerte-state.service';
import { InterventionStateService, DonneesPreremplies } from '../../interventions/intervention-state.service';
import { InfrastructureStore } from '../../../infrastructure.store';
import {
  severityLabel, statusLabel, sourceLabel,
  severityDot, severityBg, statusDot, statusBg, sourceDot,
  dateLabel, timeLabel, isActive,
  SLA_HEURES, slaElapsed, slaStatus, SlaStatus,
  SUGGESTION_PAR_SEVERITE,
} from '../alerte.types';
import { EscaladeEvent } from '../../../zone.models';

const MOTIFS_ESCALADE = [
  'Matériel insuffisant sur place',
  'Zone inaccessible — sécurité',
  'Hors compétence technique',
  'Infrastructure hors périmètre TEPAC',
  'Besoin de renfort humain',
];

type TabId = 'overview' | 'intervention' | 'activite' | 'conformite' | 'audit';

const STATUS_ORDER: AlertStatus[] = ['ouverte', 'assignee', 'en-cours', 'resolue', 'archivee'];

@Component({
  selector: 'app-alerte-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alerte-detail-drawer.component.html',
  styleUrls: ['./alerte-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlerteDetailDrawerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) alerte!: GestAlert;
  @Output() fermer = new EventEmitter<void>();

  readonly state              = inject(AlerteStateService);
  readonly alertStore         = inject(AlertStore);
  private readonly intState   = inject(InterventionStateService);
  readonly infraStore         = inject(InfrastructureStore);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly router     = inject(Router);

  // ── Escalade overlay ──────────────────────────────────────────────────────
  readonly showEscaladeOverlay = signal(false);
  readonly escaladeMotifChoisi = signal('');
  escaladeMotifCustom          = '';   // plain string — compatible ngModel
  readonly motifsEscalade      = MOTIFS_ESCALADE;

  get escaladeNiveauLabel(): string {
    const n = this.alerte.escaladeNiveau;
    return n === 0 ? 'TEPAC' : n === 1 ? 'URD' : 'DINEPA';
  }

  get escaladeNiveauSuivantLabel(): string {
    const n = this.alerte.escaladeNiveau;
    return n === 0 ? 'URD' : 'DINEPA';
  }

  get escaladeEvents(): EscaladeEvent[] {
    return this.alertStore.getEscaladeEvents(this.alerte.id);
  }

  get peutEscalader(): boolean {
    return isActive(this.alerte.status) && this.alerte.escaladeNiveau < 2;
  }

  selectMotifPredefined(m: string): void {
    this.escaladeMotifChoisi.set(m);
    this.escaladeMotifCustom = '';
  }

  onClearMotifChoisi(): void {
    this.escaladeMotifChoisi.set('');
  }

  onEscalader(): void {
    this.escaladeMotifChoisi.set('');
    this.escaladeMotifCustom = '';
    this.showEscaladeOverlay.set(true);
  }

  confirmerEscalade(): void {
    const motif = this.escaladeMotifChoisi() || this.escaladeMotifCustom.trim();
    if (!motif) return;
    this.alertStore.escaladeManuelle(this.alerte.id, motif);
    this.showEscaladeOverlay.set(false);
    this.cdr.markForCheck();
  }

  escaladeTypeLabel(type: 'automatique' | 'manuelle'): string {
    return type === 'automatique' ? 'SLA dépassé' : 'Renfort demandé';
  }

  escaladeTypeColor(type: 'automatique' | 'manuelle'): string {
    return type === 'automatique' ? '#ef4444' : '#3b82f6';
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  severityLabel = severityLabel; statusLabel = statusLabel; sourceLabel  = sourceLabel;
  severityDot   = severityDot;  severityBg  = severityBg;  statusDot    = statusDot;
  statusBg      = statusBg;     sourceDot   = sourceDot;   dateLabel    = dateLabel;
  timeLabel     = timeLabel;    isActive    = isActive;

  // ── Tab ───────────────────────────────────────────────────────────────────
  activeTab: TabId = 'overview';

  // ── SLA ───────────────────────────────────────────────────────────────────
  get slaLimitH():    number    { return SLA_HEURES[this.alerte.severity]; }
  get slaElapsedH():  number    { return slaElapsed(this.alerte.createdAt); }
  get slaRestantH():  number    { return Math.max(0, this.slaLimitH - this.slaElapsedH); }
  get slaSt():        SlaStatus { return slaStatus(this.alerte.severity, this.alerte.createdAt); }
  get slaRestantLabel(): string {
    const h = this.slaRestantH;
    if (h <= 0) return 'SLA dépassé';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')} restant`;
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  get liste():      GestAlert[] { return this.state.alertesFiltrees(); }
  get currentIdx(): number      { return this.liste.findIndex(a => a.id === this.alerte.id); }
  get total():      number      { return this.liste.length; }

  allerPrecedent(): void { if (this.currentIdx > 0) this.state.selectionner(this.liste[this.currentIdx - 1]); }
  allerSuivant():   void { if (this.currentIdx < this.total - 1) this.state.selectionner(this.liste[this.currentIdx + 1]); }

  // ── Status stepper ────────────────────────────────────────────────────────
  readonly STEPPER: { id: AlertStatus; label: string }[] = [
    { id: 'ouverte',  label: 'Nouvelle' },
    { id: 'assignee', label: 'Assignée' },
    { id: 'en-cours', label: 'En cours' },
    { id: 'resolue',  label: 'Résolue'  },
    { id: 'archivee', label: 'Clôturée' },
  ];

  stepState(step: AlertStatus): 'done' | 'active' | 'todo' {
    const cur = STATUS_ORDER.indexOf(this.alerte.status);
    const idx = STATUS_ORDER.indexOf(step);
    if (idx < cur)   return 'done';
    if (idx === cur) return 'active';
    return 'todo';
  }

  // ── Sensor lookup ─────────────────────────────────────────────────────────
  sensor() {
    if (!this.alerte.sensorCode) return null;
    for (const infra of this.infraStore.snapshot) {
      const s = infra.sensors.find(s => s.code === this.alerte.sensorCode);
      if (s) return s;
    }
    return null;
  }

  iotBarPct(): number {
    const m = this.alerte.sensorMeasuredValue, t = this.alerte.sensorThreshold;
    if (m === undefined || !t) return 0;
    return Math.min(100, Math.round((m / t) * 100));
  }

  // ── Capteurs voisins ──────────────────────────────────────────────────────
  get capteurVoisins(): { code: string; value: number; unit: string; ok: boolean }[] {
    const res: { code: string; value: number; unit: string; ok: boolean }[] = [];
    for (const infra of this.infraStore.snapshot) {
      if (infra.id === this.alerte.infrastructureId) continue;
      for (const s of infra.sensors) {
        if (res.length >= 4) break;
        res.push({ code: s.code, value: s.value, unit: s.unit, ok: s.status === 'connecte' });
      }
      if (res.length >= 4) break;
    }
    return res;
  }

  // ── Infrastructure ────────────────────────────────────────────────────────
  get infra() {
    return this.infraStore.snapshot.find(i => i.id === this.alerte.infrastructureId) ?? null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  initials(name: string): string {
    return name.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  setStatus(status: AlertStatus): void { this.state.setStatus(this.alerte.id, status); }

  onVoirIntervention(): void {
    const intervention = this.intState.toutesLesInterventions().find(i => i.id === this.alerte.interventionId);
    if (!intervention) return;
    this.intState.selectionner(intervention);
    this.fermer.emit();
    this.router.navigateByUrl('/admin/interventions');
  }

  onCreerIntervention(): void {
    const suggestion = SUGGESTION_PAR_SEVERITE[this.alerte.severity];
    const donnees: DonneesPreremplies = {
      sourceAlertId: this.alerte.id, sourceAlertCode: this.alerte.code,
      titre:       `[${this.alerte.code}] ${this.alerte.title}`,
      description: this.alerte.description,
      type:        suggestion.type,
      priorite:    suggestion.priorite,
      departement: this.alerte.department ?? '',
      commune:     this.alerte.commune    ?? '',
      section:     this.alerte.section    ?? '',
      infraId:     this.infra?.id         ?? '',
    };
    this.intState.ouvrirModalAvecDonnees(donnees);
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') { this.fermer.emit(); return; }
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); this.allerSuivant(); }
    if (e.key === 'k' || e.key === 'ArrowUp')   { e.preventDefault(); this.allerPrecedent(); }
  }

  private refreshTimer: any;
  ngOnInit():    void { this.refreshTimer = setInterval(() => this.cdr.markForCheck(), 30_000); }
  ngOnDestroy(): void { clearInterval(this.refreshTimer); }
}

import {
  ChangeDetectionStrategy, Component, EventEmitter,
  HostListener, inject, Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Intervention, InterventionStatus } from '../../../intervention.store';
import { InterventionStateService } from '../intervention-state.service';
import { AlertStore } from '../../../alert.store';
import { AlerteStateService } from '../../alertes/alerte-state.service';
import {
  statutLabel, typeLabel, prioriteLabel, prioriteDot,
  statutDot, statutBg, dateLabel, timeLabel,
  NEXT_STATUSES, SLA_HEURES_INT, slaElapsedInt,
} from '../intervention.types';
import { RapportStateService } from '../../rapports/rapport-state.service';
import { DonneesRapportPreRemplies } from '../../rapports/rapport.types';

type OngletId = 'resume' | 'taches' | 'historique' | 'cloture';

@Component({
  selector: 'app-intervention-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './intervention-detail-drawer.component.html',
  styleUrls: ['./intervention-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionDetailDrawerComponent {
  @Input({ required: true }) intervention!: Intervention;
  @Output() fermer = new EventEmitter<void>();

  private readonly state        = inject(InterventionStateService);
  private readonly rapportState = inject(RapportStateService);
  private readonly alertStore   = inject(AlertStore);
  private readonly alerteState  = inject(AlerteStateService);
  private readonly router       = inject(Router);

  onglet: OngletId = 'resume';
  notesTexte = '';
  confirmAnnuler = false;

  // ── Display helpers ───────────────────────────────────────────────────────
  statutLabel   = statutLabel;
  typeLabel     = typeLabel;
  prioriteLabel = prioriteLabel;
  statutDot     = statutDot;
  statutBg      = statutBg;
  prioriteDot   = prioriteDot;
  dateLabel     = dateLabel;
  timeLabel     = timeLabel;

  nextStatuses(status: InterventionStatus): InterventionStatus[] {
    return NEXT_STATUSES[status] ?? [];
  }

  // ── Task helpers ──────────────────────────────────────────────────────────
  tasksDone(): number { return this.intervention.tasks.filter(t => t.done).length; }
  tasksPct():  number {
    const n = this.intervention.tasks.length;
    return n ? (this.tasksDone() / n) * 100 : 0;
  }

  // ── SLA ───────────────────────────────────────────────────────────────────
  get slaLimitH():   number { return SLA_HEURES_INT[this.intervention.priority]; }
  get slaElapsedH(): number { return slaElapsedInt(this.intervention.createdAt); }
  get slaRestantH(): number { return Math.max(0, this.slaLimitH - this.slaElapsedH); }
  get slaDepasse():  boolean { return this.slaElapsedH > this.slaLimitH; }
  get slaLabel(): string {
    if (this.slaDepasse) {
      const over = this.slaElapsedH - this.slaLimitH;
      return `+${Math.floor(over)}h dépassé`;
    }
    const h = this.slaRestantH;
    const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')} restant`;
  }

  // ── Duration ──────────────────────────────────────────────────────────────
  get durationLabel(): string {
    const start = this.intervention.startedAt ?? this.intervention.createdAt;
    const end   = this.intervention.closedAt ? new Date(this.intervention.closedAt) : new Date();
    const ms    = end.getTime() - new Date(start).getTime();
    const h     = Math.floor(ms / 3_600_000);
    const m     = Math.floor((ms % 3_600_000) / 60_000);
    if (h === 0) return `${m} min`;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }

  techInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  isActive(s: InterventionStatus): boolean {
    return ['creee', 'assignee', 'en-cours', 'en-attente'].includes(s);
  }

  // ── Navigation prev/next ──────────────────────────────────────────────────
  get liste(): Intervention[] { return this.state.interventionsFiltrees(); }
  get currentIdx(): number    { return this.liste.findIndex(i => i.id === this.intervention.id); }
  get total(): number         { return this.liste.length; }

  allerPrecedent(): void {
    if (this.currentIdx > 0) this.state.selectionner(this.liste[this.currentIdx - 1]);
  }
  allerSuivant(): void {
    if (this.currentIdx < this.total - 1) this.state.selectionner(this.liste[this.currentIdx + 1]);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  setStatus(status: InterventionStatus): void {
    if (status === 'annulee') {
      if (!this.confirmAnnuler) { this.confirmAnnuler = true; return; }
      this.confirmAnnuler = false;
    }
    this.state.setStatus(this.intervention.id, status);
  }

  toggleTask(taskId: string): void { this.state.toggleTask(this.intervention, taskId); }

  saveNotes(): void {
    this.state.saveNotes(this.intervention, this.notesTexte);
    this.notesTexte = '';
  }

  onVoirAlerte(): void {
    const alert = this.alertStore.snapshot.find(a => a.id === this.intervention.sourceAlertId);
    if (!alert) return;
    this.alerteState.selectionner(alert);
    this.fermer.emit();
    this.router.navigateByUrl('/admin/alertes');
  }

  creerRapport(): void {
    const i = this.intervention;
    const donnees: DonneesRapportPreRemplies = {
      sourceInterventionId:   i.id,
      sourceInterventionCode: i.code,
      titre:       `[${i.code}] ${i.title}`,
      description: i.description ?? '',
      type:        'interventions',
      technicien:  i.technicianName,
      institution: i.institutionName,
      commune:     i.commune ?? '',
      section:     i.section ?? '',
      departement: i.department ?? '',
    };
    this.rapportState.ouvrirCreateDepuisIntervention(donnees);
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') { this.fermer.emit(); return; }
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); this.allerSuivant(); }
    if (e.key === 'k' || e.key === 'ArrowUp')   { e.preventDefault(); this.allerPrecedent(); }
  }
}

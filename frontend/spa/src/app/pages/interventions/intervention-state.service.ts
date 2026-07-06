import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Intervention, InterventionStatus, InterventionType,
  InterventionPriority, InterventionStore,
} from '../../intervention.store';
import { AlertStore } from '../../alert.store';
import { ToastService } from '../../ui/toast.service';
import {
  FiltresIntervention, FILTRES_VIDES, NEXT_STATUSES, statutLabel,
  SLA_HEURES_INT, slaElapsedInt,
} from './intervention.types';

export type VueIntervention = 'table' | 'kanban';

export interface DonneesPreremplies {
  sourceAlertId:   string;
  sourceAlertCode: string;
  titre:           string;
  description:     string;
  type:            InterventionType | '';
  priorite:        InterventionPriority | '';
  departement:     string;
  commune:         string;
  section:         string;
  infraId:         string;
}

const ACTIVE_STATUSES: InterventionStatus[] = ['creee', 'assignee', 'en-cours', 'en-attente'];

function filtrer(liste: Intervention[], f: FiltresIntervention): Intervention[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  return liste.filter(i => {
    if (f.recherche) {
      const q = f.recherche.toLowerCase();
      if (
        !i.title.toLowerCase().includes(q) &&
        !i.code.toLowerCase().includes(q) &&
        !(i.infrastructureName ?? '').toLowerCase().includes(q) &&
        !(i.commune ?? '').toLowerCase().includes(q) &&
        !i.technicianName.toLowerCase().includes(q) &&
        !i.institutionName.toLowerCase().includes(q)
      ) return false;
    }
    if (f.statuts.length        && !f.statuts.includes(i.status))                return false;
    if (f.types.length          && !f.types.includes(i.type))                    return false;
    if (f.priorites.length      && !f.priorites.includes(i.priority))            return false;
    if (f.departements.length   && !f.departements.includes(i.department ?? '')) return false;
    if (f.institutions.length   && !f.institutions.includes(i.institutionName))  return false;
    if (f.urgences_seules       && i.type !== 'urgence' && i.priority !== 'critique') return false;
    if (f.aujourd_hui) {
      const ref = i.scheduledAt ?? i.createdAt;
      if (!ref.startsWith(todayStr)) return false;
    }
    if (f.sans_assignation      && i.technicianId)                               return false;
    if (f.sla_depasse) {
      if (!ACTIVE_STATUSES.includes(i.status))                                   return false;
      if (slaElapsedInt(i.createdAt) < SLA_HEURES_INT[i.priority])               return false;
    }
    return true;
  });
}

@Injectable({ providedIn: 'root' })
export class InterventionStateService {

  private readonly store      = inject(InterventionStore);
  private readonly toast      = inject(ToastService);
  private readonly alertStore = inject(AlertStore);

  private readonly _filtres             = signal<FiltresIntervention>({ ...FILTRES_VIDES });
  private readonly _selection           = signal<Intervention | null>(null);
  private readonly _vue                 = signal<VueIntervention>('table');
  private readonly _modalOuvert         = signal(false);
  private readonly _donneesPreremplies  = signal<DonneesPreremplies | null>(null);
  private readonly _filtresDrawerOuvert = signal(false);

  readonly filtres             = this._filtres.asReadonly();
  readonly selection           = this._selection.asReadonly();
  readonly vue                 = this._vue.asReadonly();
  readonly modalOuvert         = this._modalOuvert.asReadonly();
  readonly donneesPreremplies  = this._donneesPreremplies.asReadonly();
  readonly filtresDrawerOuvert = this._filtresDrawerOuvert.asReadonly();

  readonly toutesLesInterventions = toSignal(
    this.store.items$,
    { initialValue: [] as Intervention[] }
  );

  readonly interventionsFiltrees = computed(() =>
    filtrer(this.toutesLesInterventions(), this._filtres())
  );

  readonly nombreFiltresActifs = computed(() => {
    const f = this._filtres();
    return [
      f.recherche !== '',
      f.statuts.length > 0,
      f.types.length > 0,
      f.priorites.length > 0,
      f.departements.length > 0,
      f.institutions.length > 0,
      f.urgences_seules,
      f.aujourd_hui,
      f.sans_assignation,
      f.sla_depasse,
    ].filter(Boolean).length;
  });

  readonly presenceTechniciens = computed(() => {
    const map = new Map<string, { name: string; status: InterventionStatus; codes: string[] }>();
    for (const i of this.toutesLesInterventions()) {
      if (!ACTIVE_STATUSES.includes(i.status) || !i.technicianId) continue;
      const existing = map.get(i.technicianId);
      if (existing) {
        existing.codes.push(i.code);
        if (i.status === 'en-cours') existing.status = 'en-cours';
      } else {
        map.set(i.technicianId, { name: i.technicianName, status: i.status, codes: [i.code] });
      }
    }
    // Only show technicians actively on-site (at least one en-cours intervention)
    return Array.from(map.values()).filter(t => t.status === 'en-cours');
  });

  readonly kpis = computed(() => {
    const items = this.toutesLesInterventions();
    const actifs: InterventionStatus[] = ['creee', 'assignee', 'en-cours', 'en-attente'];
    return {
      actives:  items.filter(i => actifs.includes(i.status)).length,
      enCours:  items.filter(i => i.status === 'en-cours').length,
      critiques:items.filter(i => i.priority === 'critique' && actifs.includes(i.status)).length,
      resolues: items.filter(i => ['terminee', 'validee', 'cloturee'].includes(i.status)).length,
      total:    items.length,
    };
  });

  readonly departementsDisponibles = computed(() => {
    const seen = new Set<string>();
    for (const i of this.toutesLesInterventions()) if (i.department) seen.add(i.department);
    return Array.from(seen).sort();
  });

  readonly institutionsDisponibles = computed(() => {
    const seen = new Set<string>();
    for (const i of this.toutesLesInterventions()) if (i.institutionName) seen.add(i.institutionName);
    return Array.from(seen).sort();
  });

  // ── Filter mutations ──────────────────────────────────────────────────────
  modifierRecherche(q: string): void { this._filtres.update(f => ({ ...f, recherche: q })); }

  toggleStatut(s: InterventionStatus): void {
    this._filtres.update(f => ({
      ...f, statuts: f.statuts.includes(s) ? f.statuts.filter(x => x !== s) : [...f.statuts, s],
    }));
  }

  toggleType(t: InterventionType): void {
    this._filtres.update(f => ({
      ...f, types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t],
    }));
  }

  togglePriorite(p: InterventionPriority): void {
    this._filtres.update(f => ({
      ...f, priorites: f.priorites.includes(p) ? f.priorites.filter(x => x !== p) : [...f.priorites, p],
    }));
  }

  modifierFiltre<K extends keyof FiltresIntervention>(cle: K, valeur: FiltresIntervention[K]): void {
    this._filtres.update(f => ({ ...f, [cle]: valeur }));
  }

  ouvrirFiltres(): void { this._filtresDrawerOuvert.set(true); }
  fermerFiltres(): void { this._filtresDrawerOuvert.set(false); }

  reinitialiserFiltres(): void {
    this._filtres.set({ ...FILTRES_VIDES });
    this._filtresDrawerOuvert.set(false);
  }

  filtrerUrgences():       void { this._filtres.update(f => ({ ...f, urgences_seules: !f.urgences_seules })); }
  filtrerAujourdHui():     void { this._filtres.update(f => ({ ...f, aujourd_hui:     !f.aujourd_hui })); }
  filtrerSansAssignation():void { this._filtres.update(f => ({ ...f, sans_assignation: !f.sans_assignation })); }
  filtrerSlaDepasse():     void { this._filtres.update(f => ({ ...f, sla_depasse:     !f.sla_depasse })); }

  // ── Selection ─────────────────────────────────────────────────────────────
  selectionner(i: Intervention | null): void { this._selection.set(i); }

  // ── Vue ───────────────────────────────────────────────────────────────────
  changerVue(v: VueIntervention): void { this._vue.set(v); }

  // ── Modal ─────────────────────────────────────────────────────────────────
  ouvrirModal(): void { this._donneesPreremplies.set(null); this._modalOuvert.set(true); }
  fermerModal(): void { this._modalOuvert.set(false); this._donneesPreremplies.set(null); }

  ouvrirModalAvecDonnees(donnees: DonneesPreremplies): void {
    this._donneesPreremplies.set(donnees);
    this._modalOuvert.set(true);
  }

  // ── Status ────────────────────────────────────────────────────────────────
  setStatus(id: string, status: InterventionStatus): void {
    const current = this.toutesLesInterventions().find(i => i.id === id);
    if (!current) return;
    const patch: Partial<Intervention> = { status };
    if (status === 'en-cours' && !current.startedAt) patch.startedAt = new Date().toISOString();
    if (status === 'cloturee') patch.closedAt = new Date().toISOString();
    const updated = { ...current, ...patch };
    this.store.update(updated);
    if (this._selection()?.id === id) this._selection.set(updated);
    this.toast.push('success', `Statut → ${statutLabel(status)}`);

    if (status === 'assignee' && current.sourceAlertId) {
      this.toast.push('info', 'Notification envoyée au superviseur OREPA');
    }

    if (['terminee', 'validee', 'cloturee'].includes(status) && current.sourceAlertId) {
      const alert = this.alertStore.snapshot.find(a => a.id === current.sourceAlertId);
      if (alert && ['ouverte', 'assignee', 'en-cours'].includes(alert.status)) {
        this.alertStore.setStatus(current.sourceAlertId, 'resolue');
        this.toast.push('info', `Alerte ${alert.code} résolue automatiquement`);
      }
    }
  }

  nextStatuses(status: InterventionStatus): InterventionStatus[] {
    return NEXT_STATUSES[status] ?? [];
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  toggleTask(intervention: Intervention, taskId: string): void {
    const updated: Intervention = {
      ...intervention,
      tasks: intervention.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t),
    };
    this.store.update(updated);
    if (this._selection()?.id === intervention.id) this._selection.set(updated);
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  saveNotes(intervention: Intervention, notes: string): void {
    if (!notes.trim()) return;
    const updated = { ...intervention, notes: notes.trim() };
    this.store.update(updated);
    if (this._selection()?.id === intervention.id) this._selection.set(updated);
    this.toast.push('success', 'Notes enregistrées.');
  }
}

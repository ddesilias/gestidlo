import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BffApiService, CreateInterventionPayload, InterventionTacheDto } from './api/bff-api.service';
import { AuthService } from './auth.service';

export type InterventionStatus   = 'creee' | 'envoyee' | 'assignee' | 'acceptee' | 'en-cours' | 'en-attente' | 'terminee' | 'rejetee' | 'validee' | 'cloturee' | 'annulee';
export type InterventionPriority = 'critique' | 'haute' | 'normale' | 'basse';
export type InterventionType     = 'verification' | 'reparation' | 'maintenance' | 'installation' | 'inspection' | 'urgence';

export interface InterventionTask {
  id: string; label: string; done: boolean;
}

export interface Intervention {
  id: string;
  code: string;
  type: InterventionType;
  title: string;
  description: string;
  status: InterventionStatus;
  priority: InterventionPriority;
  sourceAlertId?: string;
  sourceAlertCode?: string;
  infrastructureId?: string;
  infrastructureName?: string;
  commune?: string;
  department?: string;
  section?: string;
  institutionId: string;
  institutionName: string;
  technicianId: string;
  technicianName: string;
  assignedBy: string;
  createdAt: string;
  scheduledAt?: string;
  startedAt?: string;
  closedAt?: string;
  tasks: InterventionTask[];
  notes?: string;
  reportId?: string;
}

/**
 * Source unique des interventions (= ordres de travail = tickets kind=ORDRE). API-RÉEL : le mock
 * qui était DERRIÈRE le contrat a été basculé — c'est le « dernier flick ». Les signatures du
 * contrat (`creer/envoyer/accepter/refuser/demarrer/terminer/taches/cocherTache`) n'ont PAS changé :
 * le wizard superviseur et la fiche technicien tournent désormais sur le vrai backend sans une
 * ligne modifiée chez eux. Le périmètre est imposé par le JWT (`bff.tickets(undefined,'ORDRE')`).
 *
 * Les méthodes locales `add/update/setStatus/getActive` restent (consommateurs historiques de la
 * console admin) ; elles opèrent sur le cache local — sans persistance, comme avant le swap.
 */
@Injectable({ providedIn: 'root' })
export class InterventionStore {
  private readonly bff  = inject(BffApiService);
  private readonly auth = inject(AuthService);

  private readonly _items$ = new BehaviorSubject<Intervention[]>([]);
  readonly items$ = this._items$.asObservable();

  constructor() {
    this.charger();
    this.auth.userStream().subscribe(() => this.charger());
  }

  get snapshot(): Intervention[] { return this._items$.value; }

  /** Recharge les ordres de travail scopés (le serveur tranche le périmètre via le token). */
  charger(): void {
    if (!this.auth.isAuthenticated()) { this._items$.next([]); return; }
    this.bff.tickets(undefined, 'ORDRE').pipe(catchError(() => of([] as any[]))).subscribe(rows => {
      const list = (Array.isArray(rows) ? rows : []).map(t => this.fromTicket(t));
      this._items$.next(list);
      // Les tâches vivent sur un endpoint séparé : on les rapatrie par intervention (cache embarqué).
      list.forEach(it => this.chargerTaches(it.id));
    });
  }

  getActive(): Intervention[] {
    return this._items$.value.filter(i => !['cloturee', 'annulee', 'rejetee'].includes(i.status));
  }

  add(item: Intervention): void {
    this._items$.next([item, ...this._items$.value]);
  }

  update(item: Intervention): void {
    this._items$.next(this._items$.value.map(x => x.id === item.id ? item : x));
  }

  setStatus(id: string, status: InterventionStatus): void {
    this._items$.next(this._items$.value.map(i => i.id === id ? { ...i, status } : i));
  }

  // ════════ Contrat API-shaped — désormais RÉEL ════════

  creer(payload: CreateInterventionPayload): Observable<Intervention> {
    return this.bff.creerIntervention(payload).pipe(
      map(t => this.fromTicket(t)),
      tap(it => { this.add(it); this.chargerTaches(it.id); }),
    );
  }
  envoyer(id: string): Observable<Intervention>                  { return this.transition(this.bff.envoyerIntervention(+id), id); }
  accepter(id: string): Observable<Intervention>                 { return this.transition(this.bff.accepterIntervention(+id), id); }
  refuser(id: string, motif?: string): Observable<Intervention>  { return this.transition(this.bff.refuserIntervention(+id, motif), id); }
  demarrer(id: string): Observable<Intervention>                 { return this.transition(this.bff.demarrerIntervention(+id), id); }
  terminer(id: string): Observable<Intervention>                 { return this.transition(this.bff.terminerIntervention(+id), id); }

  /** Checklist de l'intervention (endpoint dédié). */
  taches(id: string): Observable<InterventionTask[]> {
    return this.bff.tachesIntervention(+id).pipe(
      map(ts => (ts ?? []).map(t => this.fromTache(t))),
      catchError(() => of([] as InterventionTask[])),
    );
  }

  /** Coche/décoche une tâche (terrain) puis met à jour le cache embarqué pour la fiche. */
  cocherTache(id: string, tacheId: string, done: boolean): Observable<InterventionTask[]> {
    return this.bff.cocherTacheIntervention(+id, +tacheId, done ? 'FAIT' : 'A_FAIRE').pipe(
      tap(() => this._items$.next(this._items$.value.map(i =>
        i.id === id ? { ...i, tasks: i.tasks.map(t => t.id === tacheId ? { ...t, done } : t) } : i))),
      map(() => this._items$.value.find(i => i.id === id)?.tasks ?? []),
    );
  }

  // ── Mapping Ticket → Intervention ──
  private transition(call$: Observable<any>, id: string): Observable<Intervention> {
    return call$.pipe(
      tap(t => {
        const mapped = this.fromTicket(t);
        // Le payload du ticket ne porte pas les tâches : on préserve celles déjà en cache.
        const existing = this._items$.value.find(i => i.id === id);
        const merged = { ...mapped, tasks: existing?.tasks ?? [] };
        this._items$.next(this._items$.value.map(i => i.id === id ? merged : i));
      }),
      map(() => this._items$.value.find(i => i.id === id)!),
    );
  }

  private chargerTaches(id: string): void {
    this.bff.tachesIntervention(+id).pipe(catchError(() => of([] as InterventionTacheDto[]))).subscribe(ts => {
      const tasks = (ts ?? []).map(t => this.fromTache(t));
      this._items$.next(this._items$.value.map(i => i.id === id ? { ...i, tasks } : i));
    });
  }

  private fromTache(t: InterventionTacheDto): InterventionTask {
    return { id: String(t.id), label: t.libelle, done: t.statut === 'FAIT' };
  }

  private fromTicket(t: any): Intervention {
    return {
      id: String(t.id),
      code: 'INT-' + t.id,
      type: (t.type ?? 'inspection') as InterventionType,
      title: t.titre ?? 'Intervention',
      description: t.consignes ?? '',
      status: this.mapStatut(t.status),
      priority: this.mapPriorite(t.priorite),
      infrastructureId: t.ouvrageId ?? undefined,
      infrastructureName: t.ouvrageId ?? undefined,
      commune: t.commune ?? undefined,
      department: undefined,
      institutionId: '', institutionName: '',
      technicianId: t.assignee ?? '', technicianName: t.assignee ?? '',
      assignedBy: t.superviseurId ?? '',
      createdAt: t.createdAt ?? new Date().toISOString(),
      scheduledAt: t.datePrevue ?? undefined,
      startedAt: t.startedAt ?? undefined,
      closedAt: t.completedAt ?? undefined,
      tasks: [],
      notes: t.resultatAttendu ?? undefined,
      reportId: t.rapportId != null ? String(t.rapportId) : undefined,
    };
  }

  private mapStatut(s: string): InterventionStatus {
    return ({
      BROUILLON: 'creee', ENVOYEE: 'envoyee', RECUE: 'envoyee', ACCEPTEE: 'acceptee',
      EN_COURS: 'en-cours', EN_PAUSE: 'en-attente', TERMINEE: 'terminee',
      RAPPORT_SOUMIS: 'terminee', VALIDEE: 'validee', REJETEE: 'rejetee', ANNULEE: 'annulee',
      OPEN: 'creee', ASSIGNED: 'assignee', IN_PROGRESS: 'en-cours', CLOSED: 'cloturee',
    } as Record<string, InterventionStatus>)[s] ?? 'creee';
  }

  private mapPriorite(p: string): InterventionPriority {
    const m: Record<string, InterventionPriority> = {
      urgente: 'critique', critique: 'critique', haute: 'haute', normale: 'normale', basse: 'basse',
    };
    return m[p] ?? 'normale';
  }
}

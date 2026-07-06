import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, catchError, of } from 'rxjs';
import { SLA_HOURS, EscaladeEvent, EscaladeType } from './zone.models';
import { BffApiService } from './api/bff-api.service';

export type AlertSeverity = 'critique' | 'haute' | 'moyenne' | 'basse';
export type AlertStatus   = 'ouverte' | 'assignee' | 'en-cours' | 'resolue' | 'ignoree' | 'archivee';
export type AlertSource   = 'iot' | 'technicien' | 'citoyen' | 'supervision' | 'systeme';

export interface AlertAssignment {
  institutionId: string;
  institutionName: string;
  technicianId: string;
  technicianName: string;
  assignedBy: string;
  assignedAt: string;
  interventionId?: string;
}

export interface GestAlert {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: AlertSource;
  department: string;
  commune: string;
  section?: string;
  infrastructureId?: string;
  infrastructureName?: string;
  sensorCode?: string;
  sensorThreshold?: number;
  sensorMeasuredValue?: number;
  sensorUnit?: string;
  createdAt: string;
  updatedAt: string;
  assignment?: AlertAssignment;
  interventionId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  // SLA & escalade
  escaladeNiveau: 0 | 1 | 2;          // 0 = TEPAC, 1 = URD, 2 = DINEPA
  escaladeType?: EscaladeType;         // undefined = pas encore escaladée
}

@Injectable({ providedIn: 'root' })
export class AlertStore {
  private readonly _items$: BehaviorSubject<GestAlert[]>;
  private readonly bff = inject(BffApiService);

  constructor() {
    // Timestamps computed fresh at service creation (= app bootstrap on page load)
    const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

    this._items$ = new BehaviorSubject<GestAlert[]>([
      {
        id: 'alt-001', code: 'ALT-2026-001', title: 'Pression faible — PE-02 Dessources',
        description: 'Pression réseau en dessous du seuil critique (< 0,3 bar). Population sans accès normal.',
        severity: 'haute', status: 'ouverte', source: 'iot',
        department: 'Ouest', commune: 'Léogâne', section: 'Dessources',
        infrastructureId: 'inf-r01', infrastructureName: 'Borne-fontaine PE-02', sensorCode: 'PRS-R01-003',
        sensorThreshold: 0.3, sensorMeasuredValue: 0.18, sensorUnit: 'bar',
        createdAt: ago(2), updatedAt: ago(2), escaladeNiveau: 0,
      },
      {
        id: 'alt-002', code: 'ALT-2026-002', title: 'Niveau réservoir R-01 critique',
        description: 'Niveau du réservoir R-01 à 18 %. Risque de coupure totale dans les 4h.',
        severity: 'critique', status: 'assignee', source: 'iot',
        department: 'Ouest', commune: 'Léogâne', section: 'Dessources',
        infrastructureId: 'inf-r01', infrastructureName: 'Réservoir R-01', sensorCode: 'LVL-R01-001',
        sensorThreshold: 20, sensorMeasuredValue: 18, sensorUnit: '%',
        createdAt: ago(6), updatedAt: ago(4), escaladeNiveau: 0,
        assignment: {
          institutionId: 'inst-001', institutionName: 'DINEPA Ouest',
          technicianId: 't-001', technicianName: 'Frantz Joseph',
          assignedBy: 'admin', assignedAt: ago(4),
        },
      },
      {
        id: 'alt-003', code: 'ALT-2026-003', title: 'Débit insuffisant — PE-03 Dessources',
        description: 'Débit mesuré à 0,1 L/s contre 0,8 L/s nominal. Anomalie réseau probable.',
        severity: 'moyenne', status: 'ouverte', source: 'iot',
        department: 'Ouest', commune: 'Léogâne', section: 'Dessources',
        infrastructureId: 'inf-pe01', infrastructureName: "Point d'eau PE-01", sensorCode: 'DEB-PE01-004',
        sensorThreshold: 0.4, sensorMeasuredValue: 0.1, sensorUnit: 'L/s',
        createdAt: ago(3), updatedAt: ago(3), escaladeNiveau: 0,
      },
      {
        id: 'alt-004', code: 'ALT-2026-004', title: 'Coupure générale — Léogâne Centre',
        description: 'Service suspendu depuis 03h00. Pompe P-01 arrêt non planifié.',
        severity: 'critique', status: 'en-cours', source: 'technicien',
        department: 'Ouest', commune: 'Léogâne', section: 'Centre',
        infrastructureId: 'inf-sp01', infrastructureName: 'Station de pompage SP-01',
        createdAt: ago(8), updatedAt: ago(2), escaladeNiveau: 0,
        assignment: {
          institutionId: 'inst-001', institutionName: 'DINEPA Ouest',
          technicianId: 't-002', technicianName: 'Gérald Baptiste',
          assignedBy: 'admin', assignedAt: ago(6),
          interventionId: 'int-001',
        },
        interventionId: 'int-001',
      },
      {
        id: 'alt-005', code: 'ALT-2026-005', title: 'Réservoir R-02 hors ligne',
        description: 'Capteur LVL-R02-001 déconnecté depuis 4h. Niveau inconnu.',
        severity: 'haute', status: 'ouverte', source: 'systeme',
        department: 'Ouest', commune: 'Petit-Goâve', section: 'Centre',
        infrastructureId: 'inf-r02', infrastructureName: 'Réservoir R-02', sensorCode: 'LVL-R02-001',
        createdAt: ago(4), updatedAt: ago(4), escaladeNiveau: 0,
      },
    ]);
  }

  get items$() { return this._items$.asObservable(); }

  get snapshot(): GestAlert[] { return this._items$.value; }

  // ── Backend (source scopée) ──────────────────────────────────────
  // La liste affichée et tous les compteurs dérivent de _items$ : un seul agrégat,
  // jamais de total stocké à part → le badge du header ne peut pas se désynchroniser
  // du tableau. `charger(dept)` est rappelé en ngOnInit (restaure après reload).

  /**
   * Charge les alertes depuis le backend et REMPLACE la liste.
   * Le périmètre est imposé côté serveur depuis le token (SUPERVISEUR_URD) ;
   * `departementId` n'est qu'un indice — le serveur reste le garde-fou.
   */
  charger(departementId?: string): void {
    // Pas de filtre status : on charge les TROIS segments (à traiter / en cours / traitées)
    // d'un coup, pour que les compteurs de segment s'agrègent depuis une seule liste.
    this.bff.alerts(undefined, departementId).pipe(
      catchError(() => of(null)),
    ).subscribe(rows => {
      if (!Array.isArray(rows)) return; // backend offline → on garde la liste courante
      this._items$.next(rows.map(r => this._fromBackend(r, departementId ?? r?.territory ?? '')));
    });
  }

  /**
   * Geste « traiter » : assigner un technicien + créer l'intervention.
   * On PERSISTE d'abord (POST ticket = l'intervention), puis l'UI suit — l'alerte
   * bascule « ouverte → en-cours », quitte « à traiter » et réapparaît sous « en cours ».
   * Même contrat que partout : persister d'abord, l'affichage suit.
   */
  traiter(alerte: GestAlert, technicien: { id: string; nom: string }): void {
    const num = Number(alerte.id);
    const apply = () => this._items$.next(this._items$.value.map(a =>
      a.id === alerte.id
        ? {
            ...a,
            status: 'en-cours' as AlertStatus,
            interventionId: a.interventionId ?? `int-${a.id}`,
            assignment: {
              institutionId: '', institutionName: `URD ${a.department}`,
              technicianId: technicien.id, technicianName: technicien.nom,
              assignedBy: 'superviseur', assignedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          }
        : a
    ));
    if (Number.isFinite(num)) {
      this.bff.createTicket(num, technicien.nom).pipe(catchError(() => of(null))).subscribe(() => apply());
    } else {
      apply(); // alertes sans id backend (mock) : pas de persistance, bascule locale
    }
  }

  private _fromBackend(d: any, dept: string): GestAlert {
    const now = new Date().toISOString();
    return {
      id:                 String(d.id),
      code:               `ALT-${d.id}`,
      title:              d.message ?? `${d.type ?? 'Alerte'} — ${d.pointId ?? ''}`,
      description:        d.message ?? '',
      severity:           this._mapSeverity(d.severity),
      status:             this._mapStatus(d.status),
      source:             'iot',
      department:         dept,
      commune:            d.commune ?? '',
      infrastructureName: d.pointId,
      sensorCode:         d.sensorId,
      createdAt:          d.openedAt ?? now,
      updatedAt:          d.updatedAt ?? d.openedAt ?? now,
      escaladeNiveau:     0,
    };
  }

  private _mapSeverity(s: string): AlertSeverity {
    switch ((s ?? '').toUpperCase()) {
      case 'CRIT': return 'critique';
      case 'WARN': return 'haute';
      default:     return 'basse';
    }
  }

  private _mapStatus(s: string): AlertStatus {
    switch ((s ?? '').toUpperCase()) {
      case 'ACK':    return 'assignee';
      case 'CLOSED': return 'resolue';
      default:       return 'ouverte';
    }
  }

  getOpen(): GestAlert[] { return this._items$.value.filter(a => a.status === 'ouverte'); }
  getActive(): GestAlert[] { return this._items$.value.filter(a => ['ouverte','assignee','en-cours'].includes(a.status)); }

  add(alert: GestAlert): void {
    this._items$.next([alert, ...this._items$.value]);
  }

  assign(alertId: string, assignment: AlertAssignment, interventionId?: string): void {
    this._items$.next(this._items$.value.map(a => {
      if (a.id !== alertId) return a;
      return {
        ...a,
        status: 'assignee' as AlertStatus,
        assignment,
        interventionId: interventionId ?? a.interventionId,
        updatedAt: new Date().toISOString(),
      };
    }));
  }

  setStatus(alertId: string, status: AlertStatus): void {
    this._items$.next(this._items$.value.map(a =>
      a.id === alertId ? { ...a, status, updatedAt: new Date().toISOString() } : a,
    ));
  }

  update(alert: GestAlert): void {
    this._items$.next(this._items$.value.map(x => x.id === alert.id ? alert : x));
  }

  // ── SLA helpers ────────────────────────────────────────────────

  slaDeadlineMs(alert: GestAlert): number {
    return new Date(alert.createdAt).getTime() + (SLA_HOURS[alert.severity] ?? 72) * 3_600_000;
  }

  /** 'ok' | 'warning' (< 25% restant) | 'breach' */
  slaStatus(alert: GestAlert): 'ok' | 'warning' | 'breach' {
    const now = Date.now();
    const deadline = this.slaDeadlineMs(alert);
    const totalMs = (SLA_HOURS[alert.severity] ?? 72) * 3_600_000;
    if (now >= deadline) return 'breach';
    if (now >= deadline - totalMs * 0.25) return 'warning';
    return 'ok';
  }

  slaRemainingLabel(alert: GestAlert): string {
    const diffMs = this.slaDeadlineMs(alert) - Date.now();
    if (diffMs <= 0) {
      const overMs = -diffMs;
      const overH  = Math.floor(overMs / 3_600_000);
      return overH > 0 ? `+${overH}h dépassé` : `+${Math.ceil(overMs / 60_000)} min dépassé`;
    }
    const h = Math.floor(diffMs / 3_600_000);
    const m = Math.floor((diffMs % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}min` : `${m} min`;
  }

  // ── Escalade engine ────────────────────────────────────────────

  readonly escaladeEvents = signal<EscaladeEvent[]>([]);

  /**
   * Vérifie les SLA de toutes les alertes ouvertes et auto-escalade
   * si dépassement sans intervention. Appeler périodiquement ou à l'initialisation.
   */
  checkAndEscalate(hasTepac: (commune: string) => boolean): void {
    const now = Date.now();
    const updated = this._items$.value.map(a => {
      if (!['ouverte', 'assignee'].includes(a.status)) return a;
      if (a.interventionId) return a; // déjà prise en charge
      const deadline = this.slaDeadlineMs(a);
      if (now < deadline) return a;

      // Commune sans TEPAC → niveau 1 immédiat
      const noTepac = !hasTepac(a.commune);
      const targetNiveau: 1 | 2 = noTepac || a.escaladeNiveau >= 1 ? 2 : 1;
      if (a.escaladeNiveau >= targetNiveau) return a;

      const event: EscaladeEvent = {
        id:           `esc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        alerteId:     a.id,
        type:         'automatique',
        palierDepart: a.escaladeNiveau as 0 | 1 | 2,
        palierArrive: targetNiveau,
        auteur:       'systeme',
        date:         new Date().toISOString(),
        motif:        noTepac ? 'Commune sans TEPAC — escalade immédiate' : 'SLA dépassé sans intervention',
      };
      this.escaladeEvents.update(evs => [...evs, event]);
      return { ...a, escaladeNiveau: targetNiveau, escaladeType: 'automatique' as const };
    });
    this._items$.next(updated);
  }

  escaladeManuelle(alertId: string, motif: string, auteur = 'responsable'): void {
    const a = this._items$.value.find(x => x.id === alertId);
    if (!a) return;
    const palierArrive = Math.min(a.escaladeNiveau + 1, 2) as 1 | 2;
    if (palierArrive <= a.escaladeNiveau) return;

    const event: EscaladeEvent = {
      id:           `esc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      alerteId:     alertId,
      type:         'manuelle',
      palierDepart: a.escaladeNiveau as 0 | 1 | 2,
      palierArrive,
      auteur,
      date:         new Date().toISOString(),
      motif,
    };
    this.escaladeEvents.update(evs => [...evs, event]);
    this._items$.next(this._items$.value.map(x =>
      x.id === alertId
        ? { ...x, escaladeNiveau: palierArrive, escaladeType: 'manuelle' as const, updatedAt: new Date().toISOString() }
        : x
    ));
  }

  getEscaladeEvents(alertId: string): EscaladeEvent[] {
    return this.escaladeEvents().filter(e => e.alerteId === alertId);
  }
}

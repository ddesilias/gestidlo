import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';
import { BffApiService, OuvrageDto, CapteurDto, OuvrageTypeDto, CapteurTypeDto } from './api/bff-api.service';

export type InfraType   = 'captage' | 'reservoir' | 'pompe' | 'traitement' | 'conduite' | 'point-eau' | 'borne' | 'kiosque' | 'passerelle' | 'energie';
export type InfraStatus = 'en-service' | 'hors-service' | 'maintenance' | 'a-inspecter' | 'critique' | 'archive';
export type IotStatus   = 'connecte' | 'deconnecte' | 'signal-faible' | 'batterie-faible' | 'non-equipe';

export interface Sensor {
  id: string; code: string; name: string;
  type: 'niveau' | 'pression' | 'debit' | 'qualite' | 'ph' | 'temperature';
  unit: string; value: number;
  status: 'connecte' | 'deconnecte' | 'signal-faible';
  battery: number; signal: number; lastSeen: string;
}

export interface Infrastructure {
  id: string; name: string; code: string; type: InfraType;
  status: InfraStatus; iotStatus: IotStatus;
  department: string; commune: string; section?: string; locality?: string;
  lat?: number; lon?: number;
  description?: string;
  capacity?: string; material?: string; installDate?: string;
  physicalCondition?: 'bon' | 'moyen' | 'mauvais' | 'inconnu';
  resourceId?: string; resourceName?: string;
  captageCode?: string; aepSystem?: string;
  upstreamCode?: string; downstreamCodes?: string[];
  sensors: Sensor[];
  lastActivity?: string;
  institution?: string; technician?: string;
  population?: number;
}

// ── Mapping DTO backend → modèle d'affichage ────────────────────────────────
const OUVRAGE_TYPE: Record<OuvrageTypeDto, InfraType> = {
  CAPTAGE: 'captage', FORAGE: 'captage', PUITS: 'point-eau', POMPAGE: 'pompe',
  TRAITEMENT: 'traitement', RESERVOIR: 'reservoir', RESEAU: 'conduite', BORNE: 'borne',
};
const OUVRAGE_STATUS: Record<string, InfraStatus> = {
  OPERATIONNEL: 'en-service', MAINTENANCE: 'maintenance', PANNE: 'hors-service', VETUSTE: 'a-inspecter',
};
const CAPTEUR_TYPE: Record<CapteurTypeDto, Sensor['type']> = {
  PRESSION: 'pression', NIVEAU: 'niveau', DEBIT: 'debit', QUALITE: 'qualite',
};

@Injectable({ providedIn: 'root' })
export class InfrastructureStore {
  private readonly bff = inject(BffApiService);
  // Source unique = backend (ouvrages + capteurs IoT), scopé par le JWT côté serveur.
  // Plus aucun catalogue en dur : un TEPAC/superviseur ne voit que SON patrimoine réel.
  private _items$ = new BehaviorSubject<Infrastructure[]>([]);

  readonly items$ = this._items$.asObservable();

  constructor() {
    this.loadFromApi();
  }

  get snapshot(): Infrastructure[] { return this._items$.value; }

  /** Recharge ouvrages + capteurs depuis l'API (scope imposé par le token). */
  reload(): void { this.loadFromApi(); }

  getByType(type: InfraType): Infrastructure[] {
    return this._items$.value.filter(i => i.type === type && i.status !== 'archive');
  }

  getReservoirs(): Infrastructure[] { return this.getByType('reservoir'); }

  add(item: Infrastructure): void {
    this._items$.next([item, ...this._items$.value]);
  }

  update(item: Infrastructure): void {
    this._items$.next(this._items$.value.map(x => x.id === item.id ? item : x));
  }

  remove(id: string): void {
    this._items$.next(this._items$.value.filter(x => x.id !== id));
  }

  // ── Backend ───────────────────────────────────────────────────────────────
  private loadFromApi(): void {
    forkJoin({
      ouvrages: this.bff.listOuvrages().pipe(catchError(() => of([] as OuvrageDto[]))),
      capteurs: this.bff.listCapteurs().pipe(catchError(() => of([] as CapteurDto[]))),
    }).subscribe(({ ouvrages, capteurs }) => {
      this._items$.next(this.assemble(ouvrages, capteurs));
    });
  }

  /** Assemble les ouvrages avec leurs capteurs (regroupés par ouvrageId). */
  private assemble(ouvrages: OuvrageDto[], capteurs: CapteurDto[]): Infrastructure[] {
    const sensorsByOuvrage = new Map<string, Sensor[]>();
    for (const c of capteurs) {
      if (!c.ouvrageId) continue;
      const list = sensorsByOuvrage.get(c.ouvrageId) ?? [];
      list.push(this.toSensor(c));
      sensorsByOuvrage.set(c.ouvrageId, list);
    }
    return ouvrages.map(o => this.toInfra(o, sensorsByOuvrage.get(o.id) ?? []));
  }

  private toInfra(o: OuvrageDto, sensors: Sensor[]): Infrastructure {
    return {
      id: o.id, name: o.nom, code: o.code,
      type: OUVRAGE_TYPE[o.type] ?? 'captage',
      status: o.statut === 'REJETEE' ? 'archive' : (OUVRAGE_STATUS[o.etat] ?? 'a-inspecter'),
      iotStatus: this.deriveIot(sensors),
      department: o.department, commune: o.commune ?? '',
      section: o.section ?? undefined, locality: o.locality ?? undefined,
      lat: o.lat ?? undefined, lon: o.lon ?? undefined,
      description: o.notes ?? undefined,
      capacity: o.capaciteM3h != null ? `${o.capaciteM3h} m³/h` : undefined,
      installDate: o.anneeConstruction != null ? String(o.anneeConstruction) : undefined,
      resourceId: o.resourceId ?? undefined, resourceName: o.resourceName ?? undefined,
      sensors,
      lastActivity: sensors[0]?.lastSeen ?? '—',
      technician: o.createdBy ?? undefined,
    };
  }

  private toSensor(c: CapteurDto): Sensor {
    const status: Sensor['status'] =
      c.lastValue == null ? 'deconnecte'
      : (c.signal != null && c.signal < -85) ? 'signal-faible'
      : 'connecte';
    return {
      id: c.id, code: c.code, name: c.nom,
      type: CAPTEUR_TYPE[c.type] ?? 'niveau',
      unit: c.unit ?? '', value: c.lastValue ?? 0,
      status, battery: c.battery ?? 0, signal: c.signal ?? 0,
      lastSeen: c.derniereMesure ?? '—',
    };
  }

  private deriveIot(sensors: Sensor[]): IotStatus {
    if (!sensors.length) return 'non-equipe';
    if (sensors.some(s => s.status === 'connecte')) return 'connecte';
    if (sensors.some(s => s.status === 'signal-faible')) return 'signal-faible';
    return 'deconnecte';
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { BffApiService, ZoneDto } from './api/bff-api.service';

export type { ZoneDto } from './api/bff-api.service';

/**
 * SOURCE UNIQUE des zones = le BACKEND (api-metier `zones`, via BFF). Décision d'archi : le backend
 * fait foi (persistant, multi-poste). Le dashboard, la fiche URD et le DepartementsStore lisent CE
 * store — plus `ZoneRegistreService` (localStorage) — pour raconter la même histoire que la page
 * superviseur (qui lit déjà le backend). `reload()` après toute activation de zone.
 */
@Injectable({ providedIn: 'root' })
export class ZonesBackendStore {
  private readonly bff = inject(BffApiService);
  private readonly _zones = signal<ZoneDto[]>([]);
  readonly zones = this._zones.asReadonly();

  constructor() { this.reload(); }

  /** Charge toutes les zones du périmètre du token (national pour l'admin, département pour le superviseur). */
  reload(): void {
    this.bff.listZones().pipe(catchError(() => of([] as ZoneDto[])))
      .subscribe(rows => this._zones.set(Array.isArray(rows) ? rows : []));
  }
}

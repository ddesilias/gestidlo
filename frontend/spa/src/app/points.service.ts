import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { BffApiService } from './api/bff-api.service';

export type PointType = string;

export type PointDefinition = {
  id: string;
  name: string;
  type: PointType;
  territory?: string | null;
  lon?: number | null;
  lat?: number | null;
  description?: string | null;
  active: boolean;
};

@Injectable({ providedIn: 'root' })
export class PointsService {
  private readonly items$ = new BehaviorSubject<PointDefinition[]>([]);
  private loaded = false;
  private inFlight?: Observable<PointDefinition[]>;

  constructor(private readonly api: BffApiService) {
    this.reload().subscribe({
      // best-effort; pages also auto-refresh
      error: () => undefined
    });
  }

  stream(): Observable<PointDefinition[]> {
    return this.items$.asObservable();
  }

  ensureLoaded(): Observable<PointDefinition[]> {
    if (this.loaded) {
      return this.items$.asObservable();
    }
    if (!this.inFlight) {
      this.inFlight = this.reload();
    }
    return this.inFlight;
  }

  reload(): Observable<PointDefinition[]> {
    return this.api.referencePoints().pipe(
      tap((rows) => {
        this.loaded = true;
        this.inFlight = undefined;
        this.items$.next((rows as any[]) as PointDefinition[]);
      })
    );
  }

  all(): PointDefinition[] {
    return this.items$.value.filter((p) => p.active);
  }

  allIncludingInactive(): PointDefinition[] {
    return this.items$.value;
  }

  get(id: string): PointDefinition | undefined {
    return this.items$.value.find((p) => p.id === id);
  }

  label(id: string): string {
    return this.get(id)?.name ?? id;
  }
}

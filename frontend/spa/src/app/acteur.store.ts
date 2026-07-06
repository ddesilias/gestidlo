import { Injectable, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { BffApiService, ActeurDto } from './api/bff-api.service';

export type { ActeurDto } from './api/bff-api.service';

// Acteurs enregistrés via le modal (5 familles), persistés durablement (api-metier),
// avec repli localStorage. Source des compteurs « live » de l'annuaire : l'onglet
// Acteurs fusionne ces enregistrements avec les acteurs dérivés (institutions seed +
// couverture TEPAC). La création n'est PAS optimiste : on attend la réponse du serveur
// (qui refuse les doublons métier en 422), puis on pousse le résultat dans le signal.
const STORAGE_KEY = 'gestidlo_acteurs_v1';

@Injectable({ providedIn: 'root' })
export class ActeurStore {
  private readonly _items = signal<ActeurDto[]>(this._loadLocal());

  readonly items = this._items.asReadonly();

  constructor(private readonly bff: BffApiService) {
    this._loadFromApi();
  }

  get snapshot(): ActeurDto[] { return this._items(); }

  forDept(dept?: string): ActeurDto[] {
    return dept ? this._items().filter(a => a.departementId === dept) : this._items();
  }

  /** POST puis mise à jour du store. Renvoie l'observable pour que l'appelant
   * (le modal) gère succès / message d'erreur métier (422). */
  creerActeur(payload: Parameters<BffApiService['createActeur']>[0]): Observable<ActeurDto> {
    return this.bff.createActeur(payload).pipe(tap(dto => this._merge([dto])));
  }

  /** Archivage (soft-delete côté serveur) puis retrait du signal partagé. */
  supprimerActeur(id: string): Observable<void> {
    return this.bff.deleteActeur(id).pipe(tap(() => {
      this._items.update(list => list.filter(a => a.id !== id));
      this._persistLocal();
    }));
  }

  /** Suspendre / réactiver puis mise à jour du signal avec l'acteur renvoyé par le serveur. */
  changerStatut(id: string, statut: 'actif' | 'suspendu'): Observable<ActeurDto> {
    return this.bff.changerStatutActeur(id, statut).pipe(tap(dto => this._merge([dto])));
  }

  reload(): void { this._loadFromApi(); }

  private _loadFromApi(): void {
    this.bff.listActeurs().pipe(
      catchError(() => of([] as ActeurDto[])),
    ).subscribe(dtos => this._merge(dtos, true));
  }

  private _merge(dtos: ActeurDto[], replaceAll = false): void {
    if (!replaceAll && dtos.length === 0) return;
    this._items.update(list => {
      const byId = new Map(list.map(a => [a.id, a] as const));
      for (const d of dtos) byId.set(d.id, d);
      return [...byId.values()];
    });
    this._persistLocal();
  }

  private _loadLocal(): ActeurDto[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ActeurDto[];
    } catch { /* corrompu — on ignore */ }
    return [];
  }

  private _persistLocal(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._items())); } catch { /* quota */ }
  }
}

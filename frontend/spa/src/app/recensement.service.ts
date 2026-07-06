import { Injectable, signal } from '@angular/core';

export type RecensementKind = 'ressource' | 'ouvrage';
export interface RecensementCoords { lat: number; lng: number; }

/**
 * « Un composant, ouvert de partout. » Pilote les wizards EXISTANTS (Recenser une
 * ressource / Enregistrer un ouvrage) au niveau du shell superviseur, pour qu'ils
 * s'ouvrent par-dessus la carte sans quitter la page. La carte appelle `ouvrir(...)`,
 * le layout monte le composant de page concerné en mode overlay, et `fermer()` à la
 * fermeture — l'utilisateur reste sur la carte. Le scope (département) reste verrouillé
 * car on réutilise les pages telles quelles.
 */
@Injectable({ providedIn: 'root' })
export class RecensementService {
  readonly mode   = signal<RecensementKind | null>(null);
  readonly coords = signal<RecensementCoords | null>(null);

  ouvrir(kind: RecensementKind, coords?: RecensementCoords | null): void {
    this.coords.set(coords ?? null);
    this.mode.set(kind);
  }

  fermer(): void {
    this.mode.set(null);
    this.coords.set(null);
  }
}

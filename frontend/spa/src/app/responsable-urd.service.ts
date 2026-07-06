import { Injectable, Injector, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { UserRegistryService, UserProfileDto } from './user-registry.service';

/** Carte affichée à l'étape 2 — projection minimale du compte superviseur_urd. */
export interface ResponsableUrd {
  initiales: string;
  nomComplet: string;
  enLigne: boolean;
}

/**
 * Responsable d'une URD = le compte `superviseur_urd` rattaché à cette URD (urdId).
 *
 * On NE refait PAS un GET dédié : on lit le registre des utilisateurs
 * (UserRegistryService → bff.listUsers → backend), exactement la même source
 * que InstitutionsStore.list. C'est ce qui garantit le comportement voulu :
 * si un responsable est désigné ailleurs (creer-superviseur), il apparaît ici
 * tout seul, sans rechargement — l'émission se met à jour via le signal partagé.
 */
@Injectable({ providedIn: 'root' })
export class ResponsableUrdService {
  private readonly registry = inject(UserRegistryService);
  private readonly injector = inject(Injector);

  getByUrd(urdId: string): Observable<ResponsableUrd | null> {
    const id = String(urdId);
    const resp = computed<ResponsableUrd | null>(() => {
      // Dernier superviseur désigné pour l'URD = responsable affiché (même règle
      // que InstitutionsStore : on indexe par urdId, on garde le dernier).
      const u = this.registry.list().filter(x => x.urdId === id).at(-1);
      return u ? toResponsable(u) : null;
    });
    return toObservable(resp, { injector: this.injector });
  }
}

function toResponsable(p: UserProfileDto): ResponsableUrd {
  return {
    initiales:  p.initiales || initialesFrom(p.nom),
    nomComplet: p.nom,
    // Pas de présence temps réel côté backend : on reflète l'état du compte.
    enLigne:    (p.statut ?? '').toUpperCase().startsWith('ACTIF'),
  };
}

function initialesFrom(nom: string): string {
  return (nom ?? '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

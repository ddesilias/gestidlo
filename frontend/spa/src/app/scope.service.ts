import { Injectable, inject } from '@angular/core';

import { AuthService } from './auth.service';

/**
 * Source unique du périmètre de l'utilisateur connecté.
 *
 * Le scope ne vient PAS d'un clic (`@Input()` posé par l'admin) mais du compte :
 * il est dérivé une seule fois de `currentUser.urdId`, lui-même embarqué dans le
 * token au login. Côté serveur, le filtre reste imposé par le token — ce service
 * n'est que de l'UX. Tous les composants scopés (Territoire, Infrastructures,
 * Ressources, Acteurs, Alertes, Rapports) le consomment sans poser de question.
 */
@Injectable({ providedIn: 'root' })
export class ScopeService {
  private readonly auth = inject(AuthService);

  /** URD du compte (ex. "URD-NORD"). `null` = compte hors URD (admin DINEPA). */
  get urdId(): string | null {
    return this.auth.userSnapshot()?.urdId ?? null;
  }

  /** Département administratif de l'URD (ex. "Nord"). */
  get dept(): string | null {
    return this.auth.userSnapshot()?.dept ?? null;
  }

  /**
   * Identifiant de département consommé par les listes scopées
   * (`listActeurs`, `listRessources`, …). Aujourd'hui = le département de l'URD.
   */
  get departementId(): string | null {
    return this.dept;
  }

  /** `true` si l'utilisateur est rattaché à une URD (et donc verrouillé dessus). */
  get isScoped(): boolean {
    return this.urdId != null;
  }

  /**
   * Scope prêt à brancher sur l'`@Input() scope` des pages embarquables
   * (resources-page, acteurs-page, …). `null` hors URD → la page retombe
   * sur sa vue admin complète.
   */
  get autoScope(): { dept: string; urdId?: string; commune?: string } | null {
    const u = this.auth.userSnapshot();
    // Le périmètre EST le territoire (dept + commune). L'`urdId` n'identifie que l'URD d'un
    // superviseur ; un TEPAC est rattaché à une commune sans forcément porter d'`urdId`. On
    // dérive donc le scope dès que `dept` existe — sinon (admin DINEPA) vue complète.
    // `commune` non nulle pour un TEPAC → les pages embarquées resserrent du dept à la commune.
    if (!u?.dept) return null;
    return { dept: u.dept, urdId: u.urdId ?? undefined, commune: u.commune ?? undefined };
  }
}

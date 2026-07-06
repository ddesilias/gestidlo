import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, timeout } from 'rxjs';

import { BffApiService, RapportDto, ValiderExamenDto } from './api/bff-api.service';

export type { RapportDto, ValiderExamenDto } from './api/bff-api.service';

/**
 * Rapports scopés à l'URD du superviseur. Comme les alertes : une seule liste, les
 * compteurs en sont des `computed()` (jamais stockés à part), le badge « à valider »
 * de la sidebar = `nbAValider()` (les TRANSMIS). Gestes valider/renvoyer : on persiste
 * d'abord (PATCH serveur), puis l'UI suit — le rapport quitte le bucket « à valider »
 * et le compteur tombe tout seul.
 */
@Injectable({ providedIn: 'root' })
export class RapportsStore {
  private readonly bff = inject(BffApiService);
  private readonly _items = signal<RapportDto[]>([]);

  readonly items = this._items.asReadonly();

  readonly nbAValider     = computed(() => this._items().filter(r => r.status === 'TRANSMIS').length);
  readonly nbBrouillons   = computed(() => this._items().filter(r => r.status === 'BROUILLON').length);
  readonly nbValides      = computed(() => this._items().filter(r => r.status === 'VALIDE').length);
  readonly nbTransmisAdmin = computed(() => this._items().filter(r => r.status === 'TRANSMIS_ADMIN').length);
  readonly nbArchives     = computed(() => this._items().filter(r => r.status === 'ARCHIVE').length);

  /**
   * Charge les rapports scopés (le serveur impose le périmètre depuis le token).
   * On exclut les rapports NATIONAUX (Exécutif, Audit DINEPA) : ils ne relèvent pas de la
   * validation d'un superviseur d'URD. C'est ce que promet déjà le pied de la file « à valider »
   * — désormais réellement appliqué, donc tous les compteurs (badge, segments, « Tous ») concordent.
   */
  charger(departementId?: string): void {
    this.bff.listRapports(departementId).pipe(
      catchError(() => of([] as RapportDto[])),
    ).subscribe(rows => this._items.set(
      Array.isArray(rows) ? rows.filter(r => !r.national) : []
    ));
  }

  /**
   * Valide (TRANSMIS → VALIDE). `examen` = couche du superviseur gelée dans le snapshot signé.
   * `done` reçoit le rapport mis à jour, ou `null` si l'appel a échoué (l'écran pilote son busy/erreur).
   */
  valider(id: string, examen?: ValiderExamenDto, done?: (r: RapportDto | null) => void): void {
    this.bff.validerRapport(id, examen).pipe(catchError(() => of(null)))
      .subscribe(r => { if (r) this._apply(r); done?.(r); });
  }

  /** Signe et transmet à l'admin (VALIDE → TRANSMIS_ADMIN). Geste du superviseur signataire. */
  signer(id: string, done?: (r: RapportDto | null) => void): void {
    this.bff.signerRapport(id).pipe(catchError(() => of(null)))
      .subscribe(r => { if (r) this._apply(r); done?.(r); });
  }

  renvoyer(id: string, motif: string, done?: (r: RapportDto | null) => void): void {
    this.bff.renvoyerRapport(id, motif).pipe(catchError(() => of(null)))
      .subscribe(r => { if (r) this._apply(r); done?.(r); });
  }

  /**
   * Crée un brouillon puis le pousse en tête de liste (le serveur a posé commune/dept du JWT).
   * `contenuJson` = choix guidés sérialisés ; le serveur en dérive le texte pro (resumeAuto).
   */
  creer(
    payload: { titre: string; type?: string; pages?: number | null; contenuJson?: string | null; interventionId?: number | null },
    onDone?: (r: RapportDto) => void,
    onError?: (e: unknown) => void,
  ): void {
    // timeout : un backend qui hang (requête pending) ne doit jamais figer l'UI indéfiniment.
    // onError : sans branche d'erreur, un 4xx/5xx laisse le spinner tourner pour toujours.
    this.bff.creerRapport(payload).pipe(
      timeout(15000),
      catchError(e => { onError?.(e); return of(null); }),
    ).subscribe(r => {
      if (r) { this._items.update(l => [r, ...l]); onDone?.(r); }
    });
  }

  transmettre(id: string): void {
    this.bff.transmettreRapport(id).pipe(catchError(() => of(null))).subscribe(r => { if (r) this._apply(r); });
  }

  private _apply(r: RapportDto): void {
    this._items.update(list => list.map(x => (x.id === r.id ? r : x)));
  }
}

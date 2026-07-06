import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, timer, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { BffApiService } from './api/bff-api.service';
import { AuthService } from './auth.service';

export interface Notif {
  id: number; type: string; titre: string; corps: string | null;
  alertId: number | null; commune: string | null; lu: boolean; createdAt: string;
}

/**
 * Boîte de notifications de l'utilisateur connecté. Le ciblage a déjà été fait côté serveur
 * (fan-out à la création de l'alerte) ; ici on lit SES notifications (liste complète pour le
 * panneau de la cloche) et on les marque lues.
 *
 * Rafraîchissement par POLLING (30 s, immédiat au démarrage et à chaque changement de session).
 * Le push temps réel SSE existe côté api-metier mais n'est pas encore proxifié par le BFF →
 * upgrade ultérieure ; le polling suffit pour allumer la cloche. Badge = `compteur()` = nb de
 * non-lues, jamais un nombre stocké à part.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly bff  = inject(BffApiService);
  private readonly auth = inject(AuthService);

  /** Liste complète (lues + non lues) affichée dans le panneau. */
  readonly liste    = signal<Notif[]>([]);
  readonly nonLues  = computed(() => this.liste().filter(n => !n.lu));
  readonly compteur = computed(() => this.nonLues().length);

  private sub?: Subscription;

  constructor() {
    this.demarrer();
    this.auth.userStream().subscribe(() => {
      if (this.auth.isAuthenticated()) this.rafraichir();
      else this.liste.set([]);   // déconnexion → cloche vide
    });
  }

  /** Démarre le polling (immédiat puis 30 s). Idempotent. */
  demarrer(): void {
    if (this.sub) return;
    this.sub = timer(0, 30_000).pipe(
      filter(() => this.auth.isAuthenticated()),
      switchMap(() => this.bff.notifications(false).pipe(catchError(() => of([] as Notif[])))),
    ).subscribe(list => this.liste.set((list ?? []) as Notif[]));
  }

  /** Relecture immédiate (après création d'alerte, ou changement de session). */
  rafraichir(): void {
    if (!this.auth.isAuthenticated()) return;
    this.bff.notifications(false).pipe(catchError(() => of([] as Notif[])))
      .subscribe(l => this.liste.set((l ?? []) as Notif[]));
  }

  /** Marque UNE notification lue (optimiste, le serveur ne touche que les siennes). */
  marquerLu(id: number): void {
    if (this.liste().find(n => n.id === id)?.lu) return;
    this.liste.update(l => l.map(n => n.id === id ? { ...n, lu: true } : n));
    this.bff.marquerNotifLue(id).subscribe({ error: () => this.rafraichir() });
  }

  /** Tout marquer lu → la cloche s'éteint. */
  marquerToutLu(): void {
    this.liste.update(l => l.map(n => ({ ...n, lu: true })));
    this.bff.toutMarquerNotifLu().subscribe({ error: () => this.rafraichir() });
  }

  /** Clic sur une notification : on la marque lue (la navigation vers l'alerte viendra ensuite). */
  ouvrir(n: Notif): void {
    this.marquerLu(n.id);
  }
}

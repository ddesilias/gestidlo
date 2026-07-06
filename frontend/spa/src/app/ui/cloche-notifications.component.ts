import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NotificationService } from '../notification.service';

/**
 * Cloche de notifications partagée par les 3 topbars (admin / superviseur / terrain).
 * Badge = nb de non-lues (dérivé). Clic → panneau listant SES notifications (scopées serveur) ;
 * clic sur une notif = marquer lue ; « Tout marquer lu » éteint la cloche. Fermeture par
 * calque plein écran (pas de directive maison). Couleur de l'icône héritée de la topbar.
 */
@Component({
  selector: 'app-cloche-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="cloche">
  <button type="button" class="cloche__btn" (click)="basculer()" aria-label="Notifications" title="Notifications">
    <i class="ti ti-bell"></i>
    <span class="cloche__badge" *ngIf="notifs.compteur() > 0">{{ notifs.compteur() }}</span>
  </button>

  <ng-container *ngIf="ouvert()">
    <div class="cloche__backdrop" (click)="fermer()"></div>
    <div class="cloche__panel">
      <div class="cloche__head">
        <span>Notifications</span>
        <button type="button" class="cloche__link" *ngIf="notifs.compteur() > 0" (click)="notifs.marquerToutLu()">
          Tout marquer lu
        </button>
      </div>

      <p class="cloche__vide" *ngIf="notifs.liste().length === 0">Aucune notification.</p>

      <button type="button" class="cloche__item" *ngFor="let n of notifs.liste()"
              [class.is-lu]="n.lu" (click)="notifs.ouvrir(n)">
        <span class="cloche__pastille" [class.is-lu]="n.lu"></span>
        <span class="cloche__txt">
          <span class="cloche__lib">{{ n.titre }}</span>
          <span class="cloche__sub" *ngIf="n.corps">{{ n.corps }}</span>
        </span>
        <span class="cloche__date">{{ n.createdAt | date:'shortTime' }}</span>
      </button>
    </div>
  </ng-container>
</div>
  `,
  styles: [`
    .cloche { position: relative; display: flex; }
    .cloche__btn { position: relative; display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 999px; background: transparent; border: 0;
      color: inherit; opacity: .75; cursor: pointer; font-size: 18px; }
    .cloche__btn:hover { opacity: 1; background: rgba(255,255,255,.06); }
    .cloche__badge { position: absolute; top: -1px; right: -1px; min-width: 16px; height: 16px;
      padding: 0 4px; border-radius: 999px; background: #ef4444; color: #fff; font-size: 10px;
      font-weight: 700; line-height: 16px; text-align: center; }

    .cloche__backdrop { position: fixed; inset: 0; z-index: 1990; }
    .cloche__panel { position: absolute; right: 0; top: 130%; z-index: 1991; width: 330px;
      max-height: 440px; overflow-y: auto; background: #111827;
      border: .5px solid rgba(255,255,255,.12); border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,.55); color: #e2e8f0;
      font-family: -apple-system, system-ui, sans-serif; }
    .cloche__panel::-webkit-scrollbar { width: 6px; }
    .cloche__panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 3px; }

    .cloche__head { display: flex; justify-content: space-between; align-items: center;
      padding: 11px 14px; border-bottom: .5px solid rgba(255,255,255,.08);
      font-size: 13px; font-weight: 600; position: sticky; top: 0; background: #111827; }
    .cloche__link { background: none; border: 0; color: #38bdf8; font-size: 11.5px; cursor: pointer; padding: 0; }
    .cloche__link:hover { text-decoration: underline; }

    .cloche__item { display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left;
      padding: 10px 14px; background: none; border: 0; border-bottom: .5px solid rgba(255,255,255,.05);
      color: inherit; cursor: pointer; }
    .cloche__item:hover { background: rgba(255,255,255,.03); }
    .cloche__item.is-lu { opacity: .5; }
    .cloche__pastille { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%;
      background: #38bdf8; flex-shrink: 0; }
    .cloche__pastille.is-lu { background: rgba(255,255,255,.25); }
    .cloche__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .cloche__lib { font-size: 12.5px; font-weight: 500; line-height: 1.3; }
    .cloche__sub { font-size: 11px; color: rgba(255,255,255,.55);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cloche__date { font-size: 10.5px; color: rgba(255,255,255,.4); flex-shrink: 0; margin-top: 2px; }
    .cloche__vide { padding: 18px 14px; color: rgba(255,255,255,.55); font-size: 13px; text-align: center; }
  `],
})
export class ClocheNotificationsComponent {
  readonly notifs = inject(NotificationService);
  readonly ouvert = signal(false);

  basculer(): void { this.ouvert.update(o => !o); }
  fermer():   void { this.ouvert.set(false); }
}

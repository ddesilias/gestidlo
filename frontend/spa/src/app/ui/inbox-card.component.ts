import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Carte d'inbox — primitive PARTAGÉE pour les listes actionnables (alertes à traiter,
 * rapports à valider, …). Le chrome (cadre, en-tête icône+corps, rangée d'actions) vit
 * ici, une seule fois ; chaque écran projette son contenu via trois slots :
 *   [ibx-icon]    l'icône de tête
 *   [ibx-body]    titre + badges + provenance + meta (tout le texte)
 *   [ibx-actions] la rangée d'actions (un wrapper `display:contents` côté appelant pour
 *                 que ses enfants deviennent les items flex de la rangée)
 *
 * C'est ICI qu'est écrit LE fix de layout, au bon endroit, pour les deux côtés à la fois :
 *   .ibx__body  { flex:1 1 auto; min-width:0 }  → le texte remplit, ne force pas le min-content
 *   .ibx__actions { display:flex; flex-wrap:wrap } → actions en flux, jamais position:absolute
 *
 * Préfixe `ibx-*` volontairement unique (cf. piège de collision avec le `.al-*` global).
 */
@Component({
  selector: 'app-inbox-card',
  standalone: true,
  imports: [CommonModule],
  template: `
<article class="ibx"
  [class.ibx--danger]="tone === 'danger'"
  [class.ibx--warn]="tone === 'warn'"
  [class.ibx--compact]="density === 'compact'">
  <div class="ibx__head">
    <span class="ibx__icon"><ng-content select="[ibx-icon]"></ng-content></span>
    <div class="ibx__body"><ng-content select="[ibx-body]"></ng-content></div>
  </div>
  <div class="ibx__actions" *ngIf="actions">
    <ng-content select="[ibx-actions]"></ng-content>
  </div>
</article>
  `,
  styles: [`
    .ibx { display:block; border:1px solid rgba(255,255,255,.06); border-radius:10px;
      background:#11161f; padding:12px; margin-bottom:10px; }
    .ibx--danger { border-color:rgba(226,75,74,.25); border-left:3px solid #e24b4a; background:rgba(226,75,74,.06); }
    .ibx--warn   { border-color:rgba(234,179,8,.22); border-left:3px solid #eab308; background:rgba(234,179,8,.05); }

    .ibx__head { display:flex; align-items:flex-start; gap:10px; }
    .ibx__icon { flex:none; font-size:20px; line-height:1; }
    /* LE fix — une seule fois, au bon endroit. */
    .ibx__body { flex:1 1 auto; min-width:0; }

    .ibx__actions { display:flex; align-items:center; flex-wrap:wrap; gap:8px;
      margin-top:11px; padding-top:11px; border-top:1px solid rgba(255,255,255,.06); }

    /* Densité « compact » : l'admin scanne beaucoup d'items (fiche URD à 8 onglets),
       il veut de la densité. Même chrome, juste resserré — pas un composant parallèle. */
    .ibx--compact { padding:8px 11px; margin-bottom:6px; }
    .ibx--compact .ibx__head { gap:8px; }
    .ibx--compact .ibx__icon { font-size:14px; }
    .ibx--compact .ibx__actions { margin-top:8px; padding-top:8px; }
  `],
})
export class InboxCardComponent {
  /** Accent du cadre : neutre, danger (urgent), warn (à valider/en attente). */
  @Input() tone: 'plain' | 'danger' | 'warn' = 'plain';
  /** Densité : confortable (poste de travail superviseur) ou compact (inspection admin). */
  @Input() density: 'comfortable' | 'compact' = 'comfortable';
  /** Affiche la rangée d'actions (bord supérieur + flux flex). */
  @Input() actions = true;
}

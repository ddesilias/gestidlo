import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeptSante } from './governance-signals.service';
import { STATUT_COULEUR } from './governance-status.util';

/** Normalise 'Sud-Est' / "Grand'Anse" → 'sudest' / 'grandanse'. */
function key(nom: string): string {
  return (nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['\s-]/g, '');
}

/**
 * Zone B · classement « Les plus en difficulté » (§4.2). MÊME source et MÊMES seuils que la carte
 * (l'indice de santé départemental). Pire-en-premier, mini-barre + valeur + delta (▲/▼), cliquable.
 */
@Component({
  selector: 'app-dept-ranking',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rank">
      <div class="rank__title">Les plus en difficulté</div>
      <div class="rank__sub">classement · couverture — pire en premier</div>

      <button type="button" class="row" [class.row--sel]="estSelection(d.nom)"
        *ngFor="let d of visibles(); let i = index" (click)="select.emit(d.nom)">
        <span class="row__n">{{ i + 1 }}</span>
        <span class="row__nom">{{ d.nom }}</span>
        <span class="row__track"><span class="row__fill" [style.width.%]="barWidth(d)" [style.background]="couleur(d)"></span></span>
        <span class="row__val">{{ d.couverture }}%</span>
        <span class="row__delta" [style.color]="d.delta > 0 ? 'var(--text-success)' : d.delta < 0 ? 'var(--text-danger)' : 'var(--text-muted)'">
          {{ d.delta > 0 ? '▲' : d.delta < 0 ? '▼' : '—' }}
        </span>
      </button>

      <button type="button" class="rank__more" *ngIf="rows.length > seuil()" (click)="toggle()">
        {{ tout() ? 'Réduire' : 'Voir les ' + rows.length + ' départements ›' }}
      </button>

      <div class="rank__nd" *ngIf="nonDeployes > 0">
        <i class="ti ti-map-off" aria-hidden="true"></i> {{ nonDeployes }} départements non déployés
      </div>
    </div>
  `,
  styles: [`
    .rank { background:var(--surface-1); border-radius:12px; padding:12px; height:100%; }
    .rank__title { font-size:13px; font-weight:500; color:var(--text-primary); }
    .rank__sub { font-size:10px; color:var(--text-muted); margin-bottom:8px; }
    .row { display:flex; align-items:center; gap:8px; width:100%; padding:5px 6px; background:none; border:0; border-radius:8px; cursor:pointer; text-align:left; }
    .row:hover .row__nom { color:var(--text-accent); }
    .row--sel { background:rgba(96,165,250,.12); box-shadow:inset 3px 0 0 var(--text-accent); }
    .row--sel .row__nom { color:var(--text-accent); font-weight:600; }
    .row__n { font-size:11px; color:var(--text-muted); width:12px; flex:none; }
    .row__nom { font-size:12px; color:var(--text-primary); width:74px; flex:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .row__track { flex:1; height:5px; background:var(--surface-2); border-radius:3px; overflow:hidden; }
    .row__fill { display:block; height:100%; border-radius:3px; transition:width .3s; }
    .row__val { font-size:11px; color:var(--text-primary); width:38px; text-align:right; flex:none; }
    .row__delta { font-size:10px; width:12px; flex:none; text-align:center; }
    .rank__more { font-size:11px; color:var(--text-accent); background:none; border:0; cursor:pointer; padding:8px 0 2px; }
    .rank__nd { font-size:11px; color:var(--text-muted); margin-top:6px; display:flex; align-items:center; gap:6px;
      border-top:0.5px solid var(--border-color); padding-top:8px; i { font-size:13px; } }
  `],
})
export class DeptRankingComponent {
  @Input() rows: DeptSante[] = [];
  @Input() nonDeployes = 0;
  /** Département scopé — la ligne correspondante est surlignée (le classement reste national). */
  @Input() selected: string | null = null;
  @Output() select = new EventEmitter<string>();

  estSelection(nom: string): boolean {
    return !!this.selected && key(this.selected) === key(nom);
  }

  private readonly seuilN = 5;
  readonly tout = signal(false);
  seuil = () => this.seuilN;
  toggle(): void { this.tout.update(v => !v); }

  visibles(): DeptSante[] { return this.tout() ? this.rows : this.rows.slice(0, this.seuilN); }

  /** Barre relative au pire (lisibilité) : le plus faible reste visible, pas un trait de 2 px. */
  barWidth(d: DeptSante): number {
    const max = Math.max(1, ...this.rows.map(r => r.couverture));
    return Math.max(6, Math.round((d.couverture / max) * 100));
  }
  couleur(d: DeptSante): string { return STATUT_COULEUR[d.statut]; }
}

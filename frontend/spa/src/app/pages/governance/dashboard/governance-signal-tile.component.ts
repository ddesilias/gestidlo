import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SignalTile } from './governance-signals.service';

/**
 * Tuile de signal (Zone A) — compacte (une-deux lignes). Statut = barre latérale DISCRÈTE
 * (attention/critique uniquement) + chiffre coloré si critique. Jamais d'aplat plein (§9).
 * Cliquable vers son module ; la MESURE ne vit qu'ici (anti-redondance avec le strip).
 */
@Component({
  selector: 'app-governance-signal-tile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="tile" [routerLink]="tile.route"
       [class.tile--accent]="accent" [style.--st]="borderColor"
       [attr.aria-label]="tile.label + ' : ' + tile.value">
      <span class="tile__lbl">{{ tile.label }}</span>
      <div class="tile__row">
        <span class="tile__val" [class.tile__val--crit]="tile.statut === 'critique'">{{ tile.value }}</span>
        <span class="tile__sub">{{ tile.sub }}</span>
      </div>
    </a>
  `,
  styles: [`
    .tile { display:block; text-decoration:none; background:var(--surface-1);
      border:0.5px solid var(--border-color); border-radius:var(--radius); padding:8px 10px;
      transition:border-color .15s, transform .15s; }
    .tile--accent { border-left:3px solid var(--st); }
    .tile:hover { border-color:var(--text-accent); transform:translateY(-1px); }
    .tile:focus-visible { outline:2px solid var(--text-accent); outline-offset:2px; }
    .tile__lbl { font-size:10px; color:var(--text-secondary); display:block; }
    .tile__row { display:flex; align-items:baseline; gap:6px; margin-top:2px; flex-wrap:wrap; }
    .tile__val { font-size:16px; font-weight:600; color:var(--text-primary); line-height:1.1; }
    .tile__val--crit { color:var(--text-danger); }
    .tile__sub { font-size:10px; color:var(--text-muted); }
  `],
})
export class GovernanceSignalTileComponent {
  @Input({ required: true }) tile!: SignalTile;

  get accent(): boolean { return this.tile.statut === 'attention' || this.tile.statut === 'critique'; }
  get borderColor(): string {
    return this.tile.statut === 'critique' ? 'var(--text-danger)'
      : this.tile.statut === 'attention' ? 'var(--text-warning)' : 'transparent';
  }
}

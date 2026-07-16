import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeptLigne } from './governance-signals.service';
import { STATUT_COULEUR, STATUT_LIBELLE } from './governance-status.util';

/**
 * « URD les plus en difficulté » (§ wireframe) — tableau décisionnel, une ligne par département
 * déployé, pire score en premier. NATIONAL (ne suit pas le scope). Clic sur une ligne = drill scope.
 * Purement présentationnel : `rows` arrive déjà dérivé/trié du service.
 */
@Component({
  selector: 'app-governance-urd-table',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="urd">
      <div class="urd__head">
        <span class="urd__title">URD les plus en difficulté</span>
        <span class="urd__hint">classement · pire en premier · clic → analyser</span>
      </div>
      <div class="urd__scroll">
        <table>
          <thead>
            <tr>
              <th class="c">#</th><th>URD</th><th class="n">Score</th><th class="n">Alertes crit.</th>
              <th class="n">Rapports&nbsp;>48h</th><th class="n">Interv. retard</th><th class="n">Pop. affectée</th>
              <th>Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of rows; let i = index" [class.sel]="isSel(r.nom)" (click)="select.emit(r.nom)">
              <td class="c muted">{{ i + 1 }}</td>
              <td class="nom">{{ r.nom }}</td>
              <td class="n"><b [style.color]="couleur(r)">{{ r.score }}%</b></td>
              <td class="n" [class.bad]="r.alertesCrit > 0">{{ r.alertesCrit }}</td>
              <td class="n" [class.bad]="r.rapportsRetard > 0">{{ r.rapportsRetard }}</td>
              <td class="n" [class.bad]="r.intervRetard > 0">{{ r.intervRetard }}</td>
              <td class="n">{{ r.popAffectee ? (r.popAffectee | number:'1.0-0':'fr') : '—' }}</td>
              <td><span class="st" [style.color]="couleur(r)"
                [style.background]="'color-mix(in srgb, ' + couleur(r) + ' 16%, transparent)'">{{ libelle(r) }}</span></td>
              <td class="lien">Analyser →</td>
            </tr>
            <tr *ngIf="rows.length === 0"><td colspan="9" class="empty">Aucune URD déployée.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .urd { background:var(--surface-1); border:0.5px solid var(--border-strong); border-radius:12px; padding:16px;
      box-shadow:0 1px 2px rgba(0,0,0,.12); }
    .urd__head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:12px; }
    .urd__title { font-size:13px; font-weight:600; color:var(--text-primary); letter-spacing:.1px; }
    .urd__hint { font-size:10.5px; color:var(--text-muted); }
    .urd__scroll { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th { text-align:left; color:var(--text-secondary); font-weight:600; font-size:10px; text-transform:uppercase;
      letter-spacing:.5px; padding:8px; border-bottom:1px solid var(--border-strong); white-space:nowrap; }
    td { padding:11px 8px; border-bottom:0.5px solid var(--border-color); white-space:nowrap; }
    tbody tr:last-child td { border-bottom:0; }
    tbody tr { cursor:pointer; }
    tbody tr:hover { background:rgba(96,165,250,.06); }
    tbody tr.sel { background:rgba(96,165,250,.12); box-shadow:inset 3px 0 0 var(--text-accent); }
    .c { width:24px; text-align:center; }
    .nom { width:88px; font-weight:600; color:var(--text-primary); }
    .n { text-align:right; font-variant-numeric:tabular-nums; }
    th.n { width:88px; }
    .muted { color:var(--text-muted); }
    td.n { color:var(--text-secondary); }
    td.n.bad { color:var(--text-warning); font-weight:600; }
    /* Badge de statut unifié (§4) — aligné avec les autres tables. */
    .st { display:inline-flex; align-items:center; height:19px; font-size:10px; font-weight:600; line-height:1;
      border-radius:6px; padding:0 8px; white-space:nowrap; text-transform:capitalize; }
    .lien { color:var(--text-accent); font-size:11px; font-weight:600; }
    tbody tr:hover .lien { text-decoration:underline; }
    .empty { text-align:center; color:var(--text-muted); padding:16px; }
  `],
})
export class GovernanceUrdTableComponent {
  @Input() rows: DeptLigne[] = [];
  @Input() selected: string | null = null;
  @Output() select = new EventEmitter<string>();

  isSel(nom: string): boolean {
    return !!this.selected && this.selected.toLowerCase() === nom.toLowerCase();
  }
  couleur(r: DeptLigne): string { return STATUT_COULEUR[r.statut]; }
  libelle(r: DeptLigne): string { return STATUT_LIBELLE[r.statut]; }
}

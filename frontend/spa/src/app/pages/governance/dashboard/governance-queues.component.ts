import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RapportRow, InterventionRow } from './governance-signals.service';
import { STATUT_COULEUR } from './governance-status.util';

/**
 * Deux files opérationnelles côte à côte (§ wireframe) — « Rapports à valider » + « Interventions
 * urgentes ». Suivent le scope (les lignes arrivent déjà scopées du service). Présentationnel pur.
 */
@Component({
  selector: 'app-governance-queues',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="q">
      <!-- Rapports à valider -->
      <div class="q__card">
        <div class="q__title">Rapports à valider <span class="q__hint">délai réel · statut dérivé</span></div>
        <div class="q__scroll">
          <table>
            <thead><tr><th>Rapport</th><th>URD</th><th>Commune</th><th>Type</th><th class="n">Délai</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let r of rapports">
                <td class="strong">{{ r.titre }}</td><td>{{ r.urd }}</td><td>{{ r.commune }}</td><td>{{ r.type }}</td>
                <td class="n" [class.bad]="r.delaiH > 48">{{ r.delaiH }} h</td>
                <td><span class="st" [class.st--warn]="r.statut === 'En retard'">{{ r.statut }}</span></td>
                <td class="lien"><a [routerLink]="r.route">Valider</a></td>
              </tr>
              <tr *ngIf="rapports.length === 0"><td colspan="7" class="empty">Rien en attente.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Interventions urgentes -->
      <div class="q__card">
        <div class="q__title">Interventions urgentes <span class="q__hint">en retard ou priorité élevée</span></div>
        <div class="q__scroll">
          <table>
            <thead><tr><th>Interv.</th><th>URD</th><th>Ouvrage</th><th>Priorité</th><th>Assignée à</th><th class="n">Délai</th><th>Statut</th></tr></thead>
            <tbody>
              <tr *ngFor="let i of interventions" [routerLink]="'/admin/interventions'">
                <td class="strong">{{ i.code }}</td><td>{{ i.urd }}</td><td>{{ i.ouvrage }}</td>
                <td><span class="pri" [style.color]="priColor(i)">{{ i.priorite }}</span></td>
                <td [class.muted]="i.assignee === 'Non assignée'">{{ i.assignee }}</td>
                <td class="n" [class.bad]="i.enRetard">{{ i.delaiH }} h</td>
                <td><span class="st" [class.st--warn]="i.enRetard">{{ i.statut }}</span></td>
              </tr>
              <tr *ngIf="interventions.length === 0"><td colspan="7" class="empty">Aucune intervention urgente.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .q { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    @media (max-width:1199px){ .q { grid-template-columns:1fr; } }
    /* Blocs prioritaires (§1) : bordure nette + ombre très légère pour les faire ressortir du fond. */
    .q__card { background:var(--surface-1); border:0.5px solid var(--border-strong); border-radius:12px; padding:16px;
      box-shadow:0 1px 2px rgba(0,0,0,.12); }
    .q__title { font-size:13px; font-weight:600; color:var(--text-primary); letter-spacing:.1px; margin-bottom:12px;
      display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
    .q__hint { font-size:10.5px; color:var(--text-muted); font-weight:400; }
    .q__scroll { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th { text-align:left; color:var(--text-secondary); font-weight:600; font-size:10px; text-transform:uppercase;
      letter-spacing:.5px; padding:7px 8px; border-bottom:1px solid var(--border-strong); white-space:nowrap; }
    td { padding:10px 8px; border-bottom:0.5px solid var(--border-color); white-space:nowrap; color:var(--text-secondary); }
    tbody tr:last-child td { border-bottom:0; }
    tbody tr[routerLink] { cursor:pointer; }
    tbody tr:hover { background:rgba(96,165,250,.06); }
    .strong { color:var(--text-primary); font-weight:600; }
    .muted { color:var(--text-muted); }
    .n { text-align:right; font-variant-numeric:tabular-nums; }
    td.n.bad { color:var(--text-warning); font-weight:600; }
    .pri { font-weight:600; }
    /* Badge de statut unifié (§4) — même hauteur/padding/radius partout. */
    .st { display:inline-flex; align-items:center; height:19px; font-size:10px; font-weight:600; line-height:1;
      border-radius:6px; padding:0 8px; background:rgba(148,163,184,.16); color:var(--text-secondary); text-transform:capitalize; }
    .st--warn { color:var(--text-warning); background:color-mix(in srgb, var(--text-warning) 18%, transparent); }
    /* Action « Valider » en bouton ghost discret (§3). */
    .lien a { display:inline-flex; align-items:center; height:22px; padding:0 10px; border-radius:6px;
      font-size:11px; font-weight:600; color:var(--text-accent); border:0.5px solid color-mix(in srgb, var(--text-accent) 45%, transparent); }
    .lien a:hover { background:var(--bg-accent); border-color:var(--text-accent); }
    .empty { text-align:center; color:var(--text-muted); padding:16px; }
  `],
})
export class GovernanceQueuesComponent {
  @Input() rapports: RapportRow[] = [];
  @Input() interventions: InterventionRow[] = [];

  priColor(i: InterventionRow): string { return STATUT_COULEUR[i.priStatut]; }
}

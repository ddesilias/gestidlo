import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PilotageVue } from './governance-signals.service';

/**
 * Section « Pilotage » (§ blocs bleus du wireframe). Contrairement à la carte + au classement — qui
 * restent NATIONAUX — tout ce composant SUIT le scope : `vue` est déjà scopé côté service (national OU
 * URD sélectionnée). Le composant est purement présentationnel : il n'agrège rien, il rend `vue`.
 * Synthèse · À traiter maintenant (5 signaux d'action) · 3 colonnes opérationnelles · 4 graphes · journal.
 */
@Component({
  selector: 'app-governance-pilotage',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pil" *ngIf="vue as v">
      <div class="pil__head">
        <span class="pil__badge" [class.pil__badge--nat]="v.national">{{ v.national ? 'NATIONAL' : 'URD' }}</span>
        <span class="pil__title">{{ v.titre }}</span>
        <span class="pil__hint">tout ce bloc suit le périmètre sélectionné</span>
      </div>

      <!-- Rangée 1 : Synthèse + À traiter -->
      <div class="pil__row pil__row--top">
        <div class="card">
          <div class="card__title">Synthèse</div>
          <dl class="synth">
            <div><dt>Responsable</dt><dd>{{ v.synthese.responsable }}</dd></div>
            <div><dt>Statut</dt><dd>{{ v.synthese.statut }}</dd></div>
            <div><dt>Communes couvertes</dt><dd>{{ v.synthese.communes }}</dd></div>
            <div><dt>Zones actives</dt><dd>{{ v.synthese.zones }}</dd></div>
            <div><dt>TEPAC affectés</dt><dd>{{ v.synthese.tepac }}</dd></div>
            <div><dt>Infrastructures</dt><dd>{{ v.synthese.infra }}</dd></div>
            <div><dt>Pop. desservie</dt><dd>{{ v.synthese.desservie }}</dd></div>
            <div><dt>Conformité</dt><dd>{{ v.synthese.conformite }}%</dd></div>
          </dl>
        </div>

        <div class="card">
          <div class="card__title">À traiter maintenant</div>
          <div class="triage">
            <a class="triage__cell" *ngFor="let s of v.aTraiter" [routerLink]="s.route"
               [attr.aria-label]="s.label + ' : ' + s.valeur">
              <span class="triage__val" [style.color]="s.valeur ? s.couleur : 'var(--text-muted)'">{{ s.valeur }}</span>
              <span class="triage__lbl">{{ s.label }}</span>
            </a>
          </div>
          <p class="triage__note">chaque tuile → sa liste filtrée</p>
        </div>
      </div>

      <!-- Rangée 2 : 3 colonnes opérationnelles -->
      <div class="pil__row pil__row--3">
        <div class="card">
          <div class="card__title">Alertes critiques</div>
          <div class="line" *ngFor="let a of v.alertes">
            <span class="line__txt">{{ a.titre }} <span class="line__lieu">{{ a.lieu }}</span></span>
            <span class="line__time">{{ a.temps }}</span>
          </div>
          <p class="empty" *ngIf="v.alertes.length === 0"><i class="ti ti-circle-check" aria-hidden="true"></i> Aucune</p>
        </div>

        <div class="card">
          <div class="card__title">Interventions</div>
          <div class="chips">
            <span class="chip" *ngFor="let b of v.interventions" [style.color]="b.couleur"
                  [style.background]="'color-mix(in srgb, ' + b.couleur + ' 16%, transparent)'">
              {{ b.label }} {{ b.valeur }}
            </span>
          </div>
        </div>

        <div class="card">
          <div class="card__title">Rapports à valider</div>
          <div class="line" *ngFor="let r of v.rapports">
            <span class="line__txt">{{ r.titre }} <span class="line__lieu">{{ r.lieu }}</span></span>
          </div>
          <p class="empty" *ngIf="v.rapports.length === 0"><i class="ti ti-circle-check" aria-hidden="true"></i> Rien en attente</p>
        </div>
      </div>

      <!-- Rangée 3 : 4 graphes filtrés -->
      <div class="pil__row pil__row--4">
        <div class="mini">
          <div class="mini__title">Alertes · par sévérité</div>
          <div class="bars">
            <div class="bar" *ngFor="let b of v.graphes.alertes">
              <span class="bar__fill" [style.height.%]="pct(b.valeur, v.graphes.alertes)" [style.background]="b.couleur"></span>
              <span class="bar__n">{{ b.valeur }}</span>
            </div>
          </div>
        </div>
        <div class="mini">
          <div class="mini__title">Interventions · statut</div>
          <div class="bars">
            <div class="bar" *ngFor="let b of v.graphes.interventions">
              <span class="bar__fill" [style.height.%]="pct(b.valeur, v.graphes.interventions)" [style.background]="b.couleur"></span>
              <span class="bar__n">{{ b.valeur }}</span>
            </div>
          </div>
        </div>
        <div class="mini">
          <div class="mini__title">Rapports · état</div>
          <div class="bars">
            <div class="bar" *ngFor="let b of v.graphes.rapports">
              <span class="bar__fill" [style.height.%]="pct(b.valeur, v.graphes.rapports)" [style.background]="b.couleur"></span>
              <span class="bar__n">{{ b.valeur }}</span>
            </div>
          </div>
        </div>
        <div class="mini">
          <div class="mini__title">Desservie · par commune</div>
          <div class="cov" *ngFor="let c of v.graphes.couverture">
            <span class="cov__nom">{{ c.commune }}</span>
            <span class="cov__track"><span class="cov__fill" [style.width.%]="c.pct"></span></span>
          </div>
          <p class="empty" *ngIf="v.graphes.couverture.length === 0">—</p>
        </div>
      </div>

      <!-- Journal -->
      <div class="pil__journal" *ngIf="v.journal.length">
        <span class="pil__jlabel">Journal</span>
        <span class="jitem" *ngFor="let j of v.journal">
          <i class="ti {{ j.icon }}" aria-hidden="true"></i>
          {{ j.texte }} <span class="jitem__d">{{ j.detail }}</span>
          <span class="jitem__t">{{ j.temps }}</span>
        </span>
      </div>
    </section>
  `,
  styles: [`
    .pil { background:var(--surface-1); border-radius:12px; padding:14px 16px; margin-top:12px;
      border-top:0.5px dashed var(--border-strong, var(--border-color)); }
    .pil__head { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
    .pil__badge { font-size:9px; font-weight:600; color:var(--text-accent); background:var(--bg-accent);
      border-radius:4px; padding:1px 5px; letter-spacing:.4px; }
    .pil__badge--nat { color:var(--text-success); background:var(--bg-success, rgba(52,211,153,.14)); }
    .pil__title { font-size:13px; font-weight:600; color:var(--text-primary); }
    .pil__hint { font-size:10px; color:var(--text-muted); }

    .pil__row { display:grid; gap:10px; margin-bottom:10px; }
    .pil__row--top { grid-template-columns:1fr 1.4fr; }
    .pil__row--3 { grid-template-columns:1fr 1fr 1fr; }
    .pil__row--4 { grid-template-columns:repeat(4,1fr); }
    @media (max-width:900px){ .pil__row--top,.pil__row--3,.pil__row--4 { grid-template-columns:1fr; } }

    .card { background:var(--surface-2, var(--surface-0)); border-radius:10px; padding:11px; }
    .card__title { font-size:11px; font-weight:600; color:var(--text-primary); margin-bottom:8px; }

    .synth { display:grid; grid-template-columns:1fr 1fr; gap:4px 10px; margin:0; }
    .synth > div { display:flex; justify-content:space-between; gap:6px; }
    .synth dt { font-size:11px; color:var(--text-secondary); margin:0; }
    .synth dd { font-size:11px; color:var(--text-primary); font-weight:500; margin:0; text-align:right; }

    .triage { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
    .triage__cell { display:flex; flex-direction:column; align-items:center; gap:2px; text-decoration:none;
      background:var(--surface-1); border-radius:8px; padding:8px 4px; transition:transform .15s, border-color .15s;
      border:0.5px solid transparent; }
    .triage__cell:hover { transform:translateY(-1px); border-color:var(--text-accent); }
    .triage__val { font-size:17px; font-weight:700; line-height:1; }
    .triage__lbl { font-size:8.5px; color:var(--text-secondary); text-align:center; }
    .triage__note { font-size:9px; color:var(--text-muted); margin:6px 0 0; }
    @media (max-width:520px){ .triage { grid-template-columns:repeat(2,1fr); } }

    .line { display:flex; justify-content:space-between; gap:8px; padding:3px 0; font-size:11px; color:var(--text-primary); }
    .line__lieu { color:var(--text-muted); }
    .line__time { color:var(--text-muted); flex:none; }
    .empty { font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:5px; margin:4px 0 0; }

    .chips { display:flex; flex-wrap:wrap; gap:4px; }
    .chip { font-size:9px; border-radius:5px; padding:3px 7px; white-space:nowrap; }

    .mini { background:var(--surface-2, var(--surface-0)); border-radius:10px; padding:9px; }
    .mini__title { font-size:9.5px; color:var(--text-secondary); margin-bottom:6px; }
    .bars { display:flex; align-items:flex-end; gap:8px; height:44px; }
    .bar { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:2px; }
    .bar__fill { width:100%; min-height:2px; border-radius:3px 3px 0 0; transition:height .3s; }
    .bar__n { font-size:8.5px; color:var(--text-muted); }

    .cov { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
    .cov__nom { font-size:9px; color:var(--text-muted); width:64px; flex:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cov__track { flex:1; height:4px; background:var(--surface-1); border-radius:2px; overflow:hidden; }
    .cov__fill { display:block; height:100%; background:var(--text-success); border-radius:2px; }

    .pil__journal { font-size:11px; color:var(--text-secondary); display:flex; flex-wrap:wrap; align-items:center; gap:4px 14px; margin-top:4px; }
    .pil__jlabel { font-weight:600; color:var(--text-primary); }
    .jitem { display:inline-flex; align-items:center; gap:5px; i { font-size:13px; color:var(--text-warning); } }
    .jitem__d { color:var(--text-muted); }
    .jitem__t { color:var(--text-muted); }
  `],
})
export class GovernancePilotageComponent {
  @Input({ required: true }) vue!: PilotageVue;

  /** Hauteur relative d'une barre (au max de sa série), lisible même pour la plus petite. */
  pct(v: number, serie: { valeur: number }[]): number {
    const max = Math.max(1, ...serie.map(x => x.valeur));
    return v === 0 ? 0 : Math.max(8, Math.round((v / max) * 100));
  }
}

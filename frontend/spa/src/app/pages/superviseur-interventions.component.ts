import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { BffApiService, PhotoDto } from '../api/bff-api.service';
import { ScopeService } from '../scope.service';
import { InboxCardComponent } from '../ui/inbox-card.component';
import { CreerInterventionWizardComponent } from './interventions/creer-intervention/creer-intervention-wizard.component';

/**
 * Interventions du superviseur — liste SCOPÉE à son URD.
 *
 * Contrairement à la console nationale de dispatch (InterventionsPageComponent), cette vue
 * lit les vrais tickets backend, filtrés côté serveur par le département du token
 * (ticket.pointId → PointRefEntity.territory). Aucune intervention d'une autre URD ne peut
 * apparaître : c'est de la confidentialité, pas du confort. La liste se remplit quand Kelly
 * traite une alerte (« Créer l'intervention » → ticket Sud-Est, qui naît dans son périmètre).
 */
@Component({
  selector: 'app-superviseur-interventions',
  standalone: true,
  imports: [CommonModule, InboxCardComponent, CreerInterventionWizardComponent],
  template: `
<div class="supi">

  <header class="supi-head">
    <div>
      <h1 class="supi-head__h1">Interventions</h1>
      <p class="supi-head__sub">périmètre {{ dept }} · <span class="supi-live"><i></i>suivi en direct</span></p>
    </div>
    <button class="supi-create" (click)="showWizard.set(true)"><i class="ti ti-plus"></i> Créer une intervention</button>
  </header>

  <section class="supi-kpis">
    <div class="supi-kpi"><div class="supi-kpi__lbl">Total</div><div class="supi-kpi__val">{{ tickets().length }}</div></div>
    <div class="supi-kpi"><div class="supi-kpi__lbl">À planifier</div><div class="supi-kpi__val">{{ countBy('OPEN') }}</div></div>
    <div class="supi-kpi"><div class="supi-kpi__lbl">En cours</div><div class="supi-kpi__val supi-kpi__val--amber">{{ enCours() }}</div></div>
    <div class="supi-kpi"><div class="supi-kpi__lbl">Clôturées</div><div class="supi-kpi__val supi-kpi__val--green">{{ countBy('CLOSED') }}</div></div>
  </section>

  <div *ngIf="tickets().length === 0" class="supi-empty">
    <i class="ti ti-tool"></i> Aucune intervention dans votre périmètre. Traitez une alerte pour en créer une.
  </div>

  <app-inbox-card *ngFor="let t of tickets()" [actions]="false">
    <i ibx-icon class="ti ti-tool" style="color:#60A5FA"></i>
    <div ibx-body class="supi-clickable" (click)="ouvrir(t)">
      <div class="supi-title-row">
        <span class="supi-title">{{ t.titre || t.pointId }}</span>
        <span class="supi-chip" [ngClass]="chipClass(t.status)">{{ statusLabel(t.status) }}</span>
        <span *ngIf="t.priorite" class="supi-prio" [ngClass]="'supi-prio--'+t.priorite">{{ t.priorite }}</span>
        <span *ngIf="t.alertId" class="supi-link">🔗 ALT-{{ t.alertId }}</span>
      </div>
      <div class="supi-meta">{{ t.assignee || 'non assigné' }} · {{ t.commune || '—' }} · créée {{ timeAgo(t.createdAt) }}</div>
      <span class="supi-see">Voir la fiche <i class="ti ti-chevron-right"></i></span>
    </div>
  </app-inbox-card>

  <app-creer-intervention-wizard *ngIf="showWizard()" (fermer)="showWizard.set(false)" (cree)="onCree()" />

  <!-- Fiche détail intervention (overlay, données réelles) -->
  <div class="sd-ov" *ngIf="selected() as t" (click)="fermer()">
    <div class="sd" (click)="$event.stopPropagation()">
      <div class="sd-head">
        <button class="sd-x" (click)="fermer()"><i class="ti ti-x"></i></button>
        <div class="sd-head__b">
          <div class="sd-title">{{ t.titre || 'Intervention' }}</div>
          <div class="sd-ref">Réf. INT-{{ t.id }} · créée par {{ t.superviseurId || '—' }} · {{ timeAgo(t.createdAt) }}</div>
        </div>
        <span class="supi-chip" [ngClass]="chipClass(t.status)">{{ statusLabel(t.status) }}</span>
      </div>

      <!-- Résumé -->
      <div class="sd-grid">
        <div class="sd-c"><span>Type</span><b>{{ t.type || '—' }}</b></div>
        <div class="sd-c"><span>Priorité</span><b>{{ t.priorite || '—' }}</b></div>
        <div class="sd-c"><span>Commune</span><b>{{ t.commune || '—' }}</b></div>
        <div class="sd-c"><span>Prévue</span><b>{{ t.datePrevue ? (t.datePrevue | date:'dd/MM HH:mm') : (t.heurePrevue || '—') }}</b></div>
      </div>

      <!-- Localisation -->
      <div class="sd-sec">Localisation</div>
      <div class="sd-grid sd-grid--3">
        <div class="sd-c"><span>Département</span><b>{{ dept }}</b></div>
        <div class="sd-c"><span>Commune</span><b>{{ t.commune || '—' }}</b></div>
        <div class="sd-c"><span>Point / repère</span><b>{{ t.pointId || '—' }}</b></div>
      </div>

      <!-- Élément concerné -->
      <div class="sd-sec" *ngIf="t.ouvrageId || t.capteurId || t.alertId">Élément concerné</div>
      <div class="sd-loc" *ngIf="t.ouvrageId"><i class="ti ti-building-factory-2"></i> Ouvrage {{ t.ouvrageId }}</div>
      <div class="sd-loc" *ngIf="t.capteurId"><i class="ti ti-cpu"></i> Capteur {{ t.capteurId }}</div>
      <div class="sd-loc" *ngIf="t.alertId"><i class="ti ti-alert-triangle"></i> Alerte liée ALT-{{ t.alertId }}</div>

      <!-- Description / consignes -->
      <div class="sd-sec" *ngIf="t.consignes || t.resultatAttendu">Consignes</div>
      <p class="sd-p" *ngIf="t.consignes">{{ t.consignes }}</p>
      <p class="sd-p sd-muted" *ngIf="t.resultatAttendu"><b>Résultat attendu :</b> {{ t.resultatAttendu }}</p>

      <!-- Technicien -->
      <div class="sd-sec">Technicien assigné</div>
      <div class="sd-tech">
        <span class="sd-av">{{ ini(t.assignee) }}</span>
        <div><b>{{ t.assignee || 'non assigné' }}</b><small>{{ t.commune }} · {{ acceptLabel(t) }}</small></div>
      </div>

      <!-- Travaux -->
      <div class="sd-sec">Travaux <small>{{ tachesFaites() }}/{{ taches().length }}</small></div>
      <div class="sd-empty" *ngIf="taches().length === 0">Aucune tâche.</div>
      <div class="sd-tk" *ngFor="let ta of taches()">
        <span class="sd-ck" [class.sd-ck--on]="ta.statut === 'FAIT'"><i *ngIf="ta.statut === 'FAIT'" class="ti ti-check"></i></span>
        <span [class.sd-done]="ta.statut === 'FAIT'">{{ ta.libelle }}</span>
        <span class="sd-oblig" *ngIf="ta.obligatoire">obligatoire</span>
      </div>

      <!-- Matériel / risques -->
      <div class="sd-sec" *ngIf="t.materiel || t.risques">Matériel & sécurité</div>
      <p class="sd-p" *ngIf="t.materiel"><b>Matériel :</b> {{ t.materiel }}</p>
      <p class="sd-p" *ngIf="t.risques"><b>Risques :</b> {{ t.risques }}</p>

      <!-- Photos -->
      <div class="sd-sec" *ngIf="photos().length">Photos / preuves <small>{{ photos().length }}</small></div>
      <div class="sd-photos" *ngIf="photos().length">
        <div class="sd-ph" *ngFor="let p of photos()">
          <img *ngIf="photoSrc()[p.id] as src" [src]="src" [alt]="p.type"/>
          <span class="sd-ph__t">{{ p.type }}</span>
        </div>
      </div>

      <!-- Rapport lié -->
      <div class="sd-sec" *ngIf="t.rapportId">Rapport</div>
      <button class="sd-rap" *ngIf="t.rapportId" (click)="voirRapport(t.rapportId)"><i class="ti ti-file-text"></i> Ouvrir le rapport lié</button>

      <!-- Suivi -->
      <div class="sd-sec">Suivi</div>
      <div class="sd-timeline">
        <div class="sd-ti" *ngIf="t.createdAt"><span class="sd-dot"></span>Créée · {{ t.createdAt | date:'dd/MM HH:mm' }}<small> par {{ t.superviseurId }}</small></div>
        <div class="sd-ti" *ngIf="t.acceptedAt"><span class="sd-dot"></span>Acceptée · {{ t.acceptedAt | date:'dd/MM HH:mm' }}<small> par {{ t.assignee }}</small></div>
        <div class="sd-ti" *ngIf="t.startedAt"><span class="sd-dot"></span>Démarrée · {{ t.startedAt | date:'dd/MM HH:mm' }}</div>
        <div class="sd-ti" *ngIf="t.completedAt"><span class="sd-dot sd-dot--ok"></span>Terminée · {{ t.completedAt | date:'dd/MM HH:mm' }}</div>
        <div class="sd-ti" *ngIf="t.valideeAt"><span class="sd-dot sd-dot--ok"></span>Validée · {{ t.valideeAt | date:'dd/MM HH:mm' }}<small> par {{ t.valideePar }}</small></div>
      </div>

      <!-- K · Validation superviseur -->
      <div class="sd-valid">
        <div class="sd-sec sd-sec--accent">Validation superviseur</div>
        <div class="sd-grid sd-grid--3">
          <div class="sd-c"><span>Statut</span><b>{{ validationLabel(t) }}</b></div>
          <div class="sd-c"><span>Validée le</span><b>{{ t.valideeAt ? (t.valideeAt | date:'dd/MM HH:mm') : '—' }}</b></div>
          <div class="sd-c"><span>Par</span><b>{{ t.valideePar || '—' }}</b></div>
        </div>
        <p class="sd-p sd-muted" *ngIf="t.commentaireValidation"><b>Commentaire :</b> {{ t.commentaireValidation }}</p>
        <textarea class="sd-ta" rows="2" [value]="commentaire()"
          (input)="commentaire.set($any($event.target).value)"
          placeholder="Commentaire du superviseur (motif requis pour demander une correction)…"></textarea>
        <p class="sd-actmsg" *ngIf="actionMsg()">{{ actionMsg() }}</p>
        <div class="sd-actions">
          <button class="sd-btn sd-btn--p" [disabled]="!canValider(t) || busy()" (click)="valider(t)"><i class="ti ti-check"></i> Valider le rapport</button>
          <button class="sd-btn" [disabled]="!canCorriger(t) || busy()" (click)="demanderCorrection(t)"><i class="ti ti-arrow-back-up"></i> Demander correction</button>
          <button class="sd-btn sd-btn--danger" [disabled]="!canCloturer(t) || busy()" (click)="cloturer(t)"><i class="ti ti-lock"></i> Clôturer</button>
        </div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .supi { color:#e6edf3; max-width:1080px; }
    .supi-head { margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .supi-create { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:500; padding:8px 13px; border-radius:9px; border:1px solid #2563EB; background:#2563EB; color:#fff; cursor:pointer; white-space:nowrap; }
    .supi-create i { font-size:15px; }
    .supi-head__h1 { font-size:16px; font-weight:500; margin:0; }
    .supi-head__sub { font-size:11px; color:#8b949e; margin:2px 0 0; }
    .supi-live { color:#3fb950; } .supi-live i { display:inline-block; width:6px; height:6px; border-radius:50%; background:#3fb950; margin-right:4px; vertical-align:1px; }

    .supi-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(86px,1fr)); gap:8px; margin-bottom:13px; }
    .supi-kpi { background:#161b22; border-radius:8px; padding:9px 11px; }
    .supi-kpi__lbl { font-size:10px; color:#8b949e; }
    .supi-kpi__val { font-size:19px; font-weight:500; margin-top:2px; }
    .supi-kpi__val--amber { color:#eab308; } .supi-kpi__val--green { color:#3fb950; }

    .supi-empty { display:flex; align-items:center; gap:8px; font-size:12px; color:#8b949e;
      background:#11161f; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:14px; }

    .supi-title-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .supi-title { font-size:13px; font-weight:500; }
    .supi-chip { font-size:9px; border-radius:20px; padding:2px 7px; color:#8b949e; background:rgba(255,255,255,.06); }
    .supi-chip--amber { color:#eab308; background:rgba(234,179,8,.12); }
    .supi-chip--green { color:#3fb950; background:rgba(63,185,80,.12); }
    .supi-link { font-size:10px; color:#19c3a8; }
    .supi-meta { font-size:10px; color:#8b949e; margin-top:4px; }
    .supi-clickable { cursor:pointer; }
    .supi-prio { font-size:9px; text-transform:capitalize; padding:2px 7px; border-radius:20px; color:#8b949e; background:rgba(255,255,255,.06); }
    .supi-prio--haute,.supi-prio--urgente,.supi-prio--critique { color:#eab308; background:rgba(234,179,8,.12); }
    .supi-see { font-size:10.5px; color:#60A5FA; margin-top:5px; display:inline-block; } .supi-see i { font-size:12px; vertical-align:-2px; }

    /* Fiche détail (overlay) */
    .sd-ov { position:fixed; inset:0; background:rgba(2,6,23,.66); z-index:1100; display:flex; justify-content:center; align-items:flex-start; padding:16px; overflow-y:auto; }
    .sd { width:620px; max-width:96vw; background:#0F1419; border:1px solid #1F2A33; border-radius:14px; padding:16px 18px 22px; color:#E2E8EE; }
    .sd-head { display:flex; align-items:flex-start; gap:10px; }
    .sd-x { width:32px; height:32px; border-radius:8px; border:1px solid #2A3744; background:#1A222C; color:#CBD5E1; cursor:pointer; flex-shrink:0; }
    .sd-head__b { flex:1; min-width:0; } .sd-title { font-size:16px; font-weight:600; } .sd-ref { font-size:11px; color:#6B7785; margin-top:2px; }
    .sd-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:14px 0 4px; }
    .sd-c { background:#10161D; border:1px solid #1F2A33; border-radius:9px; padding:8px 10px; } .sd-c span { font-size:10px; color:#6B7785; } .sd-c b { display:block; font-size:12.5px; margin-top:2px; text-transform:capitalize; }
    .sd-sec { font-size:11px; color:#6B7785; text-transform:uppercase; letter-spacing:.4px; margin:15px 0 7px; } .sd-sec small { text-transform:none; color:#8B9AAB; margin-left:5px; }
    .sd-loc { font-size:13px; padding:2px 0; } .sd-loc i { color:#60A5FA; margin-right:5px; }
    .sd-p { font-size:13px; color:#CBD5E1; margin:0 0 6px; line-height:1.5; } .sd-muted { color:#8B9AAB; }
    .sd-tech { display:flex; align-items:center; gap:10px; } .sd-av { width:32px; height:32px; border-radius:50%; background:rgba(96,165,250,.15); color:#93C5FD; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; }
    .sd-tech b { font-size:13.5px; } .sd-tech small { display:block; font-size:11px; color:#6B7785; }
    .sd-tk { display:flex; align-items:center; gap:9px; padding:7px 0; border-bottom:1px solid #1F2A33; font-size:13px; }
    .sd-ck { width:18px; height:18px; border-radius:5px; border:1px solid #3A4754; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#34D399; } .sd-ck--on { background:rgba(52,211,153,.15); border-color:#34D399; }
    .sd-done { color:#6B7785; text-decoration:line-through; } .sd-tk span:nth-child(2) { flex:1; }
    .sd-oblig { font-size:10px; color:#8B9AAB; background:#161D26; border:1px solid #2A3744; padding:1px 6px; border-radius:5px; }
    .sd-empty { font-size:12.5px; color:#6B7785; }
    .sd-photos { display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:8px; }
    .sd-ph { position:relative; aspect-ratio:1; border-radius:9px; overflow:hidden; background:#10161D; border:1px solid #1F2A33; }
    .sd-ph img { width:100%; height:100%; object-fit:cover; display:block; }
    .sd-ph__t { position:absolute; left:0; right:0; bottom:0; font-size:9px; text-transform:capitalize; color:#E2E8EE; background:rgba(0,0,0,.55); padding:2px 5px; }
    .sd-rap { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; padding:8px 13px; border-radius:9px; border:1px solid #2A3744; background:#161D26; color:#93C5FD; cursor:pointer; } .sd-rap i { font-size:14px; }
    .sd-timeline { display:flex; flex-direction:column; gap:8px; }
    .sd-ti { font-size:12.5px; color:#CBD5E1; display:flex; align-items:center; gap:8px; } .sd-ti small { color:#6B7785; }
    .sd-dot { width:8px; height:8px; border-radius:50%; background:#60A5FA; flex-shrink:0; } .sd-dot--ok { background:#34D399; }
    .sd-grid--3 { grid-template-columns:repeat(3,1fr); }
    /* K · Validation superviseur */
    .sd-valid { margin-top:16px; padding:14px; border:1px solid rgba(96,165,250,.35); border-radius:12px; background:rgba(96,165,250,.04); }
    .sd-sec--accent { color:#93C5FD; margin-top:0; }
    .sd-ta { width:100%; box-sizing:border-box; margin-top:10px; background:#10161D; border:1px solid #1F2A33; border-radius:9px; color:#E2E8EE; font:inherit; font-size:13px; padding:9px 11px; resize:vertical; }
    .sd-ta::placeholder { color:#6B7785; }
    .sd-actmsg { font-size:11.5px; color:#F59E0B; margin:8px 0 0; }
    .sd-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
    .sd-btn { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; padding:8px 13px; border-radius:9px; border:1px solid #2A3744; background:#161D26; color:#CBD5E1; cursor:pointer; } .sd-btn i { font-size:14px; }
    .sd-btn--p { background:#2563EB; border-color:#2563EB; color:#fff; }
    .sd-btn--danger { border-color:rgba(248,113,113,.5); color:#F87171; }
    .sd-btn:disabled { opacity:.4; cursor:not-allowed; }
  `],
})
export class SuperviseurInterventionsComponent implements OnInit {
  private readonly bff = inject(BffApiService);
  private readonly scope = inject(ScopeService);
  private readonly router = inject(Router);

  readonly tickets = signal<any[]>([]);
  readonly showWizard = signal(false);
  readonly enCours = computed(() => this.countBy('ASSIGNED') + this.countBy('IN_PROGRESS') + this.countBy('EN_COURS') + this.countBy('ACCEPTEE'));

  // Fiche détail
  readonly selected = signal<any | null>(null);
  readonly taches = signal<any[]>([]);
  readonly photos = signal<PhotoDto[]>([]);
  readonly photoSrc = signal<Record<number, string>>({});

  // Bloc K — validation superviseur
  readonly commentaire = signal('');
  readonly actionMsg = signal('');
  readonly busy = signal(false);

  get dept(): string { return this.scope.dept ?? '—'; }

  ngOnInit(): void { this.charger(); }

  private charger(): void {
    // Le serveur impose le périmètre depuis le token ; on passe quand même le dept (cohérence).
    this.bff.tickets(this.scope.dept ?? undefined).pipe(
      catchError(() => of([])),
    ).subscribe(rows => this.tickets.set(Array.isArray(rows) ? rows : []));
  }

  onCree(): void { this.charger(); }

  // ── Fiche détail (données réelles : le ticket de la liste + tâches + photos) ──
  ouvrir(t: any): void {
    this.selected.set(t);
    this.taches.set([]); this.revokeUrls(); this.photos.set([]); this.photoSrc.set({});
    this.commentaire.set(''); this.actionMsg.set('');
    const id = Number(t.id); if (!id) return;
    this.bff.tachesIntervention(id).pipe(catchError(() => of([]))).subscribe(ts => this.taches.set(ts ?? []));
    this.bff.photosIntervention(id).pipe(catchError(() => of([] as PhotoDto[]))).subscribe(ps => {
      this.photos.set(ps ?? []);
      for (const p of (ps ?? [])) {
        this.bff.photoContenu(id, p.id).subscribe(b => {
          const url = URL.createObjectURL(b);
          this.photoSrc.update(m => ({ ...m, [p.id]: url }));
        });
      }
    });
  }
  fermer(): void { this.revokeUrls(); this.selected.set(null); this.taches.set([]); this.photos.set([]); this.photoSrc.set({}); this.commentaire.set(''); this.actionMsg.set(''); }
  private revokeUrls(): void { for (const u of Object.values(this.photoSrc())) URL.revokeObjectURL(u); }

  // ── Bloc K : validation superviseur (endpoints réels /valider /corriger /cloturer) ──
  canValider(t: any): boolean { return ['TERMINEE', 'RAPPORT_SOUMIS'].includes(t.status); }
  canCorriger(t: any): boolean { return ['TERMINEE', 'RAPPORT_SOUMIS'].includes(t.status); }
  canCloturer(t: any): boolean { return ['VALIDEE', 'TERMINEE'].includes(t.status); }

  validationLabel(t: any): string {
    if (t.status === 'VALIDEE') return 'validée';
    if (t.status === 'CLOSED') return 'clôturée';
    if (t.valideePar) return 'validée';
    return 'en attente';
  }

  valider(t: any): void {
    const id = Number(t.id); if (!id) return;
    this.actionMsg.set(''); this.busy.set(true);
    this.bff.validerIntervention(id, this.commentaire().trim() || undefined)
      .pipe(catchError(() => { this.actionMsg.set('Validation impossible (droits ou état).'); return of(null); }))
      .subscribe(res => { this.busy.set(false); if (res) this.rechargerEtRouvrir(id); });
  }

  demanderCorrection(t: any): void {
    const id = Number(t.id); if (!id) return;
    const motif = this.commentaire().trim();
    if (!motif) { this.actionMsg.set('Indiquez le motif de correction dans le commentaire.'); return; }
    this.actionMsg.set(''); this.busy.set(true);
    this.bff.demanderCorrection(id, motif)
      .pipe(catchError(() => { this.actionMsg.set('Demande de correction impossible.'); return of(null); }))
      .subscribe(res => { this.busy.set(false); if (res) this.rechargerEtRouvrir(id); });
  }

  cloturer(t: any): void {
    const id = Number(t.id); if (!id) return;
    this.actionMsg.set(''); this.busy.set(true);
    this.bff.cloturerIntervention(id)
      .pipe(catchError(() => { this.actionMsg.set('Clôture impossible.'); return of(null); }))
      .subscribe(res => { this.busy.set(false); if (res) this.rechargerEtRouvrir(id); });
  }

  /** Recharge la liste scopée et ré-ouvre la fiche sur la version fraîche du ticket (source unique). */
  private rechargerEtRouvrir(id: number): void {
    this.bff.tickets(this.scope.dept ?? undefined).pipe(catchError(() => of([]))).subscribe(rows => {
      const arr = Array.isArray(rows) ? rows : [];
      this.tickets.set(arr);
      const fresh = arr.find((t: any) => Number(t.id) === id);
      this.selected.set(fresh ?? null);
      this.commentaire.set('');
    });
  }

  tachesFaites(): number { return this.taches().filter((t: any) => t.statut === 'FAIT').length; }
  ini(u: string): string { return (u || '?').slice(0, 2).toUpperCase(); }
  acceptLabel(t: any): string {
    if (t.completedAt) return 'intervention terminée';
    if (t.startedAt) return 'en cours';
    if (t.acceptedAt) return 'acceptée';
    if (t.status === 'REJETEE') return 'refusée';
    return "en attente d'acceptation";
  }
  voirRapport(rapportId: any): void { this.router.navigate(['/superviseur/rapports', rapportId]); }

  countBy(status: string): number {
    return this.tickets().filter(t => t.status === status).length;
  }

  statusLabel(s: string): string {
    return ({
      OPEN: 'à planifier', ASSIGNED: 'assignée', IN_PROGRESS: 'en cours', CLOSED: 'clôturée',
      BROUILLON: 'brouillon', ENVOYEE: 'envoyée', RECUE: 'reçue', ACCEPTEE: 'acceptée',
      EN_COURS: 'en cours', EN_PAUSE: 'en pause', TERMINEE: 'terminée',
      RAPPORT_SOUMIS: 'rapport soumis', VALIDEE: 'validée', REJETEE: 'refusée', ANNULEE: 'annulée',
    } as Record<string, string>)[s] ?? s;
  }

  chipClass(s: string): string {
    if (['CLOSED', 'TERMINEE', 'VALIDEE'].includes(s)) return 'supi-chip--green';
    if (['ASSIGNED', 'IN_PROGRESS', 'ENVOYEE', 'ACCEPTEE', 'EN_COURS', 'RAPPORT_SOUMIS'].includes(s)) return 'supi-chip--amber';
    return '';
  }

  timeAgo(iso: string): string {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `il y a ${Math.max(1, min)} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    return `il y a ${Math.floor(h / 24)} j`;
  }
}

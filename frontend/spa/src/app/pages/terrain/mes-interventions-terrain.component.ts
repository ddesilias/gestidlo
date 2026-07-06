import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { Intervention, InterventionStatus, InterventionStore, InterventionTask } from '../../intervention.store';
import { AuthService } from '../../auth.service';
import { BffApiService, PhotoDto } from '../../api/bff-api.service';
import { ToastService } from '../../ui/toast.service';

/**
 * « Mes interventions » du technicien (shell terrain). Réception de l'ordre de travail créé par
 * le superviseur, et exécution sur le terrain : accepter / refuser, démarrer, cocher les tâches
 * une-par-une, terminer. Tout passe par le CONTRAT de l'InterventionStore (mock derrière) — le
 * même store que le wizard superviseur, donc la boucle créer→recevoir→exécuter est visible.
 * Au swap mock→API, ces appels deviendront les vrais endpoints sans toucher à cet écran.
 */
@Component({
  selector: 'app-mes-interventions-terrain',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="mi">
  <h1 class="mi-h">Mes interventions</h1>
  <p class="mi-sub">ordres de travail reçus · {{ mine().length }} active(s)</p>

  <div class="mi-empty" *ngIf="mine().length === 0">
    <i class="ti ti-inbox"></i> Aucune intervention assignée pour le moment.
  </div>

  <div class="mi-card" *ngFor="let it of mine()" (click)="ouvrir(it)">
    <div class="mi-card__top">
      <span class="mi-badge" [ngClass]="'mi-badge--'+badge(it.status)">{{ label(it.status) }}</span>
      <span class="mi-prio" [ngClass]="'mi-prio--'+it.priority">{{ it.priority }}</span>
    </div>
    <div class="mi-card__t">{{ it.title }}</div>
    <div class="mi-card__m"><i class="ti ti-map-pin"></i> {{ it.commune || '—' }} · {{ typeLbl(it.type) }}<span *ngIf="it.scheduledAt"> · {{ dateLbl(it.scheduledAt) }}</span></div>
    <div class="mi-card__go">Voir la fiche <i class="ti ti-chevron-right"></i></div>
  </div>
</div>

<!-- Fiche overlay -->
<div class="fi-ov" *ngIf="selected() as it" (click)="fermer()">
  <div class="fi" (click)="$event.stopPropagation()">
    <div class="fi-head">
      <button class="fi-back" (click)="fermer()"><i class="ti ti-arrow-left"></i></button>
      <div class="fi-head__b">
        <div class="fi-title">{{ it.title }}</div>
        <div class="fi-code">{{ it.code }}</div>
      </div>
      <span class="mi-badge" [ngClass]="'mi-badge--'+badge(it.status)">{{ label(it.status) }}</span>
    </div>

    <div class="fi-grid">
      <div class="fi-c"><span>Type</span><b>{{ typeLbl(it.type) }}</b></div>
      <div class="fi-c"><span>Priorité</span><b>{{ it.priority }}</b></div>
      <div class="fi-c"><span>Commune</span><b>{{ it.commune || '—' }}</b></div>
      <div class="fi-c"><span>Prévue</span><b>{{ it.scheduledAt ? dateLbl(it.scheduledAt) : '—' }}</b></div>
    </div>

    <div class="fi-sec" *ngIf="it.infrastructureName || it.infrastructureId">Localisation</div>
    <div class="fi-loc" *ngIf="it.infrastructureName || it.infrastructureId">
      <i class="ti ti-building-factory-2"></i> {{ it.infrastructureName || it.infrastructureId }}
    </div>

    <div class="fi-sec" *ngIf="it.description">Consignes</div>
    <p class="fi-cons" *ngIf="it.description">{{ it.description }}</p>

    <div class="fi-sec">Travaux demandés <small>{{ faits(it) }}/{{ it.tasks.length }}</small></div>
    <div class="fi-tk" *ngFor="let t of it.tasks">
      <span class="fi-ck" [class.fi-ck--on]="t.done" [class.fi-ck--lock]="!peutCocher(it)" (click)="cocher(it, t)">
        <i *ngIf="t.done" class="ti ti-check"></i>
      </span>
      <span class="fi-tk__l" [class.fi-tk__l--done]="t.done">{{ t.label }}</span>
    </div>
    <div class="fi-hint" *ngIf="it.status === 'acceptee'">Démarrez l'intervention pour cocher les tâches.</div>

    <!-- Photos / preuves terrain (upload réel → ticket_photo) -->
    <ng-container *ngIf="it.status === 'en-cours' || it.status === 'terminee'">
      <div class="fi-sec">Photos / preuves <small>{{ photos().length }}</small></div>
      <div class="fi-phtypes">
        <button *ngFor="let t of typesPhoto" class="fi-phtype" [class.fi-phtype--on]="photoType()===t.k" (click)="photoType.set(t.k)">{{ t.l }}</button>
      </div>
      <div class="fi-photos">
        <div class="fi-ph" *ngFor="let p of photos()">
          <img *ngIf="photoSrc()[p.id] as src" [src]="src" [alt]="p.type"/>
          <div *ngIf="!photoSrc()[p.id]" class="fi-ph__ph"><i class="ti ti-photo"></i></div>
          <span class="fi-ph__t">{{ p.type }}</span>
          <span class="fi-ph__gps" *ngIf="p.latitude != null"><i class="ti ti-map-pin"></i></span>
        </div>
        <label class="fi-ph fi-ph--add">
          <input type="file" accept="image/*" capture="environment" hidden [disabled]="uploading()" (change)="onFichier($event)"/>
          <i class="ti" [ngClass]="uploading() ? 'ti-loader-2' : 'ti-camera-plus'"></i>
          <span>{{ uploading() ? '…' : photoTypeLabel() }}</span>
        </label>
      </div>
    </ng-container>

    <!-- Observation / anomalie (alimente le rapport) -->
    <ng-container *ngIf="it.status === 'en-cours' || it.status === 'terminee'">
      <div class="fi-sec">Observation finale</div>
      <textarea class="fi-obs" rows="2" [ngModel]="obs()" (ngModelChange)="obs.set($event)"
        placeholder="Résultat, anomalie constatée… (repris dans le rapport)"></textarea>
    </ng-container>

    <!-- Actions contextuelles -->
    <div class="fi-act">
      <ng-container *ngIf="it.status === 'envoyee' || it.status === 'creee'">
        <button class="fi-btn fi-btn--ghost" (click)="refuser(it)"><i class="ti ti-x"></i> Refuser</button>
        <button class="fi-btn fi-btn--p" (click)="accepter(it)"><i class="ti ti-check"></i> Accepter l'intervention</button>
      </ng-container>
      <button class="fi-btn fi-btn--p" *ngIf="it.status === 'acceptee'" (click)="demarrer(it)"><i class="ti ti-player-play"></i> Démarrer</button>
      <button class="fi-btn fi-btn--p" *ngIf="it.status === 'en-cours'" [disabled]="!toutObligatoireFait(it)" (click)="terminer(it)">
        <i class="ti ti-flag-check"></i> Terminer l'intervention
      </button>
      <button class="fi-btn fi-btn--p" *ngIf="it.status === 'terminee'" [disabled]="generating()" (click)="genererRapport()"><i class="ti ti-file-text"></i> {{ generating() ? 'Génération…' : 'Générer le rapport' }}</button>
      <span class="fi-done" *ngIf="it.status === 'rejetee'">Intervention refusée.</span>
    </div>
  </div>
</div>
  `,
  styles: [`
    .mi { color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; max-width:680px; }
    .mi-h { font-size:1.05rem; font-weight:600; margin:0 0 3px; } .mi-sub { font-size:.8rem; color:#8B9AAB; margin:0 0 14px; }
    .mi-empty { display:flex; align-items:center; gap:8px; font-size:13px; color:#6B7785; background:#0E131C; border:1px dashed #243041; border-radius:12px; padding:18px; }
    .mi-card { background:#0E131C; border:.5px solid rgba(96,165,250,.12); border-radius:12px; padding:12px 14px; margin-bottom:10px; cursor:pointer; }
    .mi-card:hover { border-color:rgba(96,165,250,.3); }
    .mi-card__top { display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; }
    .mi-badge { font-size:10.5px; font-weight:500; padding:2px 9px; border-radius:20px; background:rgba(255,255,255,.06); color:#8B9AAB; }
    .mi-badge--blue { background:rgba(96,165,250,.14); color:#93C5FD; } .mi-badge--amber { background:rgba(251,191,36,.14); color:#FBBF24; }
    .mi-badge--green { background:rgba(52,211,153,.14); color:#34D399; } .mi-badge--red { background:rgba(248,113,113,.14); color:#F87171; }
    .mi-prio { font-size:10px; text-transform:capitalize; color:#8B9AAB; } .mi-prio--haute,.mi-prio--critique,.mi-prio--urgente { color:#FBBF24; }
    .mi-card__t { font-size:14px; font-weight:500; } .mi-card__m { font-size:12px; color:#8B9AAB; margin-top:4px; } .mi-card__m i { font-size:13px; vertical-align:-1px; }
    .mi-card__go { font-size:11.5px; color:#60A5FA; margin-top:8px; } .mi-card__go i { font-size:13px; vertical-align:-2px; }

    .fi-ov { position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:1100; display:flex; justify-content:center; align-items:flex-start; padding:14px; overflow-y:auto; }
    .fi { width:560px; max-width:96vw; background:#0F1419; border:1px solid #1F2A33; border-radius:14px; padding:16px 18px 20px; color:#E2E8EE; }
    .fi-head { display:flex; align-items:center; gap:10px; }
    .fi-back { width:32px; height:32px; border-radius:8px; border:1px solid #2A3744; background:#1A222C; color:#CBD5E1; cursor:pointer; flex-shrink:0; }
    .fi-head__b { flex:1; min-width:0; } .fi-title { font-size:15.5px; font-weight:600; } .fi-code { font-size:11px; color:#6B7785; }
    .fi-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:14px 0; }
    .fi-c { background:#10161D; border:1px solid #1F2A33; border-radius:9px; padding:8px 10px; } .fi-c span { font-size:10px; color:#6B7785; } .fi-c b { display:block; font-size:13px; margin-top:2px; text-transform:capitalize; }
    .fi-sec { font-size:11px; color:#6B7785; text-transform:uppercase; letter-spacing:.4px; margin:14px 0 7px; } .fi-sec small { text-transform:none; color:#8B9AAB; margin-left:5px; }
    .fi-loc { font-size:13px; } .fi-loc i { color:#60A5FA; margin-right:4px; }
    .fi-cons { font-size:13px; color:#CBD5E1; margin:0; line-height:1.5; }
    .fi-obs { width:100%; background:#10161D; border:1px solid #2A3744; border-radius:8px; padding:8px 10px; color:#E2E8EE; font-size:13px; outline:none; font-family:inherit; resize:vertical; }
    .fi-obs:focus { border-color:#60A5FA; }
    .fi-phtypes { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px; }
    .fi-phtype { font-size:11px; padding:4px 9px; border-radius:7px; border:1px solid #2A3744; background:#161D26; color:#8B9AAB; cursor:pointer; }
    .fi-phtype--on { border-color:#60A5FA; color:#93C5FD; background:rgba(96,165,250,.12); }
    .fi-photos { display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:8px; }
    .fi-ph { position:relative; aspect-ratio:1; border-radius:9px; overflow:hidden; background:#10161D; border:1px solid #1F2A33; }
    .fi-ph img { width:100%; height:100%; object-fit:cover; display:block; }
    .fi-ph__ph { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#3A4754; } .fi-ph__ph i { font-size:22px; }
    .fi-ph__t { position:absolute; left:0; bottom:0; right:0; font-size:9px; text-transform:capitalize; color:#E2E8EE; background:rgba(0,0,0,.55); padding:2px 5px; }
    .fi-ph__gps { position:absolute; top:4px; right:4px; color:#34D399; font-size:11px; }
    .fi-ph--add { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; cursor:pointer; border:1px dashed #2A3744; color:#60A5FA; }
    .fi-ph--add i { font-size:20px; } .fi-ph--add span { font-size:10px; }
    .fi-tk { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #1F2A33; }
    .fi-ck { width:21px; height:21px; border-radius:6px; border:1px solid #3A4754; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; color:#60A5FA; }
    .fi-ck--on { background:rgba(52,211,153,.15); border-color:#34D399; color:#34D399; } .fi-ck--lock { opacity:.4; cursor:not-allowed; }
    .fi-tk__l { font-size:13px; } .fi-tk__l--done { color:#6B7785; text-decoration:line-through; }
    .fi-hint { font-size:11.5px; color:#6B7785; margin-top:8px; font-style:italic; }
    .fi-act { display:flex; gap:8px; justify-content:flex-end; margin-top:18px; flex-wrap:wrap; }
    .fi-btn { display:inline-flex; align-items:center; gap:6px; font-size:13.5px; padding:9px 15px; border-radius:9px; border:1px solid #2A3744; background:#161D26; color:#CBD5E1; cursor:pointer; }
    .fi-btn--p { background:#2563EB; border-color:#2563EB; color:#fff; } .fi-btn--p:disabled { opacity:.45; cursor:not-allowed; }
    .fi-btn--ghost { border-color:rgba(248,113,113,.4); color:#F87171; }
    .fi-done { font-size:12.5px; color:#8B9AAB; align-self:center; }
  `],
})
export class MesInterventionsTerrainComponent {
  private readonly store = inject(InterventionStore);
  private readonly auth  = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly bff   = inject(BffApiService);
  private readonly router = inject(Router);

  private readonly all = toSignal(this.store.items$, { initialValue: this.store.snapshot });
  readonly selectedId = signal<string | null>(null);
  readonly obs = signal('');
  readonly generating = signal(false);

  // Photos
  readonly photos = signal<PhotoDto[]>([]);
  readonly photoSrc = signal<Record<number, string>>({});
  readonly photoType = signal('AVANT');
  readonly uploading = signal(false);
  readonly typesPhoto = [
    { k: 'AVANT', l: 'Avant' }, { k: 'PENDANT', l: 'Pendant' }, { k: 'APRES', l: 'Après' },
    { k: 'ANOMALIE', l: 'Anomalie' }, { k: 'SIGNATURE', l: 'Signature' },
  ];
  photoTypeLabel(): string { return this.typesPhoto.find(t => t.k === this.photoType())?.l ?? 'Photo'; }

  private get me(): string { return this.auth.userSnapshot()?.username ?? ''; }

  /** Interventions assignées au technicien connecté, déjà envoyées (pas les brouillons superviseur). */
  readonly mine = computed(() =>
    this.all().filter(i => i.technicianId === this.me && i.status !== 'creee')
      .sort((a, b) => (b.scheduledAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.createdAt)));

  readonly selected = computed(() => this.all().find(i => i.id === this.selectedId()) ?? null);

  ouvrir(it: Intervention): void { this.selectedId.set(it.id); this.obs.set(it.notes ?? ''); this.chargerPhotos(it); }
  fermer(): void { this.revokeUrls(); this.photos.set([]); this.photoSrc.set({}); this.selectedId.set(null); }

  // ── Photos (preuves terrain — upload réel sur le ticket) ──
  private chargerPhotos(it: Intervention): void {
    this.revokeUrls();
    this.photos.set([]); this.photoSrc.set({});
    const tid = Number(it.id); if (!tid) return;
    this.bff.photosIntervention(tid).subscribe(ps => {
      this.photos.set(ps ?? []);
      for (const p of (ps ?? [])) {
        this.bff.photoContenu(tid, p.id).subscribe(b => {
          const url = URL.createObjectURL(b);
          this.photoSrc.update(m => ({ ...m, [p.id]: url }));
        });
      }
    });
  }

  onFichier(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    const it = this.selected();
    if (!file || !it) return;
    const tid = Number(it.id); if (!tid) { input.value = ''; return; }
    this.uploading.set(true);
    this.capturerGps().then(c => {
      this.bff.ajouterPhotoIntervention(tid, file, this.photoType(), c?.lat, c?.lon).subscribe({
        next: () => { this.uploading.set(false); this.toast.push('success', 'Photo ajoutée'); this.chargerPhotos(it); },
        error: () => { this.uploading.set(false); this.toast.push('error', "Échec de l'upload"); },
      });
      input.value = '';
    });
  }

  /** Géoloc best-effort (refus / indispo → upload sans GPS). */
  private capturerGps(): Promise<{ lat: number; lon: number } | null> {
    return new Promise(res => {
      if (!navigator.geolocation) { res(null); return; }
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => res(null), { timeout: 4000, maximumAge: 60000 });
    });
  }

  private revokeUrls(): void { for (const u of Object.values(this.photoSrc())) URL.revokeObjectURL(u); }

  // ── Actions (contrat InterventionStore) ──
  accepter(it: Intervention): void { this.store.accepter(it.id).subscribe(() => this.toast.push('success', 'Intervention acceptée')); }
  refuser(it: Intervention): void  { this.store.refuser(it.id).subscribe(() => { this.toast.push('info', 'Intervention refusée'); this.fermer(); }); }
  demarrer(it: Intervention): void { this.store.demarrer(it.id).subscribe(() => this.toast.push('success', 'Intervention démarrée')); }
  terminer(it: Intervention): void { this.store.terminer(it.id).subscribe(() => this.toast.push('success', 'Intervention terminée — vous pouvez générer le rapport')); }
  cocher(it: Intervention, t: InterventionTask): void {
    if (!this.peutCocher(it)) return;
    this.store.cocherTache(it.id, t.id, !t.done).subscribe();
  }
  /**
   * Assemble un brouillon de rapport DEPUIS l'intervention (lue via le contrat du store, mock pour
   * l'instant) : tâches faites → activités, photos attendues → liste, observation → constat. Le
   * résumé professionnel est généré CÔTÉ SERVEUR depuis `contenuJson` (déterministe, zéro LLM).
   * La destination — la file Rapports — est déjà réelle ; seule la SOURCE basculera au swap (et
   * alors `interventionId` + les vraies photos s'attacheront), sans toucher à ce code.
   */
  genererRapport(): void {
    const it = this.selected();
    if (!it || this.generating()) return;
    const tasksDone = it.tasks.filter(t => t.done).map(t => t.label);
    const photos    = it.tasks.filter(t => /^photo/i.test(t.label)).map(t => t.label.replace(/^photo\s*:?\s*/i, ''));
    const observation = this.obs().trim();
    const contenu = {
      etat_general: (it.priority === 'critique' || it.priority === 'haute') ? 'Critique' : 'Normal',
      activites: tasksDone,
      problemes_observes: observation ? [observation] : [],
      infrastructure: it.infrastructureName || it.infrastructureId || (it.commune ?? ''),
      observation_courte: observation,
      photos,
    };
    this.generating.set(true);
    this.bff.creerRapport({
      titre: 'Rapport — ' + it.title,
      type: 'intervention',
      commune: it.commune ?? null,
      departement: it.department ?? null,
      contenuJson: JSON.stringify(contenu),
      interventionId: Number(it.id) || null, // post-swap : lien vers le vrai ticket
    }).subscribe({
      next: (r) => {
        this.generating.set(false);
        if (r?.id) this.store.update({ ...it, reportId: r.id });
        this.toast.push('success', 'Brouillon de rapport généré');
        this.fermer();
        this.router.navigate(['/terrain/rapports']);
      },
      error: () => { this.generating.set(false); this.toast.push('error', 'Échec de la génération du rapport'); },
    });
  }

  // ── Règles d'affichage ──
  peutCocher(it: Intervention): boolean { return it.status === 'en-cours'; }
  faits(it: Intervention): number { return it.tasks.filter(t => t.done).length; }
  toutObligatoireFait(it: Intervention): boolean { return it.tasks.every(t => t.done); }

  typeLbl(t: string): string {
    return ({ iot: 'Capteur IoT', inspection: 'Inspection', maintenance: 'Maintenance', reparation: 'Réparation',
      urgence: 'Urgence', journalier: 'Journalier', qualite: 'Qualité eau', nettoyage: 'Nettoyage',
      recensement: 'Recensement', installation: 'Installation', verification: 'Vérification' } as Record<string, string>)[t] ?? t;
  }
  label(s: InterventionStatus): string {
    return ({ creee: 'brouillon', envoyee: 'à accepter', assignee: 'assignée', acceptee: 'acceptée',
      'en-cours': 'en cours', 'en-attente': 'en attente', terminee: 'terminée', rejetee: 'refusée',
      validee: 'validée', cloturee: 'clôturée', annulee: 'annulée' } as Record<string, string>)[s] ?? s;
  }
  badge(s: InterventionStatus): string {
    if (s === 'envoyee') return 'blue';
    if (s === 'acceptee' || s === 'en-cours') return 'amber';
    if (s === 'terminee' || s === 'validee' || s === 'cloturee') return 'green';
    if (s === 'rejetee' || s === 'annulee') return 'red';
    return 'blue';
  }
  dateLbl(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' · ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}

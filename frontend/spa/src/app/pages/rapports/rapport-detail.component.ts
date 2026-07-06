import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { ScopeService } from '../../scope.service';
import { AuthService } from '../../auth.service';
import { RapportsStore, RapportDto } from '../../rapports.store';

/**
 * Consulter / valider un rapport — document technicien IMMUABLE à gauche, examen du superviseur
 * à droite. Le superviseur bascule une responsabilité, il ne co-écrit pas : aucun chemin d'édition
 * du contenu technicien, sa décision est une COUCHE par-dessus (attestation + priorité + commentaire),
 * gelée côté serveur dans un snapshot signé (cf. backend RapportSignatureEntity).
 *
 * <p>Deux paliers distincts (gouvernance, pas UI) : <b>Valider</b> (TRANSMIS → VALIDE, « jugé bon
 * par l'URD ») puis, dans un second temps, <b>Signer et transmettre</b> à DINEPA (VALIDE →
 * TRANSMIS_ADMIN). L'écran enchaîne visuellement mais ne fusionne pas les deux actes — la latitude
 * entre les deux existe (transmission différée/groupée).
 *
 * <p>Les <b>flags d'aide à la décision</b> sont 100 % client, déterministes, calculés sur
 * {@code contenuJson} parsé (zéro backend, zéro LLM). Ils ne bloquent pas : ils ajoutent de la
 * friction (le bouton devient « Valider malgré N alerte(s) »).
 */
@Component({
  selector: 'app-rapport-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
<div class="rd" [class.rd--split]="afficherVolet()">
  <a class="rd-back" [routerLink]="['..']"><i class="ti ti-arrow-left"></i> Retour aux rapports</a>

  <!-- Chargement (accès direct / refresh : on attend la liste scopée) -->
  <div *ngIf="!charge()" class="rd-loading"><i class="ti ti-loader-2"></i> Chargement du rapport…</div>

  <!-- Rapport introuvable dans le périmètre (mauvais id, ou hors scope serveur) -->
  <div *ngIf="charge() && !rapport()" class="rd-empty">
    <i class="ti ti-file-off"></i>
    <div>
      <div class="rd-empty__t">Rapport introuvable</div>
      <div class="rd-empty__s">Il n'existe pas ou se trouve hors de votre périmètre.</div>
    </div>
  </div>

  <div *ngIf="rapport() as r" class="rd-grid">

    <!-- ════════ COLONNE GAUCHE — document technicien (lecture seule, immuable) ════════ -->
    <div class="rd-doc">
      <div *ngIf="afficherVolet()" class="rd-lock"><i class="ti ti-lock"></i> document du technicien · lecture seule · immuable</div>

      <header class="rd-head">
        <div class="rd-head__main">
          <span class="rd-chip" [ngClass]="chipClass(r.status)">{{ statutLabel(r.status) }}</span>
          <h1 class="rd-h1">{{ r.titre }}</h1>
          <div class="rd-meta">
            <span><i class="ti ti-user"></i> {{ r.auteur || '—' }}</span>
            <span *ngIf="r.commune"><i class="ti ti-map-pin"></i> {{ r.commune }}</span>
            <span *ngIf="r.departementId"><i class="ti ti-map"></i> {{ r.departementId }}</span>
            <span *ngIf="r.type"><i class="ti ti-tag"></i> {{ r.type }}</span>
            <span *ngIf="r.pages"><i class="ti ti-files"></i> {{ r.pages }} pages</span>
          </div>
        </div>
      </header>

      <!-- Chronologie : ce qui est renseigné s'affiche, dans l'ordre du cycle. -->
      <section class="rd-timeline">
        <span *ngIf="r.createdAt"><i class="ti ti-pencil"></i> créé {{ timeAgo(r.createdAt) }}</span>
        <span *ngIf="r.transmisLe"><i class="ti ti-send"></i> transmis {{ timeAgo(r.transmisLe) }}</span>
        <span *ngIf="r.valideLe" class="rd-ok"><i class="ti ti-check"></i> validé {{ timeAgo(r.valideLe) }}<span *ngIf="r.validePar"> · {{ r.validePar }}</span></span>
        <span *ngIf="r.signeLe" class="rd-ok"><i class="ti ti-signature"></i> signé {{ timeAgo(r.signeLe) }}<span *ngIf="r.signataire"> · {{ r.signataire }}</span></span>
      </section>

      <!-- Motif de renvoi : visible pour que l'auteur sache quoi corriger (jamais muet). -->
      <div *ngIf="r.motifRenvoi" class="rd-renvoi">
        <i class="ti ti-arrow-back-up"></i>
        <div><strong>Renvoyé pour correction.</strong> {{ r.motifRenvoi }}</div>
      </div>

      <!-- Corps : le texte professionnel déterministe (resumeAuto). Repli sur le contenu guidé. -->
      <article class="rd-body">
        <div *ngIf="r.resumeAuto; else brut" class="rd-prose">{{ r.resumeAuto }}</div>
        <ng-template #brut>
          <div *ngIf="contenuLignes().length; else vide">
            <div *ngFor="let l of contenuLignes()" class="rd-kv">
              <span class="rd-kv__k">{{ l.k }}</span>
              <span class="rd-kv__v">{{ l.v }}</span>
            </div>
          </div>
          <ng-template #vide>
            <div class="rd-noprose"><i class="ti ti-file-text"></i> Ce rapport n'a pas encore de contenu rédigé.</div>
          </ng-template>
        </ng-template>
      </article>
    </div>

    <!-- ════════ COLONNE DROITE — examen du superviseur (volet de décision) ════════ -->
    <aside *ngIf="afficherVolet()" class="rd-panel">
      <div class="rd-panel__h">Examen du superviseur</div>
      <div class="rd-panel__who">{{ signataireNom() }}<span *ngIf="signataireRole()"> · {{ signataireRole() }}</span><span *ngIf="dept"> · {{ dept }}</span></div>

      <!-- Auto-validation interdite serveur : on reflète le 403 côté UI plutôt que de proposer un geste mort. -->
      <div *ngIf="estAuteur(r)" class="rd-block rd-block--warn">
        <i class="ti ti-alert-triangle"></i>
        <div>Vous êtes l'auteur de ce rapport. Un superviseur ne peut pas valider son propre rapport — un autre signataire doit l'examiner.</div>
      </div>

      <ng-container *ngIf="!estAuteur(r)">

        <!-- ── Palier 1 : examen + validation (rapport TRANSMIS) ── -->
        <ng-container *ngIf="r.status === 'TRANSMIS'">

          <!-- Flags déterministes : friction, pas blocage -->
          <div *ngIf="autoFlags().length" class="rd-flags">
            <div class="rd-flags__h"><i class="ti ti-alert-triangle"></i> {{ autoFlags().length }} point(s) à contrôler · auto</div>
            <div *ngFor="let f of autoFlags()" class="rd-flags__i">{{ f }}</div>
          </div>
          <div *ngIf="!autoFlags().length" class="rd-flags rd-flags--ok">
            <i class="ti ti-circle-check"></i> Aucune incohérence automatique détectée
          </div>

          <!-- Attestation d'examen (cases) -->
          <div class="rd-att">
            <div class="rd-att__h">Attestation d'examen</div>
            <button type="button" class="rd-att__row" (click)="attCompletude.set(!attCompletude())">
              <i class="ti" [ngClass]="attCompletude() ? 'ti-square-check rd-on' : 'ti-square'"></i> Complétude
            </button>
            <button type="button" class="rd-att__row" (click)="attCoherence.set(!attCoherence())">
              <i class="ti" [ngClass]="attCoherence() ? 'ti-square-check rd-on' : 'ti-square'"></i> Cohérence diagnostic / opérations
            </button>
            <button type="button" class="rd-att__row" (click)="attTerritorialite.set(!attTerritorialite())">
              <i class="ti" [ngClass]="attTerritorialite() ? 'ti-square-check rd-on' : 'ti-square'"></i> Territorialité
            </button>
          </div>

          <!-- Réévaluation de priorité (n'altère pas le diagnostic technicien) -->
          <div class="rd-prio">
            <div class="rd-prio__h">Priorité <span *ngIf="prioriteTechnicien()">· technicien : {{ prioriteTechnicien() }}</span></div>
            <div class="rd-prio__chips">
              <button *ngFor="let p of PRIORITES" type="button" class="rd-prio__c"
                [class.rd-prio__c--on]="prioriteReevaluee() === p" (click)="togglePriorite(p)">{{ p }}</button>
            </div>
          </div>

          <!-- Commentaire -->
          <textarea class="rd-comm" rows="2" [(ngModel)]="commentaire" placeholder="Commentaire du superviseur (optionnel)…"></textarea>

          <!-- Certification = l'acte (gèle le snapshot signé) -->
          <button type="button" class="rd-certif" [class.rd-certif--on]="certifie()" (click)="certifie.set(!certifie())">
            <i class="ti" [ngClass]="certifie() ? 'ti-square-check rd-on' : 'ti-square'"></i>
            <span>Je certifie avoir examiné ce rapport
              <small>{{ signataireNom() }}<span *ngIf="dept"> · {{ dept }}</span> · gèle le rapport (snapshot signé)</small>
            </span>
          </button>

          <div *ngIf="erreur()" class="rd-err"><i class="ti ti-alert-circle"></i> {{ erreur() }}</div>

          <!-- Actions : Renvoyer (motif requis) / Valider -->
          <ng-container *ngIf="!renvoiOuvert()">
            <div class="rd-actions">
              <button type="button" class="rd-btn rd-btn--ghost" [disabled]="busy()" (click)="ouvrirRenvoi()">Renvoyer · motif requis</button>
              <button type="button" class="rd-btn rd-btn--primary" [disabled]="!certifie() || busy()" (click)="valider(r.id)">
                {{ autoFlags().length ? 'Valider malgré ' + autoFlags().length + ' alerte(s)' : 'Valider le rapport' }}
              </button>
            </div>
          </ng-container>
          <ng-container *ngIf="renvoiOuvert()">
            <textarea class="rd-comm" rows="2" [(ngModel)]="motif" placeholder="Motif pour l'auteur (requis — jamais muet)…"></textarea>
            <div class="rd-actions">
              <button type="button" class="rd-btn rd-btn--ghost" [disabled]="busy()" (click)="annulerRenvoi()">Annuler</button>
              <button type="button" class="rd-btn rd-btn--warn" [disabled]="!motif.trim() || busy()" (click)="confirmerRenvoi(r.id)">Confirmer le renvoi</button>
            </div>
          </ng-container>
        </ng-container>

        <!-- ── Palier 2 : signer et transmettre à DINEPA (rapport VALIDE) ── -->
        <ng-container *ngIf="r.status === 'VALIDE'">
          <div class="rd-block rd-block--ok">
            <i class="ti ti-check"></i>
            <div>Rapport validé<span *ngIf="r.validePar"> par {{ r.validePar }}</span>. Snapshot gelé. Reste à l'engager vers DINEPA.</div>
          </div>
          <div *ngIf="erreur()" class="rd-err"><i class="ti ti-alert-circle"></i> {{ erreur() }}</div>
          <div class="rd-actions">
            <button type="button" class="rd-btn rd-btn--primary" [disabled]="busy()" (click)="signer(r.id)">
              <i class="ti ti-signature"></i> Signer et transmettre à DINEPA
            </button>
          </div>
          <div class="rd-hint">La signature revérifie l'empreinte du contenu : si le rapport a changé depuis la validation, l'engagement est refusé.</div>
        </ng-container>
      </ng-container>
    </aside>
  </div>
</div>
  `,
  styles: [`
    .rd { color:#e6edf3; max-width:860px; }
    .rd--split { max-width:1180px; }
    .rd-grid { display:block; }
    .rd--split .rd-grid { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(0,1fr); gap:16px; align-items:start; }
    @media (max-width:880px) { .rd--split .rd-grid { grid-template-columns:1fr; } }

    .rd-back { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#8b949e; text-decoration:none; margin-bottom:16px; }
    .rd-back:hover { color:#c9d1d9; }
    .rd-back i { font-size:14px; }

    .rd-loading { display:flex; align-items:center; gap:8px; font-size:12px; color:#8b949e; padding:18px; }
    .rd-loading i { font-size:15px; }

    .rd-empty { display:flex; align-items:center; gap:12px; background:#161b22; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:18px; }
    .rd-empty i { font-size:24px; color:#8b949e; }
    .rd-empty__t { font-size:14px; font-weight:500; }
    .rd-empty__s { font-size:12px; color:#8b949e; margin-top:2px; }

    .rd-lock { display:flex; align-items:center; gap:6px; font-size:10px; color:#5b6470; margin-bottom:6px; }
    .rd-lock i { font-size:13px; }

    .rd-head { margin-bottom:14px; }
    .rd-h1 { font-size:20px; font-weight:500; margin:8px 0 0; }
    .rd-chip { font-size:10px; border-radius:20px; padding:3px 9px; color:#8b949e; background:rgba(255,255,255,.06); }
    .rd-chip--green { color:#3fb950; background:rgba(63,185,80,.12); }
    .rd-chip--amber { color:#eab308; background:rgba(234,179,8,.12); }
    .rd-meta { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:#8b949e; margin-top:10px; }
    .rd-meta i { font-size:13px; vertical-align:-2px; margin-right:3px; }

    .rd-timeline { display:flex; flex-wrap:wrap; gap:16px; font-size:11px; color:#8b949e; padding:10px 0; border-top:1px solid rgba(255,255,255,.07); border-bottom:1px solid rgba(255,255,255,.07); margin-bottom:14px; }
    .rd-timeline i { font-size:12px; vertical-align:-2px; margin-right:3px; }
    .rd-ok { color:#3fb950; }

    .rd-renvoi { display:flex; gap:9px; font-size:12px; color:#e0c074; background:rgba(234,179,8,.08); border:1px solid rgba(234,179,8,.22); border-radius:10px; padding:11px 13px; margin-bottom:14px; }
    .rd-renvoi i { font-size:16px; }

    .rd-body { background:#11161f; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:18px 20px; }
    .rd-prose { font-size:13px; line-height:1.65; color:#c9d1d9; white-space:pre-wrap; }
    .rd-kv { display:flex; gap:12px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,.05); font-size:12px; }
    .rd-kv__k { color:#8b949e; min-width:160px; }
    .rd-kv__v { color:#c9d1d9; }
    .rd-noprose { display:flex; align-items:center; gap:8px; font-size:12px; color:#8b949e; }
    .rd-noprose i { font-size:15px; }

    /* ── Volet d'examen ── */
    .rd-panel { background:#11161f; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:14px 15px; display:flex; flex-direction:column; gap:11px; position:sticky; top:12px; }
    .rd-panel__h { font-size:13px; font-weight:500; }
    .rd-panel__who { font-size:11px; color:#8b949e; margin-top:-7px; }

    .rd-block { display:flex; gap:9px; font-size:12px; border-radius:9px; padding:10px 11px; line-height:1.5; }
    .rd-block i { font-size:15px; flex-shrink:0; }
    .rd-block--warn { color:#e0c074; background:rgba(234,179,8,.08); border:1px solid rgba(234,179,8,.22); }
    .rd-block--ok { color:#3fb950; background:rgba(63,185,80,.07); border:1px solid rgba(63,185,80,.2); }

    .rd-flags { background:rgba(234,179,8,.08); border:1px solid rgba(234,179,8,.22); border-radius:9px; padding:9px 11px; }
    .rd-flags__h { font-size:11px; color:#eab308; display:flex; align-items:center; gap:5px; margin-bottom:5px; }
    .rd-flags__i { font-size:11px; color:#e0c074; line-height:1.5; }
    .rd-flags--ok { display:flex; align-items:center; gap:6px; font-size:11px; color:#3fb950; background:rgba(63,185,80,.06); border-color:rgba(63,185,80,.18); }

    .rd-att { background:rgba(255,255,255,.03); border-radius:9px; padding:9px 11px; }
    .rd-att__h { font-size:11px; color:#8b949e; margin-bottom:6px; }
    .rd-att__row { display:flex; align-items:center; gap:7px; width:100%; background:transparent; border:0; color:#c9d1d9; font-size:12px; font-family:inherit; padding:4px 0; cursor:pointer; text-align:left; }
    .rd-att__row i { font-size:15px; color:#8b949e; }
    .rd-on { color:#19c3a8 !important; }

    .rd-prio__h { font-size:11px; color:#8b949e; margin-bottom:6px; }
    .rd-prio__chips { display:flex; gap:6px; flex-wrap:wrap; }
    .rd-prio__c { font-size:11px; padding:4px 10px; border-radius:20px; border:1px solid rgba(255,255,255,.12); background:transparent; color:#8b949e; cursor:pointer; font-family:inherit; }
    .rd-prio__c--on { color:#5dd6c2; background:rgba(25,195,168,.14); border-color:rgba(25,195,168,.3); }

    .rd-comm { width:100%; box-sizing:border-box; font-size:12px; color:#c9d1d9; background:#0a0e14; border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:8px 10px; font-family:inherit; outline:none; resize:vertical; }

    .rd-certif { display:flex; gap:9px; align-items:flex-start; width:100%; text-align:left; background:transparent; border:1px solid rgba(25,195,168,.3); border-radius:9px; padding:10px 11px; cursor:pointer; color:#e6edf3; font-family:inherit; }
    .rd-certif--on { background:rgba(25,195,168,.08); }
    .rd-certif i { font-size:16px; color:#8b949e; flex-shrink:0; }
    .rd-certif span { font-size:12px; line-height:1.4; }
    .rd-certif small { display:block; font-size:10px; color:#5b6470; margin-top:3px; }

    .rd-actions { display:flex; gap:8px; }
    .rd-btn { flex:1; text-align:center; font-size:12px; padding:9px; border-radius:8px; cursor:pointer; font-family:inherit; border:1px solid transparent; }
    .rd-btn i { font-size:13px; vertical-align:-2px; margin-right:3px; }
    .rd-btn--ghost { color:#c9d1d9; border-color:rgba(255,255,255,.14); background:transparent; }
    .rd-btn--warn { color:#e0c074; border-color:rgba(234,179,8,.32); background:transparent; }
    .rd-btn--primary { color:#04342c; background:#19c3a8; border-color:#19c3a8; }
    .rd-btn:disabled { opacity:.45; cursor:not-allowed; }

    .rd-err { display:flex; align-items:center; gap:6px; font-size:11px; color:#f85149; }
    .rd-hint { font-size:10px; color:#5b6470; line-height:1.5; }
  `],
})
export class RapportDetailComponent implements OnInit {
  readonly store = inject(RapportsStore);
  private readonly scope = inject(ScopeService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly PRIORITES = ['Basse', 'Moyenne', 'Haute', 'Urgente'];

  /** Vrai dès que la liste a été chargée au moins une fois (évite un faux « introuvable » au boot). */
  readonly charge = signal(false);
  private readonly id = signal<string>(this.route.snapshot.paramMap.get('id') ?? '');

  readonly rapport = computed<RapportDto | undefined>(() =>
    this.store.items().find(r => r.id === this.id()));

  // ── État du volet d'examen ────────────────────────────────────────────────
  readonly attCompletude     = signal(false);
  readonly attCoherence      = signal(false);
  readonly attTerritorialite = signal(false);
  readonly prioriteReevaluee = signal<string>('');
  commentaire = '';
  readonly certifie     = signal(false);
  readonly renvoiOuvert = signal(false);
  motif = '';
  readonly busy   = signal(false);
  readonly erreur = signal<string | null>(null);

  get dept(): string { return this.scope.dept ?? ''; }
  get estTepac(): boolean { return this.auth.hasRole('TEPAC'); }
  get peutDecider(): boolean { return this.auth.hasRole('SUPERVISEUR_URD') || this.auth.hasRole('ADMIN'); }

  estAuteur(r: RapportDto): boolean {
    const me = this.auth.userSnapshot()?.username;
    return !!r.auteurUsername && r.auteurUsername === me;
  }
  signataireNom(): string {
    const u = this.auth.userSnapshot();
    return u?.nom || u?.username || '—';
  }
  signataireRole(): string {
    if (this.auth.hasRole('SUPERVISEUR_URD')) return 'Responsable URD';
    if (this.auth.hasRole('ADMIN')) return 'Administrateur';
    return '';
  }

  /** Volet affiché uniquement pour un décideur, et seulement sur les états où il a un geste. */
  readonly afficherVolet = computed<boolean>(() => {
    const r = this.rapport();
    return !!r && this.peutDecider && (r.status === 'TRANSMIS' || r.status === 'VALIDE');
  });

  /** Priorité déclarée par le technicien (lue du contenuJson, affichage seul). */
  readonly prioriteTechnicien = computed<string>(() => this.contenu()?.['priorite'] ?? '');

  /** contenuJson parsé une fois (objet ou null). */
  private readonly contenu = computed<Record<string, any> | null>(() => {
    const r = this.rapport();
    if (!r?.contenuJson) return null;
    try { const o = JSON.parse(r.contenuJson); return o && typeof o === 'object' ? o : null; }
    catch { return null; }
  });

  /**
   * Flags déterministes (zéro backend, zéro LLM) sur le contenu parsé. Règles : (1) diagnostic
   * critique contredit par un résultat « Résolu » ; (2) forte population mais priorité basse ;
   * (3) non résolu / à escalader sans suivi ; (4) capteur évoqué sans équipement lié ;
   * (5) preuves photo « avant »/« après » incomplètes.
   */
  readonly autoFlags = computed<string[]>(() => {
    const o = this.contenu();
    if (!o) return [];
    const flags: string[] = [];
    const etat = String(o['etat_general'] ?? '');
    const resultat = String(o['resultat_final'] ?? '');
    const priorite = String(o['priorite'] ?? '');
    const suivi = o['suivi_necessaire'] === true;
    const elementId = o['element_id'];
    const pop = parseInt(String(o['population_impactee'] ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    const photos = Array.isArray(o['photos']) ? o['photos'] : [];
    const cats = new Set(photos.map((p: any) => String(p?.categorie ?? '').toLowerCase()));
    const blob = (JSON.stringify(o['problemes_observes'] ?? []) + JSON.stringify(o['activites'] ?? [])).toLowerCase();

    if (etat === 'Critique' && resultat === 'Résolu')
      flags.push('État « Critique » mais résultat « Résolu » — cohérence diagnostic / résultat à vérifier.');
    if (pop >= 100 && (priorite === '' || priorite === 'Basse'))
      flags.push('~' + pop + ' ménages impactés mais priorité de suivi ' + (priorite ? '« ' + priorite + ' »' : 'non renseignée') + '.');
    if ((resultat === 'Non résolu' || resultat === 'À escalader') && !suivi)
      flags.push('Résultat « ' + resultat + ' » sans suivi complémentaire demandé.');
    if (blob.includes('capteur') && (elementId === null || elementId === undefined || elementId === ''))
      flags.push('Un capteur est évoqué mais aucun équipement n\'est lié au rapport.');
    if (photos.length > 0 && !(cats.has('avant') && (cats.has('apres') || cats.has('après'))))
      flags.push('Preuves photo incomplètes — « avant » et « après » non tous deux présents.');
    return flags;
  });

  constructor() {
    // Dès que la liste se remplit (réponse du rechargement), on quitte l'état « chargement ».
    effect(() => { if (this.store.items().length > 0) this.charge.set(true); });
  }

  /** Repli quand resumeAuto manque : on déplie le contenu guidé en lignes clé/valeur. */
  readonly contenuLignes = computed<{ k: string; v: string }[]>(() => {
    const o = this.contenu();
    if (!o) return [];
    return Object.entries(o)
      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
      .map(([k, v]) => ({ k, v: Array.isArray(v) ? v.join(', ') : (typeof v === 'object' ? JSON.stringify(v) : String(v)) }));
  });

  togglePriorite(p: string): void {
    this.prioriteReevaluee.update(cur => (cur === p ? '' : p));
  }

  valider(id: string): void {
    if (!this.certifie() || this.busy()) return;
    this.busy.set(true); this.erreur.set(null);
    this.store.valider(id, {
      attCompletude: this.attCompletude(),
      attCoherence: this.attCoherence(),
      attTerritorialite: this.attTerritorialite(),
      prioriteReevaluee: this.prioriteReevaluee() || null,
      commentaire: this.commentaire.trim() || null,
    }, r => {
      this.busy.set(false);
      if (!r) this.erreur.set('La validation a échoué (périmètre, état du rapport, ou réseau).');
    });
  }

  signer(id: string): void {
    if (this.busy()) return;
    this.busy.set(true); this.erreur.set(null);
    this.store.signer(id, r => {
      this.busy.set(false);
      if (!r) this.erreur.set('La signature a échoué — le contenu a peut-être changé depuis la validation.');
    });
  }

  ouvrirRenvoi(): void { this.renvoiOuvert.set(true); this.motif = ''; this.erreur.set(null); }
  annulerRenvoi(): void { this.renvoiOuvert.set(false); this.motif = ''; }
  confirmerRenvoi(id: string): void {
    if (!this.motif.trim() || this.busy()) return;
    this.busy.set(true); this.erreur.set(null);
    this.store.renvoyer(id, this.motif.trim(), r => {
      this.busy.set(false);
      if (r) { this.renvoiOuvert.set(false); this.motif = ''; }
      else this.erreur.set('Le renvoi a échoué.');
    });
  }

  ngOnInit(): void {
    if (this.store.items().length > 0) { this.charge.set(true); return; }
    this.store.charger(this.scope.dept ?? undefined);
    setTimeout(() => this.charge.set(true), 2500);
  }

  statutLabel(s: RapportDto['status']): string {
    return ({ BROUILLON: 'brouillon', GENERE: 'généré', TRANSMIS: 'transmis · à valider', VALIDE: 'validé', TRANSMIS_ADMIN: 'transmis à l\'admin', ARCHIVE: 'archivé' } as Record<string, string>)[s] ?? s;
  }
  chipClass(s: RapportDto['status']): string {
    if (s === 'VALIDE' || s === 'ARCHIVE' || s === 'TRANSMIS_ADMIN') return 'rd-chip--green';
    if (s === 'TRANSMIS') return 'rd-chip--amber';
    return '';
  }

  timeAgo(iso: string | null): string {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return 'à l\'instant';
    if (h < 24) return `il y a ${h} h`;
    return `il y a ${Math.floor(h / 24)} j`;
  }
}

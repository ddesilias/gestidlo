import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ScopeService } from '../scope.service';
import { AuthService } from '../auth.service';
import { RapportsStore, RapportDto } from '../rapports.store';
import { InboxCardComponent } from '../ui/inbox-card.component';
import { SoumettreRapportComponent } from './terrain/soumettre-rapport.component';

type Segment = 'a-valider' | 'brouillons' | 'valides' | 'archives' | 'tous';

/**
 * Rapports à valider — inbox de validation du superviseur, née sur la primitive partagée
 * <app-inbox-card> (elle hérite gratuitement de la mise en page corrigée).
 *
 *  - Bucket « à valider » = rapports TRANSMIS, scopés Sud-Est côté serveur (jamais une autre
 *    URD, jamais les rapports nationaux). Badge = agrégat live des TRANSMIS.
 *  - Valider : Transmis → Validé (remonte à DINEPA). Renvoyer : Transmis → Brouillon AVEC
 *    motif (jamais muet — l'auteur doit savoir quoi corriger). Persiste d'abord, l'UI suit.
 */
@Component({
  selector: 'app-superviseur-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InboxCardComponent, SoumettreRapportComponent],
  template: `
<div class="supr">

  <header class="supr-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
    <div>
      <h1 class="supr-head__h1">{{ estTepac ? 'Mes rapports' : 'Rapports à valider' }}</h1>
      <p class="supr-head__sub">périmètre {{ dept }} · {{ estTepac ? 'vos rapports de terrain' : 'transmis par vos TEPAC' }} · <span class="supr-live"><i></i>suivi en direct</span></p>
    </div>
    <button type="button" (click)="ouvrirCreation()"
      style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;padding:8px 14px;border-radius:8px;background:#10B981;border:0;color:#04231c;cursor:pointer;white-space:nowrap;">
      <i class="ti ti-plus"></i> {{ estTepac ? 'Soumettre un rapport' : 'Créer un rapport' }}
    </button>
  </header>

  <!-- Assistant de soumission guidé (TEPAC) : il clique, le serveur rédige. -->
  <app-soumettre-rapport *ngIf="wizardOuvert()" (fermer)="wizardOuvert.set(false)" (soumis)="apresSoumission()"></app-soumettre-rapport>

  <!-- Création d'un brouillon (superviseur/admin) — commune/dept imposés par le serveur depuis le JWT -->
  <div *ngIf="creationOuverte()" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;padding:12px;background:#11161f;border:1px solid rgba(255,255,255,.08);border-radius:10px;">
    <input class="supr-input" style="flex:1;min-width:200px;" [(ngModel)]="nTitre" placeholder="Titre du rapport…" />
    <select class="supr-input" [(ngModel)]="nType" style="padding:7px 9px;">
      <option value="mensuel">Mensuel</option>
      <option value="technique">Technique</option>
      <option value="incident">Incident</option>
    </select>
    <input class="supr-input" type="number" [(ngModel)]="nPages" placeholder="Pages" style="max-width:90px;" />
    <button class="supr-btn supr-btn--primary" [disabled]="!nTitre.trim()" (click)="creer()"><i class="ti ti-file-plus"></i> Créer le brouillon</button>
    <button class="supr-btn supr-btn--ghost" (click)="annulerCreation()">Annuler</button>
  </div>

  <section class="supr-kpis">
    <div class="supr-kpi"><div class="supr-kpi__lbl">À valider</div><div class="supr-kpi__val supr-kpi__val--amber">{{ store.nbAValider() }}</div></div>
    <div class="supr-kpi"><div class="supr-kpi__lbl">Plus ancien</div><div class="supr-kpi__val">{{ plusAncien() }}<span class="supr-kpi__suf"> j</span></div></div>
    <div class="supr-kpi"><div class="supr-kpi__lbl">Validés</div><div class="supr-kpi__val supr-kpi__val--green">{{ store.nbValides() }}</div></div>
    <div class="supr-kpi"><div class="supr-kpi__lbl">Vers DINEPA</div><div class="supr-kpi__val supr-kpi__val--green" style="font-size:14px;margin-top:5px;">à jour</div></div>
  </section>

  <div class="supr-segs">
    <button class="supr-seg" [class.supr-seg--on]="segment()==='a-valider'" (click)="segment.set('a-valider')">À valider · {{ store.nbAValider() }}</button>
    <button class="supr-seg" [class.supr-seg--on]="segment()==='brouillons'" (click)="segment.set('brouillons')">Brouillons · {{ store.nbBrouillons() }}</button>
    <button class="supr-seg" [class.supr-seg--on]="segment()==='valides'" (click)="segment.set('valides')">Validés · {{ store.nbValides() }}</button>
    <button class="supr-seg" [class.supr-seg--on]="segment()==='archives'" (click)="segment.set('archives')">Archivés · {{ store.nbArchives() }}</button>
    <button class="supr-seg" [class.supr-seg--on]="segment()==='tous'" (click)="segment.set('tous')">Tous · {{ store.items().length }}</button>
  </div>

  <!-- À VALIDER : cartes actionnables -->
  <ng-container *ngIf="segment()==='a-valider'">
    <div *ngIf="aValider().length===0" class="supr-empty"><i class="ti ti-circle-check"></i> Rien à valider pour le moment</div>

    <app-inbox-card *ngFor="let r of aValider()" tone="warn">
      <i ibx-icon class="ti ti-file-text" style="color:#eab308"></i>
      <div ibx-body>
        <div class="supr-title-row">
          <span class="supr-title">{{ r.titre }}</span>
          <span class="supr-tag">transmis · à valider</span>
        </div>
        <div class="supr-meta">{{ r.auteur }}<span *ngIf="r.commune"> · commune {{ r.commune }}</span></div>
        <div class="supr-meta supr-meta--amber">transmis {{ timeAgo(r.transmisLe) }}<span *ngIf="r.pages"> · {{ r.pages }} pages</span></div>
      </div>
      <div ibx-actions class="supr-act">
        <ng-container *ngIf="renvoiId() !== r.id">
          <a class="supr-btn supr-btn--ghost" [routerLink]="[r.id]"><i class="ti ti-eye"></i> Consulter</a>
          <!-- Valider / Renvoyer = actions du superviseur uniquement (le TEPAC ne valide pas). -->
          <button *ngIf="!estTepac" class="supr-btn supr-btn--warn" (click)="ouvrirRenvoi(r.id)"><i class="ti ti-arrow-back-up"></i> Renvoyer</button>
          <button *ngIf="!estTepac" class="supr-btn supr-btn--primary" (click)="valider(r.id)"><i class="ti ti-check"></i> Valider</button>
        </ng-container>
        <ng-container *ngIf="renvoiId() === r.id">
          <input class="supr-input" [(ngModel)]="motif" placeholder="Motif pour l'auteur (requis)…" />
          <button class="supr-btn supr-btn--primary" [disabled]="!motif.trim()" (click)="confirmerRenvoi(r.id)">Confirmer le renvoi</button>
          <button class="supr-btn supr-btn--ghost" (click)="annulerRenvoi()">Annuler</button>
        </ng-container>
      </div>
    </app-inbox-card>

    <div class="supr-foot">
      <span><i class="ti ti-info-circle"></i> Les rapports nationaux (Exécutif, Audit) n'apparaissent pas ici</span>
    </div>
  </ng-container>

  <!-- Autres segments : liste compacte (lecture) -->
  <ng-container *ngIf="segment()!=='a-valider'">
    <div *ngIf="liste().length===0" class="supr-empty">Aucun rapport dans ce segment</div>
    <app-inbox-card *ngFor="let r of liste()" density="compact" [actions]="false">
      <i ibx-icon class="ti ti-file-text" [style.color]="dotColor(r.status)"></i>
      <div ibx-body>
        <div class="supr-title-row">
          <span class="supr-title">{{ r.titre }}</span>
          <span class="supr-chip" [ngClass]="chipClass(r.status)">{{ statutLabel(r.status) }}</span>
        </div>
        <div class="supr-meta">{{ r.auteur }}<span *ngIf="r.commune"> · {{ r.commune }}</span><span *ngIf="r.signataire"> · signé : {{ r.signataire }}</span><span *ngIf="r.motifRenvoi"> · renvoyé : {{ r.motifRenvoi }}</span></div>
        <!-- L'auteur transmet son brouillon (→ file « à valider » du superviseur). -->
        <button *ngIf="r.status==='BROUILLON' && estAuteur(r)" class="supr-btn supr-btn--primary" style="margin-top:7px;" (click)="transmettre(r.id)">
          <i class="ti ti-send"></i> Transmettre
        </button>
        <!-- Le superviseur signe le rapport validé et le relaie à l'admin (VALIDE → TRANSMIS_ADMIN). -->
        <button *ngIf="r.status==='VALIDE' && !estTepac" class="supr-btn supr-btn--primary" style="margin-top:7px;" (click)="signer(r.id)">
          <i class="ti ti-signature"></i> Signer et transmettre
        </button>
      </div>
    </app-inbox-card>
  </ng-container>
</div>
  `,
  styles: [`
    .supr { color:#e6edf3; max-width:1080px; }
    .supr-head { margin-bottom:12px; }
    .supr-head__h1 { font-size:16px; font-weight:500; margin:0; }
    .supr-head__sub { font-size:11px; color:#8b949e; margin:2px 0 0; }
    .supr-live { color:#3fb950; } .supr-live i { display:inline-block; width:6px; height:6px; border-radius:50%; background:#3fb950; margin-right:4px; vertical-align:1px; }

    .supr-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:8px; margin-bottom:13px; }
    .supr-kpi { background:#161b22; border-radius:8px; padding:9px 11px; }
    .supr-kpi__lbl { font-size:10px; color:#8b949e; }
    .supr-kpi__val { font-size:19px; font-weight:500; margin-top:2px; }
    .supr-kpi__val--amber { color:#eab308; } .supr-kpi__val--green { color:#3fb950; }
    .supr-kpi__suf { font-size:11px; color:#8b949e; }

    .supr-segs { display:flex; gap:6px; margin-bottom:13px; flex-wrap:wrap; }
    .supr-seg { font-size:11px; color:#8b949e; background:transparent; border:1px solid rgba(255,255,255,.10); border-radius:20px; padding:4px 11px; cursor:pointer; font-family:inherit; }
    .supr-seg:hover { color:#c9d1d9; }
    .supr-seg--on { color:#5dd6c2; background:rgba(25,195,168,.14); border-color:rgba(25,195,168,.3); }

    .supr-empty { display:flex; align-items:center; gap:8px; font-size:12px; color:#3fb950;
      background:rgba(63,185,80,.06); border:1px solid rgba(63,185,80,.18); border-radius:10px; padding:14px; }

    .supr-title-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .supr-title { font-size:13px; font-weight:500; }
    .supr-tag { font-size:9px; color:#eab308; background:rgba(234,179,8,.15); border-radius:20px; padding:2px 7px; }
    .supr-chip { font-size:9px; border-radius:20px; padding:2px 7px; color:#8b949e; background:rgba(255,255,255,.06); }
    .supr-chip--green { color:#3fb950; background:rgba(63,185,80,.12); }
    .supr-chip--amber { color:#eab308; background:rgba(234,179,8,.12); }
    .supr-meta { font-size:11px; color:#8b949e; margin-top:5px; }
    .supr-meta--amber { color:#e0c074; margin-top:3px; }

    /* Passe-plat : les enfants deviennent les items flex de .ibx__actions. */
    .supr-act { display:contents; }
    .supr-btn { font-size:11px; border-radius:7px; padding:5px 10px; cursor:pointer; font-family:inherit; border:1px solid transparent; }
    .supr-btn i { font-size:12px; vertical-align:-2px; margin-right:3px; }
    .supr-btn--ghost { color:#c9d1d9; border-color:rgba(255,255,255,.12); background:transparent; }
    .supr-btn--warn { color:#e0c074; border-color:rgba(234,179,8,.3); background:transparent; }
    .supr-btn--primary { color:#04342c; background:#19c3a8; }
    .supr-btn:disabled { opacity:.45; cursor:not-allowed; }
    .supr-input { font-size:11px; color:#c9d1d9; background:#0a0e14; border:1px solid rgba(255,255,255,.12);
      border-radius:7px; padding:5px 9px; font-family:inherit; outline:none; min-width:220px; flex:1 1 220px; }

    .supr-foot { font-size:10px; color:#5b6470; margin-top:6px; }
    .supr-foot i { font-size:12px; vertical-align:-2px; margin-right:4px; }
  `],
})
export class SuperviseurRapportsComponent implements OnInit {
  readonly store = inject(RapportsStore);
  private readonly scope = inject(ScopeService);
  private readonly auth = inject(AuthService);

  /** Même page URD/TEPAC ; le rôle change l'intitulé et masque les actions de validation. */
  get estTepac(): boolean { return this.auth.hasRole('TEPAC'); }

  // ── Création / transmission (auteur) ──────────────────────────────────────
  readonly creationOuverte = signal(false);
  readonly wizardOuvert = signal(false);   // assistant guidé TEPAC
  nTitre = '';
  nType  = 'mensuel';
  nPages: number | null = null;

  get username(): string { return this.auth.userSnapshot()?.username ?? ''; }
  estAuteur(r: { auteurUsername?: string | null }): boolean {
    return !!r.auteurUsername && r.auteurUsername === this.username;
  }

  /** TEPAC → assistant guidé (le wireframe) ; superviseur/admin → formulaire inline rapide. */
  ouvrirCreation(): void {
    if (this.estTepac) { this.wizardOuvert.set(true); return; }
    this.nTitre = ''; this.nType = 'mensuel'; this.nPages = null; this.creationOuverte.set(true);
  }
  annulerCreation(): void { this.creationOuverte.set(false); }

  /** Le wizard a soumis (créé + transmis) : on recharge la liste scopée et on montre la file. */
  apresSoumission(): void {
    this.store.charger(this.scope.dept ?? undefined);
    this.segment.set('a-valider');
  }

  creer(): void {
    if (!this.nTitre.trim()) return;
    this.store.creer({ titre: this.nTitre.trim(), type: this.nType, pages: this.nPages }, () => {
      this.creationOuverte.set(false);
      this.segment.set('brouillons');   // on voit aussitôt son nouveau brouillon
    });
  }

  transmettre(id: string): void { this.store.transmettre(id); }

  readonly segment = signal<Segment>('a-valider');
  readonly renvoiId = signal<string | null>(null);
  motif = '';

  get dept(): string { return this.scope.dept ?? '—'; }

  readonly aValider = computed(() => this.store.items().filter(r => r.status === 'TRANSMIS'));
  readonly liste = computed(() => {
    switch (this.segment()) {
      case 'brouillons': return this.store.items().filter(r => r.status === 'BROUILLON');
      case 'valides':    return this.store.items().filter(r => r.status === 'VALIDE');
      case 'archives':   return this.store.items().filter(r => r.status === 'ARCHIVE');
      case 'tous':       return this.store.items();
      default:           return this.aValider();
    }
  });

  /** Ancienneté (jours) du plus vieux rapport en attente — le « plus ancien » du wireframe. */
  readonly plusAncien = computed(() => {
    const jours = this.aValider()
      .map(r => r.transmisLe ? Math.floor((Date.now() - new Date(r.transmisLe).getTime()) / 86_400_000) : 0);
    return jours.length ? Math.max(...jours) : 0;
  });

  valider(id: string): void { this.store.valider(id); }
  signer(id: string): void { this.store.signer(id); }

  ouvrirRenvoi(id: string): void { this.renvoiId.set(id); this.motif = ''; }
  annulerRenvoi(): void { this.renvoiId.set(null); this.motif = ''; }
  confirmerRenvoi(id: string): void {
    if (!this.motif.trim()) return;
    this.store.renvoyer(id, this.motif.trim());
    this.annulerRenvoi();
  }

  statutLabel(s: RapportDto['status']): string {
    return ({ BROUILLON: 'brouillon', GENERE: 'généré', TRANSMIS: 'transmis', VALIDE: 'validé', TRANSMIS_ADMIN: 'transmis à l\'admin', ARCHIVE: 'archivé' } as Record<string, string>)[s] ?? s;
  }
  chipClass(s: RapportDto['status']): string {
    if (s === 'VALIDE' || s === 'ARCHIVE' || s === 'TRANSMIS_ADMIN') return 'supr-chip--green';
    if (s === 'TRANSMIS') return 'supr-chip--amber';
    return '';
  }
  dotColor(s: RapportDto['status']): string {
    if (s === 'VALIDE' || s === 'ARCHIVE' || s === 'TRANSMIS_ADMIN') return '#3fb950';
    return s === 'TRANSMIS' ? '#eab308' : '#8b949e';
  }

  timeAgo(iso: string | null): string {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const h = Math.floor(ms / 3_600_000);
    if (h < 24) return `il y a ${Math.max(1, h)} h`;
    return `il y a ${Math.floor(h / 24)} j`;
  }

  ngOnInit(): void {
    this.store.charger(this.scope.dept ?? undefined);
    if (this.estTepac) this.segment.set('brouillons');   // le TEPAC atterrit sur SES brouillons
  }
}

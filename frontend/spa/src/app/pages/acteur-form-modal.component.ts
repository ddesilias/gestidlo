import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActeurStore, ActeurDto } from '../acteur.store';
import { ActeurTypeDto } from '../api/bff-api.service';

interface TypeCard { key: ActeurTypeDto; label: string; }

const TYPE_CARDS: TypeCard[] = [
  { key: 'TEPAC',      label: 'TEPAC' },
  { key: 'OPERATEUR',  label: 'Opérateur' },
  { key: 'CAEPA',      label: 'CAEPA' },
  { key: 'MAIRIE',     label: 'Mairie' },
  { key: 'PARTENAIRE', label: 'Partenaire' },
];

@Component({
  selector: 'app-acteur-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="am-overlay" *ngIf="visible" (click)="cancel()">
  <div class="am-modal" (click)="$event.stopPropagation()">

    <div class="am-head">
      <span class="am-title">Enregistrer un acteur</span>
      <button type="button" class="am-x" (click)="cancel()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="am-body">
      <!-- Département verrouillé -->
      <div class="am-lock">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Enregistré dans le département <strong>{{ scope?.dept || '—' }}</strong> · verrouillé
      </div>

      <!-- Type -->
      <div class="am-lbl">Type d'acteur</div>
      <div class="am-types">
        <button type="button" class="am-type" *ngFor="let t of typeCards"
                [class.am-type--on]="form.value.type===t.key" (click)="selectType(t.key)">
          {{ t.label }}
        </button>
      </div>

      <form [formGroup]="form" class="am-form">
        <div class="am-grid2">
          <div class="am-field">
            <label>{{ form.value.type==='TEPAC' ? 'Nom du TEPAC' : "Nom de l'entité" }} <span class="am-req">*</span></label>
            <input type="text" formControlName="nom" [placeholder]="nomPlaceholder()"/>
          </div>

          <!-- Commune (TEPAC / Mairie / CAEPA) -->
          <div class="am-field" *ngIf="needsCommune()">
            <label>Commune <span class="am-req">*</span></label>
            <select formControlName="commune">
              <option value="">—</option>
              <!-- TEPAC : toutes les communes du département. Plusieurs TEPAC par commune
                   sont autorisés → on n'en grise aucune ; on signale juste celles déjà couvertes. -->
              <ng-container *ngIf="form.value.type==='TEPAC'; else autresCommunes">
                <option *ngFor="let c of communesTepac" [value]="c.nom">
                  {{ c.nom }}{{ c.aUnTepac ? ' — déjà couverte' : '' }}
                </option>
              </ng-container>
              <ng-template #autresCommunes>
                <option *ngFor="let c of communes" [value]="c">{{ c }}</option>
              </ng-template>
            </select>
            <div class="am-hint" *ngIf="form.value.type==='TEPAC' && communesTepac.length===0">
              Aucune commune référencée pour ce département.
            </div>
          </div>
        </div>

        <!-- Compte de connexion TEPAC — créé automatiquement avec l'acteur -->
        <ng-container *ngIf="form.value.type==='TEPAC'">
          <div class="am-tepac-note">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            Rôle système <strong>Technicien TEPAC</strong> · un compte de connexion est créé. Le technicien se connecte avec son <strong>email</strong> ; le mot de passe est chiffré côté serveur.
          </div>
          <div class="am-grid2">
            <div class="am-field">
              <label>Email <span class="am-req">*</span></label>
              <input type="email" formControlName="compteEmail" placeholder="ex : jeanpierre@gestidlo.ht" autocomplete="off"/>
            </div>
            <div class="am-field">
              <label>Mot de passe temporaire <span class="am-req">*</span></label>
              <input type="password" formControlName="comptePassword" placeholder="min. 6 caractères" autocomplete="new-password"/>
            </div>
          </div>
        </ng-container>

        <!-- OPÉRATEUR -->
        <ng-container *ngIf="form.value.type==='OPERATEUR'">
          <div class="am-field">
            <label>Sous-type <span class="am-req">*</span></label>
            <div class="am-chips">
              <button type="button" class="am-chip" *ngFor="let s of ['prive','ong','kiosque','regie']"
                      [class.am-chip--on]="form.value.sousType===s" (click)="form.patchValue({ sousType: s })">{{ s | titlecase }}</button>
            </div>
          </div>
          <div class="am-grid2">
            <div class="am-field">
              <label>Maître d'ouvrage</label>
              <select formControlName="maitreOuvrage">
                <option value="">—</option>
                <option *ngFor="let m of maitresOuvrage" [value]="m.nom">{{ m.nom }}</option>
              </select>
            </div>
            <div class="am-field">
              <label>Type de contrat</label>
              <select formControlName="typeContrat">
                <option value="convention">Convention</option>
                <option value="affermage">Affermage</option>
                <option value="gerance">Gérance</option>
                <option value="regie">Régie directe</option>
              </select>
            </div>
          </div>
          <div class="am-grid2">
            <div class="am-field">
              <label>Période (début)</label>
              <input type="number" formControlName="periodeDebut" placeholder="2023"/>
            </div>
            <div class="am-field">
              <label>Période (fin)</label>
              <input type="number" formControlName="periodeFin" placeholder="2028"/>
            </div>
          </div>
          <div class="am-field">
            <label>Ouvrages exploités <span class="am-muted">· département {{ scope?.dept }} uniquement</span></label>
            <div class="am-chips am-chips--wrap" *ngIf="ouvrages.length; else noOuvrage">
              <button type="button" class="am-chip" *ngFor="let o of ouvrages"
                      [class.am-chip--on]="ouvragesSel().has(o.id)" (click)="toggleOuvrage(o.id)">{{ o.name }}</button>
            </div>
            <ng-template #noOuvrage><div class="am-hint">Aucun ouvrage recensé dans le département.</div></ng-template>
          </div>
        </ng-container>

        <!-- CAEPA -->
        <ng-container *ngIf="form.value.type==='CAEPA'">
          <div class="am-grid2">
            <div class="am-field">
              <label>Zone gérée</label>
              <input type="text" formControlName="zoneId" placeholder="Nom de la zone / SAEP"/>
            </div>
            <div class="am-field">
              <label>Responsable du comité</label>
              <input type="text" formControlName="responsable" placeholder="Nom du référent"/>
            </div>
          </div>
        </ng-container>

        <!-- MAIRIE -->
        <ng-container *ngIf="form.value.type==='MAIRIE'">
          <div class="am-field">
            <label>Responsable</label>
            <input type="text" formControlName="responsable" placeholder="Nom du maire / référent"/>
          </div>
        </ng-container>

        <!-- PARTENAIRE -->
        <ng-container *ngIf="form.value.type==='PARTENAIRE'">
          <div class="am-field">
            <label>Domaine d'intervention</label>
            <input type="text" formControlName="sousType" placeholder="Ex : appui CAEPA, financement, WASH…"/>
          </div>
        </ng-container>

        <!-- Communs -->
        <div class="am-grid2" *ngIf="form.value.type">
          <div class="am-field">
            <label>Contact (téléphone)</label>
            <input type="text" formControlName="contactTel" placeholder="+509…"/>
          </div>
          <div class="am-field">
            <label>Statut</label>
            <select formControlName="statut">
              <option value="actif">Actif</option>
              <option value="vacant" *ngIf="form.value.type==='TEPAC'">Vacant</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>
        </div>
      </form>

      <div class="am-error" *ngIf="errorMsg()">{{ errorMsg() }}</div>

      <div class="am-note">
        <strong>Ce qui change selon le type :</strong>
        TEPAC → personne + commune (sans TEPAC) · Opérateur → sous-type + contrat + ouvrages ·
        CAEPA → zone gérée + responsable · Mairie → commune + responsable · Partenaire → domaine.
      </div>
    </div>

    <div class="am-foot">
      <button type="button" class="am-btn" (click)="cancel()">Annuler</button>
      <button type="button" class="am-btn am-btn--primary" [disabled]="form.invalid || saving()" (click)="submit()">
        {{ saving() ? 'Enregistrement…' : "Enregistrer l'acteur" }}
      </button>
    </div>
  </div>
</div>
`,
  styles: [`
    .am-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1100; display:flex; align-items:center; justify-content:center; padding:20px; }
    .am-modal { width:640px; max-width:96vw; max-height:92vh; overflow-y:auto; background:#0F1419; border:1px solid #1F2A33; border-radius:14px; color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; }
    .am-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #1F2A33; }
    .am-title { font-size:15px; font-weight:600; }
    .am-x { width:30px; height:30px; border-radius:8px; border:1px solid #2A3744; background:#1A222C; color:#CBD5E1; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .am-body { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
    .am-lock { display:flex; align-items:center; gap:7px; font-size:12px; color:#93C5FD; background:rgba(96,165,250,.1); border:1px solid rgba(96,165,250,.25); border-radius:8px; padding:7px 11px; }
    .am-lbl { font-size:12px; color:#8B9AAB; }
    .am-types { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
    .am-type { font-size:12px; padding:9px 4px; border-radius:9px; border:1px solid #2A3744; background:#161D26; color:#8B9AAB; cursor:pointer; }
    .am-type--on { border-color:#60A5FA; color:#93C5FD; background:rgba(96,165,250,.12); font-weight:500; }
    .am-form { display:flex; flex-direction:column; gap:12px; }
    .am-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .am-field { display:flex; flex-direction:column; gap:4px; }
    .am-field label { font-size:12px; color:#8B9AAB; }
    .am-req { color:#FB7185; }
    .am-muted { color:#6B7785; font-weight:400; }
    .am-field input, .am-field select { background:#10161D; border:1px solid #2A3744; border-radius:8px; padding:8px 10px; color:#E2E8EE; font-size:13px; outline:none; }
    .am-field input:focus, .am-field select:focus { border-color:#60A5FA; }
    .am-chips { display:flex; gap:6px; }
    .am-chips--wrap { flex-wrap:wrap; }
    .am-chip { font-size:12px; padding:5px 12px; border-radius:8px; border:1px solid #2A3744; background:transparent; color:#8B9AAB; cursor:pointer; }
    .am-chip--on { border-color:#60A5FA; color:#93C5FD; background:rgba(96,165,250,.12); }
    .am-hint { font-size:11px; color:#6B7785; }
    .am-tepac-note { display:flex; align-items:flex-start; gap:7px; font-size:12px; color:#86EFAC; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.25); border-radius:8px; padding:8px 11px; line-height:1.5; }
    .am-tepac-note svg { flex:none; margin-top:2px; }
    .am-tepac-note strong { color:#BBF7D0; }
    .am-error { font-size:12.5px; color:#FB7185; background:rgba(251,113,133,.1); border:1px solid rgba(251,113,133,.25); border-radius:8px; padding:8px 11px; }
    .am-note { font-size:11px; color:#6B7785; line-height:1.6; border-top:1px dashed #1F2A33; padding-top:10px; }
    .am-note strong { color:#8B9AAB; }
    .am-foot { display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #1F2A33; }
    .am-btn { font-size:13px; padding:8px 14px; border-radius:8px; border:1px solid #2A3744; background:#1A222C; color:#CBD5E1; cursor:pointer; }
    .am-btn--primary { background:#2563EB; border-color:#2563EB; color:#fff; }
    .am-btn--primary:disabled { opacity:.5; cursor:not-allowed; }
    @media (max-width:560px) { .am-types { grid-template-columns:repeat(3,1fr); } .am-grid2 { grid-template-columns:1fr; } }
  `],
})
export class ActeurFormModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() scope?: { dept: string; urdId?: string };
  /** TEPAC : toutes les communes du département + drapeau « déjà pourvu » (affichées, grisées si pourvues). */
  @Input() communesTepac: { nom: string; aUnTepac: boolean }[] = [];
  /** Toutes les communes du département (pour mairie / caepa). */
  @Input() communes: string[] = [];
  /** Ouvrages du département (pour opérateur). */
  @Input() ouvrages: { id: string; name: string }[] = [];
  /** Mairies du département (maître d'ouvrage). */
  @Input() maitresOuvrage: { id: string; nom: string }[] = [];
  /** Type pré-réglé (ex : bouton « Affecter TEPAC »). */
  @Input() initialType?: ActeurTypeDto;

  @Output() cree   = new EventEmitter<ActeurDto>();
  @Output() fermer = new EventEmitter<void>();

  private readonly fb    = inject(FormBuilder);
  private readonly store = inject(ActeurStore);

  readonly typeCards = TYPE_CARDS;
  readonly saving    = signal(false);
  readonly errorMsg  = signal('');
  readonly ouvragesSel = signal<Set<string>>(new Set());

  readonly form = this.fb.group({
    type:         ['' as '' | ActeurTypeDto, Validators.required],
    nom:          ['', Validators.required],
    commune:      [''],
    sousType:     [''],
    maitreOuvrage:[''],
    typeContrat:  ['convention'],
    periodeDebut: [null as number | null],
    periodeFin:   [null as number | null],
    zoneId:       [''],
    responsable:  [''],
    contactTel:   [''],
    statut:       ['actif'],
    compteEmail:    [''],
    comptePassword: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.reset();
      if (this.initialType) this.selectType(this.initialType);
    }
  }

  needsCommune(): boolean {
    const t = this.form.value.type;
    return t === 'TEPAC' || t === 'MAIRIE' || t === 'CAEPA';
  }

  nomPlaceholder(): string {
    switch (this.form.value.type) {
      case 'TEPAC':      return 'Ex : Jean Pierre';
      case 'OPERATEUR':  return 'Ex : Régie communale de…';
      case 'CAEPA':      return 'Ex : CAEPA Dessources';
      case 'MAIRIE':     return 'Ex : Mairie de Léogâne';
      case 'PARTENAIRE': return 'Ex : Helvetas Haïti';
      default:           return '';
    }
  }

  selectType(t: ActeurTypeDto): void {
    this.form.patchValue({ type: t });
    this.appliquerValidateurs(t);
    this.ouvragesSel.set(new Set());
  }

  /** Cœur du formulaire discriminé : (ré)active seulement les validateurs du type choisi. */
  private appliquerValidateurs(type: ActeurTypeDto): void {
    const conditionnels = ['commune', 'sousType', 'zoneId', 'responsable', 'maitreOuvrage', 'compteEmail', 'comptePassword'];
    for (const n of conditionnels) {
      const c = this.form.get(n)!;
      c.clearValidators();
      c.updateValueAndValidity({ emitEvent: false });
    }
    if (type === 'TEPAC' || type === 'MAIRIE' || type === 'CAEPA') {
      this.form.get('commune')!.setValidators(Validators.required);
    }
    if (type === 'OPERATEUR') {
      this.form.get('sousType')!.setValidators(Validators.required);
    }
    // TEPAC : email + mot de passe temporaire toujours requis — le compte de connexion
    // (login par email) est créé d'office avec l'acteur.
    if (type === 'TEPAC') {
      this.form.get('compteEmail')!.setValidators([Validators.required, Validators.email]);
      this.form.get('comptePassword')!.setValidators([Validators.required, Validators.minLength(6)]);
    }
    for (const n of conditionnels) this.form.get(n)!.updateValueAndValidity({ emitEvent: false });
  }

  toggleOuvrage(id: string): void {
    this.ouvragesSel.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  submit(): void {
    this.errorMsg.set('');
    if (this.form.invalid || !this.scope?.dept) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.store.creerActeur(this.construireDto()).subscribe({
      next: (dto) => { this.saving.set(false); this.cree.emit(dto); this.fermer.emit(); },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.message || "Échec de l'enregistrement de l'acteur.");
      },
    });
  }

  cancel(): void { this.fermer.emit(); }

  private construireDto(): Parameters<ActeurStore['creerActeur']>[0] {
    const v = this.form.getRawValue();
    const ouvrageIds = [...this.ouvragesSel()];
    return {
      type:          v.type as ActeurTypeDto,
      nom:           (v.nom ?? '').trim(),
      departementId: this.scope!.dept,      // toujours injecté depuis le scope, jamais saisi
      commune:       v.commune || null,
      sousType:      v.sousType || null,
      maitreOuvrage: v.maitreOuvrage || null,
      typeContrat:   v.type === 'OPERATEUR' ? (v.typeContrat || null) : null,
      periodeDebut:  v.type === 'OPERATEUR' ? (v.periodeDebut ?? null) : null,
      periodeFin:    v.type === 'OPERATEUR' ? (v.periodeFin ?? null) : null,
      ouvrageIds:    ouvrageIds.length ? ouvrageIds.join(',') : null,
      zoneId:        v.zoneId || null,
      responsable:   v.responsable || null,
      contactTel:    v.contactTel || null,
      statut:        v.statut || 'actif',
      // TEPAC : email (clé de login) + mot de passe temporaire → le serveur crée le
      // compte « Technicien TEPAC » et hache le mot de passe. Username dérivé de l'email.
      compteEmail:    v.type === 'TEPAC' ? (v.compteEmail || '').trim().toLowerCase() : null,
      comptePassword: v.type === 'TEPAC' ? (v.comptePassword || null) : null,
    };
  }

  private reset(): void {
    this.form.reset({ type: '', nom: '', commune: '', sousType: '', maitreOuvrage: '',
      typeContrat: 'convention', periodeDebut: null, periodeFin: null, zoneId: '',
      responsable: '', contactTel: '', statut: 'actif',
      compteEmail: '', comptePassword: '' });
    this.ouvragesSel.set(new Set());
    this.errorMsg.set('');
    this.saving.set(false);
  }
}

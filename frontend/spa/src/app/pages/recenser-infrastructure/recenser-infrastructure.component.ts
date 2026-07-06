import {
  Component, computed, DestroyRef, EventEmitter, inject,
  Input, OnInit, Output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DEPARTEMENTS, DEPT_CODES, FAMILLES,
  InfraFamille, InfrastructureExistante, InfrastructureFormData,
  RessourceNaturelle, Technicien,
} from './infrastructure.types';

@Component({
  selector: 'app-recenser-infrastructure',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './recenser-infrastructure.component.html',
  styleUrls: ['./recenser-infrastructure.component.scss'],
})
export class RecenserInfrastructureComponent implements OnInit {

  @Input() ouvragesExistants: InfrastructureExistante[] = [];
  @Input() ressourcesNaturelles: RessourceNaturelle[] = [];
  @Input() techniciens: Technicien[] = [];
  @Input() prochaineSequence: Record<string, number> = {};

  @Output() fermer              = new EventEmitter<void>();
  @Output() enregistrer         = new EventEmitter<InfrastructureFormData>();
  @Output() enregistrerBrouillon= new EventEmitter<InfrastructureFormData>();
  @Output() ouvrirCarte         = new EventEmitter<void>();

  private readonly fb         = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // ── Reactive form ──────────────────────────────────────────────────────────
  form = this.fb.group({
    famille:     ['',                  Validators.required],
    type:        ['',                  Validators.required],
    nom:         ['',                  [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    departement: ['',                  Validators.required],
    commune:     ['',                  Validators.required],
    section:     [''],
    localite:    [''],
    systemeAep:  [''],
    ressourceId: [''],
    description: ['',                  Validators.maxLength(500)],
    technicienId:[''],
    lat:         [null as number | null],
    lon:         [null as number | null],
  });

  // ── Cascade signals ────────────────────────────────────────────────────────
  readonly familleSignal    = signal<string>('');
  readonly departementSignal = signal<string>('');

  // ── Tag multi-select ───────────────────────────────────────────────────────
  readonly ouvragesAmont     = signal<string[]>([]);
  readonly ouvragesAval      = signal<string[]>([]);
  readonly searchAmont       = signal('');
  readonly searchAval        = signal('');
  readonly showAmontDropdown = signal(false);
  readonly showAvalDropdown  = signal(false);

  // ── Submitted flag for error display ──────────────────────────────────────
  readonly submitted = signal(false);

  // ── Expose constants to template ──────────────────────────────────────────
  readonly familles    = FAMILLES;
  readonly familleCles = Object.keys(FAMILLES) as InfraFamille[];
  readonly departements = Object.keys(DEPARTEMENTS);

  // ── Computed / derived ────────────────────────────────────────────────────

  readonly typesDisponibles = computed(() => {
    const f = this.familleSignal() as InfraFamille;
    return f ? FAMILLES[f].types : [];
  });

  readonly communesDisponibles = computed(() =>
    DEPARTEMENTS[this.departementSignal()] ?? []
  );

  readonly codeGenere = computed(() => {
    const f    = this.familleSignal() as InfraFamille;
    const dept = this.departementSignal();
    if (!f || !dept) return '—';
    const prefix   = FAMILLES[f].prefix;
    const deptCode = DEPT_CODES[dept] ?? dept.substring(0, 3).toUpperCase();
    const key = `${prefix}-${deptCode}`;
    const seq = this.prochaineSequence[key] ?? 1;
    return `${key}-${String(seq).padStart(3, '0')}`;
  });

  readonly amontCodes = computed(() =>
    this.ouvragesAmont()
      .map(id => this.ouvragesExistants.find(o => o.id === id)?.code ?? id)
      .join(' + ')
  );

  readonly avalCodes = computed(() =>
    this.ouvragesAval()
      .map(id => this.ouvragesExistants.find(o => o.id === id)?.code ?? id)
      .join(' + ')
  );

  readonly suggestionsAmont = computed(() => {
    const q        = this.searchAmont().toLowerCase();
    const selected = this.ouvragesAmont();
    return this.ouvragesExistants.filter(o =>
      !selected.includes(o.id) &&
      (o.code.toLowerCase().includes(q) || o.nom.toLowerCase().includes(q))
    ).slice(0, 8);
  });

  readonly suggestionsAval = computed(() => {
    const q        = this.searchAval().toLowerCase();
    const selected = this.ouvragesAval();
    return this.ouvragesExistants.filter(o =>
      !selected.includes(o.id) &&
      (o.code.toLowerCase().includes(q) || o.nom.toLowerCase().includes(q))
    ).slice(0, 8);
  });

  readonly champRemplis = computed(() => {
    const v = this.form.value;
    return [
      v.famille, v.type, v.nom, v.departement, v.commune,
      v.section, v.localite, v.systemeAep, v.ressourceId,
      v.description, v.technicienId,
    ].filter(x => !!x && String(x).trim() !== '').length;
  });

  readonly totalChamps = 11;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.form.get('famille')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        this.familleSignal.set(val ?? '');
        this.form.get('type')!.setValue('', { emitEvent: false });
      });

    this.form.get('departement')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        this.departementSignal.set(val ?? '');
        this.form.get('commune')!.setValue('', { emitEvent: false });
      });
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  ajouterAmont(id: string): void {
    this.ouvragesAmont.update(l => [...l, id]);
    this.searchAmont.set('');
    this.showAmontDropdown.set(false);
  }

  retirerAmont(id: string): void {
    this.ouvragesAmont.update(l => l.filter(x => x !== id));
  }

  ajouterAval(id: string): void {
    this.ouvragesAval.update(l => [...l, id]);
    this.searchAval.set('');
    this.showAvalDropdown.set(false);
  }

  retirerAval(id: string): void {
    this.ouvragesAval.update(l => l.filter(x => x !== id));
  }

  hideAmontDelayed(): void {
    setTimeout(() => this.showAmontDropdown.set(false), 160);
  }

  hideAvalDelayed(): void {
    setTimeout(() => this.showAvalDropdown.set(false), 160);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  ouvrageCodeById(id: string): string {
    const o = this.ouvragesExistants.find(x => x.id === id);
    return o ? o.code : id;
  }

  isInvalid(controlName: string): boolean {
    const c = this.form.get(controlName);
    return !!(c && c.invalid && (c.touched || this.submitted()));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  onEnregistrer(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.enregistrer.emit(this.buildData());
  }

  onBrouillon(): void {
    this.enregistrerBrouillon.emit(this.buildData());
  }

  private buildData(): InfrastructureFormData {
    const v         = this.form.value;
    const ressource = this.ressourcesNaturelles.find(r => r.id === v.ressourceId);
    return {
      code:        this.codeGenere(),
      nom:         v.nom         ?? '',
      famille:     v.famille     as InfraFamille,
      type:        v.type        ?? '',
      departement: v.departement ?? '',
      commune:     v.commune     ?? '',
      section:     v.section     ?? '',
      localite:    v.localite    ?? '',
      systemeAep:  v.systemeAep  ?? '',
      ressourceId: v.ressourceId ?? '',
      ressourceNom: ressource?.nom ?? '',
      ouvragesAmont: this.ouvragesAmont(),
      ouvragesAval:  this.ouvragesAval(),
      description:   v.description  ?? '',
      technicienId:  v.technicienId ?? '',
      lat: v.lat ?? null,
      lon: v.lon ?? null,
    };
  }
}

import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Infrastructure, InfraStatus, InfrastructureStore, InfraType } from './infrastructure.store';

// ── Filter shape ──────────────────────────────────────────────────────────────
export interface FiltresInfra {
  recherche:    string;
  types:        InfraType[];
  etats:        InfraStatus[];
  departements: string[];
  avecCapteurs: boolean | null;  // null = tous, true = avec, false = sans
  systemeAep:   string;
}

const FILTRES_VIDES: FiltresInfra = {
  recherche:    '',
  types:        [],
  etats:        [],
  departements: [],
  avecCapteurs: null,
  systemeAep:   '',
};

// ── Pure filter function ──────────────────────────────────────────────────────
function filtrerListe(liste: Infrastructure[], f: FiltresInfra): Infrastructure[] {
  return liste.filter(i => {
    if (f.recherche) {
      const q = f.recherche.toLowerCase();
      if (
        !i.name.toLowerCase().includes(q) &&
        !i.code.toLowerCase().includes(q) &&
        !(i.commune ?? '').toLowerCase().includes(q) &&
        !(i.aepSystem ?? '').toLowerCase().includes(q)
      ) return false;
    }
    if (f.types.length        && !f.types.includes(i.type))               return false;
    if (f.etats.length        && !f.etats.includes(i.status))             return false;
    if (f.departements.length && !f.departements.includes(i.department))  return false;
    if (f.avecCapteurs === true  && i.iotStatus === 'non-equipe')          return false;
    if (f.avecCapteurs === false && i.iotStatus !== 'non-equipe')          return false;
    if (f.systemeAep && !(i.aepSystem ?? '').toLowerCase().includes(f.systemeAep.toLowerCase())) return false;
    return true;
  });
}

function nombreFiltresActifs(f: FiltresInfra): number {
  return [
    f.recherche !== '',
    f.types.length > 0,
    f.etats.length > 0,
    f.departements.length > 0,
    f.avecCapteurs !== null,
    f.systemeAep !== '',
  ].filter(Boolean).length;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class InfrastructureStateService {

  private readonly infraStore = inject(InfrastructureStore);

  // ── Private writable signals ───────────────────────────────────────────────
  private readonly _filtres             = signal<FiltresInfra>({ ...FILTRES_VIDES });
  private readonly _selection           = signal<Infrastructure | null>(null);
  private readonly _filtrePanneauOuvert = signal(false);
  private readonly _couchesActives      = signal<string[]>(['marqueurs', 'liaisons']);

  // ── Public readonly ────────────────────────────────────────────────────────
  readonly filtres             = this._filtres.asReadonly();
  readonly selection           = this._selection.asReadonly();
  readonly filtrePanneauOuvert = this._filtrePanneauOuvert.asReadonly();
  readonly couchesActives      = this._couchesActives.asReadonly();

  // ── Store items as signal (auto-updated) ───────────────────────────────────
  readonly toutesLesInfras = toSignal(
    this.infraStore.items$,
    { initialValue: [] as Infrastructure[] }
  );

  // ── Derived computed ───────────────────────────────────────────────────────
  readonly infrasFiltrees = computed(() =>
    filtrerListe(this.toutesLesInfras(), this._filtres())
  );

  readonly nombreFiltresActifs = computed(() =>
    nombreFiltresActifs(this._filtres())
  );

  readonly kpis = computed(() => {
    const items = this.infrasFiltrees();
    return {
      total:       items.length,
      enService:   items.filter(i => i.status === 'en-service').length,
      horsService: items.filter(i => i.status === 'hors-service' || i.status === 'critique').length,
      aInspecter:  items.filter(i => i.status === 'a-inspecter').length,
      avecCapteurs:items.filter(i => i.iotStatus !== 'non-equipe').length,
    };
  });

  readonly departementsDisponibles = computed(() => {
    const seen = new Set<string>();
    for (const i of this.toutesLesInfras()) {
      if (i.department) seen.add(i.department);
    }
    return Array.from(seen).sort();
  });

  readonly systemesAepDisponibles = computed(() => {
    const seen = new Set<string>();
    for (const i of this.toutesLesInfras()) {
      if (i.aepSystem) seen.add(i.aepSystem);
    }
    return Array.from(seen).sort();
  });

  // ── Mutations: filtres ─────────────────────────────────────────────────────
  modifierFiltre<K extends keyof FiltresInfra>(cle: K, valeur: FiltresInfra[K]): void {
    this._filtres.update(f => ({ ...f, [cle]: valeur }));
  }

  toggleType(type: InfraType): void {
    this._filtres.update(f => ({
      ...f,
      types: f.types.includes(type) ? f.types.filter(t => t !== type) : [...f.types, type],
    }));
  }

  toggleEtat(etat: InfraStatus): void {
    this._filtres.update(f => ({
      ...f,
      etats: f.etats.includes(etat) ? f.etats.filter(e => e !== etat) : [...f.etats, etat],
    }));
  }

  toggleDepartement(dept: string): void {
    this._filtres.update(f => ({
      ...f,
      departements: f.departements.includes(dept)
        ? f.departements.filter(d => d !== dept)
        : [...f.departements, dept],
    }));
  }

  reinitialiserFiltres(): void { this._filtres.set({ ...FILTRES_VIDES }); }

  // ── Mutations: sélection ──────────────────────────────────────────────────
  selectionner(infra: Infrastructure | null): void { this._selection.set(infra); }

  // ── Mutations: drawer filtres ─────────────────────────────────────────────
  ouvrirFiltrePanneau(): void  { this._filtrePanneauOuvert.set(true); }
  fermerFiltrePanneau(): void  { this._filtrePanneauOuvert.set(false); }

  // ── Mutations: couches carte ──────────────────────────────────────────────
  toggleCouche(nom: string): void {
    this._couchesActives.update(cs =>
      cs.includes(nom) ? cs.filter(c => c !== nom) : [...cs, nom]
    );
  }

  coucheActive(nom: string): boolean {
    return this._couchesActives().includes(nom);
  }

  // ── Export/import ─────────────────────────────────────────────────────────
  exporterFiltres(): string {
    return btoa(JSON.stringify(this._filtres()));
  }

  importerFiltres(encoded: string): void {
    try {
      this._filtres.set({ ...FILTRES_VIDES, ...JSON.parse(atob(encoded)) });
    } catch { /* ignore bad data */ }
  }
}

import { Injectable, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { NatResource, NatType, NatStatus, NAT_DATA } from './pages/resources-page.component';
import { BffApiService, RessourceDto } from './api/bff-api.service';

export type { NatResource, NatType, NatStatus } from './pages/resources-page.component';

// Source de vérité unique du module Ressources naturelles.
// - Seed catalogue : NAT_DATA (sources/rivières/bassins de référence, côté front).
// - Ressources recensées : persistées durablement via le BFF → api-metier
//   (table ressource + liaison N–N ressource_departement), avec repli localStorage
//   pour rester opérationnel hors-ligne / au redémarrage du backend (H2 in-memory).
// Modèle canonique = NatResource ; le mapping NatResource ↔ RessourceDto est interne.
const STORAGE_KEY = 'gestidlo_ressources_naturelles_v1';

@Injectable({ providedIn: 'root' })
export class ResourcesStore {
  private readonly _items = signal<NatResource[]>(this._loadLocal());

  readonly items = this._items.asReadonly();

  constructor(private readonly bff: BffApiService) {
    this._loadFromApi();
  }

  get snapshot(): NatResource[] { return this._items(); }

  /** Liste scopée à un département (ou liste complète si dept absent). */
  forDept(dept?: string): NatResource[] {
    return dept ? this._items().filter(r => r.department === dept) : this._items();
  }

  /** Périmètre fin du TEPAC : ressources de sa commune (tous statuts confondus). */
  forCommune(commune?: string): NatResource[] {
    if (!commune) return this._items();
    const c = commune.toLowerCase();
    return this._items().filter(r => (r.commune ?? '').toLowerCase() === c);
  }

  getById(id: string): NatResource | undefined {
    return this._items().find(r => r.id === id);
  }

  /** Recharge les ressources persistées depuis l'API (cohérence multi-postes). */
  reload(): void { this._loadFromApi(); }

  /** Superviseur : valide un recensement → la ressource devient officielle (optimiste + backend). */
  valider(id: string): void {
    this._items.update(list => list.map(x => (x.id === id ? { ...x, validation: 'validee', motifRejet: undefined } : x)));
    this._persistLocal();
    this.bff.validerRessource(id).pipe(catchError(() => of(null)))
      .subscribe(dto => { if (dto) this._mergeBackend([dto]); });
  }

  /** Superviseur : rejette un recensement avec motif (optimiste + backend). */
  rejeter(id: string, motif: string): void {
    this._items.update(list => list.map(x => (x.id === id ? { ...x, validation: 'rejetee', motifRejet: motif } : x)));
    this._persistLocal();
    this.bff.rejeterRessource(id, motif).pipe(catchError(() => of(null)))
      .subscribe(dto => { if (dto) this._mergeBackend([dto]); });
  }

  add(r: NatResource): void {
    // 1. Optimiste : visible immédiatement dans toutes les vues.
    this._items.update(list => [...list, r]);
    // 2. Cache local (repli hors-ligne / redémarrage backend).
    this._persistLocal();
    // 3. Persistance durable côté backend (best-effort, dégradé gracieux).
    this.bff.createRessource(this._toBackend(r)).pipe(
      catchError(() => of(null)),
    ).subscribe(dto => { if (dto) this._mergeBackend([dto]); });
  }

  update(r: NatResource): void {
    this._items.update(list => list.map(x => (x.id === r.id ? r : x)));
    this._persistLocal();
  }

  // ── Backend ────────────────────────────────────────────────────────────

  private _loadFromApi(): void {
    this.bff.listRessources().pipe(
      catchError(() => of([] as RessourceDto[])), // backend offline → on garde le local
    ).subscribe(dtos => this._mergeBackend(dtos));
  }

  private _mergeBackend(dtos: RessourceDto[]): void {
    if (!dtos.length) return;
    const fromApi = dtos.map(d => this._fromBackend(d));
    this._items.update(list => {
      const byId = new Map(list.map(r => [r.id, r] as const));
      for (const r of fromApi) byId.set(r.id, r); // le backend fait autorité
      return [...byId.values()];
    });
    this._persistLocal();
  }

  // ── Cache local ─────────────────────────────────────────────────────────

  /** Catalogue de référence front, marqué `seed` → la vue commune (TEPAC) l'ignore. */
  private _seedCatalogue(): NatResource[] {
    return NAT_DATA.map(r => ({ ...r, seed: true }));
  }

  private _loadLocal(): NatResource[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const custom = JSON.parse(raw) as NatResource[];
        const seedIds = new Set(NAT_DATA.map(r => r.id));
        return [...this._seedCatalogue(), ...custom.filter(c => !seedIds.has(c.id))];
      }
    } catch { /* stockage corrompu — on repart du seed */ }
    return this._seedCatalogue();
  }

  private _persistLocal(): void {
    const seedIds = new Set(NAT_DATA.map(r => r.id));
    const custom = this._items().filter(r => !seedIds.has(r.id));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); } catch { /* quota */ }
  }

  // ── Mapping NatResource ↔ RessourceDto ──────────────────────────────────

  private _toBackend(r: NatResource) {
    return {
      id:                   r.id,
      code:                 r.code,
      nom:                  r.name,
      type:                 r.type.toUpperCase(),
      etat:                 (r.status ?? 'saine').toUpperCase(),
      debitM3h:             r.flowM3h ?? null,
      lat:                  r.lat ?? null,
      lon:                  r.lon ?? null,
      commune:              r.commune ?? null,
      section:              r.section ?? null,
      departementPrincipal: r.department,
      departementsTraverses: [] as string[],
    };
  }

  private _fromBackend(d: RessourceDto): NatResource {
    const principal = d.departements?.find(x => x.estPrincipal)?.departementId
      ?? d.departements?.[0]?.departementId ?? '';
    const validation = d.statut === 'EN_ATTENTE_VALIDATION' ? 'en_attente'
      : d.statut === 'REJETEE' ? 'rejetee' : 'validee';
    return {
      id:         d.id,
      code:       d.code,
      name:       d.nom,
      type:       d.type.toLowerCase() as NatType,
      status:     d.etat.toLowerCase() as NatStatus,
      department: principal,
      commune:    d.commune ?? '',
      section:    d.section ?? undefined,
      lat:        d.lat ?? undefined,
      lon:        d.lon ?? undefined,
      flowM3h:    d.debitM3h ?? undefined,
      validation,
      createdBy:  d.createdBy ?? undefined,
      motifRejet: d.motifRejet ?? undefined,
    };
  }
}

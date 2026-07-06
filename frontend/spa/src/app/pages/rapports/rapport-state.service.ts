import { computed, Injectable, signal } from '@angular/core';
import {
  ReportEntry, ReportStatus, ReportType, FiltresRapport,
  DonneesRapportPreRemplies, FILTRES_VIDES_RAPPORT, RAPPORTS_MOCK,
  STATUS_LABELS, TYPE_LABELS, TYPE_LABELS_SHORT, TYPE_COLOR, TYPE_BG, STATUS_DOT, STATUS_BG,
} from './rapport.types';

@Injectable({ providedIn: 'root' })
export class RapportStateService {

  private readonly _rapports   = signal<ReportEntry[]>(RAPPORTS_MOCK);
  private readonly _filtres    = signal<FiltresRapport>({ ...FILTRES_VIDES_RAPPORT });
  private readonly _selection  = signal<ReportEntry | null>(null);
  private readonly _filtresDrawerOuvert = signal(false);
  private readonly _createOuvert        = signal(false);
  private readonly _createStep          = signal(1);
  private readonly _templatesOuvert     = signal(false);
  private readonly _previewOuvert       = signal(false);
  private readonly _donneesPreremplies  = signal<DonneesRapportPreRemplies | null>(null);

  readonly rapports           = this._rapports.asReadonly();
  readonly filtres            = this._filtres.asReadonly();
  readonly selection          = this._selection.asReadonly();
  readonly filtresDrawerOuvert = this._filtresDrawerOuvert.asReadonly();
  readonly createOuvert       = this._createOuvert.asReadonly();
  readonly createStep         = this._createStep.asReadonly();
  readonly templatesOuvert    = this._templatesOuvert.asReadonly();
  readonly previewOuvert      = this._previewOuvert.asReadonly();
  readonly donneesPreremplies = this._donneesPreremplies.asReadonly();

  readonly rapportsFiltres = computed(() => filtrerRapports(this._rapports(), this._filtres()));

  readonly kpis = computed(() => {
    const r = this._rapports();
    return {
      total:        r.length,
      generesMois:  r.filter(x => x.status === 'genere' || x.status === 'valide').length,
      enAttente:    r.filter(x => x.status === 'brouillon').length,
      transmis:     r.filter(x => x.status === 'transmis').length,
      valides:      r.filter(x => x.status === 'valide').length,
      archives:     r.filter(x => x.status === 'archive').length,
    };
  });

  readonly nombreFiltresActifs = computed(() => {
    const f = this._filtres();
    return [
      f.recherche !== '',
      f.statuts.length > 0,
      f.types.length > 0,
      f.auteurs.length > 0,
      f.institutions.length > 0,
      f.formats.length > 0,
      f.dateFrom !== '',
      f.dateTo !== '',
    ].filter(Boolean).length;
  });

  // ── Display helpers ───────────────────────────────────────────────────────
  statusLabel(s: ReportStatus): string { return STATUS_LABELS[s] ?? s; }
  typeLabel(t: ReportType): string     { return TYPE_LABELS[t] ?? t; }
  typeLabelShort(t: ReportType): string { return TYPE_LABELS_SHORT[t] ?? t; }
  typeColor(t: ReportType): string     { return TYPE_COLOR[t] ?? '#64748b'; }
  typeBg(t: ReportType): string        { return TYPE_BG[t] ?? '#f8fafc'; }
  statusDot(s: ReportStatus): string   { return STATUS_DOT[s] ?? '#94a3b8'; }
  statusBg(s: ReportStatus): string    { return STATUS_BG[s] ?? 'rgba(148,163,184,.12)'; }

  // ── Selection ─────────────────────────────────────────────────────────────
  selectionner(r: ReportEntry | null): void { this._selection.set(r); }

  // ── Filtres ───────────────────────────────────────────────────────────────
  ouvrirFiltres(): void   { this._filtresDrawerOuvert.set(true); }
  fermerFiltres(): void   { this._filtresDrawerOuvert.set(false); }
  reinitialiserFiltres(): void {
    this._filtres.set({ ...FILTRES_VIDES_RAPPORT });
    this._filtresDrawerOuvert.set(false);
  }

  modifierRecherche(q: string): void {
    this._filtres.update(f => ({ ...f, recherche: q }));
  }

  toggleStatut(s: ReportStatus): void {
    this._filtres.update(f => ({
      ...f, statuts: f.statuts.includes(s) ? f.statuts.filter(x => x !== s) : [...f.statuts, s],
    }));
  }

  toggleType(t: ReportType): void {
    this._filtres.update(f => ({
      ...f, types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t],
    }));
  }

  toggleFormat(fmt: string): void {
    this._filtres.update(f => ({
      ...f, formats: f.formats.includes(fmt) ? f.formats.filter(x => x !== fmt) : [...f.formats, fmt],
    }));
  }

  modifierFiltre<K extends keyof FiltresRapport>(cle: K, val: FiltresRapport[K]): void {
    this._filtres.update(f => ({ ...f, [cle]: val }));
  }

  // ── Create drawer ─────────────────────────────────────────────────────────
  ouvrirCreate(): void {
    this._donneesPreremplies.set(null);
    this._createStep.set(1);
    this._createOuvert.set(true);
  }

  ouvrirCreateDepuisIntervention(donnees: DonneesRapportPreRemplies): void {
    this._donneesPreremplies.set(donnees);
    this._createStep.set(1);
    this._createOuvert.set(true);
  }

  fermerCreate(): void {
    this._createOuvert.set(false);
    this._donneesPreremplies.set(null);
  }

  avancerEtape(): void { this._createStep.update(s => Math.min(s + 1, 6)); }
  reculerEtape(): void { this._createStep.update(s => Math.max(s - 1, 1)); }

  ajouterRapport(r: ReportEntry): void {
    this._rapports.update(list => [r, ...list]);
  }

  // ── Templates drawer ──────────────────────────────────────────────────────
  ouvrirTemplates(): void { this._templatesOuvert.set(true); }
  fermerTemplates(): void { this._templatesOuvert.set(false); }

  // ── Preview ───────────────────────────────────────────────────────────────
  ouvrirPreview(): void  { this._previewOuvert.set(true); }
  fermerPreview(): void  { this._previewOuvert.set(false); }

  // ── Validation workflow (superviseur URD) ─────────────────────────────────
  validerRapport(id: string): void {
    this._rapports.update(l => l.map(r =>
      r.id === id ? { ...r, status: 'valide' as ReportStatus } : r
    ));
  }
  renvoyerRapport(id: string): void {
    this._rapports.update(l => l.map(r =>
      r.id === id ? { ...r, status: 'brouillon' as ReportStatus } : r
    ));
  }
}

// ── Pure filter fn ────────────────────────────────────────────────────────────
export function filtrerRapports(liste: ReportEntry[], f: FiltresRapport): ReportEntry[] {
  return liste.filter(r => {
    if (f.recherche) {
      const q = f.recherche.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !r.subtitle.toLowerCase().includes(q)) return false;
    }
    if (f.statuts.length && !f.statuts.includes(r.status))               return false;
    if (f.types.length   && !f.types.includes(r.type))                   return false;
    if (f.auteurs.length && !f.auteurs.includes(r.author))               return false;
    if (f.institutions.length && !f.institutions.includes(r.institution)) return false;
    if (f.formats.length && !f.formats.includes(r.format))               return false;
    return true;
  });
}

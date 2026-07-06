import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Capteur, CapteurStatut, CapteurStore, CapteurType } from '../capteur.store';
import { AjouterCapteurComponent } from './capteurs/ajouter-capteur/ajouter-capteur.component';
import { CapteurDetailDrawerComponent } from './capteurs/capteur-detail-drawer/capteur-detail-drawer.component';
import { ScannerQrComponent } from './capteurs/scanner-qr/scanner-qr.component';

type FiltreRapide = 'critiques' | 'horsLigne' | 'pression' | 'debit' | 'niveau' | 'leogane' | 'nonCalibres' | null;

@Component({
  selector: 'app-points-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AjouterCapteurComponent, CapteurDetailDrawerComponent, ScannerQrComponent],
  templateUrl: './points-page.component.html',
  styleUrls: ['./points-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PointsPageComponent {
  private readonly store = inject(CapteurStore);

  // ── Modals ────────────────────────────────────────────────────────────────
  readonly ajouterVisible     = signal(false);
  readonly scannerVisible     = signal(false);
  readonly capteurSelectionne = signal<Capteur | null>(null);

  // ── Filter state ─────────────────────────────────────────────────────────
  readonly filtreActif   = signal<FiltreRapide>(null);
  readonly recherche     = signal('');
  readonly pageActuelle  = signal(0);
  readonly PAR_PAGE      = 6;

  // ── KPIs ─────────────────────────────────────────────────────────────────
  readonly total          = computed(() => this.store.all().length);
  readonly nbEnLigne      = computed(() => this.store.enLigne().length);
  readonly nbHorsLigne    = computed(() => this.store.horsLigne().length);
  readonly nbEnAlerte     = computed(() => this.store.enAlerte().length);
  readonly nbCritiques    = computed(() => this.store.critiques().length);
  readonly nbBatterieFaible = computed(() => this.store.batterieFaible().length);
  readonly pctEnLigne     = computed(() => Math.round((this.nbEnLigne() / this.total()) * 100));

  // ── Flux temps réel ───────────────────────────────────────────────────────
  readonly fluxTempsReel  = computed(() => this.store.fluxTempsReel());
  readonly pressionMoy    = computed(() => {
    const list = this.store.all().filter(c => c.type === 'pression' && c.valeur != null);
    if (!list.length) return '—';
    const avg = list.reduce((s, c) => s + c.valeur!, 0) / list.length;
    return avg.toFixed(1);
  });
  readonly debitMoy       = computed(() => {
    const list = this.store.all().filter(c => c.type === 'debit' && c.valeur != null);
    if (!list.length) return '—';
    const avg = list.reduce((s, c) => s + c.valeur!, 0) / list.length;
    return avg.toFixed(1);
  });
  readonly niveauMoy      = computed(() => {
    const list = this.store.all().filter(c => c.type === 'niveau' && c.valeur != null);
    if (!list.length) return '—';
    const avg = list.reduce((s, c) => s + c.valeur!, 0) / list.length;
    return Math.round(avg).toString();
  });

  // ── Filtered table ────────────────────────────────────────────────────────
  readonly capteursFiltres = computed(() => {
    const f = this.filtreActif();
    const q = this.recherche().toLowerCase();
    return this.store.all().filter(c => {
      if (f === 'critiques'   && !['critique','attention'].includes(c.statut)) return false;
      if (f === 'horsLigne'   && c.statut !== 'hors-ligne')                    return false;
      if (f === 'pression'    && c.type !== 'pression')                        return false;
      if (f === 'debit'       && c.type !== 'debit')                           return false;
      if (f === 'niveau'      && c.type !== 'niveau')                          return false;
      if (f === 'leogane'     && c.commune !== 'Léogâne')                      return false;
      if (f === 'nonCalibres' && c.statut !== 'signal-faible')                 return false;
      if (q && !c.code.toLowerCase().includes(q)
            && !c.infraNom.toLowerCase().includes(q)
            && !c.commune.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  readonly totalPages     = computed(() => Math.ceil(this.capteursFiltres().length / this.PAR_PAGE));
  readonly capteursPage   = computed(() => {
    const p = this.pageActuelle();
    return this.capteursFiltres().slice(p * this.PAR_PAGE, (p + 1) * this.PAR_PAGE);
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  // ── Detail drawer ─────────────────────────────────────────────────────────
  ouvrirDetail(c: Capteur): void  { this.capteurSelectionne.set(c); }
  fermerDetail(): void            { this.capteurSelectionne.set(null); }

  prevCapteurDe(c: Capteur): Capteur | null {
    const list = this.capteursFiltres();
    const idx = list.findIndex(x => x.id === c.id);
    return idx > 0 ? list[idx - 1] : null;
  }

  nextCapteurDe(c: Capteur): Capteur | null {
    const list = this.capteursFiltres();
    const idx = list.findIndex(x => x.id === c.id);
    return idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  }

  naviguerDetail(dir: 'prev' | 'next'): void {
    const c = this.capteurSelectionne();
    if (!c) return;
    const next = dir === 'prev' ? this.prevCapteurDe(c) : this.nextCapteurDe(c);
    if (next) this.capteurSelectionne.set(next);
  }

  setFiltre(f: FiltreRapide): void {
    this.filtreActif.set(this.filtreActif() === f ? null : f);
    this.pageActuelle.set(0);
  }

  setRecherche(v: string): void { this.recherche.set(v); this.pageActuelle.set(0); }

  pagePrecedente(): void { if (this.pageActuelle() > 0) this.pageActuelle.update(p => p - 1); }
  pageSuivante():   void { if (this.pageActuelle() < this.totalPages() - 1) this.pageActuelle.update(p => p + 1); }
  pageMaxIdx(): number   { return Math.min(this.capteursFiltres().length, (this.pageActuelle() + 1) * this.PAR_PAGE); }
  pageMinIdx(): number   { return this.pageActuelle() * this.PAR_PAGE + 1; }

  // ── Display helpers ───────────────────────────────────────────────────────
  statutLabel(s: CapteurStatut): string {
    const MAP: Record<CapteurStatut, string> = {
      'en-ligne': 'En ligne', 'hors-ligne': 'Hors ligne', 'critique': 'Critique',
      'attention': 'Attention', 'maintenance': 'Maintenance',
      'signal-faible': 'Signal faible', 'batterie-faible': 'Batterie faible',
    };
    return MAP[s];
  }

  typeLabel(t: CapteurType): string {
    return { pression:'Pression', debit:'Débit', niveau:'Niveau', qualite:'Qualité' }[t];
  }

  statutCls(s: CapteurStatut): string {
    if (s === 'critique')        return 'cp-badge--critique';
    if (s === 'attention')       return 'cp-badge--attention';
    if (s === 'hors-ligne')      return 'cp-badge--offline';
    if (s === 'en-ligne')        return 'cp-badge--online';
    if (s === 'maintenance')     return 'cp-badge--maintenance';
    if (s === 'signal-faible')   return 'cp-badge--signal';
    if (s === 'batterie-faible') return 'cp-badge--battery';
    return '';
  }

  rowCls(s: CapteurStatut): string {
    if (s === 'critique')  return 'cp-row--critique';
    if (s === 'attention') return 'cp-row--attention';
    if (s === 'hors-ligne') return 'cp-row--offline';
    return '';
  }

  derniereTransCls(dt: string): boolean {
    return dt.includes('h') || dt.includes('min') && parseInt(dt) > 5;
  }

  signalDots(bars: number): string {
    return '●'.repeat(bars) + '○'.repeat(4 - bars);
  }

  signalCls(bars: number): string {
    if (bars >= 4) return 'cp-signal--ok';
    if (bars >= 2) return 'cp-signal--warn';
    return 'cp-signal--bad';
  }

  battPct(b?: number): number { return b ?? 0; }

  battCls(b?: number): string {
    if (b == null) return 'cp-batt--none';
    if (b <= 20)   return 'cp-batt--low';
    if (b <= 50)   return 'cp-batt--mid';
    return 'cp-batt--ok';
  }

  valeurLabel(c: Capteur): string {
    if (c.valeur == null) return '—';
    return `${c.valeur} ${c.unite}`;
  }

  valeurCls(c: Capteur): string {
    if (c.statut === 'critique') return 'cp-val--critique';
    if (c.statut === 'attention') return 'cp-val--attention';
    return '';
  }

  fluxDotCls(s: CapteurStatut): string {
    if (s === 'critique')  return 'cp-dot--critique';
    if (s === 'attention') return 'cp-dot--attention';
    if (s === 'hors-ligne') return 'cp-dot--offline';
    if (s === 'signal-faible') return 'cp-dot--warn';
    return 'cp-dot--ok';
  }
}

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResponsableUrdService, ResponsableUrd } from '../../../../responsable-urd.service';
import { TepacRegistryService, TepacItem } from '../../../../tepac-registry.service';

@Component({
  selector: 'app-zone-etape2',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './zone-etape2.component.html',
  styleUrl: './zone-etape2.component.scss',
})
export class ZoneEtape2Component {
  private readonly respService  = inject(ResponsableUrdService);
  private readonly tepacService = inject(TepacRegistryService);

  // Passés depuis l'étape 1 (le wizard pilote, l'étape ne saisit rien).
  readonly departement = input.required<string>(); // ex. "Ouest"
  readonly commune     = input.required<string>();  // ex. "Tabarre"
  readonly urdId       = input.required<string>();   // id institution URD (1 URD = 1 département)

  // Remontées au parent (stepper) : l'étape n'agit pas, elle signale.
  readonly designerResponsable = output<void>();
  readonly tepacChange         = output<TepacItem | null>(); // TEPAC lié (ou null) ; le parent prend .id pour le payload

  readonly responsableUrd = signal<ResponsableUrd | null>(null);

  // ── Sélecteur TEPAC (technicien existant de l'URD) ──────────────────
  readonly tepacs           = signal<TepacItem[]>([]);
  readonly tepacOuvert      = signal(false);
  readonly recherche        = signal('');
  readonly tepacSelectionne = signal<TepacItem | null>(null);

  readonly tepacsFiltres = computed(() => {
    const q = this.recherche().toLowerCase().trim();
    if (!q) return this.tepacs();
    return this.tepacs().filter(t =>
      (t.nomComplet ?? 'poste à pourvoir').toLowerCase().includes(q) ||
      t.commune.toLowerCase().includes(q));
  });

  constructor() {
    // Responsable URD — lu depuis le registre (apparaît seul s'il est désigné ailleurs).
    effect((onCleanup) => {
      const sub = this.respService.getByUrd(this.urdId()).subscribe({
        next:  (r) => this.responsableUrd.set(r ?? null),
        error: ()  => this.responsableUrd.set(null),
      });
      onCleanup(() => sub.unsubscribe());
    });

    // TEPAC de l'URD + présélection du relais de la commune de la zone (s'il est actif).
    effect((onCleanup) => {
      const commune = this.commune();
      const sub = this.tepacService.getTepacsForDept(this.departement()).subscribe(list => {
        this.tepacs.set(list);
        // Une seule présélection : on ne clobbe pas un choix manuel ni les ré-émissions.
        if (!this.tepacSelectionne()) {
          const match = list.find(t => t.commune === commune && t.statut === 'ACTIF') ?? null;
          this.tepacSelectionne.set(match);
          this.tepacChange.emit(match);
        }
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  etat(s: TepacItem['statut']): string {
    return { ACTIF: 'Actif', VACANT: 'Vacant', SUSPENDU: 'Suspendu' }[s];
  }

  choisirTepac(t: TepacItem): void {
    this.tepacSelectionne.set(t);
    this.tepacChange.emit(t);
    this.tepacOuvert.set(false);
  }
}

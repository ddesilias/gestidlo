import { Injectable, computed, inject } from '@angular/core';
import { ALL_INSTITUTIONS, InstitutionData, InstitutionType } from './pages/governance/institutions/institutions.component';
import { UserRegistryService, UserProfileDto } from './user-registry.service';

export type { InstitutionData, InstitutionType };

@Injectable({ providedIn: 'root' })
export class InstitutionsStore {
  private readonly userRegistry = inject(UserRegistryService);

  /**
   * Liste réactive des institutions. Le responsable de chaque URD est dérivé
   * du compte superviseur_urd persistant (UserRegistry → backend), pas d'une
   * copie locale. C'est l'unique source de vérité : détail + liste lisent ici,
   * et la valeur survit au reload car elle vient de l'API.
   */
  readonly list = computed<InstitutionData[]>(() => {
    const byUrd = new Map<string, UserProfileDto>();
    for (const u of this.userRegistry.list()) {
      // Dernier superviseur désigné pour l'URD = responsable principal affiché.
      if (u.urdId) byUrd.set(u.urdId, u);
    }
    if (byUrd.size === 0) return ALL_INSTITUTIONS;

    return ALL_INSTITUTIONS.map(inst => {
      const u = byUrd.get(inst.id);
      if (!u) return inst;
      return {
        ...inst,
        responsable:          u.nom,
        responsableInitiales: u.initiales || initialesFrom(u.nom),
        responsableCls:       inst.responsableCls === 'gray' ? 'green' : inst.responsableCls,
      };
    });
  });

  get snapshot(): InstitutionData[] { return this.list(); }

  getById(id: string): InstitutionData | undefined {
    return this.list().find(i => i.id === id);
  }

  getByType(type: InstitutionType): InstitutionData[] {
    return this.list().filter(i => i.type === type);
  }
}

function initialesFrom(nom: string): string {
  return (nom ?? '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

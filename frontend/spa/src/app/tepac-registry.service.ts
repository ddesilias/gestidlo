import { Injectable, Injector, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { ActeurStore, ActeurDto } from './acteur.store';
import { ZoneRegistreService } from './zone-registre.service';
import { TEPAC_MAP } from './tepac.data';

/** Un relais TEPAC par commune de l'URD. `nomComplet: null` ⇒ poste vacant. */
export interface TepacItem {
  id: string;                                  // id acteur réel, ou `tepac[-vacant]-<commune>`
  nomComplet: string | null;
  initiales: string;
  commune: string;
  statut: 'ACTIF' | 'VACANT' | 'SUSPENDU';
}

/**
 * Couverture TEPAC d'une URD = un relais par commune du département.
 *
 * On NE crée PAS d'endpoint dédié : on réutilise exactement les mêmes entrées
 * que l'onglet Acteurs et la fiche URD (ActeurStore + TEPAC_MAP + communes du
 * registre), pour que « TEPAC affectés / vacants » reste cohérent partout.
 * Règle (identique à acteurs-page) : TEPAC enregistré ▸ sinon seed TEPAC_MAP ▸
 * sinon « Poste à pourvoir · Vacant ». La création d'un TEPAC vit dans le
 * registre des acteurs, pas ici — ce wizard ne fait que lier l'existant.
 */
@Injectable({ providedIn: 'root' })
export class TepacRegistryService {
  private readonly acteurs  = inject(ActeurStore);
  private readonly zones    = inject(ZoneRegistreService);
  private readonly injector = inject(Injector);

  getTepacsForDept(dept: string): Observable<TepacItem[]> {
    const list = computed<TepacItem[]>(() => {
      void this.zones.version(); // réactif aux changements de communes / acteurs
      const stored = new Map<string, ActeurDto>();
      for (const a of this.acteurs.forDept(dept)) {
        if (a.type === 'TEPAC' && a.commune) stored.set(a.commune, a);
      }
      return this.zones.getCommunesForDept(dept).map<TepacItem>(commune => {
        const a = stored.get(commune);
        const nom = a?.nom ?? TEPAC_MAP[commune]; // '' (TEPAC_MAP) ⇒ vacant
        if (nom) {
          return {
            id:         a?.id ?? 'tepac-' + commune,
            nomComplet: nom,
            initiales:  initialesFrom(nom),
            commune,
            statut:     a?.statut === 'suspendu' ? 'SUSPENDU' : 'ACTIF',
          };
        }
        return { id: 'tepac-vacant-' + commune, nomComplet: null, initiales: '', commune, statut: 'VACANT' };
      });
    });
    return toObservable(list, { injector: this.injector });
  }
}

function initialesFrom(nom: string): string {
  return (nom ?? '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

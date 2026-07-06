import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { DepartementsStore, norm } from './departements.store';
import { ZonesBackendStore, ZoneDto } from './zones-backend.store';
import { ZoneRegistreService } from './zone-registre.service';
import { ActeurStore } from './acteur.store';

/**
 * Non-régression du correctif « pop. desservie = 0 pour URD Nord ».
 * `desservieDe()` doit privilégier les zones ACTIVE live, mais retomber sur la valeur
 * structurelle du seed quand aucune zone active n'est remontée du backend — au lieu d'un faux 0.
 */
describe('DepartementsStore · desservieDe (repli seed)', () => {
  const zonesSignal = signal<ZoneDto[]>([]);

  function setup(zones: ZoneDto[]) {
    zonesSignal.set(zones);
    TestBed.configureTestingModule({
      providers: [
        DepartementsStore,
        { provide: ZonesBackendStore, useValue: { zones: zonesSignal } },
        { provide: ZoneRegistreService, useValue: { getCommunesForDept: () => [] as string[] } },
        { provide: ActeurStore, useValue: { items: signal([]) } },
      ],
    });
    return TestBed.inject(DepartementsStore);
  }

  function zoneNord(populationCible: number | null): ZoneDto {
    return { departementId: 'Nord', statut: 'ACTIVE', commune: 'Cap-Haïtien', populationCible } as ZoneDto;
  }

  it('retombe sur le seed (14 000) quand AUCUNE zone active pour Nord', () => {
    const store = setup([]);
    const nord = store.byNom('Nord')!;
    expect(store.desservieDe(nord)).toBe(14000); // seed.couverture.populationDesservie
    expect(store.desservieDe(nord)).not.toBe(0);
  });

  it('privilégie le live quand des zones actives existent', () => {
    const store = setup([zoneNord(5000), zoneNord(3000)]);
    const nord = store.byNom('Nord')!;
    expect(store.desservieDe(nord)).toBe(8000); // Σ live, PAS le seed 14 000
  });

  it('ignore les zones non ACTIVE et retombe sur le seed', () => {
    const store = setup([{ departementId: 'Nord', statut: 'SUSPENDUE', commune: 'x', populationCible: 9000 } as ZoneDto]);
    const nord = store.byNom('Nord')!;
    expect(store.desservieDe(nord)).toBe(14000);
  });

  it('protège contre populationCible null → retombe sur le seed plutôt qu\'un faux 0', () => {
    const store = setup([zoneNord(null)]);
    const nord = store.byNom('Nord')!;
    expect(store.desservieDe(nord)).toBe(14000);
  });

  it('reste à 0 pour un département non déployé sans seed desservie (Artibonite)', () => {
    const store = setup([]);
    const arti = store.byNom('Artibonite')!;
    expect(store.desservieDe(arti)).toBe(0); // seed.populationDesservie = 0, comportement inchangé
  });

  it('couverturePct de Nord n\'est plus 0 après repli (≈ 5,4 %)', () => {
    const store = setup([]);
    const nord = store.byNom('Nord')!;
    expect(store.couverturePct(nord)).toBeCloseTo(5.4, 0); // 14000 / 260000
    expect(norm(nord.nom)).toBe('nord');
  });
});

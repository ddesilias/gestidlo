import { scoreSante, bandeSante, SanteInputs } from './governance-status.util';

/**
 * Score santé composite (Lot C — carte « Santé réseau » + colonne du tableau URD).
 * Partagé entre le scope national/URD et le calcul par-département : un seul barème testé ici.
 */
describe('scoreSante · composite opérationnel', () => {
  const good: SanteInputs = {
    alertesCritiques: 0, slaRespectePct: 100, interventionsEnRetard: 0,
    rapportsEnRetard: 0, capteursTotal: 10, capteursEnLigne: 10,
  };

  it('100 quand tout est au vert', () => {
    expect(scoreSante(good)).toBe(100);
  });

  it('les alertes critiques pèsent 35 % (7 crit → sous-score alertes = 0)', () => {
    // sAlertes=0, sInterv=100, sRapports=100, sCapteurs=100 → 0.30+0.20+0.15 = 65
    expect(scoreSante({ ...good, alertesCritiques: 7 })).toBe(65);
  });

  it('SLA null → repli sur les interventions en retard (2 → sous-score interv = 60)', () => {
    // sInterv=100-40=60 ; alertes/rapports=100 ; capteurs 10/10=100 → 35 + 18 + 20 + 15 = 88
    expect(scoreSante({ ...good, slaRespectePct: null, interventionsEnRetard: 2 })).toBe(88);
  });

  it('protège la division capteurs quand aucun capteur (total 0 → sous-score 100)', () => {
    expect(scoreSante({ ...good, capteursTotal: 0, capteursEnLigne: 0 })).toBe(100);
  });

  it('capteurs partiellement en ligne (8/10 → 80) pèsent 15 %', () => {
    // sCapteurs=80 ; reste 100 → 35 + 30 + 20 + 0.15*80(=12) = 97
    expect(scoreSante({ ...good, capteursTotal: 10, capteursEnLigne: 8 })).toBe(97);
  });

  it('bandes CDC §18', () => {
    expect(bandeSante(95)).toBe('Bon');
    expect(bandeSante(80)).toBe('À surveiller');
    expect(bandeSante(65)).toBe('Dégradé');
    expect(bandeSante(50)).toBe('Critique');
  });
});

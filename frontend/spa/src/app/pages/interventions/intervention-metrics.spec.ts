import {
  estResolue, dureeResolutionH, mttrHeures, slaRespectePct, InterventionResolue,
} from './intervention.types';

/**
 * Métriques rétrospectives du cockpit Gouvernance (Lot A — vérité des données).
 * Ces helpers remplacent les valeurs MOCK (slaTaux 88 %) par du dérivé réel.
 */
describe('intervention-metrics · MTTR & taux SLA', () => {
  const H = 3_600_000;
  const base = new Date('2026-01-01T00:00:00Z').getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  const resolue = (dureeH: number, priority: InterventionResolue['priority']): InterventionResolue =>
    ({ createdAt: iso(base), closedAt: iso(base + dureeH * H), priority });

  describe('estResolue', () => {
    it('vrai pour terminée/validée/clôturée avec dates', () => {
      expect(estResolue({ status: 'terminee', createdAt: iso(base), closedAt: iso(base + H) })).toBe(true);
      expect(estResolue({ status: 'cloturee', createdAt: iso(base), closedAt: iso(base + H) })).toBe(true);
    });
    it('faux si non résolue ou dates manquantes', () => {
      expect(estResolue({ status: 'en-cours', createdAt: iso(base), closedAt: iso(base + H) })).toBe(false);
      expect(estResolue({ status: 'terminee', createdAt: iso(base) })).toBe(false); // pas de closedAt
      expect(estResolue({ status: 'terminee', closedAt: iso(base + H) })).toBe(false); // pas de createdAt
    });
  });

  it('dureeResolutionH mesure closedAt − createdAt en heures', () => {
    expect(dureeResolutionH({ createdAt: iso(base), closedAt: iso(base + 5 * H) })).toBe(5);
  });

  describe('mttrHeures', () => {
    it('null quand aucune intervention résolue', () => {
      expect(mttrHeures([])).toBeNull();
    });
    it('moyenne arrondie des durées de résolution', () => {
      expect(mttrHeures([resolue(2, 'haute'), resolue(4, 'haute'), resolue(6, 'haute')])).toBe(4);
      expect(mttrHeures([resolue(1, 'basse'), resolue(2, 'basse')])).toBe(2); // 1.5 → 2
    });
  });

  describe('slaRespectePct', () => {
    it('null quand aucune intervention résolue', () => {
      expect(slaRespectePct([])).toBeNull();
    });
    it('respecte le délai propre à chaque priorité (critique 4h, haute 8h, normale 24h, basse 72h)', () => {
      // critique bouclée en 3h → OK ; critique bouclée en 5h → hors délai
      expect(slaRespectePct([resolue(3, 'critique'), resolue(5, 'critique')])).toBe(50);
    });
    it('100 % quand toutes bouclées dans les délais', () => {
      expect(slaRespectePct([resolue(4, 'critique'), resolue(8, 'haute'), resolue(24, 'normale')])).toBe(100);
    });
    it('0 % quand toutes hors délai', () => {
      expect(slaRespectePct([resolue(5, 'critique'), resolue(100, 'basse')])).toBe(0);
    });
  });
});

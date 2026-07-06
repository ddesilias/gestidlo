import { ChangeDetectionStrategy, Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ZoneRegistreService } from '../../../zone-registre.service';
import {
  ZoneFiche, PerimPoint,
  MethodeComptage, SousZone,
  EchantillonSZ, RatiosEnquete, ParamsMethodo,
  NodeType, TronconNature, ReseauNoeud, ReseauTroncon,
  CategorieUsager, DemandeTroncon, PointConso,
  RecensementSnapshot, CATEGORIES_PAR_DEFAUT,
} from '../../../zone.models';

interface RegleValidation {
  label: string;
  ok: boolean;
  bloquant: boolean;
  phase: number;
}

export type RecPhase  = 1 | 2 | 3 | 4 | 5;
export type P1Tab     = 'perimetre' | 'reseau';

// ── Calculs géodésiques ────────────────────────────────────────
function calcAreaKm2(pts: PerimPoint[]): number {
  if (pts.length < 3) return 0;
  let a = 0; const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i].lng * pts[j].lat - pts[j].lng * pts[i].lat;
  }
  const latMid = pts.reduce((s, p) => s + p.lat, 0) / n * Math.PI / 180;
  return Math.abs(a) / 2 * 111.32 * 111.32 * Math.cos(latMid);
}

function calcPerimKm(pts: PerimPoint[]): number {
  if (pts.length < 2) return 0;
  let d = 0; const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dl = (pts[j].lat - pts[i].lat) * 111.32;
    const dn = (pts[j].lng - pts[i].lng) * 111.32 * Math.cos(pts[i].lat * Math.PI / 180);
    d += Math.sqrt(dl * dl + dn * dn);
  }
  return d;
}

function geoDistM(n1: ReseauNoeud, n2: ReseauNoeud): number {
  const dlat = (n2.lat - n1.lat) * 111320;
  const dlng = (n2.lng - n1.lng) * 111320 * Math.cos(n1.lat * Math.PI / 180);
  return Math.round(Math.sqrt(dlat * dlat + dlng * dlng));
}

function normPts(
  pts: Array<{ lat: number; lng: number }>,
  W = 520, H = 150, PAD = 16,
): (cx: number, cy: number) => { x: number; y: number } {
  const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const rLa = maxLat - minLat || 0.001, rLg = maxLng - minLng || 0.001;
  return (lat, lng) => ({
    x: PAD + (lng - minLng) / rLg * (W - 2 * PAD),
    y: PAD + (1 - (lat - minLat) / rLa) * (H - 2 * PAD),
  });
}

@Component({
  selector: 'app-recensement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recensement.component.html',
  styleUrls: ['./recensement.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecensementComponent implements OnInit {
  readonly zoneId  = signal('');
  readonly zone    = signal<ZoneFiche | null>(null);
  readonly phase   = signal<RecPhase>(1);
  readonly p1Tab   = signal<P1Tab>('perimetre');

  // ── Phase 1a : Périmètre ────────────────────────────────────
  readonly tableMode  = signal<'carte' | 'tableau'>('carte');
  readonly points     = signal<PerimPoint[]>([]);
  readonly pasteErr   = signal('');
  readonly pasteInfo  = signal('');

  readonly sommets       = computed(() => this.points().length);
  readonly superficieKm2 = computed(() => calcAreaKm2(this.points()));
  readonly perimetreKm   = computed(() => calcPerimKm(this.points()));
  readonly altMin = computed(() => {
    const c = this.points().filter(p => p.cote !== undefined).map(p => p.cote!);
    return c.length ? Math.min(...c) : null;
  });
  readonly altMax = computed(() => {
    const c = this.points().filter(p => p.cote !== undefined).map(p => p.cote!);
    return c.length ? Math.max(...c) : null;
  });
  readonly denivele      = computed(() => {
    const mn = this.altMin(), mx = this.altMax();
    return mn !== null && mx !== null ? mx - mn : null;
  });
  readonly typeAdduction = computed(() => {
    const d = this.denivele();
    return d === null || this.sommets() < 3 ? null : d >= 10 ? 'gravitaire' : 'refoulement';
  });
  readonly periIsValid = computed(() => this.sommets() >= 3);

  // SVG périmètre
  readonly svgPolyPoints = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';
    const to = normPts(pts);
    return pts.map(p => { const { x, y } = to(p.lat, p.lng); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
  });
  readonly svgDotPositions = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return [];
    const to = normPts(pts);
    return pts.map((p, i) => ({ i: i + 1, ...to(p.lat, p.lng) }));
  });

  // ── Phase 1b : Réseau ───────────────────────────────────────
  readonly noeudsInternes = signal<ReseauNoeud[]>([]);
  readonly troncons       = signal<ReseauTroncon[]>([]);

  // UI ajout tronçon
  newTronconDe: string = '';
  newTronconA:  string = '';
  newTronconNature: TronconNature = 'antenne';
  readonly noeudPasteErr = signal('');

  // Tous les nœuds (sommets périmètre + internes)
  readonly allNoeuds = computed((): ReseauNoeud[] => [
    ...this.points()
      .filter(p => p.lat && p.lng)
      .map(p => ({ id: p.id, lat: p.lat, lng: p.lng, cote: p.cote, type: 'sommet' as NodeType })),
    ...this.noeudsInternes(),
  ]);

  // Stats réseau
  readonly lineaireTotal = computed(() =>
    this.troncons().reduce((s, t) => s + this.tronconLength(t), 0)
  );
  readonly noeudsIsoles = computed(() => {
    const ref = new Set(this.troncons().flatMap(t => [t.deNoeudId, t.aNoeudId]));
    return this.allNoeuds().filter(n => !ref.has(n.id));
  });
  readonly networkType = computed(() => {
    const n = this.allNoeuds().length, e = this.troncons().length;
    if (n < 2 || e === 0) return null;
    const nbMaille = this.troncons().filter(t => t.nature === 'maille').length;
    const nbAntenne = e - nbMaille;
    if (nbMaille > 0 && nbAntenne > 0) return 'mixte';
    if (nbMaille > 0) return 'maillé';
    return 'ramifié';
  });

  // SVG réseau (périmètre + nœuds + tronçons)
  readonly networkSvg = computed(() => {
    const all = this.allNoeuds();
    if (all.length === 0) return null;
    const to = normPts(all);
    const ns = all.map(n => ({ ...n, ...to(n.lat, n.lng) }));
    const poly = ns.filter(n => n.type === 'sommet').map(n => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' ');
    const edges = this.troncons().map(t => {
      const f = ns.find(n => n.id === t.deNoeudId);
      const e = ns.find(n => n.id === t.aNoeudId);
      return f && e ? { t, x1: f.x, y1: f.y, x2: e.x, y2: e.y, len: this.tronconLength(t) } : null;
    }).filter(Boolean) as any[];
    return { ns, poly, edges };
  });

  // ── Phase 2 : Bâti ─────────────────────────────────────────
  readonly sousZones = signal<SousZone[]>([]);

  readonly methodes: { value: MethodeComptage; label: string }[] = [
    { value: 'satellite', label: 'Satellite' },
    { value: 'mixte',     label: 'Mixte' },
    { value: 'terrain',   label: 'Terrain' },
  ];

  readonly totalMaisonsComptees  = computed(() =>
    this.sousZones().reduce((s, z) => s + (z.maisonsComptees || 0), 0)
  );
  readonly totalMaisonsCorrigees = computed(() =>
    this.sousZones().reduce((s, z) => s + this.corriger(z), 0)
  );
  readonly densiteBati = computed(() => {
    const sup = this.superficieKm2(), mais = this.totalMaisonsCorrigees();
    return sup > 0 && mais > 0 ? Math.round(mais / sup) : null;
  });
  readonly densiteAlert = computed(() => {
    const d = this.densiteBati();
    if (d === null) return null;
    if (d < 30)    return `Densité très faible (${d} m/km²) — vérifier le périmètre`;
    if (d > 40000) return `Densité très élevée (${d} m/km²) — vérifier le comptage`;
    return null;
  });
  readonly batiIsValid = computed(() =>
    this.sousZones().length > 0 && this.sousZones().every(z => z.maisonsComptees > 0)
  );

  corriger(sz: SousZone): number {
    return Math.round((sz.maisonsComptees || 0) * (sz.coefMajorateur || 1));
  }

  addSousZone(): void {
    const idx = this.sousZones().length + 1;
    this.sousZones.update(zs => [...zs, { id: `SZ-${idx}`, nom: `Sous-zone ${idx}`, methode: 'satellite', maisonsComptees: 0, coefMajorateur: 1.05 }]);
  }

  removeSousZone(id: string): void { this.sousZones.update(zs => zs.filter(z => z.id !== id)); }

  updateSousZoneNom(id: string, nom: string): void {
    this.sousZones.update(zs => zs.map(z => z.id === id ? { ...z, nom } : z));
  }

  updateSousZoneNum(id: string, field: 'maisonsComptees' | 'coefMajorateur', raw: string): void {
    const val = parseFloat(raw.replace(',', '.'));
    if (isNaN(val)) return;
    this.sousZones.update(zs => zs.map(z => z.id === id ? { ...z, [field]: val } : z));
  }

  updateSousZoneMethode(id: string, methode: MethodeComptage): void {
    this.sousZones.update(zs => zs.map(z => z.id === id ? { ...z, methode } : z));
  }

  async pasteSousZones(): Promise<void> {
    try { this.parseSousZonesTSV(await navigator.clipboard.readText()); }
    catch { /* clipboard denied */ }
  }
  private parseSousZonesTSV(text: string): void {
    const rows = text.trim().split(/\r?\n/).map(r => r.split('\t'));
    const offset = this.sousZones().length;
    const ok: SousZone[] = [];
    rows.forEach((cols, i) => {
      // Format attendu : nom\tmaisons\tcoef  ou  maisons\tcoef
      const nums = cols.map(c => parseFloat(c.replace(',', '.').trim())).filter(n => !isNaN(n));
      if (nums.length < 1) return;
      const maisons = Math.round(nums[0]), coef = nums[1] ?? 1.05;
      ok.push({ id: `SZ-${offset + ok.length + 1}`, nom: cols[0]?.trim() || `SZ-${offset + ok.length + 1}`, methode: 'satellite', maisonsComptees: maisons, coefMajorateur: coef });
    });
    if (ok.length) this.sousZones.update(zs => [...zs, ...ok]);
  }

  validerBati(): void {
    if (!this.batiIsValid()) return;
    const total = this.totalMaisonsCorrigees();
    const z = this.zone();
    if (z) { z.foyers = total; this.zoneService.persistAll(); }
    this.zoneService.addJournal(
      this.zoneId(),
      `Phase 2 · ${this.sousZones().length} sous-zones · ${this.totalMaisonsComptees()} brutes → ${total} maisons corrigées`,
    );
    // Initialiser les échantillons pour la phase 3
    this.echantillons.set(this.sousZones().map(sz => ({
      sousZoneId: sz.id,
      nomSousZone: sz.nom,
      maisonsCorrigees: this.corriger(sz),
      taille: Math.ceil(this.corriger(sz) * 0.10),
      collectees: 0,
      geolocalisees: 0,
    })));
    this.phase.set(3);
  }

  // ── Phase 3 : Enquête ───────────────────────────────────────
  readonly echantillons = signal<EchantillonSZ[]>([]);
  readonly ratios = signal<RatiosEnquete>({ menagesParMaison: 1.63, personnesParMenage: 6.1 });
  readonly params = signal<ParamsMethodo>({
    tauxCroissanceAn: 3.5,
    horizonAns: 20,
    dotationLjHab: 70,
    pertesPercent: 30,
    cpj: 1.5,
    cph: 2.0,
  });

  // ── Chaîne de calcul live ────────────────────────────────────
  // Pop actuelle = maisons × ménages/maison × pers/ménage
  readonly menages = computed(() =>
    Math.round(this.totalMaisonsCorrigees() * this.ratios().menagesParMaison)
  );
  readonly popActuelle = computed(() =>
    Math.round(this.menages() * this.ratios().personnesParMenage)
  );
  // Pop horizon = pop × (1 + taux/100)^horizon
  readonly popHorizon = computed(() => {
    const { tauxCroissanceAn, horizonAns } = this.params();
    return Math.round(this.popActuelle() * Math.pow(1 + tauxCroissanceAn / 100, horizonAns));
  });
  readonly anneeHorizon = computed(() => {
    const base = this.zone() ? parseInt(this.refYear(this.zone()!)) || 2025 : 2025;
    return base + this.params().horizonAns;
  });
  // Formules étude : Qmj = pop × dotation × (1+pertes/100) / 86400
  readonly qmjLs = computed(() => {
    const { dotationLjHab, pertesPercent } = this.params();
    return this.popHorizon() * dotationLjHab * (1 + pertesPercent / 100) / 86400;
  });
  readonly qpjLs = computed(() => this.qmjLs() * this.params().cpj);
  readonly qphLs = computed(() => this.qmjLs() * this.params().cph);

  // Validation phase 3 : échantillon ≥ 10% par sous-zone ou dérogation
  readonly enqueteIsValid = computed(() =>
    this.echantillons().length > 0 &&
    this.echantillons().every(e => e.collectees >= e.taille || !!e.derogation?.trim())
  );
  readonly totalTaille         = computed(() => this.echantillons().reduce((s, e) => s + e.taille, 0));
  readonly totalCollectees     = computed(() => this.echantillons().reduce((s, e) => s + e.collectees, 0));
  readonly totalGeolocalisees  = computed(() => this.echantillons().reduce((s, e) => s + e.geolocalisees, 0));
  readonly tauxGlobal = computed(() => {
    const tot = this.totalTaille(), ok = this.totalCollectees();
    return tot > 0 ? Math.round(ok / tot * 100) : 0;
  });

  updateEchantillon(id: string, field: 'collectees' | 'geolocalisees', raw: string): void {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    this.echantillons.update(es => es.map(e => e.sousZoneId === id ? { ...e, [field]: val } : e));
  }
  updateDerogation(id: string, text: string): void {
    this.echantillons.update(es => es.map(e => e.sousZoneId === id ? { ...e, derogation: text } : e));
  }

  updateRatios(field: keyof RatiosEnquete, raw: string): void {
    if (field === 'niveauVie') { this.ratios.update(r => ({ ...r, niveauVie: raw })); return; }
    const val = parseFloat(raw.replace(',', '.'));
    if (isNaN(val)) return;
    this.ratios.update(r => ({ ...r, [field]: val }));
  }
  updateParams(field: keyof ParamsMethodo, raw: string): void {
    const val = parseFloat(raw.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    this.params.update(p => ({ ...p, [field]: val }));
  }

  validerEnquete(): void {
    if (!this.enqueteIsValid()) return;
    const z = this.zone();
    if (z) {
      z.population = this.popActuelle();
      z.qmj        = parseFloat(this.qmjLs().toFixed(1));
      z.qpj        = parseFloat(this.qpjLs().toFixed(1));
      z.horizonRef = this.anneeHorizon();
      this.zoneService.persistAll();
    }
    this.zoneService.addJournal(
      this.zoneId(),
      `Phase 3 · Pop ${this.popActuelle()} → ${this.popHorizon()} (${this.anneeHorizon()}) · Qmj ${this.fmtNum(this.qmjLs(), 1)} l/s · Qpj ${this.fmtNum(this.qpjLs(), 1)} l/s`,
    );
    this.initDemandeTroncons();
    this.phase.set(4);
  }

  // ── Phase 4 : Demande par tronçon ───────────────────────────────
  readonly categories    = signal<CategorieUsager[]>([...CATEGORIES_PAR_DEFAUT]);
  readonly demandeTroncons = signal<DemandeTroncon[]>([]);
  readonly pointsConso   = signal<PointConso[]>([]);
  readonly p4PasteErr    = signal('');

  readonly totalParCat = computed((): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const c of this.categories()) result[c.id] = 0;
    for (const dt of this.demandeTroncons()) {
      for (const c of this.categories()) {
        result[c.id] = +(((result[c.id] ?? 0) + (dt.demande[c.id] ?? 0)).toFixed(3));
      }
    }
    return result;
  });

  readonly demandeTotal = computed(() =>
    Object.values(this.totalParCat()).reduce((s, v) => s + v, 0)
  );
  readonly demandeDomestique = computed(() =>
    this.categories().filter(c => c.domestique).reduce((s, c) => s + (this.totalParCat()[c.id] ?? 0), 0)
  );
  readonly demandeInstitutionnel = computed(() => this.demandeTotal() - this.demandeDomestique());

  readonly demandeVsQpj = computed(() => {
    const qpj = this.qpjLs(), tot = this.demandeTotal();
    return { ok: tot <= qpj, qpj, tot };
  });

  readonly demandeIsValid = computed(() => {
    const { ok, tot } = this.demandeVsQpj();
    return this.demandeTroncons().length > 0 && tot > 0 && ok;
  });

  initDemandeTroncons(): void {
    const tronconIds = new Set(this.troncons().map(t => t.id));
    const cats = this.categories();
    // Add missing rows, remove stale rows
    this.demandeTroncons.update(existing => {
      const kept = existing.filter(d => tronconIds.has(d.tronconId));
      const existingIds = new Set(kept.map(d => d.tronconId));
      const newRows: DemandeTroncon[] = this.troncons()
        .filter(t => !existingIds.has(t.id))
        .map(t => ({ tronconId: t.id, demande: Object.fromEntries(cats.map(c => [c.id, 0])) }));
      return [...kept, ...newRows];
    });
  }

  updateDemande(tronconId: string, catId: string, raw: string): void {
    const val = parseFloat(raw.replace(',', '.'));
    const v = isNaN(val) || val < 0 ? 0 : val;
    this.demandeTroncons.update(ds => ds.map(d =>
      d.tronconId !== tronconId ? d : { ...d, demande: { ...d.demande, [catId]: v } }
    ));
  }

  pasteDemande(): void {
    navigator.clipboard.readText()
      .then(text => this.parseDemandeTSV(text))
      .catch(() => this.p4PasteErr.set('Accès presse-papier refusé'));
  }

  private parseDemandeTSV(text: string): void {
    this.p4PasteErr.set('');
    const cats = this.categories();
    const rows = text.trim().split(/\r?\n/).map(r => r.split('\t'));
    const tronconIds = new Set(this.troncons().map(t => t.id));
    const start = isNaN(parseFloat(rows[0]?.[1])) ? 1 : 0;
    const entries: DemandeTroncon[] = [];
    let notFound = 0;
    for (let i = start; i < rows.length; i++) {
      const cols = rows[i];
      const tronconId = cols[0]?.trim();
      if (!tronconId || !tronconIds.has(tronconId)) { notFound++; continue; }
      const demande: Record<string, number> = {};
      cats.forEach((c, j) => {
        const v = parseFloat((cols[j + 1] ?? '').replace(',', '.'));
        demande[c.id] = isNaN(v) ? 0 : v;
      });
      entries.push({ tronconId, demande });
    }
    if (entries.length) {
      this.demandeTroncons.update(ds => {
        const map = new Map(ds.map(d => [d.tronconId, d]));
        entries.forEach(e => map.set(e.tronconId, e));
        return Array.from(map.values());
      });
    }
    if (notFound > 0) this.p4PasteErr.set(`${notFound} ligne(s) ignorée(s) — identifiant tronçon non reconnu`);
  }

  addPointConso(): void {
    const idx = this.pointsConso().length + 1;
    this.pointsConso.update(ps => [...ps, {
      id: `PC${idx}`, nom: '', type: 'autre',
      lat: 0, lng: 0,
      tronconId: this.troncons()[0]?.id ?? '',
      debitLs: 0,
    }]);
  }

  removePointConso(id: string): void { this.pointsConso.update(ps => ps.filter(p => p.id !== id)); }

  updatePointConso(id: string, field: keyof PointConso, raw: string): void {
    this.pointsConso.update(ps => ps.map(p => {
      if (p.id !== id) return p;
      if (field === 'nom' || field === 'type' || field === 'tronconId') return { ...p, [field]: raw };
      const val = parseFloat(raw.replace(',', '.'));
      return { ...p, [field]: isNaN(val) ? 0 : val };
    }));
  }

  validerDemande(): void {
    if (!this.demandeIsValid()) return;
    this.zoneService.addJournal(
      this.zoneId(),
      `Phase 4 · ${this.demandeTroncons().length} tronçons · ${this.fmtNum(this.demandeTotal(), 2)} l/s · dom ${this.fmtNum(this.demandeDomestique(), 2)} l/s · inst ${this.fmtNum(this.demandeInstitutionnel(), 2)} l/s`,
    );
    this.phase.set(5);
  }

  // ── Phase 5 : Validation finale ─────────────────────────────────
  readonly p5Derogation = signal('');

  readonly regles = computed((): RegleValidation[] => [
    { label: 'Périmètre fermé',                                               ok: this.periIsValid(),                              bloquant: true, phase: 1 },
    { label: `Bâti · ${this.sousZones().length}/${this.sousZones().length} sous-zones`, ok: this.batiIsValid(),               bloquant: true, phase: 2 },
    { label: `Échantillon ≥ 10% · ${this.totalCollectees()}/${this.totalTaille()}`,     ok: this.enqueteIsValid(),            bloquant: true, phase: 3 },
    { label: `Demande ≤ Qpj (${this.fmtNum(this.demandeTotal(),1)} ≤ ${this.fmtNum(this.qpjLs(),1)})`, ok: this.demandeVsQpj().ok && this.demandeTotal() > 0, bloquant: true, phase: 4 },
    { label: `Réseau · ${this.noeudsIsoles().length} nœud(s) isolé(s)`,      ok: this.noeudsIsoles().length === 0,                bloquant: true, phase: 1 },
  ]);

  readonly toutesReglesOk = computed(() => this.regles().every(r => r.ok));
  readonly reglesFailing  = computed(() => this.regles().filter(r => !r.ok).length);

  goToFailingPhase(): void {
    const r = this.regles().find(r => !r.ok);
    if (r) this.phase.set(r.phase as RecPhase);
  }

  validerRecensement(): void {
    if (!this.toutesReglesOk()) return;
    const z = this.zone();
    if (!z) return;
    const snap: RecensementSnapshot = {
      version: this.refYear(z),
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      resultats: {
        maisonsCorrigees: this.totalMaisonsCorrigees(),
        popActuelle:      this.popActuelle(),
        popHorizon:       this.popHorizon(),
        anneeHorizon:     this.anneeHorizon(),
        qmjLs:  parseFloat(this.qmjLs().toFixed(2)),
        qpjLs:  parseFloat(this.qpjLs().toFixed(2)),
        qphLs:  parseFloat(this.qphLs().toFixed(2)),
        demandeTotal:     parseFloat(this.demandeTotal().toFixed(2)),
        domestique:       parseFloat(this.demandeDomestique().toFixed(2)),
        institutionnel:   parseFloat(this.demandeInstitutionnel().toFixed(2)),
      },
      derogations: this.p5Derogation() ? [this.p5Derogation()] : [],
    };
    if (!z.snapshots) z.snapshots = [];
    z.snapshots.push(snap);
    this.zoneService.updateZoneStatus(this.zoneId(), 'supervised');
    this.zoneService.addJournal(
      this.zoneId(),
      `✓ Recensement validé réf. ${snap.version} · ${snap.resultats.popHorizon.toLocaleString()} hab horizon · ${snap.resultats.demandeTotal} l/s`,
    );
    this.retourTerritoire();
  }

  // ── Progression ─────────────────────────────────────────────
  readonly done = computed(() => this.phase() - 1);
  readonly phases = [
    { label: 'Périmètre', short: 'Périmètre' },
    { label: 'Bâti',      short: 'Bâti' },
    { label: 'Enquête',   short: 'Enquête' },
    { label: 'Points conso', short: 'Points conso' },
    { label: 'Validation', short: 'Validation' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private zoneService: ZoneRegistreService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('zoneId') ?? '';
    this.zoneId.set(id);
    const z = this.zoneService.getZone(id);
    this.zone.set(z ?? null);
    if (z && z.status !== 'recensement-en-cours' && z.status !== 'supervised') {
      this.zoneService.updateZoneStatus(id, 'recensement-en-cours');
      this.zoneService.addJournal(id, 'Recensement démarré');
    }
  }

  phaseStatus(n: number): 'done' | 'active' | 'locked' {
    const p = this.phase();
    if (n < p) return 'done'; if (n === p) return 'active'; return 'locked';
  }
  goToPhase(n: number): void {
    if (n >= 1 && n <= 5 && (n <= this.phase() || n === this.phase() + 1)) this.phase.set(n as RecPhase);
  }
  retourTerritoire(): void { this.router.navigate(['/admin/governance/territoire']); }
  refYear(z: ZoneFiche): string { return z.activeLe ? z.activeLe.split('/')[2] : '2025'; }
  fmtNum(n: number | null, dec = 2): string { return n === null || !isFinite(n) ? '—' : n.toFixed(dec); }

  noeudsIsolesIds(): string {
    return this.noeudsIsoles().map(n => n.id).join(', ');
  }

  // ── Périmètre : points ──────────────────────────────────────
  addPoint(): void {
    const idx = this.points().length + 1;
    this.points.update(pts => [...pts, { id: `P${idx}`, lat: 0, lng: 0, type: 'sommet' }]);
  }
  removePoint(i: number): void { this.points.update(pts => pts.filter((_, j) => j !== i)); }
  updatePointField(i: number, field: 'lat' | 'lng' | 'cote', raw: string): void {
    const val = parseFloat(raw.replace(',', '.'));
    if (isNaN(val)) return;
    this.points.update(pts => pts.map((p, j) => j === i ? { ...p, [field]: val } : p));
  }
  async pasteFromClipboard(): Promise<void> {
    this.pasteErr.set(''); this.pasteInfo.set('');
    try { this.parseTSV(await navigator.clipboard.readText()); }
    catch { this.pasteErr.set('Accès presse-papier refusé — utilisez Ctrl+V dans la zone ci-dessous'); }
  }
  onPasteArea(evt: ClipboardEvent): void {
    evt.preventDefault();
    this.parseTSV(evt.clipboardData?.getData('text') ?? '');
  }
  private parseTSV(text: string): void {
    const rows = text.trim().split(/\r?\n/).map(r => r.split('\t'));
    const offset = this.points().length;
    const ok: PerimPoint[] = [], bad: number[] = [];
    rows.forEach((cols, i) => {
      const nums = cols.map(c => parseFloat(c.replace(',', '.').trim())).filter(n => !isNaN(n));
      if (nums.length < 2) { bad.push(i + 1); return; }
      const [lat, lng] = nums;
      if (lat < 17.9 || lat > 20.2 || lng < -74.6 || lng > -71.6) { bad.push(i + 1); return; }
      ok.push({ id: `P${offset + ok.length + 1}`, lat, lng, cote: nums[2], type: 'sommet' });
    });
    if (ok.length) { this.points.update(pts => [...pts, ...ok]); this.pasteInfo.set(`${ok.length} point(s) importé(s)`); }
    if (bad.length) this.pasteErr.set(`Lignes ignorées (hors Haïti) : ${bad.join(', ')}`);
  }
  onCsvFile(evt: Event): void {
    const file = (evt.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = e => {
      const tsv = ((e.target?.result as string) ?? '').split(/\r?\n/).map(l => l.split(/[,;]/).join('\t')).join('\n');
      this.parseTSV(tsv);
    };
    r.readAsText(file);
  }
  resetPoints(): void { this.points.set([]); this.pasteErr.set(''); this.pasteInfo.set(''); }

  validerEtAllerReseau(): void {
    if (!this.periIsValid()) return;
    const z = this.zone();
    if (z) { z.superficie = parseFloat(this.superficieKm2().toFixed(2)); this.zoneService.persistAll(); }
    this.zoneService.addJournal(this.zoneId(), `Phase 1 · Périmètre · ${this.sommets()} sommets · ${this.fmtNum(this.superficieKm2())} km²`);
    this.p1Tab.set('reseau');
  }

  // ── Réseau : nœuds internes ─────────────────────────────────
  readonly nodeTypes: { value: NodeType; label: string }[] = [
    { value: 'noeud-interne', label: 'Nœud interne' },
    { value: 'piquage',       label: 'Piquage' },
    { value: 'alimentation',  label: 'Alimentation' },
  ];

  addNoeudInterne(type: NodeType = 'noeud-interne'): void {
    const prefix = type === 'alimentation' ? 'A' : type === 'piquage' ? 'PQ' : 'N';
    const same = this.noeudsInternes().filter(n => n.type === type).length;
    this.noeudsInternes.update(ns => [...ns, { id: `${prefix}${same + 1}`, lat: 0, lng: 0, type }]);
  }

  removeNoeudInterne(id: string): void {
    this.noeudsInternes.update(ns => ns.filter(n => n.id !== id));
    this.troncons.update(ts => ts.filter(t => t.deNoeudId !== id && t.aNoeudId !== id));
  }

  updateNoeudField(id: string, field: 'lat' | 'lng' | 'cote', raw: string): void {
    const val = parseFloat(raw.replace(',', '.'));
    if (isNaN(val)) return;
    this.noeudsInternes.update(ns => ns.map(n => n.id === id ? { ...n, [field]: val } : n));
  }

  async pasteNoeuds(): Promise<void> {
    this.noeudPasteErr.set('');
    try { this.parseNoeudsTSV(await navigator.clipboard.readText()); }
    catch { this.noeudPasteErr.set('Accès presse-papier refusé'); }
  }
  onPasteNoeuds(evt: ClipboardEvent): void {
    evt.preventDefault(); this.parseNoeudsTSV(evt.clipboardData?.getData('text') ?? '');
  }
  private parseNoeudsTSV(text: string): void {
    const offset = this.noeudsInternes().length;
    const rows = text.trim().split(/\r?\n/).map(r => r.split('\t'));
    const ok: ReseauNoeud[] = [];
    rows.forEach((cols, i) => {
      const nums = cols.map(c => parseFloat(c.replace(',', '.').trim())).filter(n => !isNaN(n));
      if (nums.length < 2) return;
      const [lat, lng] = nums;
      if (lat < 17.9 || lat > 20.2 || lng < -74.6 || lng > -71.6) return;
      ok.push({ id: `N${offset + ok.length + 1}`, lat, lng, cote: nums[2], type: 'noeud-interne' });
    });
    if (ok.length) this.noeudsInternes.update(ns => [...ns, ...ok]);
  }

  nodeColor(type: NodeType): string {
    return type === 'alimentation' ? '#FBBF24'
         : type === 'piquage'     ? '#A78BFA'
         : type === 'sommet'      ? '#60A5FA'
         :                          '#4ADE80';
  }
  nodeLabel(type: NodeType): string {
    return type === 'sommet' ? 'sommet' : type === 'alimentation' ? 'alimentation'
         : type === 'piquage' ? 'piquage' : 'nœud';
  }

  // ── Réseau : tronçons ───────────────────────────────────────
  readonly tronconNatures: { value: TronconNature; label: string }[] = [
    { value: 'antenne',      label: 'Antenne' },
    { value: 'maille',       label: 'Maille' },
    { value: 'ramification', label: 'Ramification' },
  ];

  tronconLength(t: ReseauTroncon): number {
    if (!t.longueurAuto && t.longueur !== undefined) return t.longueur;
    const all = this.allNoeuds();
    const f = all.find(n => n.id === t.deNoeudId), e = all.find(n => n.id === t.aNoeudId);
    return f && e ? geoDistM(f, e) : 0;
  }

  previewLength(): number {
    const all = this.allNoeuds();
    const f = all.find(n => n.id === this.newTronconDe), e = all.find(n => n.id === this.newTronconA);
    return f && e ? geoDistM(f, e) : 0;
  }

  addTroncon(): void {
    const { newTronconDe: de, newTronconA: a, newTronconNature: nature } = this;
    if (!de || !a || de === a) return;
    const id = `${de}→${a}`;
    if (this.troncons().find(t => t.id === id)) return;
    this.troncons.update(ts => [...ts, { id, deNoeudId: de, aNoeudId: a, longueurAuto: true, nature }]);
    this.newTronconDe = ''; this.newTronconA = '';
  }

  removeTroncon(id: string): void { this.troncons.update(ts => ts.filter(t => t.id !== id)); }

  updateTronconNature(id: string, nature: TronconNature): void {
    this.troncons.update(ts => ts.map(t => t.id === id ? { ...t, nature } : t));
  }

  overrideLongueur(id: string, raw: string): void {
    const val = parseFloat(raw.replace(',', '.'));
    this.troncons.update(ts => ts.map(t => t.id !== id ? t : isNaN(val) || val <= 0
      ? { ...t, longueurAuto: true, longueur: undefined }
      : { ...t, longueurAuto: false, longueur: val }
    ));
  }

  readonly reseauIsValid = computed(() =>
    this.allNoeuds().length >= 2 && this.troncons().length >= 1 && this.noeudsIsoles().length === 0
  );

  validerReseau(): void {
    const lineaire = this.lineaireTotal();
    this.zoneService.addJournal(
      this.zoneId(),
      `Phase 1 · Réseau · ${this.allNoeuds().length} nœuds · ${this.troncons().length} tronçons · ${lineaire} m`,
    );
    this.phase.set(2);
  }
}

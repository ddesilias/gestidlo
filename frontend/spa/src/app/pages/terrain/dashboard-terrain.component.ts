import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { BffApiService } from '../../api/bff-api.service';
import { AlerteStateService } from '../alertes/alerte-state.service';

/** Sévérité d'alerte → classe de pastille (mêmes tons que le shell terrain). */
type Severite = 'critique' | 'eleve' | 'moyen';
type EtatTravail = 'en-cours' | 'planifiee';
type EtatCapteur = 'seuil' | 'ok' | 'hors-ligne';

interface AlerteVm {
  id: number; severite: Severite; titre: string; lieu: string; quand: string; actions: boolean;
}
interface InterventionVm { titre: string; sousTitre: string; etat: EtatTravail; }
interface CapteurVm { nom: string; mesure: string; etat: EtatCapteur; }

/**
 * Tableau de bord technicien TEPAC — reproduit le wireframe validé : bande de KPI, file
 * « Mes alertes » (cœur de la chaîne Capteurs→Alertes→Tickets), puis Interventions + capteurs.
 *
 * Périmètre verrouillé sur la commune : le composant appelle simplement GET /api/alerts
 * (sans paramètre) — c'est le SERVEUR qui injecte `WHERE commune = <commune du JWT>` via le
 * résolveur de scope. Un TEPAC de Jacmel ne reçoit QUE les alertes de Jacmel ; aucune fuite,
 * aucun choix de territoire côté front. Les KPI alertes sont des agrégats recalculés depuis la
 * liste reçue (pas de compteur figé). Interventions & capteurs restent en démo (endpoints à venir).
 */
@Component({
  selector: 'app-dashboard-terrain',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display:block; color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; }
    .td-wrap { display:flex; flex-direction:column; gap:14px; }

    /* ═══ KPI ═══ */
    .td-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(132px,1fr)); gap:10px; }
    .td-kpi { background:rgba(255,255,255,.03); border:.5px solid rgba(96,165,250,.1); border-radius:10px; padding:11px 13px; }
    .td-kpi-label { font-size:12px; color:#8B9AAB; }
    .td-kpi-value { font-size:23px; font-weight:600; color:#F5F7FA; margin-top:2px; line-height:1.1; }
    .td-kpi-value small { font-size:13px; font-weight:500; color:#6B7785; }
    .td-kpi-sub { font-size:11px; margin-top:2px; }
    .td-sub--danger  { color:#F87171; }
    .td-sub--success { color:#34D399; }
    .td-sub--muted   { color:#6B7785; }

    /* ═══ En-têtes de section ═══ */
    .td-sec-head { display:flex; align-items:center; gap:8px; }
    .td-sec-title { font-size:14px; font-weight:600; color:#F5F7FA; }
    .td-spacer { flex:1; }
    .td-signaler {
      display:flex; align-items:center; gap:6px; font-size:12px; padding:6px 12px; border-radius:8px;
      background:rgba(96,165,250,.1); border:.5px solid rgba(96,165,250,.35); color:#60A5FA;
      cursor:pointer; font-family:inherit; font-weight:500;
    }
    .td-signaler:hover { background:rgba(96,165,250,.18); }

    /* ═══ Cartes ═══ */
    .td-card { background:#0E131C; border:.5px solid rgba(96,165,250,.1); border-radius:12px; padding:12px 14px; }
    .td-alerts { display:flex; flex-direction:column; gap:9px; }
    .td-alert { display:flex; flex-direction:column; gap:9px; }
    .td-alert-top { display:flex; align-items:center; gap:9px; }
    .td-alert-titre { font-size:13px; font-weight:500; color:#F5F7FA; flex:1; min-width:0; }
    .td-alert-when { font-size:11px; color:#6B7785; white-space:nowrap; }
    .td-alert-bottom { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .td-alert-lieu { font-size:12px; color:#8B9AAB; flex:1; min-width:120px; display:flex; align-items:center; gap:6px; }
    .td-alert--compact { flex-direction:row; align-items:center; }
    .td-empty { font-size:12.5px; color:#6B7785; padding:6px 2px; }

    /* Pastilles */
    .td-pill { font-size:11px; padding:3px 9px; border-radius:999px; font-weight:500; white-space:nowrap; }
    .td-pill--critique  { background:rgba(248,113,113,.14); color:#F87171; }
    .td-pill--eleve     { background:rgba(251,191,36,.14);  color:#FBBF24; }
    .td-pill--moyen     { background:rgba(96,165,250,.14);  color:#60A5FA; }
    .td-pill--en-cours  { background:rgba(251,191,36,.14);  color:#FBBF24; }
    .td-pill--planifiee { background:rgba(96,165,250,.14);  color:#60A5FA; }
    .td-pill--seuil     { background:rgba(248,113,113,.14); color:#F87171; }
    .td-pill--ok        { background:rgba(52,211,153,.14);  color:#34D399; }
    .td-pill--hors-ligne{ background:rgba(255,255,255,.06); color:#8B9AAB; }

    /* Boutons d'action */
    .td-btn {
      font-size:12px; padding:5px 11px; border:.5px solid rgba(255,255,255,.14); border-radius:8px;
      background:transparent; color:#E2E8EE; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:5px;
    }
    .td-btn:hover { background:rgba(255,255,255,.05); }
    .td-btn--escalade { color:#FBBF24; border-color:rgba(251,191,36,.3); }
    .td-btn--escalade:hover { background:rgba(251,191,36,.1); }

    /* ═══ Grille bas (interventions / capteurs) ═══ */
    .td-grid2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; }
    .td-card-title { font-size:13px; font-weight:600; color:#F5F7FA; display:flex; align-items:center; gap:7px; }
    .td-demo-tag { font-size:9px; letter-spacing:.04em; color:#5b6470; border:.5px solid rgba(255,255,255,.12); border-radius:5px; padding:1px 5px; }
    .td-row { display:flex; align-items:center; gap:8px; padding-top:10px; margin-top:10px; border-top:.5px solid rgba(96,165,250,.1); }
    .td-row:first-of-type { padding-top:0; margin-top:0; border-top:0; }
    .td-row-main { font-size:12px; color:#E2E8EE; flex:1; min-width:0; line-height:1.45; }
    .td-row-sub { color:#6B7785; font-size:11px; }
  `],
  template: `
<div class="td-wrap">

  <!-- ═══ KPI ═══ -->
  <div class="td-kpis">
    <div class="td-kpi" *ngFor="let k of kpis()">
      <div class="td-kpi-label">{{ k.label }}</div>
      <div class="td-kpi-value">{{ k.value }}<small *ngIf="k.suffix"> {{ k.suffix }}</small></div>
      <div class="td-kpi-sub" [ngClass]="'td-sub--' + k.tone">{{ k.sub }}</div>
    </div>
  </div>

  <!-- ═══ Mes alertes (LIVE, scopées commune par le serveur) ═══ -->
  <div class="td-sec-head">
    <span class="td-sec-title">Mes alertes</span>
    <span class="td-spacer"></span>
    <button type="button" class="td-signaler" (click)="signalerAlerte()">
      <i class="ti ti-plus" style="font-size:13px"></i> Signaler une alerte
    </button>
  </div>

  <div class="td-alerts">
    <div class="td-card td-empty" *ngIf="!loading() && alertes().length === 0">
      {{ erreur() || 'Aucune alerte ouverte sur votre commune.' }}
    </div>
    <div class="td-card td-empty" *ngIf="loading()">Chargement des alertes…</div>

    <div class="td-card" *ngFor="let a of alertes()">
      <div class="td-alert td-alert--compact" *ngIf="!a.actions">
        <span class="td-pill" [ngClass]="'td-pill--' + a.severite">{{ severiteLabel(a.severite) }}</span>
        <span class="td-alert-titre" style="flex:1">{{ a.titre }}</span>
        <span class="td-alert-when">{{ a.quand }}</span>
      </div>
      <div class="td-alert" *ngIf="a.actions">
        <div class="td-alert-top">
          <span class="td-pill" [ngClass]="'td-pill--' + a.severite">{{ severiteLabel(a.severite) }}</span>
          <span class="td-alert-titre">{{ a.titre }}</span>
          <span class="td-alert-when">{{ a.quand }}</span>
        </div>
        <div class="td-alert-bottom">
          <span class="td-alert-lieu"><i class="ti ti-building-community" style="font-size:13px"></i> {{ a.lieu }}</span>
          <button type="button" class="td-btn" (click)="traiter(a)">Traiter</button>
          <button type="button" class="td-btn td-btn--escalade" (click)="escalader(a)">
            <i class="ti ti-arrow-up" style="font-size:12px"></i> Escalader URD
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ Interventions + Capteurs (LIVE, scopés commune) ═══ -->
  <div class="td-grid2">

    <div class="td-card">
      <div class="td-card-title" style="margin-bottom:10px">Interventions</div>
      <div class="td-empty" *ngIf="!loading() && interventions().length === 0">Aucune intervention en cours.</div>
      <div class="td-row" *ngFor="let i of interventions()">
        <span class="td-row-main">{{ i.titre }}<br><span class="td-row-sub">{{ i.sousTitre }}</span></span>
        <span class="td-pill" [ngClass]="'td-pill--' + i.etat">{{ interventionLabel(i.etat) }}</span>
      </div>
    </div>

    <div class="td-card">
      <div class="td-card-title" style="margin-bottom:10px">État des capteurs</div>
      <div class="td-empty" *ngIf="!loading() && capteurs().length === 0">Aucun capteur sur votre commune.</div>
      <div class="td-row" *ngFor="let c of capteurs()">
        <span class="td-row-main">{{ c.nom }}<br><span class="td-row-sub">{{ c.mesure }}</span></span>
        <span class="td-pill" [ngClass]="'td-pill--' + c.etat">{{ capteurLabel(c.etat) }}</span>
      </div>
    </div>

  </div>
</div>
  `,
})
export class DashboardTerrainComponent implements OnInit {
  private readonly bff = inject(BffApiService);
  private readonly alerteState = inject(AlerteStateService);

  readonly loading = signal(true);
  readonly erreur  = signal('');

  // ── Alertes : LIVE (scopées commune côté serveur via le JWT) ────────────────
  readonly alertes = signal<AlerteVm[]>([]);

  // ── Interventions & capteurs : LIVE (scopés commune côté serveur) ───────────
  readonly interventions = signal<InterventionVm[]>([]);
  readonly capteurs = signal<CapteurVm[]>([]);

  /** KPI = agrégats dérivés des listes LIVE (recalculés à chaque lecture, pas de compteur figé). */
  readonly kpis = computed(() => {
    const ouvertes = this.alertes();
    const critiques = ouvertes.filter(a => a.severite === 'critique').length;
    const inter = this.interventions();
    const enCours = inter.filter(i => i.etat === 'en-cours').length;
    const capt = this.capteurs();
    const enLigne = capt.filter(c => c.etat !== 'hors-ligne').length;
    return [
      { label: 'Alertes ouvertes', value: String(ouvertes.length), suffix: '', sub: critiques + ' critique', tone: 'danger' },
      { label: 'Interventions',    value: String(inter.length), suffix: '', sub: enCours + ' en cours', tone: 'muted' },
      { label: 'Capteurs',         value: String(enLigne), suffix: '/ ' + capt.length, sub: 'en ligne', tone: 'success' },
    ];
  });

  ngOnInit(): void {
    // Une seule chaîne : alertes + interventions + capteurs (tous scopés commune par le SERVEUR
    // depuis le JWT) + noms de points pour libeller lieux/sous-titres.
    forkJoin({
      alertes: this.bff.alerts(),
      tickets: this.bff.tickets(),
      capteurs: this.bff.capteurs(),
      points: this.bff.referencePoints(),
    }).subscribe({
      next: ({ alertes, tickets, capteurs, points }) => {
        const nomParPoint = new Map<string, string>(
          (points ?? []).map((p: any) => [p.id, p.name ?? p.id] as const));

        this.alertes.set((alertes ?? [])
          .filter((a: any) => a.status !== 'CLOSED')              // file de travail = alertes ouvertes
          .map((a: any) => this.toAlerteVm(a, nomParPoint))
          .sort((x: AlerteVm, y: AlerteVm) => this.poids(y.severite) - this.poids(x.severite)));

        this.interventions.set((tickets ?? [])
          .filter((t: any) => t.status !== 'CLOSED')
          .map((t: any) => this.toInterventionVm(t, nomParPoint)));

        this.capteurs.set((capteurs ?? []).map((c: any) => this.toCapteurVm(c)));

        this.loading.set(false);
      },
      error: () => { this.erreur.set('Données indisponibles pour le moment.'); this.loading.set(false); },
    });
  }

  private toInterventionVm(t: any, nomParPoint: Map<string, string>): InterventionVm {
    const lieu = [nomParPoint.get(t.pointId), t.commune].filter(Boolean).join(' · ');
    return {
      titre: t.titre || 'Intervention',
      sousTitre: lieu || '—',
      etat: t.status === 'IN_PROGRESS' ? 'en-cours' : 'planifiee',
    };
  }

  private toCapteurVm(c: any): CapteurVm {
    const etat: EtatCapteur = c.etat === 'seuil' ? 'seuil' : c.etat === 'ok' ? 'ok' : 'hors-ligne';
    return { nom: c.nom ?? c.pointId, mesure: c.mesure ?? '—', etat };
  }

  private toAlerteVm(a: any, nomParPoint: Map<string, string>): AlerteVm {
    const severite = this.mapSeverite(a.severity);
    const lieu = [nomParPoint.get(a.pointId), a.commune].filter(Boolean).join(' · ');
    return {
      id: a.id,
      severite,
      titre: a.message ?? 'Alerte',
      lieu: lieu || '—',
      quand: this.tempsRelatif(a.openedAt),
      actions: severite !== 'moyen',            // critique/élevé → Traiter + Escalader ; moyen → compact
    };
  }

  private mapSeverite(s: string): Severite {
    return s === 'CRIT' ? 'critique' : s === 'WARN' ? 'eleve' : 'moyen';
  }
  private poids(s: Severite): number {
    return s === 'critique' ? 3 : s === 'eleve' ? 2 : 1;
  }
  private tempsRelatif(iso?: string): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    return `il y a ${Math.round(h / 24)} j`;
  }

  // ── Libellés ────────────────────────────────────────────────────────────────
  severiteLabel(s: Severite): string {
    return { critique: 'Critique', eleve: 'Élevé', moyen: 'Moyen' }[s];
  }
  interventionLabel(e: EtatTravail): string {
    return { 'en-cours': 'En cours', 'planifiee': 'Planifiée' }[e];
  }
  capteurLabel(e: EtatCapteur): string {
    return { seuil: 'Seuil dépassé', ok: 'OK', 'hors-ligne': 'Hors ligne' }[e];
  }

  // ── Actions (stubs ; à câbler sur les endpoints terrain) ────────────────────
  signalerAlerte(): void { this.alerteState.ouvrirModalCreer(); }
  traiter(_a: AlerteVm): void { /* TODO: POST ticket / changer statut */ }
  escalader(_a: AlerteVm): void { /* TODO: escalade TEPAC → URD */ }
}

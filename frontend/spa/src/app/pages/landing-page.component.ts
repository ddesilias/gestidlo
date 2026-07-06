import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<div class="lp">

  <!-- ── NAV ─────────────────────────────────────────── -->
  <nav class="lp-nav">
    <div class="lp-nav-inner">
      <a class="lp-brand" routerLink="/">
        <span class="lp-brand-dot"></span>
        <span>GEstiDlo</span>
      </a>
      <div class="lp-nav-links">
        <span class="lp-nav-badge">Réseau AEP Haïti</span>
      </div>
      <a class="lp-nav-cta" routerLink="/login">Connexion</a>
    </div>
  </nav>

  <!-- ── HERO ─────────────────────────────────────────── -->
  <section class="lp-hero">
    <div class="lp-orb lp-orb--1"></div>
    <div class="lp-orb lp-orb--2"></div>

    <div class="lp-hero-inner">
      <div class="lp-badge">
        <span class="lp-pulse-dot lp-pulse-dot--cyan"></span>
        NOUVEAU &nbsp;·&nbsp; GEstiDlo v2.0 — Réseau AEP Haïti
      </div>

      <h1 class="lp-title">
        La supervision hydraulique<br>
        <span class="lp-title-gradient">enfin pilotable.</span>
      </h1>

      <p class="lp-subtitle">
        Pilotez en temps réel les 3&nbsp;000+ points de mesure du réseau AEP haïtien.
        Alertes intelligentes, interventions terrain tracées, rapports DINEPA/OREPA —
        tout en un seul tableau de bord.
      </p>

      <div class="lp-hero-ctas">
        <a class="lp-btn lp-btn--primary" routerLink="/login">
          Accéder à la plateforme
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        </a>
        <a class="lp-btn lp-btn--ghost" routerLink="/dashboard">Voir la démo</a>
      </div>

      <!-- LIVE STATS STRIP -->
      <div class="lp-stats">
        <div class="lp-stat">
          <span class="lp-stat-value lp-stat--ok">{{ capteurs() }}</span>
          <span class="lp-stat-label">Capteurs actifs</span>
        </div>
        <div class="lp-stat-divider"></div>
        <div class="lp-stat">
          <span class="lp-stat-value lp-stat--crit">
            {{ alertesCrit() }}
            <span class="lp-pulse-dot lp-pulse-dot--red"></span>
          </span>
          <span class="lp-stat-label">Alertes CRIT</span>
        </div>
        <div class="lp-stat-divider"></div>
        <div class="lp-stat">
          <span class="lp-stat-value lp-stat--warn">{{ interventions() }}</span>
          <span class="lp-stat-label">Interventions actives</span>
        </div>
        <div class="lp-stat-divider"></div>
        <div class="lp-stat">
          <span class="lp-stat-value lp-stat--ok">{{ uptime() }}%</span>
          <span class="lp-stat-label">Uptime réseau</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ── DASHBOARD MOCKUP ──────────────────────────────── -->
  <div class="lp-mockup-wrap">
    <div class="lp-mockup">
      <div class="lp-mockup-topbar">
        <div class="lp-mockup-dots"><span></span><span></span><span></span></div>
        <span class="lp-mockup-title">GEstiDlo — Dashboard</span>
        <span class="lp-mockup-live">
          <span class="lp-pulse-dot lp-pulse-dot--red"></span> LIVE
        </span>
      </div>
      <div class="lp-mockup-body">
        <div class="lp-mockup-kpis">
          <div class="lp-mkpi lp-mkpi--ok">
            <span class="lp-mkpi-val">241</span>
            <span class="lp-mkpi-lbl">OK</span>
          </div>
          <div class="lp-mkpi lp-mkpi--warn">
            <span class="lp-mkpi-val">3</span>
            <span class="lp-mkpi-lbl">WARN</span>
          </div>
          <div class="lp-mkpi lp-mkpi--crit">
            <span class="lp-mkpi-val">{{ alertesCrit() }}</span>
            <span class="lp-mkpi-lbl">CRIT</span>
          </div>
          <div class="lp-mkpi lp-mkpi--blue">
            <span class="lp-mkpi-val">{{ interventions() }}</span>
            <span class="lp-mkpi-lbl">Interventions</span>
          </div>
        </div>

        <div class="lp-mockup-graph">
          <svg viewBox="0 0 400 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lpGraphGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00D4FF" stop-opacity="0.25"/>
                <stop offset="100%" stop-color="#00D4FF" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0 60 C40 55 60 30 100 35 S160 20 200 25 S280 40 320 30 S380 15 400 20 L400 80 L0 80 Z"
              fill="url(#lpGraphGrad)"/>
            <path d="M0 60 C40 55 60 30 100 35 S160 20 200 25 S280 40 320 30 S380 15 400 20"
              fill="none" stroke="#00D4FF" stroke-width="2"/>
          </svg>
          <div class="lp-graph-labels">
            <span>Débit moyen (m³/h)</span>
            <span class="lp-graph-trend">+8.2%</span>
          </div>
        </div>

        <div class="lp-mockup-table">
          <div class="lp-mtrow lp-mtrow--header">
            <span>Point</span><span>Département</span><span>Statut</span><span>Δ</span>
          </div>
          <div class="lp-mtrow">
            <span>AEP-OUE-042</span><span>Ouest</span>
            <span class="lp-ms lp-ms--crit">CRIT</span>
            <span class="lp-mdelta lp-mdelta--down">−23%</span>
          </div>
          <div class="lp-mtrow">
            <span>AEP-ART-017</span><span>Artibonite</span>
            <span class="lp-ms lp-ms--ok">OK</span>
            <span class="lp-mdelta lp-mdelta--up">+4%</span>
          </div>
          <div class="lp-mtrow">
            <span>AEP-NOR-008</span><span>Nord</span>
            <span class="lp-ms lp-ms--warn">WARN</span>
            <span class="lp-mdelta lp-mdelta--down">−7%</span>
          </div>
          <div class="lp-mtrow">
            <span>AEP-SUD-031</span><span>Sud</span>
            <span class="lp-ms lp-ms--ok">OK</span>
            <span class="lp-mdelta lp-mdelta--up">+1%</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── FEATURES BENTO ────────────────────────────────── -->
  <section class="lp-features">
    <div class="lp-section-inner">
      <p class="lp-section-tag">FONCTIONNALITÉS</p>
      <h2 class="lp-section-title">Tout ce dont vous avez besoin<br>pour piloter le réseau AEP</h2>

      <div class="lp-bento">

        <div class="lp-card lp-card--wide">
          <div class="lp-card-icon lp-card-icon--cyan">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" fill="currentColor"/>
              <path d="M12 6v2M12 16v2M6 12H4M20 12h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
          </div>
          <h3>Supervision temps réel</h3>
          <p>Cartographie interactive de tous vos ouvrages hydrauliques. Débit, pression, qualité — visualisés en direct sur fond OpenStreetMap avec seuils configurables par département.</p>
          <div class="lp-card-chip">247 capteurs actifs</div>
        </div>

        <div class="lp-card lp-card--tall">
          <div class="lp-card-icon lp-card-icon--red">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M12 2L2 19h20L12 2zm0 3.5L19.5 17h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="currentColor"/>
            </svg>
          </div>
          <h3>Alertes intelligentes</h3>
          <p>Détection automatique des anomalies avec escalade INFO → WARN → CRIT → URGENT. Notifications push, SMS et e-mail aux équipes terrain.</p>
          <div class="lp-alert-preview">
            <div class="lp-alert-item lp-alert-item--crit">
              <span class="lp-alert-dot lp-alert-dot--crit"></span>
              <div>
                <div class="lp-alert-title">Pression critique — AEP-OUE-042</div>
                <div class="lp-alert-sub">il y a 3 min</div>
              </div>
            </div>
            <div class="lp-alert-item lp-alert-item--warn">
              <span class="lp-alert-dot lp-alert-dot--warn"></span>
              <div>
                <div class="lp-alert-title">Débit faible — AEP-ART-017</div>
                <div class="lp-alert-sub">il y a 12 min</div>
              </div>
            </div>
            <div class="lp-alert-item lp-alert-item--ok">
              <span class="lp-alert-dot lp-alert-dot--ok"></span>
              <div>
                <div class="lp-alert-title">Retour à la normale — AEP-NOR-003</div>
                <div class="lp-alert-sub">il y a 28 min</div>
              </div>
            </div>
          </div>
        </div>

        <div class="lp-card">
          <div class="lp-card-icon lp-card-icon--blue">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
            </svg>
          </div>
          <h3>Ouvrages hydrauliques</h3>
          <p>Registre complet des infrastructures : forages, réservoirs, stations de pompage. Fiches techniques, historique de maintenance et géolocalisation GPS.</p>
        </div>

        <div class="lp-card">
          <div class="lp-card-icon lp-card-icon--green">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zM6 10h3v2H6zm5 0h7v2h-7zM6 14h5v2H6zm7 0h5v2h-5z" fill="currentColor"/>
            </svg>
          </div>
          <h3>Interventions terrain</h3>
          <p>Cycle de vie complet : de la panne détectée à la résolution validée. Assignation techniciens, listes de tâches, rapports DINEPA téléchargeables.</p>
        </div>

      </div>
    </div>
  </section>

  <!-- ── STATS BAND ─────────────────────────────────────── -->
  <section class="lp-statsband">
    <div class="lp-statsband-inner">
      <div class="lp-sstat">
        <span class="lp-sstat-val">10</span>
        <span class="lp-sstat-lbl">Départements couverts</span>
      </div>
      <div class="lp-sstat">
        <span class="lp-sstat-val">3 000+</span>
        <span class="lp-sstat-lbl">Points de mesure</span>
      </div>
      <div class="lp-sstat">
        <span class="lp-sstat-val">99.4%</span>
        <span class="lp-sstat-lbl">Disponibilité réseau</span>
      </div>
      <div class="lp-sstat">
        <span class="lp-sstat-val">&lt; 90s</span>
        <span class="lp-sstat-lbl">Temps de détection</span>
      </div>
    </div>
  </section>

  <!-- ── PARTNERS ──────────────────────────────────────── -->
  <section class="lp-partners">
    <p class="lp-partners-label">Conçu pour les institutions haïtiennes de l'eau</p>
    <div class="lp-partners-row">
      <div class="lp-partner">DINEPA</div>
      <div class="lp-partner">OREPA Ouest</div>
      <div class="lp-partner">CNIGS</div>
      <div class="lp-partner">Mairie de Léogâne</div>
      <div class="lp-partner">TEPAC</div>
    </div>
  </section>

  <!-- ── FINAL CTA ──────────────────────────────────────── -->
  <section class="lp-finalcta">
    <div class="lp-finalcta-glow"></div>
    <div class="lp-finalcta-inner">
      <p class="lp-section-tag">DÉMARREZ MAINTENANT</p>
      <h2 class="lp-finalcta-title">Prêt à superviser votre réseau AEP&nbsp;?</h2>
      <p class="lp-finalcta-sub">
        Accédez à votre tableau de bord en quelques secondes.<br>
        Données en temps réel, sécurisées et conformes aux normes DINEPA.
      </p>
      <a class="lp-btn lp-btn--primary lp-btn--lg" routerLink="/login">
        Accéder à la plateforme
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
      </a>
    </div>
  </section>

  <!-- ── FOOTER ─────────────────────────────────────────── -->
  <footer class="lp-footer">
    <div class="lp-footer-inner">
      <span class="lp-brand">
        <span class="lp-brand-dot"></span>GEstiDlo
      </span>
      <span class="lp-footer-copy">
        © 2026 GEstiDlo — Gestion des Eaux et de l'Infrastructure de Distribution Locale
      </span>
    </div>
  </footer>

</div>
  `,
  styles: [`
    /* ─── ROOT ─────────────────────────────────────────── */
    .lp {
      min-height: 100vh;
      background: #0A0E1A;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-x: hidden;
    }

    /* ─── NAV ──────────────────────────────────────────── */
    .lp-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(10, 14, 26, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .lp-nav-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
      height: 60px;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .lp-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 1.1rem;
      color: #E2E8F0;
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .lp-brand-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00D4FF;
      box-shadow: 0 0 8px #00D4FF;
      flex-shrink: 0;
    }
    .lp-nav-links { flex: 1; padding-left: 0.75rem; }
    .lp-nav-badge {
      font-size: 0.72rem;
      color: #94A3B8;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 0.2rem 0.65rem;
      border-radius: 9999px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .lp-nav-cta {
      padding: 0.45rem 1.1rem;
      border: 1px solid rgba(0, 212, 255, 0.4);
      color: #00D4FF;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .lp-nav-cta:hover { background: rgba(0, 212, 255, 0.1); }

    /* ─── HERO ─────────────────────────────────────────── */
    .lp-hero {
      position: relative;
      padding: 6rem 1.5rem 5rem;
      text-align: center;
      overflow: hidden;
    }
    .lp-hero-inner {
      max-width: 820px;
      margin: 0 auto;
      position: relative;
      z-index: 2;
    }
    .lp-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
      z-index: 1;
    }
    .lp-orb--1 {
      width: 550px; height: 550px;
      background: rgba(0, 102, 255, 0.12);
      top: -120px; left: -180px;
    }
    .lp-orb--2 {
      width: 420px; height: 420px;
      background: rgba(139, 92, 246, 0.1);
      bottom: -80px; right: -120px;
    }

    .lp-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #00D4FF;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      padding: 0.35rem 1rem;
      border-radius: 9999px;
      margin-bottom: 2rem;
    }

    .lp-title {
      font-size: clamp(2.4rem, 6vw, 4.5rem);
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.04em;
      margin: 0 0 1.5rem;
      color: #F1F5F9;
    }
    .lp-title-gradient {
      background: linear-gradient(135deg, #00D4FF 0%, #0066FF 50%, #8B5CF6 100%);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: lp-grad 5s ease infinite;
    }
    @keyframes lp-grad {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    .lp-subtitle {
      font-size: 1.1rem;
      line-height: 1.75;
      color: #94A3B8;
      max-width: 620px;
      margin: 0 auto 2.5rem;
    }

    .lp-hero-ctas {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 3rem;
    }

    /* ─── BUTTONS ──────────────────────────────────────── */
    .lp-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-radius: 9999px;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
      cursor: pointer;
      border: none;
    }
    .lp-btn--primary {
      background: linear-gradient(135deg, #00D4FF, #0055FF);
      color: #fff;
      box-shadow: 0 4px 20px rgba(0, 85, 255, 0.35);
    }
    .lp-btn--primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 85, 255, 0.5);
    }
    .lp-btn--ghost {
      background: rgba(255,255,255,0.06);
      color: #E2E8F0;
      border: 1px solid rgba(255,255,255,0.12);
    }
    .lp-btn--ghost:hover { background: rgba(255,255,255,0.1); }
    .lp-btn--lg { padding: 1rem 2rem; font-size: 1rem; }

    /* ─── LIVE STATS STRIP ─────────────────────────────── */
    .lp-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 1.5rem 2rem;
      flex-wrap: wrap;
      gap: 0;
    }
    .lp-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      padding: 0 2rem;
    }
    .lp-stat-divider {
      width: 1px; height: 44px;
      background: rgba(255,255,255,0.1);
    }
    .lp-stat-value {
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .lp-stat-label {
      font-size: 0.72rem;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .lp-stat--ok   { color: #10B981; }
    .lp-stat--warn { color: #F59E0B; }
    .lp-stat--crit { color: #EF4444; }

    /* ─── PULSE DOTS ───────────────────────────────────── */
    .lp-pulse-dot {
      display: inline-block;
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .lp-pulse-dot--cyan {
      background: #00D4FF;
      animation: lp-pulse-c 2s infinite;
    }
    .lp-pulse-dot--red {
      background: #EF4444;
      animation: lp-pulse-r 1.5s infinite;
    }
    @keyframes lp-pulse-c {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.7); }
    }
    @keyframes lp-pulse-r {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
      50% { opacity: 0.8; box-shadow: 0 0 0 5px rgba(239,68,68,0); }
    }

    /* ─── MOCKUP ────────────────────────────────────────── */
    .lp-mockup-wrap {
      padding: 0 1.5rem 5rem;
      display: flex;
      justify-content: center;
    }
    .lp-mockup {
      width: 100%;
      max-width: 920px;
      background: #111827;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      overflow: hidden;
      box-shadow:
        0 30px 80px rgba(0,0,0,0.5),
        0 0 0 1px rgba(0, 212, 255, 0.04);
    }
    .lp-mockup-topbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: #0D1420;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .lp-mockup-dots { display: flex; gap: 6px; }
    .lp-mockup-dots span {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
    }
    .lp-mockup-title { flex: 1; font-size: 0.8rem; color: #64748B; font-weight: 500; }
    .lp-mockup-live {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.7rem;
      color: #EF4444;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .lp-mockup-body { padding: 1.25rem; display: grid; gap: 1rem; }

    .lp-mockup-kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
    }
    .lp-mkpi {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 0.875rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .lp-mkpi-val {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .lp-mkpi-lbl {
      font-size: 0.68rem;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .lp-mkpi--ok   .lp-mkpi-val { color: #10B981; }
    .lp-mkpi--warn .lp-mkpi-val { color: #F59E0B; }
    .lp-mkpi--crit .lp-mkpi-val { color: #EF4444; }
    .lp-mkpi--blue .lp-mkpi-val { color: #60A5FA; }

    .lp-mockup-graph {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 0.875rem;
    }
    .lp-mockup-graph svg { width: 100%; height: 80px; display: block; }
    .lp-graph-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: #64748B;
      margin-top: 0.5rem;
    }
    .lp-graph-trend { color: #10B981; font-weight: 600; }

    .lp-mockup-table {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      overflow: hidden;
    }
    .lp-mtrow {
      display: grid;
      grid-template-columns: 2fr 1.5fr 0.8fr 0.6fr;
      padding: 0.6rem 0.875rem;
      font-size: 0.8rem;
      gap: 0.5rem;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .lp-mtrow:last-child { border-bottom: none; }
    .lp-mtrow--header {
      color: #64748B;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .lp-ms {
      font-size: 0.66rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
      display: inline-block;
    }
    .lp-ms--ok   { background: rgba(16,185,129,0.15); color: #10B981; }
    .lp-ms--warn { background: rgba(245,158,11,0.15); color: #F59E0B; }
    .lp-ms--crit { background: rgba(239,68,68,0.15);  color: #EF4444; }
    .lp-mdelta { font-size: 0.8rem; font-weight: 600; }
    .lp-mdelta--up   { color: #10B981; }
    .lp-mdelta--down { color: #EF4444; }

    /* ─── FEATURES ──────────────────────────────────────── */
    .lp-features {
      padding: 6rem 1.5rem;
      background: #0D1117;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .lp-section-inner { max-width: 1100px; margin: 0 auto; }
    .lp-section-tag {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #00D4FF;
      text-transform: uppercase;
      margin: 0 0 0.75rem;
    }
    .lp-section-title {
      font-size: clamp(1.75rem, 4vw, 2.75rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #F1F5F9;
      margin: 0 0 3rem;
      line-height: 1.2;
    }

    /* BENTO */
    .lp-bento {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .lp-card {
      background: #111827;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      transition: border-color 0.25s, transform 0.25s;
    }
    .lp-card:hover {
      border-color: rgba(0, 212, 255, 0.25);
      transform: translateY(-3px);
    }
    .lp-card h3 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #F1F5F9;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .lp-card p {
      font-size: 0.875rem;
      color: #94A3B8;
      line-height: 1.65;
      margin: 0;
    }
    .lp-card-icon {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .lp-card-icon--cyan  { background: rgba(0, 212, 255, 0.12);  color: #00D4FF; }
    .lp-card-icon--red   { background: rgba(239, 68, 68, 0.12);   color: #EF4444; }
    .lp-card-icon--blue  { background: rgba(96, 165, 250, 0.12);  color: #60A5FA; }
    .lp-card-icon--green { background: rgba(16, 185, 129, 0.12);  color: #10B981; }
    .lp-card-chip {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 9999px;
      font-size: 0.75rem;
      color: #00D4FF;
      font-weight: 600;
      margin-top: auto;
      align-self: flex-start;
    }

    /* ALERT PREVIEW (inside card) */
    .lp-alert-preview {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    .lp-alert-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.55rem 0.75rem;
      border-radius: 8px;
      background: rgba(255,255,255,0.03);
      border-left: 3px solid transparent;
    }
    .lp-alert-item--crit { border-left-color: #EF4444; }
    .lp-alert-item--warn { border-left-color: #F59E0B; }
    .lp-alert-item--ok   { border-left-color: #10B981; }
    .lp-alert-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .lp-alert-dot--crit { background: #EF4444; animation: lp-pulse-r 1.5s infinite; }
    .lp-alert-dot--warn { background: #F59E0B; }
    .lp-alert-dot--ok   { background: #10B981; }
    .lp-alert-title { font-size: 0.78rem; color: #E2E8F0; font-weight: 500; }
    .lp-alert-sub   { font-size: 0.7rem;  color: #64748B; }

    /* ─── STATS BAND ────────────────────────────────────── */
    .lp-statsband {
      padding: 4.5rem 1.5rem;
      background: linear-gradient(135deg, rgba(0,102,255,0.08), rgba(139,92,246,0.06));
      border-top: 1px solid rgba(255,255,255,0.06);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .lp-statsband-inner {
      max-width: 900px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2rem;
      text-align: center;
    }
    .lp-sstat { display: flex; flex-direction: column; gap: 0.4rem; }
    .lp-sstat-val {
      font-size: 2.5rem;
      font-weight: 900;
      letter-spacing: -0.05em;
      background: linear-gradient(135deg, #00D4FF, #0055FF);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }
    .lp-sstat-lbl {
      font-size: 0.75rem;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ─── PARTNERS ──────────────────────────────────────── */
    .lp-partners {
      padding: 4rem 1.5rem;
      text-align: center;
      background: #0A0E1A;
    }
    .lp-partners-label {
      font-size: 0.75rem;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin: 0 0 2rem;
    }
    .lp-partners-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
      flex-wrap: wrap;
    }
    .lp-partner {
      font-size: 0.85rem;
      font-weight: 700;
      color: #334155;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.55rem 1.25rem;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 8px;
      transition: color 0.2s, border-color 0.2s;
    }
    .lp-partner:hover { color: #94A3B8; border-color: rgba(255,255,255,0.15); }

    /* ─── FINAL CTA ─────────────────────────────────────── */
    .lp-finalcta {
      padding: 7rem 1.5rem;
      text-align: center;
      background: #0D1117;
      position: relative;
      overflow: hidden;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .lp-finalcta-glow {
      position: absolute;
      width: 700px; height: 700px;
      background: radial-gradient(circle, rgba(0,85,255,0.14) 0%, transparent 65%);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .lp-finalcta-inner {
      max-width: 600px;
      margin: 0 auto;
      position: relative;
      z-index: 2;
    }
    .lp-finalcta-title {
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #F1F5F9;
      margin: 0.5rem 0 1rem;
      line-height: 1.2;
    }
    .lp-finalcta-sub {
      font-size: 1rem;
      color: #94A3B8;
      line-height: 1.7;
      margin: 0 0 2.5rem;
    }

    /* ─── FOOTER ────────────────────────────────────────── */
    .lp-footer {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 1.5rem;
      background: #0A0E1A;
    }
    .lp-footer-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .lp-footer-copy { font-size: 0.75rem; color: #334155; }

    /* ─── RESPONSIVE ────────────────────────────────────── */
    @media (max-width: 860px) {
      .lp-bento { grid-template-columns: 1fr; }
      .lp-statsband-inner { grid-template-columns: repeat(2, 1fr); gap: 2rem; }
      .lp-mockup-kpis { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .lp-hero { padding: 4rem 1rem 3.5rem; }
      .lp-stats {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
        padding: 1.25rem;
      }
      .lp-stat { flex-direction: row; justify-content: space-between; padding: 0; }
      .lp-stat-divider { width: 100%; height: 1px; }
      .lp-statsband-inner { grid-template-columns: repeat(2, 1fr); }
      .lp-mtrow { grid-template-columns: 2fr 1fr 1fr; }
      .lp-mtrow > span:nth-child(4) { display: none; }
      .lp-footer-inner { flex-direction: column; text-align: center; }
      .lp-nav-badge { display: none; }
    }
  `]
})
export class LandingPageComponent implements OnInit, OnDestroy {
  capteurs = signal(247);
  alertesCrit = signal(3);
  interventions = signal(12);
  uptime = signal(99.4);

  private ticker?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.ticker = setInterval(() => {
      this.capteurs.update(v => v + (Math.random() > 0.7 ? 1 : 0) - (Math.random() > 0.85 ? 1 : 0));
      this.alertesCrit.update(v => Math.max(0, v + (Math.random() > 0.92 ? 1 : Math.random() > 0.92 ? -1 : 0)));
      this.interventions.update(v => Math.max(0, v + (Math.random() > 0.95 ? 1 : Math.random() > 0.95 ? -1 : 0)));
    }, 3500);
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
  }
}

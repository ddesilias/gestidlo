import { Routes } from '@angular/router';

import { AlertesPageComponent } from './pages/alertes/alertes-page.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { HistoryPageComponent } from './pages/history-page.component';
import { LandingPageComponent } from './pages/landing-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { PointDetailsPageComponent } from './pages/point-details-page.component';
import { PointsPageComponent } from './pages/points-page.component';
import { ProcessesPageComponent } from './pages/processes-page.component';
import { SupervisionPageComponent } from './pages/supervision-page.component';
import { TicketsPageComponent } from './pages/tickets-page.component';
import { MeasurementTypesPageComponent } from './pages/measurement-types-page.component';
import { PointTypesPageComponent } from './pages/point-types-page.component';
import { ResourcesPageComponent } from './pages/resources-page.component';
import { TraceabilityPageComponent } from './pages/traceability-page.component';
import { ServicePageComponent } from './pages/service-page.component';
import { RapportsPageComponent } from './pages/rapports/rapports-page.component';
import { RapportsOfficielsComponent } from './pages/admin/rapports-officiels.component';
import { GovernancePageComponent } from './pages/governance-page.component';
import { InterventionsPageComponent } from './pages/interventions/interventions-page.component';
import { ConfigPageComponent } from './pages/config-page.component';
import { PointsConfigPageComponent } from './pages/points-config-page.component';
import { ThresholdsConfigPageComponent } from './pages/thresholds-config-page.component';
import { InfrastructuresPageComponent } from './pages/infrastructures-page.component';
import { CapteursPageComponent } from './pages/capteurs-page.component';
import { CapteurLiveComponent } from './pages/terrain/capteur-live.component';
import { CapteurDetailLiveComponent } from './pages/terrain/capteur-detail-live.component';
import { AdminDashboardPageComponent } from './pages/admin-dashboard-page.component';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { SuperviseurLayoutComponent } from './layout/superviseur-layout.component';
import { SupRessourcesPageComponent, SupActeursPageComponent, SupInfrastructuresPageComponent, SupCapteursPageComponent } from './layout/superviseur-scoped-pages';
import { SuperviseurAccueilComponent } from './pages/superviseur-accueil.component';
import { SuperviseurAlertesComponent } from './pages/superviseur-alertes.component';
import { SuperviseurInterventionsComponent } from './pages/superviseur-interventions.component';
import { SuperviseurRapportsComponent } from './pages/superviseur-rapports.component';
import { SuperviseurTerritoireComponent } from './pages/superviseur-territoire.component';

/** Accueil après login : chaque rôle vers son shell ; les autres sur l'admin. */
const homeFor = (auth: AuthService) =>
  auth.hasRole('SUPERVISEUR_URD') ? '/superviseur/tableau-de-bord'
  : auth.hasRole('TEPAC')         ? '/terrain/tableau-de-bord'
  : '/admin/dashboard';

const loginGuard = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return inject(Router).createUrlTree([homeFor(auth)]);
  }
  return true;
};

const landingGuard = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return inject(Router).createUrlTree([homeFor(auth)]);
  }
  return true;
};

/** Admin shell guard — renvoie chaque rôle scopé (superviseur, TEPAC) vers son propre shell. */
const adminShellGuard = () => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) return inject(Router).createUrlTree(['/login']);
  if (auth.hasRole('SUPERVISEUR_URD')) return inject(Router).createUrlTree(['/superviseur/tableau-de-bord']);
  if (auth.hasRole('TEPAC')) return inject(Router).createUrlTree(['/terrain/tableau-de-bord']);
  return true;
};

/**
 * Terrain shell guard — n'autorise que le rôle TEPAC (le scope commune/dept vient
 * du token, jamais du front). Tout autre rôle est renvoyé vers son propre accueil.
 */
const terrainGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (!auth.hasRole('TEPAC')) return router.createUrlTree([homeFor(auth)]);
  return true;
};

/**
 * Supervisor shell guard — pièce maîtresse de l'accès.
 * N'autorise que role=SUPERVISEUR_URD ET urdId non nul (périmètre dérivé du token).
 * Pas d'urdId → compte mal provisionné → retour login.
 */
const superviseurGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (!auth.hasRole('SUPERVISEUR_URD')) return router.createUrlTree(['/admin/dashboard']);
  if (!auth.userSnapshot()?.urdId) return router.createUrlTree(['/login']);
  return true;
};

/** Config-level guard — requires ADMIN role explicitly. */
const adminGuard = () => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) return inject(Router).createUrlTree(['/login']);
  if (auth.hasRole('ADMIN')) return true;
  return inject(Router).createUrlTree(['/admin/dashboard']);
};

const adminConfigChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'measurement-types' },
  { path: 'measurement-types', component: MeasurementTypesPageComponent },
  { path: 'point-types',       component: PointTypesPageComponent },
  { path: 'points',            component: PointsConfigPageComponent },
  { path: 'thresholds',        component: ThresholdsConfigPageComponent }
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingPageComponent, canActivate: [landingGuard] },
  { path: 'login', component: LoginPageComponent, canActivate: [loginGuard] },

  /* ─────────────────────────────────────────────────────────
     SUPERVISOR SHELL  ·  /superviseur/*
  ───────────────────────────────────────────────────────── */
  {
    path: 'superviseur',
    component: SuperviseurLayoutComponent,
    canActivate: [superviseurGuard],
    children: [
      { path: '',                pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      { path: 'tableau-de-bord', component: SuperviseurAccueilComponent },
      { path: 'carte',           component: DashboardPageComponent },
      { path: 'infrastructures', component: SupInfrastructuresPageComponent },
      { path: 'ressources',      component: SupRessourcesPageComponent },
      { path: 'capteurs',        component: SupCapteursPageComponent },
      { path: 'capteurs/ouvrage/:id', component: CapteurLiveComponent },
      { path: 'capteurs/:capteurId/live', component: CapteurDetailLiveComponent },
      { path: 'acteurs',         component: SupActeursPageComponent },
      { path: 'alertes',         component: SuperviseurAlertesComponent },
      { path: 'rapports',        component: SuperviseurRapportsComponent },
      { path: 'rapports/:id',    loadComponent: () => import('./pages/rapports/rapport-detail.component').then(m => m.RapportDetailComponent) },
      { path: 'interventions',   component: SuperviseurInterventionsComponent },
      { path: 'territoire',      component: SuperviseurTerritoireComponent },
      { path: 'historique',      component: HistoryPageComponent },
      { path: '**', redirectTo: 'tableau-de-bord' }
    ]
  },

  /* ─────────────────────────────────────────────────────────
     TERRAIN SHELL (technicien TEPAC)  ·  /terrain/*
  ───────────────────────────────────────────────────────── */
  {
    path: 'terrain',
    loadComponent: () => import('./layout/terrain-layout.component').then(m => m.TerrainLayoutComponent),
    canActivate: [terrainGuard],
    children: [
      { path: '',                pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      { path: 'tableau-de-bord', loadComponent: () => import('./pages/terrain/dashboard-terrain.component').then(m => m.DashboardTerrainComponent) },
      // Pages PARTAGÉES avec le shell URD : mêmes composants, scopés à la commune par le JWT
      // (un TEPAC ne voit que sa commune, sans une ligne de code différente).
      { path: 'alertes',         component: SuperviseurAlertesComponent },
      // Fiche technicien : reçoit/exécute les ordres de travail (InterventionStore, contrat).
      { path: 'interventions',   loadComponent: () => import('./pages/terrain/mes-interventions-terrain.component').then(m => m.MesInterventionsTerrainComponent) },
      { path: 'ressources',      component: SupRessourcesPageComponent },
      { path: 'infrastructures', component: SupInfrastructuresPageComponent },
      { path: 'rapports',        component: SuperviseurRapportsComponent },
      { path: 'rapports/:id',    loadComponent: () => import('./pages/rapports/rapport-detail.component').then(m => m.RapportDetailComponent) },
      { path: 'capteurs',        component: SupCapteursPageComponent },
      { path: 'capteurs/ouvrage/:id', component: CapteurLiveComponent },
      { path: 'capteurs/:capteurId/live', component: CapteurDetailLiveComponent },
      { path: '**', redirectTo: 'tableau-de-bord' }
    ]
  },

  /* ─────────────────────────────────────────────────────────
     ADMIN SHELL  ·  /admin/*
  ───────────────────────────────────────────────────────── */
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminShellGuard],
    children: [
      { path: '',                pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard',       component: AdminDashboardPageComponent },
      { path: 'supervision',     component: SupervisionPageComponent },
      { path: 'alertes',         component: AlertesPageComponent },
      { path: 'tickets',         component: TicketsPageComponent },
      { path: 'points',          component: PointsPageComponent },
      { path: 'points/:id',      component: PointDetailsPageComponent },
      { path: 'resources',       component: ResourcesPageComponent },
      { path: 'infrastructures', component: InfrastructuresPageComponent },
      { path: 'capteurs',        component: CapteursPageComponent },
      { path: 'capteurs/ouvrage/:id', component: CapteurLiveComponent },
      { path: 'capteurs/:capteurId/live', component: CapteurDetailLiveComponent },
      { path: 'service',         component: ServicePageComponent },
      { path: 'processes',       component: ProcessesPageComponent },
      { path: 'history',         component: HistoryPageComponent },
      { path: 'quality',         component: HistoryPageComponent },
      { path: 'traceability',    component: TraceabilityPageComponent },
      { path: 'rapports',        component: RapportsPageComponent },
      // Écran détail 2-colonnes (attestations → valider → signer), ciblé par « Valider » du
      // Centre d'action : la validation garde son circuit à deux temps, jamais court-circuitée.
      { path: 'rapports/:id',    loadComponent: () => import('./pages/rapports/rapport-detail.component').then(m => m.RapportDetailComponent) },
      { path: 'rapports-recus',  component: RapportsOfficielsComponent },
      { path: 'interventions',   component: InterventionsPageComponent },
      // Section Gouvernance : shell à sous-navigation (onglets) + vue d'ensemble en index.
      // Les paths des enfants sont relatifs → les URLs /admin/governance/* restent inchangées.
      {
        path: 'governance',
        loadComponent: () => import('./pages/governance/dashboard/governance-shell.component').then(m => m.GovernanceShellComponent),
        children: [
          { path: '',                          component: GovernancePageComponent },
          { path: 'territoire',                loadComponent: () => import('./pages/governance/territoire/territoire.component').then(m => m.TerritoireComponent) },
          { path: 'zones/:zoneId/recensement', loadComponent: () => import('./pages/governance/recensement/recensement.component').then(m => m.RecensementComponent) },
          { path: 'zones/:zoneId/liaison',     loadComponent: () => import('./pages/governance/liaison/liaison-zone.component').then(m => m.LiaisonZoneComponent) },
          { path: 'institutions/urd/:urdId',   loadComponent: () => import('./pages/governance/institutions/urd-detail/urd-detail.component').then(m => m.UrdDetailComponent) },
          { path: 'institutions',              loadComponent: () => import('./pages/governance/institutions/institutions.component').then(m => m.InstitutionsComponent) },
          { path: 'utilisateurs',              loadComponent: () => import('./pages/governance/utilisateurs/utilisateurs.component').then(m => m.UtilisateursComponent) },
          { path: 'regles',                    loadComponent: () => import('./pages/governance/regles-sla/regles-sla.component').then(m => m.ReglesSlaComponent) },
          { path: 'conformite',                loadComponent: () => import('./pages/governance/conformite/conformite.component').then(m => m.ConformiteComponent) },
          { path: 'politiques',                loadComponent: () => import('./pages/governance/politiques/politiques.component').then(m => m.PolitiquesComponent) },
          { path: 'audit',                     loadComponent: () => import('./pages/governance/audit/audit.component').then(m => m.AuditComponent) },
          { path: 'config',                    loadComponent: () => import('./pages/governance/config/config.component').then(m => m.GovConfigComponent) },
        ],
      },
      {
        path: 'config',
        component: ConfigPageComponent,
        canActivate: [adminGuard],
        children: adminConfigChildren
      },
      {
        path: 'configuration',
        component: ConfigPageComponent,
        canActivate: [adminGuard],
        children: adminConfigChildren
      },
      {
        path: 'administration',
        component: ConfigPageComponent,
        canActivate: [adminGuard],
        children: adminConfigChildren
      },
      { path: 'measurement-types', redirectTo: 'config/measurement-types', pathMatch: 'full' },
      { path: 'point-types',       redirectTo: 'config/point-types',       pathMatch: 'full' },
      { path: '**', redirectTo: 'dashboard' }
    ]
  },

  /* ─────────────────────────────────────────────────────────
     BACKWARD COMPAT — old paths redirect to /admin/*
     (keeps internal page navigation working during migration)
  ───────────────────────────────────────────────────────── */
  { path: 'dashboard',       redirectTo: '/admin/dashboard',       pathMatch: 'full' },
  { path: 'supervision',     redirectTo: '/admin/supervision',     pathMatch: 'full' },
  { path: 'alertes',         redirectTo: '/admin/alertes',         pathMatch: 'full' },
  { path: 'resources',       redirectTo: '/admin/resources',       pathMatch: 'full' },
  { path: 'infrastructures', redirectTo: '/admin/infrastructures', pathMatch: 'full' },
  { path: 'interventions',   redirectTo: '/admin/interventions',   pathMatch: 'full' },
  { path: 'rapports',        redirectTo: '/admin/rapports',        pathMatch: 'full' },
  { path: 'governance',      redirectTo: '/admin/governance',      pathMatch: 'full' },
  { path: 'traceability',    redirectTo: '/admin/traceability',    pathMatch: 'full' },
  { path: 'points',          redirectTo: '/admin/points',          pathMatch: 'full' },
  { path: 'tickets',         redirectTo: '/admin/tickets',         pathMatch: 'full' },
  { path: 'quality',         redirectTo: '/admin/quality',         pathMatch: 'full' },
  { path: 'sup',             redirectTo: '/superviseur/tableau-de-bord',     pathMatch: 'full' },
  { path: '**',              redirectTo: '/login' }
];

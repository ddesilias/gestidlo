import { Routes } from '@angular/router';

import { AlertsPageComponent } from './pages/alerts-page.component';
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
import { ConfigPageComponent } from './pages/config-page.component';
import { PointsConfigPageComponent } from './pages/points-config-page.component';
import { ThresholdsConfigPageComponent } from './pages/thresholds-config-page.component';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AdminLayoutComponent } from './layout/admin-layout.component';

const authGuard = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login']);
};

const loginGuard = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return inject(Router).createUrlTree(['/dashboard']);
  }
  return true;
};

const landingGuard = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return inject(Router).createUrlTree(['/dashboard']);
  }
  return true;
};

const adminGuard = () => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) {
    return inject(Router).createUrlTree(['/login']);
  }
  if (auth.hasRole('ADMIN')) {
    return true;
  }
  return inject(Router).createUrlTree(['/dashboard']);
};

const adminConfigChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'measurement-types' },
  { path: 'measurement-types', component: MeasurementTypesPageComponent },
  { path: 'point-types', component: PointTypesPageComponent },
  { path: 'points', component: PointsConfigPageComponent },
  { path: 'thresholds', component: ThresholdsConfigPageComponent }
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingPageComponent, canActivate: [landingGuard] },
  { path: 'login', component: LoginPageComponent, canActivate: [loginGuard] },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'supervision', component: SupervisionPageComponent },
      { path: 'alerts', component: AlertsPageComponent },
      { path: 'tickets', component: TicketsPageComponent },
      { path: 'points', component: PointsPageComponent },
      { path: 'points/:id', component: PointDetailsPageComponent },
      { path: 'resources', component: PointsPageComponent },
      { path: 'infrastructures', component: PointsPageComponent },
      { path: 'service', component: TicketsPageComponent },
      { path: 'processes', component: ProcessesPageComponent },
      { path: 'history', component: HistoryPageComponent },
      { path: 'quality', component: HistoryPageComponent },
      { path: 'traceability', component: HistoryPageComponent },
      { path: 'reports', component: HistoryPageComponent },
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
        path: 'governance',
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
      { path: 'point-types', redirectTo: 'config/point-types', pathMatch: 'full' },
      { path: '**', redirectTo: 'dashboard' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export interface AlertContext {
  source?: string;
  type?: string;
  entityId?: string;
  entityType?: string;
  dept?: string;
  commune?: string;
}

export interface ReportContext {
  type?: string;
  institutionId?: string;
  dept?: string;
  entityId?: string;
  entityType?: string;
}

export interface MapFocusContext {
  entityId?: string;
  dept?: string;
  commune?: string;
  section?: string;
}

// ── ActionCenterService ───────────────────────────────────────────────────────
// Central router for cross-page actions.
// Every "Créer alerte", "Créer rapport", "Voir fiche" button in every page calls
// one of these methods — never a page-specific navigation copy.
//
// Context objects pre-fill filters or form fields on the destination page.
// Pages read context from Router queryParams on init.

@Injectable({ providedIn: 'root' })
export class ActionCenterService {
  constructor(private readonly router: Router) {}

  navigateToAlerts(ctx?: AlertContext): void {
    const params: Record<string, string> = {};
    if (ctx?.source)     params['source']     = ctx.source;
    if (ctx?.type)       params['type']        = ctx.type;
    if (ctx?.entityId)   params['entity']      = ctx.entityId;
    if (ctx?.entityType) params['entityType']  = ctx.entityType;
    if (ctx?.dept)       params['dept']        = ctx.dept;
    if (ctx?.commune)    params['commune']     = ctx.commune;
    this.router.navigate(['/alerts'], { queryParams: params });
  }

  navigateToReports(ctx?: ReportContext): void {
    const params: Record<string, string> = {};
    if (ctx?.type)          params['type']        = ctx.type;
    if (ctx?.institutionId) params['institution'] = ctx.institutionId;
    if (ctx?.dept)          params['dept']        = ctx.dept;
    if (ctx?.entityId)      params['entity']      = ctx.entityId;
    if (ctx?.entityType)    params['entityType']  = ctx.entityType;
    this.router.navigate(['/reports'], { queryParams: params });
  }

  navigateToResource(id?: string): void {
    this.router.navigate(id ? ['/points', id] : ['/resources']);
  }

  navigateToMap(ctx?: MapFocusContext): void {
    const params: Record<string, string> = {};
    if (ctx?.entityId) params['focus']   = ctx.entityId;
    if (ctx?.dept)     params['dept']    = ctx.dept;
    if (ctx?.commune)  params['commune'] = ctx.commune;
    if (ctx?.section)  params['section'] = ctx.section;
    this.router.navigate(['/supervision'], { queryParams: params });
  }

  navigateToGovernance(institutionId?: string): void {
    const params: Record<string, string> = {};
    if (institutionId) params['institution'] = institutionId;
    this.router.navigate(['/governance'], { queryParams: params });
  }

  navigateToPoints(id?: string): void {
    this.router.navigate(id ? ['/points', id] : ['/points']);
  }

  navigateToTickets(relatedEntityId?: string): void {
    const params: Record<string, string> = {};
    if (relatedEntityId) params['entity'] = relatedEntityId;
    this.router.navigate(['/tickets'], { queryParams: params });
  }
}

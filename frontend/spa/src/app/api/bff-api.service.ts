import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class BffApiService {
  private readonly baseUrl = 'http://localhost:9083/api';

  constructor(private readonly http: HttpClient) {}

  dashboard() {
    return this.http.get<any>(`${this.baseUrl}/dashboard`);
  }

  health() {
    return this.http.get<any>(`${this.baseUrl}/health`);
  }

  realtimePoints(pointIds?: string[]) {
    let params = new HttpParams();
    for (const id of pointIds ?? []) {
      params = params.append('pointIds', id);
    }
    return this.http.get<any[]>(`${this.baseUrl}/realtime/points`, { params });
  }

  ingestMeasurement(payload: {
    pointId: string;
    sensorId: string;
    type: string;
    value: number;
    unit: string;
    timestamp?: string;
  }) {
    return this.http.post<any>(`${this.baseUrl}/iot/measurements`, payload);
  }

  alerts(status: 'ACTIVE' | 'ACK' | 'CLOSED' = 'ACTIVE') {
    return this.http.get<any>(`${this.baseUrl}/alerts`, {
      params: new HttpParams().set('status', status)
    });
  }

  ackAlert(id: number) {
    return this.http.post<any>(`${this.baseUrl}/alerts/${id}/ack`, {});
  }

  tickets() {
    return this.http.get<any>(`${this.baseUrl}/tickets`);
  }

  createTicket(alertId: number, assignee: string) {
    return this.http.post<any>(`${this.baseUrl}/tickets`, { alertId, assignee });
  }

  advanceTicket(id: number) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/advance`, {});
  }

  assignTicket(id: number, assignee: string) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/assign`, { assignee });
  }

  history(pointId: string, type: string, from: string, to: string) {
    return this.http.get<any>(`${this.baseUrl}/history/points/${pointId}`, {
      params: new HttpParams().set('type', type).set('from', from).set('to', to)
    });
  }

  referenceCodeList(listName: string) {
    return this.http.get<any[]>(`${this.baseUrl}/reference/codelists/${listName}`);
  }

  referencePoints() {
    return this.http.get<any[]>(`${this.baseUrl}/reference/points`);
  }

  upsertReferencePoint(
    id: string,
    payload: {
      name?: string | null;
      type?: string | null;
      territory?: string | null;
      lon?: number | null;
      lat?: number | null;
      description?: string | null;
      active?: boolean | null;
    }
  ) {
    return this.http.put<any>(`${this.baseUrl}/reference/points/${id}`, payload);
  }

  deleteReferencePoint(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/reference/points/${id}`);
  }

  referenceThresholds() {
    return this.http.get<any[]>(`${this.baseUrl}/reference/thresholds`);
  }

  upsertThreshold(type: string, payload: { minWarn?: number | null; minCrit?: number | null }) {
    return this.http.put<any>(`${this.baseUrl}/reference/thresholds/${type}`, payload);
  }

  upsertCodeItem(
    listName: string,
    code: string,
    payload: {
      labelFr?: string | null;
      labelHt?: string | null;
      labelEn?: string | null;
      color?: string | null;
      sortOrder?: number | null;
      active?: boolean | null;
    }
  ) {
    return this.http.put<any>(`${this.baseUrl}/reference/codelists/${listName}/${code}`, payload);
  }

  deleteCodeItem(listName: string, code: string) {
    return this.http.delete<void>(`${this.baseUrl}/reference/codelists/${listName}/${code}`);
  }

  processDefinitions() {
    return this.http.get<any[]>(`${this.baseUrl}/process-definitions`);
  }

  startProcess(definitionKey: string, variables?: Record<string, unknown>) {
    return this.http.post<any>(`${this.baseUrl}/process-instances/${definitionKey}/start`, variables ?? {});
  }

  tasks(processInstanceId: string) {
    return this.http.get<any[]>(`${this.baseUrl}/tasks`, {
      params: new HttpParams().set('processInstanceId', processInstanceId)
    });
  }

  completeTask(taskId: string, variables?: Record<string, unknown>) {
    return this.http.post<void>(`${this.baseUrl}/tasks/${taskId}/complete`, variables ?? {});
  }
}

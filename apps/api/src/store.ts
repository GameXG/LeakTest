import type {
  AiObservation,
  DnsObservation,
  FingerprintSnapshot,
  HttpObservation,
  SessionRecord,
  SessionReport,
  WebrtcObservation,
} from "./types.js";

export class InMemoryStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly fingerprints = new Map<string, FingerprintSnapshot>();
  private readonly httpObservations = new Map<string, HttpObservation[]>();
  private readonly dnsObservations = new Map<string, DnsObservation[]>();
  private readonly aiObservations = new Map<string, AiObservation[]>();
  private readonly webrtcObservations = new Map<string, WebrtcObservation[]>();
  private readonly reports = new Map<string, SessionReport>();

  setSession(session: SessionRecord): void {
    this.sessions.set(session.id, session);
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  setFingerprint(snapshot: FingerprintSnapshot): void {
    this.fingerprints.set(snapshot.sessionId, snapshot);
  }

  getFingerprint(sessionId: string): FingerprintSnapshot | undefined {
    return this.fingerprints.get(sessionId);
  }

  addHttpObservation(observation: HttpObservation): void {
    const list = this.httpObservations.get(observation.sessionId) ?? [];
    list.push(observation);
    this.httpObservations.set(observation.sessionId, list);
  }

  addHttpObservations(observations: HttpObservation[]): void {
    for (const observation of observations) {
      this.addHttpObservation(observation);
    }
  }

  getHttpObservations(sessionId: string): HttpObservation[] {
    return this.httpObservations.get(sessionId) ?? [];
  }

  addDnsObservation(observation: DnsObservation): void {
    const list = this.dnsObservations.get(observation.sessionId) ?? [];

    if (
      observation.source === "probe_endpoint_hit" &&
      observation.probeId
    ) {
      const existing = list.find(
        (item) =>
          item.source === "probe_endpoint_hit" &&
          item.targetId === observation.targetId &&
          item.probeId === observation.probeId,
      );

      if (existing) {
        return;
      }
    }

    list.push(observation);
    this.dnsObservations.set(observation.sessionId, list);
  }

  addDnsObservations(observations: DnsObservation[]): void {
    for (const observation of observations) {
      this.addDnsObservation(observation);
    }
  }

  getDnsObservations(sessionId: string): DnsObservation[] {
    return this.dnsObservations.get(sessionId) ?? [];
  }

  addAiObservation(observation: AiObservation): void {
    const list = this.aiObservations.get(observation.sessionId) ?? [];
    list.push(observation);
    this.aiObservations.set(observation.sessionId, list);
  }

  addAiObservations(observations: AiObservation[]): void {
    for (const observation of observations) {
      this.addAiObservation(observation);
    }
  }

  getAiObservations(sessionId: string): AiObservation[] {
    return this.aiObservations.get(sessionId) ?? [];
  }

  addWebrtcObservation(observation: WebrtcObservation): void {
    const list = this.webrtcObservations.get(observation.sessionId) ?? [];
    list.push(observation);
    this.webrtcObservations.set(observation.sessionId, list);
  }

  addWebrtcObservations(observations: WebrtcObservation[]): void {
    for (const observation of observations) {
      this.addWebrtcObservation(observation);
    }
  }

  getWebrtcObservations(sessionId: string): WebrtcObservation[] {
    return this.webrtcObservations.get(sessionId) ?? [];
  }

  setReport(report: SessionReport): void {
    this.reports.set(report.sessionId, report);
  }

  getReport(sessionId: string): SessionReport | undefined {
    return this.reports.get(sessionId);
  }
}

export const store = new InMemoryStore();

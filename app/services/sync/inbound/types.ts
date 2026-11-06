/** Wire format for a single pulled event from GET /api/sync/pull. */
export interface PulledField {
  name: string;
  value: string | null; // JSON-encoded or null
  hlc: string; // "wallclock:counter:actorId" wire format
}

export interface PulledEvent {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  actorId: string;
  fields: PulledField[];
  time: string; // RFC3339 event time
}

export interface InboundHandler {
  readonly entityTypes: string[];
  handle(event: PulledEvent): Promise<void>;
}

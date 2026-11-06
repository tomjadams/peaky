import type { DomainEventEnvelope } from "./DomainEvent";

export interface ReviewAnswerRecorded extends DomainEventEnvelope {
  type: "ReviewAnswerRecorded.v1";
  entityType: "review_answer";
  data: {
    questionId: string;
    answer: string | null;
    naReason?: string | null;
    itemNaReasons?: string | null;
    pillarSlug?: string;
    templateId?: string;
  };
}

export interface ReviewCheckpointSaved extends DomainEventEnvelope {
  type: "ReviewCheckpointSaved.v1";
  entityType: "review_checkpoint";
  data: {
    templateId: string;
    note?: string;
    questionsAnswered: number;
    questionsChanged: number;
    progressDelta: number;
    overallProgress: number;
    pillarSnapshots: Array<{
      slug: string;
      name: string;
      progress: number;
      totalQuestions: number;
      answeredQuestions: number;
    }>;
  };
}

export interface ReviewNoteRecorded extends DomainEventEnvelope {
  type: "ReviewNoteRecorded.v1";
  entityType: "review_note";
  data: {
    scopeType: string;
    scopeId: string;
    content: string;
  };
}

export interface ReviewNoteDeleted extends DomainEventEnvelope {
  type: "ReviewNoteDeleted.v1";
  entityType: "review_note";
  data: {
    scopeType: string;
    scopeId: string;
  };
}

export interface ReviewAttachmentUploaded extends DomainEventEnvelope {
  type: "ReviewAttachmentUploaded.v1";
  entityType: "review_attachment";
  data: {
    attachmentId: string;
    scopeType: string;
    scopeId: string;
    filename: string;
    mimeType: string;
    fileSize: number;
  };
}

export interface ReviewAttachmentDeleted extends DomainEventEnvelope {
  type: "ReviewAttachmentDeleted.v1";
  entityType: "review_attachment";
  data: {
    attachmentId: string;
    scopeType: string;
    scopeId: string;
    filename: string;
    mimeType: string;
    fileSize: number;
  };
}

export interface ReviewProgressUpdated extends DomainEventEnvelope {
  type: "ReviewProgressUpdated.v1";
  entityType: "review";
  data: {
    pillarSlug: string;
    progress: number;
  };
}

// ─── Product lifecycle events ─────────────────────────────────

export interface ProductCreated extends DomainEventEnvelope {
  type: "ProductCreated.v1";
  entityType: "product";
  data: {
    name: string;
    teamIds: string[];
    componentIds: string[];
    origin: "bespoke" | "open-source" | "vendor";
    isExternal: boolean;
    productManagerId?: string;
    engineeringLeadId?: string;
    roadmapUrl?: string;
    documentationUrl?: string;
    supportChannel?: string;
  };
}

export interface ProductUpdated extends DomainEventEnvelope {
  type: "ProductUpdated.v1";
  entityType: "product";
  data: {
    changes: Record<string, unknown>;
  };
}

export interface ProductArchived extends DomainEventEnvelope {
  type: "ProductArchived.v1";
  entityType: "product";
  data: {
    previousStatus: string;
  };
}

export interface ProductRestored extends DomainEventEnvelope {
  type: "ProductRestored.v1";
  entityType: "product";
  data: {
    previousStatus: string;
  };
}

export interface ProductDeleted extends DomainEventEnvelope {
  type: "ProductDeleted.v1";
  entityType: "product";
  data: {
    name: string;
  };
}

// ─── Template lifecycle events ────────────────────────────────

export interface TemplateDraftCreated extends DomainEventEnvelope {
  type: "TemplateDraftCreated.v1";
  entityType: "template_draft";
  data: {
    name: string;
  };
}

export interface TemplateDraftUpdated extends DomainEventEnvelope {
  type: "TemplateDraftUpdated.v1";
  entityType: "template_draft";
  data: {
    changes: Record<string, unknown>;
  };
}

export interface TemplateDraftDeleted extends DomainEventEnvelope {
  type: "TemplateDraftDeleted.v1";
  entityType: "template_draft";
  data: {
    name: string;
  };
}

export interface TemplatePublished extends DomainEventEnvelope {
  type: "TemplatePublished.v1";
  entityType: "template_draft";
  data: {
    name: string;
  };
}

export interface TemplatePillarCreated extends DomainEventEnvelope {
  type: "TemplatePillarCreated.v1";
  entityType: "template_pillar";
  data: {
    templateId: string;
    name: string;
  };
}

export interface TemplatePillarUpdated extends DomainEventEnvelope {
  type: "TemplatePillarUpdated.v1";
  entityType: "template_pillar";
  data: {
    templateId: string;
    changes: Record<string, unknown>;
  };
}

export interface TemplatePillarDeleted extends DomainEventEnvelope {
  type: "TemplatePillarDeleted.v1";
  entityType: "template_pillar";
  data: {
    templateId: string;
    name: string;
  };
}

export interface TemplateQuestionCreated extends DomainEventEnvelope {
  type: "TemplateQuestionCreated.v1";
  entityType: "template_question";
  data: {
    templateId: string;
    pillarSlug: string;
    questionId: string;
    questionText: string;
    questionType: string;
    position: number;
  };
}

export interface TemplateQuestionUpdated extends DomainEventEnvelope {
  type: "TemplateQuestionUpdated.v1";
  entityType: "template_question";
  data: {
    templateId: string;
    pillarSlug: string;
    questionId: string;
    changes: Record<string, unknown>;
  };
}

export interface TemplateQuestionDeleted extends DomainEventEnvelope {
  type: "TemplateQuestionDeleted.v1";
  entityType: "template_question";
  data: {
    templateId: string;
    pillarSlug: string;
    questionId: string;
  };
}

export interface TemplateImported extends DomainEventEnvelope {
  type: "TemplateImported.v1";
  entityType: "template_draft";
  data: {
    name: string;
    pillarCount: number;
    questionCount: number;
  };
}

// ─── Review lifecycle events ──────────────────────────────────

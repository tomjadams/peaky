import type {
  PillarNote,
  PillarAttachment,
} from "../../app/models/pillar-notes";

export interface PillarNotesData {
  notes: PillarNote;
  attachments: PillarAttachment[];
}

const pillarNotesStore: Record<string, PillarNotesData> = {
  "01932b3c-7d00-7000-8000-000000002001:infrastructure": {
    notes: {
      content:
        "We use **Terraform** for all infrastructure provisioning. Key highlights:\n- Multi-region deployment with automatic failover\n- Auto-scaling configured for peak traffic\n- All secrets stored in Secrets Manager",
      updatedAt: "2026-01-15T10:30:00Z",
    },
    attachments: [
      {
        id: "01932b3c-7d00-7000-8000-000000007001",
        filename: "Infrastructure_Architecture.pdf",
        contentType: "application/pdf",
        sizeBytes: 2457600,
        objectKey:
          "reviews/01932b3c-7d00-7000-8000-000000002001/pillars/infrastructure/01932b3c-7d00-7000-8000-000000007001.pdf",
        createdBy: "user-001",
        createdByName: "Sarah Chen",
        createdAt: "2026-01-10T14:00:00Z",
      },
    ],
  },
  "01932b3c-7d00-7000-8000-000000002001:reliability": {
    notes: {
      content:
        "Circuit breakers implemented using *Resilience4j*. SLO targets:\n- Availability: 99.9%\n- P99 latency: < 500ms",
      updatedAt: "2026-01-20T09:15:00Z",
    },
    attachments: [
      {
        id: "01932b3c-7d00-7000-8000-000000007002",
        filename: "Load_Test_Results.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 862208,
        objectKey:
          "reviews/01932b3c-7d00-7000-8000-000000002001/pillars/reliability/01932b3c-7d00-7000-8000-000000007002.xlsx",
        createdBy: "user-002",
        createdByName: "Marcus Johnson",
        createdAt: "2026-01-18T16:45:00Z",
      },
      {
        id: "01932b3c-7d00-7000-8000-000000007003",
        filename: "Chaos_Engineering_Report.pdf",
        contentType: "application/pdf",
        sizeBytes: 1245184,
        objectKey:
          "reviews/01932b3c-7d00-7000-8000-000000002001/pillars/reliability/01932b3c-7d00-7000-8000-000000007003.pdf",
        createdBy: "advisor-001",
        createdByName: "Elena Kowalski",
        createdAt: "2026-01-19T11:30:00Z",
      },
    ],
  },
};

export function getPillarNotes(
  reviewId: string,
  pillarSlug: string
): PillarNotesData {
  const key = `${reviewId}:${pillarSlug}`;
  return (
    pillarNotesStore[key] || {
      notes: { content: "", updatedAt: "" },
      attachments: [],
    }
  );
}

export function savePillarNotes(
  reviewId: string,
  pillarSlug: string,
  content: string
): PillarNote {
  const key = `${reviewId}:${pillarSlug}`;
  const now = new Date().toISOString();

  if (!pillarNotesStore[key]) {
    pillarNotesStore[key] = {
      notes: { content: "", updatedAt: "" },
      attachments: [],
    };
  }

  pillarNotesStore[key].notes = {
    content,
    updatedAt: now,
  };

  return pillarNotesStore[key].notes;
}

let nextAttachmentId = 100;

export function addAttachment(
  reviewId: string,
  pillarSlug: string,
  attachment: Omit<PillarAttachment, "id">
): PillarAttachment {
  const key = `${reviewId}:${pillarSlug}`;
  const id = `att-${String(nextAttachmentId++).padStart(3, "0")}`;

  if (!pillarNotesStore[key]) {
    pillarNotesStore[key] = {
      notes: { content: "", updatedAt: "" },
      attachments: [],
    };
  }

  const newAttachment: PillarAttachment = {
    id,
    ...attachment,
  };

  pillarNotesStore[key].attachments.push(newAttachment);
  return newAttachment;
}

export function saveAttachment(
  reviewId: string,
  pillarSlug: string,
  attachment: PillarAttachment
): PillarAttachment {
  const key = `${reviewId}:${pillarSlug}`;

  if (!pillarNotesStore[key]) {
    pillarNotesStore[key] = {
      notes: { content: "", updatedAt: "" },
      attachments: [],
    };
  }

  const existingIndex = pillarNotesStore[key].attachments.findIndex(
    (existingAttachment) => existingAttachment.id === attachment.id
  );

  if (existingIndex === -1) {
    pillarNotesStore[key].attachments.push(attachment);
    return attachment;
  }

  pillarNotesStore[key].attachments.splice(existingIndex, 1, attachment);
  return attachment;
}

export function deleteAttachment(
  reviewId: string,
  pillarSlug: string,
  attachmentId: string
): boolean {
  const key = `${reviewId}:${pillarSlug}`;
  const data = pillarNotesStore[key];

  if (!data) return false;

  const index = data.attachments.findIndex((a) => a.id === attachmentId);
  if (index === -1) return false;

  data.attachments.splice(index, 1);
  return true;
}

export function getAttachmentById(
  attachmentId: string
): PillarAttachment | null {
  for (const data of Object.values(pillarNotesStore)) {
    const attachment = data.attachments.find((a) => a.id === attachmentId);
    if (attachment) return attachment;
  }
  return null;
}

/**
 * Get all pillar notes for a review.
 * Returns array of pillar notes with reviewId and pillarSlug.
 */
export function getPillarNotesByReviewId(
  reviewId: string
): Array<{ id: string; pillarSlug: string; note?: string }> {
  const results: Array<{ id: string; pillarSlug: string; note?: string }> = [];

  for (const [key, data] of Object.entries(pillarNotesStore)) {
    if (key.startsWith(`${reviewId}:`)) {
      const pillarSlug = key.slice(reviewId.length + 1);
      if (data.notes.content) {
        results.push({
          id: key,
          pillarSlug,
          note: data.notes.content,
        });
      }
    }
  }

  return results;
}

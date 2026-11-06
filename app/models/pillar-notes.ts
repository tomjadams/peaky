export interface PillarNote {
  content: string;
  updatedAt: string;
}

export interface PillarAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface PillarNotesResponse {
  notes: PillarNote;
  attachments: PillarAttachment[];
}

export interface SavePillarNotesRequest {
  content: string;
}

export interface UploadAttachmentResponse {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

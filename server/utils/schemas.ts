import { z } from "zod";

export const savePillarNotesSchema = z.object({
  content: z.string().max(50000),
});

export const uploadAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z
    .string()
    .refine(
      (type) =>
        [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "image/png",
          "image/jpeg",
        ].includes(type),
      { message: "Only PDF, XLSX, XLS, PNG, and JPEG files are supported" }
    ),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, "File exceeds 10MB limit"),
});

export type SavePillarNotesInput = z.infer<typeof savePillarNotesSchema>;
export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;

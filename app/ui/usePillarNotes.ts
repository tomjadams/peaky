import type {
  PillarNote,
  PillarAttachment,
  PillarNotesResponse,
} from "~/models";
import { attachmentMutations } from "~/services/entity/AttachmentMutations";
import { noteMutations } from "~/services/entity/NoteMutations";

const PILLAR_NOTE_SCOPE = "pillar" as const;

export function usePillarNotes(reviewId: string, pillarSlug: string) {
  const notes = ref<PillarNote>({ content: "", updatedAt: "" });
  const attachments = ref<PillarAttachment[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<Error | null>(null);

  const apiUrl = computed(
    () => `/api/reviews/${reviewId}/pillars/${pillarSlug}/notes`
  );

  async function loadLocalState(): Promise<{
    noteFound: boolean;
    attachmentCount: number;
  }> {
    const [localNote, localAttachments] = await Promise.all([
      noteMutations.fetchByScope(reviewId, PILLAR_NOTE_SCOPE, pillarSlug),
      attachmentMutations.fetchForScope(
        reviewId,
        PILLAR_NOTE_SCOPE,
        pillarSlug
      ),
    ]);

    notes.value = localNote
      ? {
          content: localNote.content,
          updatedAt: localNote.updatedAt,
        }
      : { content: "", updatedAt: "" };
    attachments.value = localAttachments;

    return {
      noteFound: localNote !== null,
      attachmentCount: localAttachments.length,
    };
  }

  async function fetch() {
    loading.value = true;
    error.value = null;
    try {
      const localState = await loadLocalState();

      if (localState.noteFound && localState.attachmentCount > 0) {
        return;
      }

      const data = await $fetch<PillarNotesResponse>(apiUrl.value);
      if (!localState.noteFound) {
        notes.value = data.notes;
      }

      if (localState.attachmentCount === 0) {
        attachments.value = data.attachments;
      }

      await Promise.all([
        noteMutations.seed({
          reviewId,
          scopeType: PILLAR_NOTE_SCOPE,
          scopeId: pillarSlug,
          content: data.notes.content,
          updatedAt: data.notes.updatedAt,
        }),
        attachmentMutations.seed(
          reviewId,
          PILLAR_NOTE_SCOPE,
          pillarSlug,
          data.attachments
        ),
      ]);
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  }

  async function save(): Promise<boolean> {
    saving.value = true;
    error.value = null;
    try {
      await noteMutations.save(
        reviewId,
        PILLAR_NOTE_SCOPE,
        pillarSlug,
        notes.value.content
      );

      const savedNote = await noteMutations.fetchByScope(
        reviewId,
        PILLAR_NOTE_SCOPE,
        pillarSlug
      );

      notes.value = savedNote
        ? {
            content: savedNote.content,
            updatedAt: savedNote.updatedAt,
          }
        : { content: notes.value.content, updatedAt: new Date().toISOString() };
      return true;
    } catch (err) {
      error.value = err as Error;
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function uploadAttachment(
    file: File
  ): Promise<PillarAttachment | null> {
    error.value = null;
    try {
      const attachment = await attachmentMutations.create(
        reviewId,
        PILLAR_NOTE_SCOPE,
        pillarSlug,
        file
      );
      attachments.value.push(attachment);
      return attachment;
    } catch (err) {
      error.value = err as Error;
      return null;
    }
  }

  async function removeAttachment(attachmentId: string): Promise<boolean> {
    error.value = null;
    try {
      const deleted = await attachmentMutations.delete(reviewId, attachmentId);

      if (!deleted) {
        return false;
      }

      attachments.value = attachments.value.filter(
        (a) => a.id !== attachmentId
      );
      return true;
    } catch (err) {
      error.value = err as Error;
      return false;
    }
  }

  function hasNotes(): boolean {
    return (
      notes.value.content.trim().length > 0 || attachments.value.length > 0
    );
  }

  onMounted(fetch);

  return {
    notes,
    attachments,
    loading,
    saving,
    error,
    save,
    uploadAttachment,
    removeAttachment,
    hasNotes,
    refresh: fetch,
  };
}

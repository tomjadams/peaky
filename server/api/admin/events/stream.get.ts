import { subscribeToAdminEvents } from "../../../data/admin-events-stream";
import { getLifecycleActor } from "../../../utils/lifecycleActor";

function formatSseMessage(event: string, data: Record<string, string>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default defineEventHandler(async (event) => {
  const actor = await getLifecycleActor(event);

  if (!actor.roles.includes("admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admins can live-tail audit events",
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const write = (payload: string) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(payload));
      };

      write(
        formatSseMessage("connected", {
          type: "connected",
          time: new Date().toISOString(),
        })
      );

      const unsubscribe = subscribeToAdminEvents((payload) => {
        write(formatSseMessage("admin-events", payload));
      });

      const heartbeat = setInterval(() => {
        write(": keep-alive\n\n");
      }, 15000);

      const cleanup = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      event.node.req.on("close", cleanup);
      event.node.req.on("error", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream",
    },
  });
});

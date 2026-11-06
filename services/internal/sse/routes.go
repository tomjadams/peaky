package sse

import (
	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/option"

	"github.com/peaky-team/peaky/services/internal/ssecontract"
)

// RegisterRoutes mounts the SSE stream at /api/sse/events.
func RegisterRoutes(s *fuego.Server, h *Handler) {
	fuego.GetStd(s, "/api/sse/events", h.Events,
		option.Tags("sse"),
		option.Summary("Server-Sent Events stream for sync cursor notifications"),
		option.AddResponse(200, "SSE stream of cursor notifications", fuego.Response{
			Type:         ssecontract.CursorNotification{},
			ContentTypes: []string{"text/event-stream"},
		}),
		option.AddResponse(403, "Actor has no entitled channels", fuego.Response{
			Type:         fuego.HTTPError{},
			ContentTypes: []string{"application/json"},
		}),
	)
}

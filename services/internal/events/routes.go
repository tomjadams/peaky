package events

import (
	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/option"
)

// RegisterRoutes mounts GET /api/events.
func RegisterRoutes(s *fuego.Server, h *Handlers) {
	fuego.Get(s, "/api/events", h.List,
		option.Tags("events"),
	)
}

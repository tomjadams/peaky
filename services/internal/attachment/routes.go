package attachment

import (
	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/option"
)

// RegisterRoutes mounts GET /api/attachments/{id}/download.
func RegisterRoutes(s *fuego.Server, h *Handlers) {
	fuego.Get(s, "/api/attachments/{id}/download", h.Download,
		option.Tags("attachments"),
	)
}

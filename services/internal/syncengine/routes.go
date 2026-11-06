package syncengine

import (
	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/option"
)

// RegisterRoutes mounts the sync endpoints under /api/sync.
func RegisterRoutes(s *fuego.Server, h *Handlers) {
	g := fuego.Group(s, "/api/sync")
	fuego.Get(g, "/bootstrap", h.Bootstrap,
		option.Tags("sync"),
		option.Summary("Bootstrap actor identity and entitlement snapshot"),
	)
	fuego.Post(g, "/push", h.Push,
		option.Tags("sync"),
		option.Summary("Push local outbox events"),
	)
	fuego.Get(g, "/pull", h.Pull,
		option.Tags("sync"),
		option.Summary("Pull server events since cursor"),
	)
	fuego.Get(g, "/entitlements", h.Entitlements,
		option.Tags("sync"),
		option.Summary("Refresh actor entitlement snapshot"),
	)
}

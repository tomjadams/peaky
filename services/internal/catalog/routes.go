package catalog

import (
	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/option"
)

// RegisterRoutes mounts the catalog-directory-mirror endpoints.
func RegisterRoutes(s *fuego.Server, h *Handlers) {
	g := fuego.Group(s, "/api/catalog-directory-mirror")
	fuego.Get(g, "", h.Bootstrap, option.Tags("catalog"))
	fuego.Get(g, "/meta", h.Meta, option.Tags("catalog"))
	fuego.Get(g, "/users", h.Users, option.Tags("catalog"))
	fuego.Get(g, "/groups", h.Groups, option.Tags("catalog"))
	fuego.Get(g, "/components", h.Components, option.Tags("catalog"))
}

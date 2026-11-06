package ssecontract

import "testing"

func TestCatalogChannelFormat(t *testing.T) {
	if got := CatalogChannel("review"); got != "sync:review:catalog" {
		t.Fatalf("expected sync:review:catalog, got %q", got)
	}
}

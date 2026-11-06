package repo_test

import "github.com/peaky-team/peaky/services/internal/syncengine/repo"

// Shared test helpers used by both the fake-repo unit tests (default build)
// and the Postgres integration tests (//go:build integration). This file
// carries no build tag so the helpers are available in both configurations.

// entityIDs collects the EntityID of each pull event for easy assertion.
func entityIDs(events []repo.PullEvent) []string {
	ids := make([]string, len(events))
	for i, ev := range events {
		ids[i] = ev.EntityID
	}
	return ids
}

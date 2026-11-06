// Package conflict implements field-level HLC conflict resolution.
//
// Wire format:  "wallclock:counter:actorId"  (e.g. "1716220800000:0001:actor_alice")
// Storage format: "wallclock:counter"        (actor_id is a separate column)
//
// Comparison is purely lexicographic on the zero-padded string, which gives
// correct ordering without integer parsing — resistant to malformed input.
package conflict

import (
	"context"
	"fmt"
	"strings"

	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

const (
	hlcWireParts    = 3
	hlcStorageParts = 2
	counterWidth    = 4 // zero-padded: "0001"
)

// ParseWire splits a wire-format HLC "wallclock:counter:actorId" into its
// components. Returns an error for malformed input so callers can reject
// push events early rather than silently accepting bad data.
func ParseWire(hlc string) (wallclock, counter, actorID string, err error) {
	parts := strings.SplitN(hlc, ":", hlcWireParts)
	if len(parts) != hlcWireParts || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		return "", "", "", fmt.Errorf("invalid HLC %q: expected wallclock:counter:actorId", hlc)
	}
	return parts[0], parts[1], parts[2], nil
}

// ParseStorage splits a storage-format HLC "wallclock:counter" into its parts.
func ParseStorage(hlc string) (wallclock, counter string, err error) {
	parts := strings.SplitN(hlc, ":", hlcStorageParts)
	if len(parts) != hlcStorageParts {
		return "", "", fmt.Errorf("invalid storage HLC %q: expected wallclock:counter", hlc)
	}
	return parts[0], parts[1], nil
}

// ToStorage converts a wire-format HLC to the storage format (strips actorId).
func ToStorage(wireHLC string) (string, error) {
	wallclock, counter, _, err := ParseWire(wireHLC)
	if err != nil {
		return "", err
	}
	return wallclock + ":" + counter, nil
}

// CompareWire returns:
//
//	+1 if a > b  (a is newer or wins tiebreaker)
//	-1 if a < b  (b is newer or wins tiebreaker)
//	 0 if equal
//
// Comparison is lexicographic. For equal wallclock+counter, actorId breaks
// the tie — higher actorId wins (deterministic, consistent across all nodes).
func CompareWire(a, b string) int {
	return strings.Compare(a, b)
}

// WinsOver reports whether incoming (wire format) beats stored (storage format
// + storedActorID). Used by the push handler for each field.
//
// Incoming wins when:
//   - its wallclock:counter is strictly greater, OR
//   - wallclock:counter are equal AND its actorId is lexicographically greater
func WinsOver(incomingWire, storedStorage, storedActorID string) (bool, error) {
	wallIn, ctrIn, actorIn, err := ParseWire(incomingWire)
	if err != nil {
		return false, err
	}

	wallStored, ctrStored, err := ParseStorage(storedStorage)
	if err != nil {
		// No stored version yet — incoming wins unconditionally
		return true, nil
	}

	incomingFull := wallIn + ":" + ctrIn + ":" + actorIn
	storedFull := wallStored + ":" + ctrStored + ":" + storedActorID

	return CompareWire(incomingFull, storedFull) > 0, nil
}

// Generate creates a new storage-format HLC guaranteed to be monotonically
// greater than last. wallclock is the current Unix milliseconds as a string.
// counter is zero-padded to counterWidth digits.
//
// This is used server-side when the server needs to stamp a field (rare in
// Phase 1 — most HLCs originate on the client).
func Generate(wallclockMs int64, lastStorage string) (string, error) {
	wallStr := fmt.Sprintf("%d", wallclockMs)

	if lastStorage == "" {
		return fmt.Sprintf("%s:%0*d", wallStr, counterWidth, 0), nil
	}

	lastWall, lastCtr, err := ParseStorage(lastStorage)
	if err != nil {
		return fmt.Sprintf("%s:%0*d", wallStr, counterWidth, 0), nil
	}

	if wallStr > lastWall {
		// Wall clock advanced — reset counter
		return fmt.Sprintf("%s:%0*d", wallStr, counterWidth, 0), nil
	}

	// Same or lagging wall clock — increment counter.
	// On parse failure ctr stays 0, which is safe: the new HLC will still be
	// greater than the last due to the wall clock component.
	var ctr int
	if _, err := fmt.Sscanf(lastCtr, "%d", &ctr); err != nil {
		ctr = 0
	}
	ctr++

	// Guard: if counter overflows past counterWidth digits, lexicographic
	// ordering breaks ("10000" < "9999" as strings). Advance the wallclock
	// by 1ms and reset the counter instead.
	maxCounter := 1
	for range counterWidth {
		maxCounter *= 10
	}
	if ctr >= maxCounter {
		var lastWallMs int64
		if _, err := fmt.Sscanf(lastWall, "%d", &lastWallMs); err == nil {
			return fmt.Sprintf("%d:%0*d", lastWallMs+1, counterWidth, 0), nil
		}
	}

	return fmt.Sprintf("%s:%0*d", lastWall, counterWidth, ctr), nil
}

// FieldResult is the per-field outcome of a push.
type FieldResult struct {
	Name     string
	Accepted bool
	Reason   string // non-empty when Accepted==false
}

// ApplyFields iterates the pushed fields for one entity, resolves per-field
// HLC conflicts, and persists accepted fields.
//
// Returns the per-field results. Errors are reserved for hard storage
// failures — HLC rejections are soft outcomes (Accepted=false).
func ApplyFields(
	ctx context.Context,
	r repo.SyncRepo,
	entityType, entityID, actorID string,
	fields []repo.FieldValue,
) ([]FieldResult, error) {
	results := make([]FieldResult, 0, len(fields))

	for _, f := range fields {
		result, err := applyField(ctx, r, entityType, entityID, actorID, f)
		if err != nil {
			return results, fmt.Errorf("apply field %q on %s/%s: %w",
				f.Name, entityType, entityID, err)
		}
		results = append(results, result)
	}

	return results, nil
}

func applyField(
	ctx context.Context,
	r repo.SyncRepo,
	entityType, entityID, actorID string,
	f repo.FieldValue,
) (FieldResult, error) {
	existing, err := r.GetFieldVersion(ctx, entityType, entityID, f.Name)
	if err != nil {
		return FieldResult{}, fmt.Errorf("get field version %s/%s/%s: %w", entityType, entityID, f.Name, err)
	}

	var storedHLC, storedActorID string
	if existing != nil {
		storedHLC = existing.HLC
		storedActorID = existing.ActorID
	}

	wins, err := WinsOver(f.HLC, storedHLC, storedActorID)
	if err != nil {
		return FieldResult{
			Name:     f.Name,
			Accepted: false,
			Reason:   fmt.Sprintf("malformed HLC: %v", err),
		}, nil
	}

	if !wins {
		return FieldResult{
			Name:     f.Name,
			Accepted: false,
			Reason:   "hlc_conflict",
		}, nil
	}

	storageHLC, err := ToStorage(f.HLC)
	if err != nil {
		return FieldResult{}, err
	}

	fv := repo.FieldVersion{
		EntityType: entityType,
		EntityID:   entityID,
		FieldName:  f.Name,
		Value:      f.Value,
		HLC:        storageHLC,
		ActorID:    actorID,
	}

	if err := r.UpsertFieldVersion(ctx, fv); err != nil {
		return FieldResult{}, fmt.Errorf("upsert field version %s/%s/%s: %w", entityType, entityID, f.Name, err)
	}

	return FieldResult{Name: f.Name, Accepted: true}, nil
}

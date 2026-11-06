package events

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// Repo is the persistence interface required by the events handler.
type Repo interface {
	// ListEvents returns CloudEvent records for entities the actor can view.
	// If allowAll is true, entitledIDs is ignored and no review_id filter is applied.
	ListEvents(ctx context.Context, actorID string, entitledIDs []string, after string, limit int, allowAll bool) ([]EventRecord, bool, error)
}

// PostgresEventsRepo implements Repo against a PostgreSQL database.
type PostgresEventsRepo struct {
	db *sql.DB
}

// NewPostgresEventsRepo constructs a production events repo.
func NewPostgresEventsRepo(db *sql.DB) *PostgresEventsRepo {
	return &PostgresEventsRepo{db: db}
}

func (r *PostgresEventsRepo) ListEvents(ctx context.Context, actorID string, entitledIDs []string, after string, limit int, allowAll bool) ([]EventRecord, bool, error) {
	// Build numbered placeholders for PostgreSQL ($1, $2, ...).
	// $1 = actorID, $2..$N = entitledIDs, $N+1 = after (or epoch), $N+2 = limit+1
	args := make([]any, 0, len(entitledIDs)+3)
	args = append(args, actorID)

	var authClause string
	if allowAll {
		authClause = "actor_id = $1"
	} else if len(entitledIDs) > 0 {
		parts := make([]string, len(entitledIDs))
		for i, id := range entitledIDs {
			parts[i] = fmt.Sprintf("$%d", len(args)+1)
			args = append(args, id)
		}
		authClause = fmt.Sprintf("(actor_id = $1 OR review_id IN (%s))", strings.Join(parts, ","))
	} else {
		// No entitlements and not allow-all — restrict to actor's own events only
		authClause = "actor_id = $1"
	}

	afterPos := len(args) + 1
	limitPos := afterPos + 1

	// Use epoch as the lower bound when no cursor is provided.
	afterVal := "1970-01-01T00:00:00Z"
	if after != "" {
		afterVal = after
	}
	args = append(args, afterVal, limit+1)

	//nolint:gosec // authClause contains only "$N" positional placeholders, not user input.
	query := fmt.Sprintf(`
		SELECT id, specversion, dataschema, review_id, event_type, actor_type, actor_id,
		       client_id, data, time, hlc, status, source, entity_type, entity_id
		FROM events
		WHERE %s
		  AND time > $%d::timestamptz
		ORDER BY time DESC
		LIMIT $%d`, authClause, afterPos, limitPos)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, false, fmt.Errorf("list events: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var records []EventRecord
	for rows.Next() {
		var ev EventRecord
		var t time.Time
		if err := rows.Scan(
			&ev.ID, &ev.SpecVersion, &ev.DataSchema, &ev.ReviewID,
			&ev.EventType, &ev.ActorType, &ev.ActorID, &ev.ClientID,
			&ev.Data, &t, &ev.HLC, &ev.Status, &ev.Source,
			&ev.EntityType, &ev.EntityID,
		); err != nil {
			return nil, false, fmt.Errorf("scan event: %w", err)
		}
		ev.Time = t.UTC().Format(time.RFC3339Nano)
		records = append(records, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, false, fmt.Errorf("list events rows: %w", err)
	}

	hasMore := len(records) > limit
	if hasMore {
		records = records[:limit]
	}
	return records, hasMore, nil
}

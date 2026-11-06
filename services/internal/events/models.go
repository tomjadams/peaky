package events

// EventRecord is a raw CloudEvents v1.0.2 row returned to the client.
type EventRecord struct {
	ID          string  `json:"id"`
	SpecVersion string  `json:"specversion"`
	DataSchema  *string `json:"dataschema,omitempty"`
	ReviewID    *string `json:"reviewId,omitempty"`
	EventType   string  `json:"type"`
	ActorType   string  `json:"actorType"`
	ActorID     string  `json:"actorId"`
	ClientID    *string `json:"clientId,omitempty"`
	Data        *string `json:"data,omitempty"`
	Time        string  `json:"time"`
	HLC         *string `json:"hlc,omitempty"`
	Status      string  `json:"status"`
	Source      string  `json:"source"`
	EntityType  *string `json:"entityType,omitempty"`
	EntityID    *string `json:"entityId,omitempty"`
}

type eventsResponse struct {
	Events  []EventRecord `json:"events"`
	HasMore bool          `json:"hasMore"`
}

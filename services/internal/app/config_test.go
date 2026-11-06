package app_test

import (
	"testing"

	"github.com/peaky-team/peaky/services/internal/app"
)

func TestConfigFromEnv_ProviderHandoffIntegrationDefaultsDisabled(t *testing.T) {
	// authorization/REQ-007; improvement-plans/AC-035: the private provider
	// handoff capability ships disabled. It is a server-only env var — never
	// a public runtime config key — so handoff UI availability can never
	// authorize a provider operation.
	t.Setenv("PROVIDER_HANDOFF_INTEGRATION_ENABLED", "")
	if app.ConfigFromEnv().ProviderHandoffIntegrationEnabled {
		t.Error("capability must default to disabled when the env var is unset")
	}
}

func TestConfigFromEnv_ProviderHandoffIntegrationEnabledOnlyByExactTrue(t *testing.T) {
	// Fail-closed parsing: only the exact value "true" enables the
	// capability; anything else — "1", "TRUE", "yes" — stays disabled.
	for _, value := range []string{"1", "TRUE", "yes", "on", "enabled"} {
		t.Setenv("PROVIDER_HANDOFF_INTEGRATION_ENABLED", value)
		if app.ConfigFromEnv().ProviderHandoffIntegrationEnabled {
			t.Errorf("env value %q must not enable the capability", value)
		}
	}

	t.Setenv("PROVIDER_HANDOFF_INTEGRATION_ENABLED", "true")
	if !app.ConfigFromEnv().ProviderHandoffIntegrationEnabled {
		t.Error("env value \"true\" must enable the capability")
	}
}

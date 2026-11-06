// Package apiui provides OpenAPI UI handlers for the Peaky HTTP services.
package apiui

import (
	"fmt"
	"net/http"
)

// ScalarUI returns an http.Handler that serves the Scalar API reference page
// for the given OpenAPI spec URL. Both peaky-api and peaky-sse use this
// to replace Fuego's default Stoplight Elements with the same sleek Scalar
// UI that was previously served by the Echo-based docs package.
func ScalarUI(specURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = fmt.Fprintf(w, scalarHTML, specURL)
	})
}

const scalarHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Peaky API Reference</title>
</head>
<body>
  <script id="api-reference" data-url="%s"></script>
  <script>
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
    document.head.appendChild(s);
  </script>
</body>
</html>`

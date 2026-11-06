> **Note:** The `specs/layout/` domain no longer exists. PWA support requirements now live in `openspec/specs/common-ui/spec.md`.

# layout Specification Delta

## ADDED Requirements

### Requirement: Progressive Web App Support

The application SHALL be installable as a Progressive Web App (PWA) from supported browsers, providing a standalone desktop-like experience.

#### Scenario: PWA manifest configuration
- **WHEN** the application is loaded in a browser
- **THEN** a valid web manifest is served with app metadata
- **AND** the manifest includes `name` set to "Operational Readiness Review"
- **AND** the manifest includes `short_name` set to "ORR"
- **AND** the manifest includes `display` set to "standalone"
- **AND** the manifest includes appropriate theme and background colors

#### Scenario: PWA icon assets
- **WHEN** the PWA manifest is loaded
- **THEN** icons are provided in 192x192 and 512x512 sizes
- **AND** icons display the ORR branding (checkmark above "ORR" text)
- **AND** icons use a dark slate background (#0f172a) matching the app theme
- **AND** a maskable icon variant is included for adaptive icon support

#### Scenario: PWA installation prompt
- **WHEN** a user visits the application in a supported browser (Chrome, Edge)
- **THEN** the browser displays an install prompt or icon in the address bar
- **AND** clicking the install prompt initiates the PWA installation flow
- **AND** after installation, the app opens in a standalone window

#### Scenario: Service worker registration
- **WHEN** the application loads
- **THEN** a service worker is registered for offline caching
- **AND** static assets (JS, CSS, HTML, images) are cached for offline access
- **AND** the service worker uses auto-update strategy for seamless updates

#### Scenario: PWA development mode
- **WHEN** running the application in development mode
- **THEN** the PWA service worker is enabled for testing
- **AND** the manifest and icons are accessible at their configured paths
- **AND** developers can test installation flow locally

### Requirement: Consistent Application Branding

The application SHALL use consistent branding across all icon touchpoints.

#### Scenario: Favicon configuration
- **WHEN** the application is loaded in a browser tab
- **THEN** the favicon displays the ORR branded icon
- **AND** the favicon matches the PWA icon design
- **AND** the favicon is provided in SVG format for sharp rendering

#### Scenario: Icon design consistency
- **WHEN** displaying any application icon (favicon, PWA, sidebar)
- **THEN** all icons use the same visual design language
- **AND** the checkmark is positioned above the "ORR" text
- **AND** colors are consistent: indigo checkmark (#6366f1), light text (#f1f5f9), dark background (#0f172a)

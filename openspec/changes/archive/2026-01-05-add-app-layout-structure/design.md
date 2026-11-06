# Layout Design

## Context
The ORR application needs a consistent layout structure that provides a professional user experience while accommodating all the necessary UI components. The layout should be responsive and follow modern web application design patterns.

## Reference Implementation
A complete reference implementation has been provided in `good_menu.html`. This implementation demonstrates:

- A Discord-inspired left sidebar with logo at the top
- Compact navigation with icon-only display and hover tooltips
- A clean header with title, subtitle, and user controls
- A well-structured main content area with survey progress indicator
- Responsive design patterns that work across device sizes

This reference implementation will serve as the basis for our layout structure.

## Goals / Non-Goals

### Goals
- Create a clean, professional layout structure for the ORR application
- Implement a Discord-inspired sidebar for navigation as shown in the reference implementation
- Provide a main content area with sufficient space for application content
- Add a hidden right sidebar that can be toggled for additional functionality
- Apply the defined color palette for consistent styling
- Ensure the layout is responsive across different device sizes

### Non-Goals
- Implementing specific functionality within the layout components (placeholder content only)
- Creating complex animations or transitions
- Building a complete theming system (only applying the defined color palette)

## Decisions

### Layout Structure
We will implement a three-column layout structure based on the reference implementation:
1. Left sidebar (always visible on desktop, collapsible on mobile)
   - Fixed width of 80px (w-20) with icon-only navigation
   - Logo at the top with app name
   - Navigation items with hover tooltips
   - User profile at the bottom
2. Main content area (flexible width)
   - Header with title, subtitle, and user controls
   - Content container with appropriate padding
   - Footer with navigation buttons when needed
3. Right sidebar (hidden by default, can be toggled)

### Component Architecture
- Create reusable layout components that can be composed together
- Use Nuxt's layout system for consistent application structure
- Implement responsive behavior using CSS Grid and Flexbox
- Follow the structure demonstrated in the reference implementation

### Visual Design
From the reference implementation, we will adopt:
- Compact sidebar (80px width) with centered icons and tooltips on hover
- Active state highlighting with primary color background (bg-primary/10)
- Clean header with title/subtitle pattern
- Progress indicator for multi-step processes
- Consistent spacing and typography

## Layout Mockups

### Default View (Multi-Question)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────┐  ┌─────────────────────────────────┐  ┌─────────┐  │
│  │   ORR   │  │ ORR: Project Phoenix            │  │         │  │
│  │    ✓    │  │ Complete the readiness checks   │  │         │  │
│  │         │  │                                 │  │         │  │
│  ├─────────┤  │ Progress                        │  │         │  │
│  │         │  │ [===========60%===========]     │  │         │  │
│  │    🏠   │  │ 30 of 50 checks completed       │  │  RIGHT  │  │
│  │         │  │                                 │  │         │  │
│  │    📋   │  │ Security                        │  │ SIDEBAR │  │
│  │         │  │ -------------------------       │  │         │  │
│  │    ⚙️    │  │ ▼ Have all credentials been... │  │ (Hidden │  │
│  │         │  │   [Yes] [No] [N/A]              │  │    by   │  │
│  │         │  │ ▼ Is Two-Factor Auth enforced?  │  │ default)│  │
│  │         │  │   [Yes] [No] [N/A]              │  │         │  │
│  │    👤    │  │ ▼ Are security logs monitored? │  │         │  │
│  └─────────┘  └─────────────────────────────────┘  └─────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Survey View (Single Question)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────┐  ┌─────────────────────────────────┐  ┌─────────┐  │
│  │   ORR   │  │ IT Security ORR                 │  │         │  │
│  │    ✓    │  │ Operational Readiness Review    │  │         │  │
│  │         │  │                                 │  │         │  │
│  ├─────────┤  │ Survey Progress                 │  │         │  │
│  │         │  │ [===========60%===========]     │  │         │  │
│  │    🏠   │  │ Section 3: Security & Compliance│  │  RIGHT  │  │
│  │         │  │                                 │  │         │  │
│  │    📋   │  │ Question 8 of 25               │  │ SIDEBAR │  │
│  │         │  │                                 │  │         │  │
│  │    ⚙️    │  │ Is two-factor authentication...│  │ (Hidden │  │
│  │         │  │                                 │  │    by   │  │
│  │         │  │ [Yes]        [No]               │  │ default)│  │
│  │         │  │                                 │  │         │  │
│  │    👤    │  │ [Back]                  [Next]  │  │         │  │
│  └─────────┘  └─────────────────────────────────┘  └─────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Color Palette Implementation

The layout will use the following color scheme from the provided Tailwind configuration, as demonstrated in the reference implementation:

- Primary color: `#135bec` - Used for active elements, buttons, and highlights
- Background (light mode): `#f6f6f8` - Main background color in light mode
- Background (dark mode): `#101622` - Main background color in dark mode
- Slate colors: Used for text, borders, and UI elements with varying levels of emphasis

## Dark Mode Implementation

The application will implement dark mode using Nuxt's built-in color mode module, which provides several advantages:

- Minimal JavaScript required
- Automatic theme persistence using localStorage
- CSS variables for theme colors
- System preference detection
- Class-based approach compatible with Tailwind's dark mode

### Dark Mode Toggle Component

A dedicated ThemeToggle component will be created with the following features:

- Simple toggle button with appropriate icons for light/dark modes
- Visual indication of the current mode
- Smooth transition between modes using CSS transitions
- Accessible design with proper aria attributes

## Key UI Elements from Reference Implementation

### Left Sidebar
- Fixed width: `w-20` (80px)
- Full height: `h-screen`
- Logo container: `h-16` with centered content
- Navigation items: `h-12 w-12` with rounded corners (`rounded-lg`)
- Active state: `bg-primary/10 text-primary`
- Hover tooltips using absolute positioning

### Header
- Height: `h-20`
- Border bottom: `border-b border-gray-200 dark:border-gray-800`
- Background with blur: `bg-white/75 backdrop-blur-sm dark:bg-background-dark/75`
- Title: `text-xl font-bold`
- Subtitle: `text-sm text-gray-500`

### Main Content
- Padding: `px-8 py-6`
- Max width container: `max-w-4xl mx-auto`
- Progress bar: `h-2 rounded-full bg-primary`
- Question heading: `text-4xl font-black leading-tight tracking-tight` (survey view)
- Buttons: `h-12 rounded-lg` with appropriate colors

### Content View Modes

#### Default View (Multiple Questions)
- Section headers: `text-xl font-bold border-b border-slate-200 pb-3`
- Question containers: `py-4 divide-y divide-slate-200`
- Question text: `text-slate-700`
- Answer options: Horizontal layout with `flex rounded-lg border border-slate-200 p-0.5 bg-white`
- Expandable/collapsible questions with `group` styling
- Spacing between question groups for visual separation

#### Survey View (Single Question)
- Centered layout with focus on one question at a time
- Larger question text: `text-4xl font-black`
- Prominent answer buttons: `h-12 rounded-lg`
- Navigation controls at the bottom (back/next)
- Progress indicator showing current question position

## Device Support

- **Minimum Size**: 14-inch MacBook (Nov 2023) - The layout will be optimized for this minimum screen size
- **Larger Displays**: The layout will adapt to larger external monitors with appropriate spacing and content width
- **No Mobile Support Required**: The application does not need to support mobile or tablet devices smaller than the minimum size

## Risks / Trade-offs
- **Risk**: Layout may become complex with nested components → Mitigation: Follow the clean structure in the reference implementation
- **Risk**: Responsive behavior might be challenging → Mitigation: Use the responsive patterns demonstrated in the reference
- **Risk**: Right sidebar toggle might cause layout shifts → Mitigation: Use CSS transitions and fixed widths

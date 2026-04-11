# Design System Inspiration of Samsung (One UI 8.5 — Ambient Design)

## 1. Visual Theme & Atmosphere

Samsung's One UI 8.5 introduces **Ambient Design** — a philosophy where the interface becomes invisible until needed. UI chrome (status bars, navigation bars, system controls) fades from view during content consumption and returns only on demand. The result is a "seamless and immersive" experience where the screen belongs to the content, not the system. This is Samsung's most radical interface evolution since One UI's founding: the operating system itself recedes, becoming ambient — present but not visible, aware of context but not intrusive.

The brand's visual identity was forged through deliberate evolution: from the three-star mark (1969) through the blue oval era (1993-2005) to today's standalone Samsung Blue wordmark. One UI 8.5, debuting with Galaxy S26 (February 2026), extends this philosophy of confident simplicity to the system UI itself — if the interface is good enough, it should be brave enough to disappear.

**Glass UI** is the signature visual treatment of 8.5. System surfaces — Quick Panel tiles, floating tab bars, widget backgrounds — use frosted semi-transparency with thin outline borders that dynamically react to the wallpaper underneath. This creates a layered depth system where elements appear to hover on a sheet of frosted glass rather than sitting on opaque backgrounds. The aesthetic sits between Apple's "Liquid Glass" (iOS 26) and Samsung's own heritage, with Samsung maintaining warmer tones and softer edges.

Typography remains bifurcated: Samsung Sharp Sans for display and SamsungOne for body. One UI 8.5 notably moves search bars to the bottom of apps for one-handed reachability, and increases widget font sizes for glanceability. Third-party font installation is no longer supported — only Samsung Galaxy Store fonts are permitted (security hardening via cryptographic signature verification).

The four design pillars (Natural, Clean, Consistent, Sensorial) now operate under the Ambient Design umbrella, with a fifth emergent principle: **Contextual Awareness** — the system understands what you're looking at, adapts its layout to your wallpaper, and suggests actions before you ask.

**Key Characteristics:**
- **Ambient Design**: UI chrome fades during scroll, returns on interaction — the system is present but invisible
- **Glass UI**: Frosted semi-transparent surfaces with thin outline borders, wallpaper-reactive tinting
- **Floating Pill Tab Bar**: Bottom navigation as a hovering pill-shaped element with frosted background (replaces fixed rectangular tabs)
- **3D App Icons**: Subtle drop shadows on homescreen icons creating a floating/raised effect
- **AI-Adaptive Lock Screen**: Clock and widgets auto-position around wallpaper subjects (Stretch Clock)
- **Drag-and-Drop Quick Panel**: Fully customizable tiles — add, delete, move, resize. Widget-style tiles with live data
- Samsung Sharp Sans for display, SamsungOne for body — dual-font brand system
- One UI philosophy: Natural, Clean, Consistent, Sensorial + Contextual Awareness
- 6 customizable unlock animations: Slide, Expand, Spread, Wave, Warp, Ripple
- Now Bar: pill-shaped live activity indicator on lock screen (timers, music, navigation)
- Illustration palette (Sky Blue, Ocean Blue, Teal, Lavender, Clover, Saffron, Coral) for warmth in editorial contexts

## 2. Color Palette & Roles

### Primary Brand
- **Samsung Blue** (`#1428A0`): The iconic brand color since 1993 — representing technology, reliability, and innovation. Used for the wordmark, key brand moments, and primary interactive accents. Samsung Blue is the single most recognizable element of the visual identity.
- **Pure Black** (`#000000`): Hero section backgrounds, immersive product showcases, navigation bar. The cinematic void that makes products glow.
- **Pure White** (`#FFFFFF`): Alternate section backgrounds, editorial content panels, product page surfaces. The breathing room between dark cinematic moments.

### Surface & Background
- **Near White** (`#F7F7F7`): Alternate light surface — slightly warmer than pure white to prevent sterility. Used for product detail sections and content cards.
- **Light Gray** (`#F5F5F5`): Secondary surface for subtle section differentiation on light backgrounds.
- **Dark Surface** (`#1A1A1A`): Elevated dark cards, footer regions, and secondary dark panels — lifted from pure black for depth hierarchy.

### Text
- **Near Black** (`#1D1D1F`): Primary heading text on light backgrounds — slightly softened from pure black.
- **Dark Gray** (`#313131`): Primary body text on light backgrounds — comfortable reading weight.
- **Mid Gray** (`#575757`): Secondary text, descriptions, and subdued UI labels.
- **Light Text Gray** (`#6E6E73`): Tertiary text, metadata, and caption content.
- **Muted Gray** (`#DADADA`): Placeholder text, disabled states, and divider lines.
- **White** (`#FFFFFF`): Text on dark backgrounds, button text on filled CTAs.

### Interactive & Accent
- **Samsung Blue** (`#1428A0`): Primary brand accent for key interactive moments and brand expressions.
- **Action Blue** (`#3388E9`): Active interactive elements — buttons, links, focus states on product pages.
- **Bright Blue** (`#3581FF`): Links and interactive text on dark backgrounds — higher luminance for contrast.
- **Cyan Blue** (`#0E9FF9`): Feature highlight accents, product-specific interactive elements.
- **Galaxy Yellow** (`#FFF01F`): Product-specific accent (Galaxy AI features) — energetic highlight for AI-powered capabilities.

### Gradient & Special
- **Cyan-to-Green Gradient** (`#64E9E3` → `#9FFAC7`): Galaxy AI feature gradients, premium product highlights. Used sparingly for futuristic technology moments.
- **Accent Blue Glow** (`#9BD6FF`): Soft highlight for promotional banners and hover states — the lightest blue in the system.

### Illustration Palette
- **Sky Blue** — Lightness, openness, and aspiration
- **Ocean Blue** — Depth, trust, and stability
- **Teal** — Innovation and freshness
- **Lavender** — Creativity and premium feel
- **Clover** — Growth and sustainability
- **Saffron** — Warmth and energy
- **Coral** — Approachability and human connection

### Border & Divider
- **Border Light** (`rgba(221, 221, 221, 1)` / `#DDDDDD`): Standard border for buttons and cards on light backgrounds.
- **Border Subtle** (`rgba(234, 234, 234, 1)` / `#EAEAEA`): Subtle dividers and card outlines.

### Overlay
- **Dark Overlay** (`rgba(0, 0, 0, 0.7)`): Modal backdrops and image overlays.
- **Dark Mask** (`rgba(0, 0, 0, 0.8)`): Full-screen masks for navigation menus and popups.

### Shadows
- **Card Shadow** (`0px 4px 17px 0px rgba(224, 224, 224, 0.32)`): Soft, diffused elevation for popup cards and floating panels.

## 3. Typography Rules

### Font Family
- **Display**: `SamsungSharpSans` — proprietary geometric sans-serif. Friendly, refined, and modern. Used for all headlines and display text.
- **Body**: `SamsungOne` — proprietary sans-serif optimized for digital readability. Used for body text, UI elements, and interactive labels.
- **Fallback Stack**: `sans-serif`
- **Korean Variant**: `SamsungOneKorean, sans-serif` for Korean-language pages.

### Hierarchy

| Role | Font | Size (Mobile) | Size (Desktop) | Weight | Line Height | Notes |
|------|------|---------------|----------------|--------|-------------|-------|
| Display Hero | SamsungSharpSans | 36px | 64px | 700 | 1.125-1.18 | Product launch headlines, maximum impact |
| Section Heading | SamsungSharpSans | 28px | 56px | 700 | 1.07 | h2-level feature section titles |
| Sub-heading | SamsungSharpSans | 28px | 48px | 700 | 1.16-1.20 | Product sub-headlines, feature callouts |
| Feature Title | SamsungSharpSans | 24px | 32px | 700 | 1.25 | Feature block titles |
| Card Title | SamsungSharpSans | 20px | 24px | 700 | 1.33 | Product card headings |
| Nav Heading | SamsungOne | 18px | 18px | 600 | 1.44 | Navigation category labels |
| Body Large | SamsungOne | 16px | 18px | 400 | 1.50-1.55 | Primary reading text, descriptions |
| Body | SamsungOne | 14px | 16px | 400 | 1.50 | Standard body copy |
| Button Text | SamsungOne | 14px | 14px | 700 | 1.43 | CTA button labels |
| Caption | SamsungOne | 12px | 14px | 400 | 1.43 | Secondary text, metadata |
| Disclaimer | SamsungOne | 10px | 12px | 400 | 1.30-1.33 | Legal text, footnotes |

### Principles
- **Dual-font clarity**: SamsungSharpSans owns the emotional, brand-level moments (headlines, product names). SamsungOne handles the functional, readable moments (body, UI, buttons). Never mix their roles.
- **Weight discipline**: The headline scale lives at 700 (bold) exclusively — Samsung Sharp Sans at bold weight IS the brand voice. Body text lives at 400 (regular) with 600 (semibold) for emphasis. No light weights (300) in the web system.
- **Responsive scaling**: Headlines compress dramatically from desktop to mobile (64px → 36px, 56px → 28px) but maintain proportional line-heights. Body text scales modestly (18px → 16px) to preserve readability.
- **No decorative tracking**: Unlike Apple's universally tight tracking, Samsung uses default letter-spacing for most text. The typography is designed to breathe naturally, reflecting the "human-centered" brand philosophy.

## 4. Component Stylings

### Buttons

**Primary Filled (CTA)**
- Background: `#000000`
- Text: `#FFFFFF`, SamsungOne, 14px, weight 700
- Height: 48px
- Padding: 6px 24px
- Radius: 36px (pill shape)
- Border: none
- Hover: slight opacity shift
- Use: Primary call-to-action ("Buy now", "Pre-order", "Learn more")

**Secondary Outlined**
- Background: `#FFFFFF`
- Text: `#6E6E73`
- Height: 48px
- Padding: 6px 24px
- Radius: 36px (pill shape)
- Border: 1px solid `#DDDDDD`
- Hover: border darkens, text shifts to `#000000`
- Use: Secondary actions, "See all" links

**Text Link (Underline)**
- Background: transparent
- Text: `#000000` or `#FFFFFF` depending on surface
- Text-decoration: underline
- Font: SamsungOne, 14px, weight 400
- Hover: opacity 0.7
- Use: Inline navigation, "Learn more" within content blocks

**Icon Button (Circular)**
- Background: transparent or `rgba(0, 0, 0, 0.5)`
- Size: 40px (mobile) / 36px (desktop)
- Radius: 50%
- Use: Carousel arrows, play/pause controls, close buttons

### Cards & Containers
- Background: `#FFFFFF` (light) or `#1A1A1A` (dark)
- Border: 1px solid `#EAEAEA` (light) or none (dark)
- Radius: 20px (standard Samsung rounding)
- Shadow: `0px 4px 17px 0px rgba(224, 224, 224, 0.32)` for elevated cards
- Content: left-aligned, consistent padding
- Hover: subtle shadow increase or border color shift

### Popup / Modal
- Max-width: 680px (desktop), 90% (mobile)
- Radius: 11px
- Padding: 32px top, 33px left, 35px right, 48px bottom
- Shadow: `0px 4px 17px 0px rgba(224, 224, 224, 0.32)`
- Border: 1px solid `#EAEAEA`
- Backdrop: `rgba(0, 0, 0, 0.7)`

### Navigation (GNB - Global Navigation Bar)
- **Web**: Background `#000000` (solid black), Height ~56px, fixed positioning
- **One UI 8.5 App**: Floating Pill Tab Bar — frosted semi-transparent pill shape with thin outline borders
- Text: `#FFFFFF`, SamsungOne, 14px, weight 400
- Logo: Samsung wordmark in white, left-aligned
- Mobile: hamburger menu with full-screen overlay (`rgba(0, 0, 0, 0.8)`)
- **Ambient Behavior**: Navigation fades from view during vertical scrolling, returns on scroll-up or tap
- Z-index: 199-299 for standard nav, 899+ for overlays

### Floating Pill Tab Bar (One UI 8.5 — New)
- Shape: fully rounded pill (max border-radius capsule) with horizontal margins from screen edges
- Background: frosted semi-transparent, wallpaper-reactive tinting
- Border: thin outline (1px solid rgba(255,255,255,0.2)) for glass effect
- Active indicator: circular highlight on selected tab
- Height: ~46dp
- Behavior: fades during content scroll, returns on demand
- Used in: Phone, Gallery, Clock, My Files, and other Samsung first-party apps
- Replaces the traditional fixed rectangular bottom navigation

### Now Bar (One UI 8.5 — New)
- Position: pill-shaped floating element at bottom of lock screen, between shortcut icons
- Content: live activity updates (timers, music playback, navigation directions)
- Also visible: as compact element in status bar and on AOD
- Shape: pill with frosted background
- Use: real-time contextual information without unlocking

### Quick Panel (One UI 8.5 — Redesigned)
- Fully drag-and-drop customizable: add, delete, move, resize all elements
- Tile sizes: small, medium, large formats
- Widget-style tiles: embed live, glanceable data (not just toggles)
- Slider orientation: brightness and volume switchable between horizontal and vertical
- Visual: frosted glass background, thin border outlines on tiles, wallpaper-reactive translucency
- Behavior: search bar with improved animation, landscape orientation support

### Product Hero Module
- Full-viewport-width section with solid black or white background
- Product name: SamsungSharpSans, 64px (desktop), weight 700
- One-line descriptor below in SamsungOne, 18px, weight 400
- Two pill CTAs side by side: "Buy now" (filled black) and "Learn more" (outlined)
- Product image dominating center frame, floating on solid background

### Carousel / Slider
- Arrow buttons: 40px circular, semi-transparent
- Dot indicators: small circles, active state filled
- Transition: smooth cubic-bezier easing (`cubic-bezier(0.2, 0.6, 0.4, 1)`)
- Swipe: touch-enabled on mobile

### Image Treatment
- Products on solid-color fields (black or white) — floating, gravity-defying presentation
- Full-bleed section images spanning entire viewport width
- Product photography with subtle ambient shadows from the photography itself
- Lifestyle images in rounded-corner containers (20px radius)
- Video content with play button overlay and progressive loading

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Common values: 6px, 8px, 12px, 16px, 20px, 22px, 24px, 28px, 32px, 33px, 35px, 48px
- Notable characteristic: Samsung's spacing is generous but systematic. The 8px base creates a rhythm, but values like 22px, 33px, 35px suggest a pragmatic approach — spacing serves content, not a rigid mathematical grid.

### Grid & Container
- Max wrapper width: 1920px (full-bleed container)
- Desktop content width: 988px (inner content block)
- Tablet content width: 692px
- Mobile content width: 360px with 24px horizontal padding
- Hero: full-viewport-width sections with centered content
- Product grids: 2-4 column layouts within centered container
- Single-column for hero moments — one product, one message, full attention

### Whitespace Philosophy
- **Cinematic scale**: Hero sections occupy near-full viewport heights. Products breathe in vast expanses of solid color, reinforcing the "premium technology" positioning.
- **Section alternation**: Black and white sections alternate to create narrative rhythm — dark for immersion, white for information. This mirrors the One UI principle of "clean and concise first impression."
- **Density contrast**: Headlines are bold and compressed, surrounded by generous padding. Body text areas maintain comfortable reading margins. The contrast between tight typography and open layout creates visual energy.

### Border Radius Scale
- Micro (4px): Small utility elements, tags
- Standard (11px): Modals, dialog containers
- Large (20px): Product cards, image containers, content blocks
- Pill (30-36px): CTA buttons, action elements
- Circle (50%): Icon buttons, media controls

## 6. Depth & Elevation (One UI 8.5 — Glass UI)

One UI 8.5 introduces a three-layer visual depth system (Blur, Dim, Shadow) and the Glass UI frosted surface treatment.

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow, solid background | Standard content sections, hero areas |
| Frosted Glass | Semi-transparent bg + `backdrop-filter: blur()` + thin outline border | Floating Pill Tab Bar, Quick Panel tiles, Magic Glass widgets |
| 3D Icon Shadow | Subtle drop shadow beneath homescreen icons | App icon floating effect (new in 8.5) |
| Card Lift (Level 1) | `0px 4px 17px 0px rgba(224, 224, 224, 0.32)` | Popup cards, floating panels, modals |
| Navigation (Web) | Solid `#000000` background, fixed position | Web GNB |
| Navigation (App) | Frosted pill with wallpaper-reactive tint | Floating Pill Tab Bar |
| Overlay/Dim | `rgba(0, 0, 0, 0.65)` | Modal backgrounds, bottom sheet dim |
| Deep Mask | `rgba(0, 0, 0, 0.8)` | Full navigation overlay, search panel |

### Samsung Visual Depth Hierarchy (Official)
- **Blur**: Applied evenly across backgrounds, combined with dim. Creates emphasis on foreground content. The primary depth tool in 8.5.
- **Dim**: Clarifies hierarchical levels, applied consistently across transitions. Used solely to distinguish information types. Never used decoratively.
- **Shadow**: Creates soft connections between layers. Intentionally avoids strong 3D depth. Should NEVER combine with dim — pick one or the other.

### Glass UI Surfaces (One UI 8.5 — New)
- **Frosted background**: Semi-transparent with gaussian blur, tinted by wallpaper colors beneath
- **Thin outline borders**: 1px solid with low opacity (`rgba(255,255,255,0.2)` light / `rgba(255,255,255,0.1)` dark) — the signature glass edge
- **Wallpaper-reactive**: Surface tint dynamically shifts based on the wallpaper region underneath
- **Applied to**: Quick Panel tiles, Floating Pill Tab Bar, Now Bar, Magic Glass widgets
- **Neomorphic elements**: Buttons appear raised with realistic shadows; selected states use gradients for elevation distinction

### Decorative Depth
- 3D app icons with subtle drop shadows (toned down from beta for subtlety)
- Frosted Quick Panel tiles with live data, hovering above blurred wallpaper
- Section color transitions (black to white) create implied depth without shadows on web
- Product photography provides its own depth through studio lighting and ambient shadows

## 7. Do's and Don'ts

### Do
- Use SamsungSharpSans for headlines and SamsungOne for body — respect the dual-font boundary
- Use Samsung Blue (`#1428A0`) as the primary brand accent — it carries the heritage of the brand since 1993
- **Embrace Ambient Design**: let UI chrome fade during content consumption, bring it back on interaction
- **Apply Glass UI** for floating system elements: frosted blur + thin outline borders + wallpaper-reactive tint
- Use pill-shaped elements (max border-radius capsules) for floating bars, CTAs, and navigation — the 8.5 signature shape
- Apply 26dp border-radius to cards, dialogs, and containers — the One UI container standard
- Keep product imagery on solid-color fields for web — products should float on black or white
- Apply bold weight (700) to all SamsungSharpSans headlines — this is the brand voice
- **Place search bars at the bottom** of app screens for one-handed reachability
- Use the three-layer depth system: Blur for emphasis, Dim for hierarchy, Shadow for connection (never combine Dim + Shadow)
- Follow Ambient Design principles: contextually aware, responsive to movement, disciplined about space

### Don't
- Don't mix SamsungSharpSans into body text or SamsungOne into display headlines — each font has its role
- Don't use light font weights (300) — Samsung's web system starts at 400 and peaks at 700
- Don't combine Dim and Shadow on the same element — pick one depth mechanism per layer
- Don't use Samsung Blue as a background fill — it is an accent and brand mark color, not a surface
- Don't introduce sharp corners (0px radius) on cards — the rounded corner / pill system is the 8.5 brand signature
- Don't make navigation permanently visible in app contexts — Ambient Design requires chrome to fade during scroll
- Don't apply decorative letter-spacing to SamsungSharpSans — the font is designed to breathe at default tracking
- Don't use opaque backgrounds on floating elements in 8.5 — Glass UI requires semi-transparency + blur for system surfaces
- Don't center-align body text — Samsung body copy is left-aligned; only hero headlines and product names center
- Don't place search bars at the top of app screens — One UI 8.5 moves search to bottom for reachability
- Don't install third-party fonts — One UI 8.5 requires cryptographic signature verification (Samsung Galaxy Store fonts only)

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <768px | Single column, 360px inner width, 24px padding |
| Tablet | 768-1279px | 692px inner width, 2-column grids begin |
| Desktop | 1280-1920px | 988px inner content, full navigation, multi-column layouts |
| Large Desktop | >1920px | Centered with 1920px max wrapper |

### Touch Targets
- Primary CTAs: 48px height with 6px 24px padding — comfortable touch target
- Navigation links: adequate spacing for finger targeting
- Carousel arrows: 40px circular touch targets
- Icon buttons: minimum 36px touch target on desktop, 40px on mobile

### Collapsing Strategy
- Hero headlines: 64px → 36px on mobile, maintaining proportional line-height
- Sub-headlines: 48px → 28px on mobile
- Product grids: 4-column → 2-column → single column stacked
- Navigation: full horizontal GNB → hamburger menu with full-screen overlay
- Product hero modules: full-bleed maintained at all sizes, text and CTAs scale down
- Section backgrounds: maintain full-width color blocks at all breakpoints
- Image sizing: products scale proportionally while maintaining floating presentation

### Image Behavior
- Product photography maintains aspect ratio at all breakpoints
- Hero product images scale down but stay centered on solid backgrounds
- Full-bleed section backgrounds persist at every viewport size
- Video content maintains playback controls with responsive sizing
- Lazy loading for below-fold content with fade-in transitions

### Mobile-Specific Adaptations
- Fixed navigation offset: 96px top (accommodating mobile GNB + utility bar)
- Touch-based carousel navigation replaces arrow buttons
- Stacked CTA buttons (full-width) replace side-by-side layout
- Body text maintains 16px minimum for mobile readability

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary brand accent: Samsung Blue (`#1428A0`)
- Page background (light): `#FFFFFF` or `#F7F7F7`
- Page background (dark): `#000000`
- Heading text (light bg): `#1D1D1F`
- Heading text (dark bg): `#FFFFFF`
- Body text (light bg): `#313131`
- Body text (dark bg): `#FFFFFF`
- Secondary text: `#575757`
- Tertiary text: `#6E6E73`
- Interactive blue: `#3388E9`
- CTA button fill: `#000000`
- CTA button outline: `#DDDDDD`
- Card border: `#EAEAEA`
- Card shadow: `0px 4px 17px 0px rgba(224, 224, 224, 0.32)`

### Example Component Prompts
- "Create a hero section on black background. Headline at 64px SamsungSharpSans weight 700, line-height 1.125, color white. One-line subtitle at 18px SamsungOne weight 400, line-height 1.55, color white. Two pill CTAs: 'Buy now' (black bg #000, white text, 36px radius, 48px height, 6px 24px padding) and 'Learn more' (white bg, #6E6E73 text, 1px solid #DDD border, 36px radius)."
- "Design a product card: white background, 20px border-radius, 1px solid #EAEAEA border. Product image top 60% floating on solid background. Title at 24px SamsungSharpSans weight 700. Description at 14px SamsungOne weight 400, color #575757. 'Learn more' underline link at bottom."
- "Build the Samsung navigation: sticky, ~56px height, solid black #000 background (NOT translucent, NOT blurred). Samsung wordmark logo in white left-aligned. Links at 14px SamsungOne weight 400, white text. Hamburger icon on mobile triggering full-screen overlay."
- "Create an alternating section layout: first section black bg with white text and centered floating product image, second section white bg with #1D1D1F text. Each section near full-viewport height with 64px SamsungSharpSans headline and two pill CTAs below."
- "Design a modal popup: max-width 680px, 11px border-radius, 1px solid #EAEAEA border, shadow 0px 4px 17px rgba(224,224,224,0.32). Padding 32px top, 33px left/right, 48px bottom. Backdrop rgba(0,0,0,0.7)."

### Iteration Guide (One UI 8.5 — Ambient Design)
1. Headlines always use SamsungSharpSans at weight 700 — this IS the Samsung voice
2. Body text always uses SamsungOne at weight 400 — clean, readable, functional
3. Section backgrounds alternate: black for immersive product moments, white for informational content
4. All cards and containers use 26dp border-radius — the One UI container standard
5. CTAs are pill-shaped (max-radius capsules) with 48px height — approachable and touch-ready
6. **Ambient Design**: Navigation fades during content scroll on mobile apps; web uses solid black GNB
7. **Glass UI for floating elements**: frosted blur + thin outline + wallpaper-reactive tint on system surfaces
8. **Three-layer depth**: Blur (emphasis) → Dim (hierarchy) → Shadow (connection). Never combine Dim + Shadow.
9. Samsung Blue (`#1428A0`) appears only for brand moments, not as a UI background color
10. Galaxy AI features use cyan-green gradient (`#64E9E3` → `#9FFAC7`) and Galaxy Yellow (`#FFF01F`)
11. **Search at bottom**: App search bars positioned at bottom for one-handed reachability
12. **Now Bar**: Pill-shaped live activity indicator on lock screen for timers, music, navigation
13. **Floating Pill Tab Bar**: Replaces fixed bottom nav in Samsung apps — frosted capsule with circular active indicator
14. **3D Icon shadows**: Subtle drop shadows on homescreen icons for floating effect (keep subtle, not heavy)
15. **Adaptive lock screen**: AI auto-positions clock and widgets around wallpaper subjects

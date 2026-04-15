# Orchestration — Component Composition & Layout Assembly Rules

> This document defines **how components combine** — the spacing, nesting, anchoring, and z-layer relationships between elements. DESIGN.md specifies individual component specs. This document specifies how those components assemble into complete screens.

---

## 1. Screen Frame Structure

Every Samsung One UI 8.5 screen follows a fixed vertical frame:

```
┌─────────────────────────────────┐
│ Status Bar (24dp)               │  z:200, static, fixed top
├─────────────────────────────────┤
│ App Bar (56dp) — optional       │  z:10, static, fixed or scroll-away
├─────────────────────────────────┤
│                                 │
│                                 │
│ Content Area (flex: 1)          │  z:0, scrollable
│                                 │
│                                 │
├─────────────────────────────────┤
│ Bottom Nav (64dp) — optional    │  z:10, static, fixed bottom
├─────────────────────────────────┤
│ Nav Bar (48dp gesture / 20dp)   │  z:200, static, fixed bottom
└─────────────────────────────────┘
```

### Frame Measurements (from image analysis)
- **Total viewport**: 360 × 780dp (standard), 360 × 800dp (tall)
- **Status bar**: height 24dp. Layout: `time(left, 14dp from edge) | notification-pill(center) | system-icons(right, 14dp from edge)`
- **App Bar**: height 56dp. Padding: `0 16dp`. Back icon: 24×24dp, left-aligned. Title: 16dp from icon or 16dp from left edge. Overflow icons: right, gap 24dp between icons
- **Bottom Nav**: height 64dp. Glass pill shape, radius 999px. Horizontal padding: 24dp. Items: 4-5, evenly distributed. Icon: 24×24dp, label below: 10dp font, gap 4dp icon-to-label
- **Navigation Bar** (gesture): height 20dp. Pill indicator: 134×5dp, centered, radius 999px, bottom 8dp

---

## 2. Vertical Stacking Rules

### Component-to-Component Gaps

| From → To | Gap (dp) | Notes |
|---|---|---|
| Status Bar → App Bar | 0 | Seamless join |
| Status Bar → Content (no AppBar) | 0 | Lock screen, wallpaper screens |
| App Bar → First Content | 0 | Content scrolls under AppBar |
| App Bar → Section Title | 16 | When first element is a heading |
| Section Title → First Item | 8 | Tight coupling title→content |
| Card → Card | 12 | Vertical card list |
| Card → Card (same group) | 8 | Related cards cluster tighter |
| List Item → List Item | 0 | Divider line provides separation |
| List Item → Section Header | 16 | New section needs breathing room |
| Button → Button (vertical) | 8 | Stacked action buttons |
| Input → Input | 16 | Form fields need scanning room |
| Input → Helper Text | 4 | Error/hint text hugs field |
| Chip Row → Content Below | 16 | Filter chips above list |
| Content → FAB | N/A | FAB is absolute positioned |
| Last Content → Bottom Nav | 64dp clear | Ensure content doesn't hide under nav |

### Lock Screen Stacking (from Image 1, 4)
```
Status Bar (24dp)
  ↓ 0dp
Content Area (centered vertically)
  - Clock: centered, top ~30% of viewport
  - Widgets: below clock, gap 16dp
  ↓ flex space
Now Bar (64dp height): bottom 20dp above nav bar
  - Shape: pill (999px radius)
  - Internal: icon(left 16dp) + content(flex) + action(right 16dp)
  - Vertical padding: 12dp
Nav Bar (20dp)
```

### Dialog Overlay Stacking (from Image 1)
```
Dim overlay: rgba(0,0,0,0.65), z:100, full viewport
Dialog container: 
  - Position: bottom of screen, 0dp from bottom edge
  - Width: 100% viewport (full-width bottom sheet style)
  - Radius: 26dp top-left, 26dp top-right, 0 bottom
  - Padding: 24dp all sides
  - Title → Description: gap 8dp
  - Description → Button row: gap 24dp
  - Button row: 2 buttons, separated by 1px vertical divider
  - Each button: flex 1, height 48dp, text centered
  - Cancel: flat style (left), Apply: flat style (right)
```

---

## 3. Horizontal Layout Rules

### Alignment Patterns

| Pattern | Usage | Spec |
|---|---|---|
| Edge-to-edge | Cards, media, dividers | `margin: 0; width: 100%` |
| Standard inset | Content with padding | `padding: 0 24dp` (mobile) |
| Card inset | Cards within padded content | `margin: 0 16dp` |
| Center-aligned | Dialogs, empty states, hero text | `align-items: center; text-align: center` |
| Split horizontal | Label + value, title + action | `justify-content: space-between` |

### Horizontal Component Groups

| Group | Gap | Alignment |
|---|---|---|
| Button + Button (horizontal) | 8dp | center-aligned |
| Icon + Label (inline) | 8dp | vertical center |
| Avatar + Text Block | 12dp | vertical center, text top-aligned if multi-line |
| Chip + Chip | 6dp | wrap allowed |
| Action Icon + Action Icon (AppBar) | 24dp | vertical center |
| Tab + Tab (Pill Tab Bar) | 0dp | items fill container evenly |

---

## 4. Quick Settings Panel Layout (from Image 2, 3)

### Full QS Panel Structure
```
┌──────────────────────────────────┐
│ Status Bar (24dp)                │
│ Carrier(left) | Icons(right)     │
├──────────────────────────────────┤
│ Action Bar (48dp)                │
│ padding: 0 16dp                  │
│ [edit] [power] [settings]  right │
├──────────────────────────────────┤
│ QS Toggle Grid                   │
│ Layout: 4 columns × 2 rows      │
│ Toggle size: 64×64dp (icon 40dp) │
│ Grid gap: 12dp                   │
│ Row gap: 16dp                    │
│ Horizontal padding: 24dp        │
│ Active: filled circle bg         │
│ Inactive: surface circle bg      │
│ Label below: 10dp font, gap 6dp  │
├──────────────────────────────────┤
│ Page indicator: 3 dots, gap 6dp  │
│ Active dot: 6dp, Inactive: 4dp  │
├──────────────────────────────────┤
│ Brightness Slider Row            │
│ Height: 48dp                     │
│ Layout: [icon] [slider flex] [icon]│
│ Slider: radius 999px, track 4dp  │
│ Thumb: 24×24dp circle            │
│ Horizontal padding: 24dp        │
├──────────────────────────────────┤
│ Tile Cards (2-column grid)       │
│ Gap: 8dp                         │
│ Card radius: 20dp                │
│ Card padding: 16dp               │
│ Card height: auto (content-fit)  │
│ Structure: [icon left] [title]   │
│            [subtitle below]      │
│            [action-icon right]   │
│ Horizontal padding: 16dp        │
├──────────────────────────────────┤
│ Media Control Row                │
│ Layout: 2 chips, gap 8dp         │
│ Chip: radius 999px, h:36dp      │
│ Chip padding: 0 16dp             │
│ Structure: [dot-icon] [label]    │
│ Horizontal padding: 16dp        │
├──────────────────────────────────┤
│ Bottom Shortcut Row              │
│ Layout: 2 items, gap 12dp        │
│ Item: radius 20dp, h:56dp        │
│ Structure: [icon 32dp] [label]   │
│ Horizontal padding: 16dp        │
├──────────────────────────────────┤
│ Navigation Bar (48dp)            │
│ [|||]  [○]  [<]  centered       │
└──────────────────────────────────┘
```

### QS Toggle Specs (measured from Image 3)
- **Icon container**: 64×64dp circle
- **Active state**: filled with semantic color (e.g., connectivity blue), icon white
- **Inactive state**: `var(--surface-2)` fill, icon `var(--text-2)`
- **Label**: 10dp, `var(--text-3)`, max 2 lines, text-align center
- **Touch target**: 72×72dp minimum (extends beyond visual circle)

### QS Tile Card Composition
```
┌────────────────────────────────┐
│  [Icon 24dp]  Title     [▶]   │  height: auto
│               Subtitle         │  padding: 16dp
└────────────────────────────────┘
Gap between icon and text: 12dp
Gap between title and subtitle: 2dp
Action icon: 24×24dp, right-aligned, vertically centered
```

---

## 5. Now Bar Layout (from Image 4)

### Now Bar — Live Activity Pill
```
┌─────────────────────────────────────────┐
│ [AppIcon 32dp]  Title          [Icon]   │  height: 48-64dp
│                 Subtitle                │  radius: 999px
└─────────────────────────────────────────┘

Position: bottom of lock screen, 20dp above nav bar
Width: calc(100% - 48dp) → 24dp margin each side
Padding: 8dp 16dp
Background: tinted glass (G2), blur 24px
Border: 1px solid rgba(255,255,255,0.15)
```

### Now Bar Internal Layout
- **App icon**: 32×32dp, circle, left 16dp
- **Text block**: flex:1, margin-left 12dp
  - Title: 14dp, weight 600, `var(--text)`, single line ellipsis
  - Subtitle: 12dp, weight 400, `var(--text-2)`, single line
  - Title↔Subtitle gap: 2dp
- **Action icon**: 24×24dp, right 16dp, vertically centered
- **Min height**: 48dp (single line), 64dp (two lines)

### Now Bar Adjacent Components (from Image 4)
```
┌──────────┐  ┌────────────────────────┐  ┌──────────┐
│  Phone   │  │   Now Bar (pill)       │  │  Camera  │
│  48×48dp │  │   flex: 1              │  │  48×48dp │
│  circle  │  │   radius: 999px       │  │  circle  │
└──────────┘  └────────────────────────┘  └──────────┘
     gap: 8dp         gap: 8dp
     
Layout: horizontal flex, align-items: center
Quick action circles: 48×48dp, glass G1 background
Entire row padding: 0 16dp
```

---

## 6. Widget Grid Layout (measured from homescreen reference images)

### Widget Size System
| Size | Dimensions | Grid Cells | Usage |
|---|---|---|---|
| Compact | 176×80dp | 2×1 | Single stat, greeting, mini weather, calendar mini |
| Standard | 176×176dp | 2×2 | Weather full, health rings, photo, alarm, steps |
| Wide | 368×80dp | 4×1 | Weather bar, timeline strip |
| Large | 368×160dp | 4×2 | Calendar schedule, energy score, media player |
| Full | 368×176dp | 4×2 | Full detail widgets |

### Widget Internal Layouts (measured from images)

**Compact Widget (2×1) — Greeting/Brief**
```
┌────────────────────────────┐
│ [icon 32dp]    08:45 AM    │  height: 80dp, width: 176dp
│               Good morning │  radius: 26dp, padding: 12dp 16dp
└────────────────────────────┘
Background: tinted semi-opaque (warm from wallpaper)
Icon: 32×32dp, top-left  |  Primary: 14dp/600  |  Secondary: 12dp/400
```

**Compact Widget (2×1) — Gauge/Stats**
```
┌────────────────────────────┐
│  [Gauge 40dp]    Value     │  height: 80dp, width: 176dp
│                  Unit      │  radius: 26dp, padding: 12dp 16dp
└────────────────────────────┘
Gauge: 40×40dp circular progress  |  Value: 20dp/700  |  Unit: 11dp/400
```

**Compact Widget (2×1) — Multi-Gauge (4 stats)**
```
┌────────────────────────────┐
│  [G1] [G2]    [G3] [G4]   │  height: 80dp, width: 176dp
│  100   53      56  +50    │  radius: 26dp, padding: 12dp
└────────────────────────────┘
Layout: 2×2 mini-gauges  |  Each: 28×28dp  |  Value: 10dp/600  |  Gap: 8dp
```

**Standard Widget (2×2) — Weather Full**
```
┌────────────────────────────┐
│                  ☀️ 48dp   │  height: 176dp, width: 176dp
│ 24°                        │  radius: 26dp, padding: 16dp
│ Sunny                      │  bg: semantic color fill
│ ↑26° / ↓23°               │
│ Seoul                      │
└────────────────────────────┘
Temp: 36dp/700 SamsungSharpSans  |  Condition: 14dp/500  |  Hi/Lo: 12dp/400
```

**Standard Widget (2×2) — Health Rings**
```
┌────────────────────────────┐
│          ❤️                │  height: 176dp, width: 176dp
│    [Triple Ring 72dp]      │  radius: 26dp, padding: 16dp
│  ●4,350  ●76  ●458        │
└────────────────────────────┘
Rings: centered 72×72dp  |  Stats: bottom, 3 items  |  Each: [dot 6dp]+value(13dp/600)
```

**Standard Widget (2×2) — Steps/Progress**
```
┌────────────────────────────┐
│ Steps                      │  height: 176dp, width: 176dp
│ 4,350                      │  radius: 26dp, padding: 16dp
│ /6,000 Steps               │
│ [████████░░░░] ●           │
└────────────────────────────┘
Title: 14dp/500  |  Value: 28dp/700 SamsungSharpSans  |  Progress: h:8dp, r:999px
```

**Standard Widget (2×2) — Alarm**
```
┌────────────────────────────┐
│ 6:00 AM                    │  height: 176dp, width: 176dp
│ S M T W T F S              │  radius: 26dp, padding: 16dp
│ [alarm icon 40dp]          │  bg: solid color (purple)
└────────────────────────────┘
Time: 32dp/700 SamsungSharpSans white  |  Days: 11dp row, gap 6dp  |  Icon: 40dp bottom-left
```

**Standard Widget (2×2) — Photo**
```
┌────────────────────────────┐
│  [Photo fills entire area] │  height: 176dp, width: 176dp
└────────────────────────────┘
Radius: 26dp  |  Padding: 0  |  Image: object-fit:cover, clip to radius
```

**Large Widget (4×2) — Calendar Schedule**
```
┌─────────────────────────────────────────┐
│ Today, Wed, Jan 22                [+]   │  height: 160dp, width: 368dp
│ │ 9:30AM   Meeting                      │  radius: 26dp, padding: 16dp 20dp
│ │ 1:00PM   Lunch with Luca             │
│ │ 5:00PM   Gym                          │
└─────────────────────────────────────────┘
Header: 16dp/600  |  Items: h:36dp  |  Color bar: 3×20dp left  |  Time: 12dp/500 w:64dp
```

**Large Widget (4×2) — Energy Score**
```
┌─────────────────────────────────────────┐
│ Energy score         Well rested        │  height: 160dp, width: 368dp
│ 92.6       [☁️]     body text...        │  radius: 26dp, padding: 20dp
│ Excellent            max 3 lines        │  layout: 2-col (40%/60%)
└─────────────────────────────────────────┘
Score: 36dp/700 SamsungSharpSans  |  Label: 13dp/500 colored  |  Body: 12dp/400
```

**Wide Widget (4×1) — Weather Bar**
```
┌─────────────────────────────────────────┐
│ ☀️ 10° San Jose         Wed 22 Jan     │  height: 80dp, width: 368dp
│                            12:45        │  radius: 26dp, padding: 16dp 20dp
└─────────────────────────────────────────┘
Layout: horizontal space-between  |  bg: semantic sky blue
```

### Widget Grid Composition Rules
```
Grid: 4 columns base (each ~82dp + 8dp gap)
Container padding: 16dp horizontal (= 360 - 32 = 328dp usable)
Widget gap: 8dp (both axes)
2-unit width = ~168-176dp  |  4-unit width = ~344-368dp

Stacking: widgets snap to grid, sizes from fixed set only
Mixed heights OK: 2×2 left + two 2×1 stacked right
Height alignment: top-aligned per row, next row = tallest + 8dp
Maximum: ~3-4 rows visible above dock
Scroll: vertical if widget area exceeds visible space
```

### Widget Color Behavior
- **Opaque fill**: weather (sky blue), alarm (purple), calendar (white/surface)
- **Semi-transparent**: health, greeting — glass G0 or surface with opacity
- **Image fill**: photo widget — no background, image clips to radius
- **Tinted**: greeting/AI widgets — wallpaper palette, warm tint
- **Rule**: no two adjacent widgets should use the same background color

---

## 7. App Icon Grid & Dock Layout (measured from homescreen images)

### App Icon Specs
```
Icon container: 60×60dp
Icon visual: 56×56dp centered in container
Icon radius: 18dp (squircle, Samsung standard)
Icon shadow: 0 2dp 8dp rgba(0,0,0,0.15) — 3D floating effect
Label: 11dp/400, center-aligned, single line, ellipsis if overflow
Gap icon→label: 6dp
Touch target: 72×72dp (extends beyond visual)
```

### Folder Icon
```
Container: 60×60dp, radius 18dp
Background: semi-transparent glass (rgba(255,255,255,0.15) dark / rgba(0,0,0,0.06) light)
Internal: 2×2 mini-icon grid
Mini-icon: 20×20dp each, radius 6dp
Mini-icon gap: 4dp
Mini-icon padding from folder edge: 8dp
```

### App Grid Layout
```
Columns: 4 (fixed on mobile, 5 on tablet)
Column gap: evenly distributed → (360 - 48dp padding - 4×60dp) / 3 = ~28dp
Row gap: 24dp (icon-bottom-to-label-bottom of row above)
Container padding: 0 24dp
Max visible rows: 4-5 without scroll
```

### Dock Layout
```
Position: fixed, ~48dp above navigation bar
Items: 4 (always, not configurable without edit mode)
Icon size: 60×60dp (same as grid icons)
Background: none (transparent) or glass pill (optional)
  If glass: radius 999px, padding 8dp 20dp, glass G0
Gap between icons: evenly distributed → (360 - 40dp padding - 4×60dp) / 3 = ~28dp
No labels: dock icons have no text labels
Separator: gap 12dp between dock and page indicator above
```

### Page Indicator
```
Position: centered horizontally, between app grid and dock
Dots: 6dp diameter each, gap 6dp
Active dot: white (dark mode) / dark (light mode), opacity 1
Inactive dot: same color, opacity 0.35
Total width: auto (based on page count)
Vertical margin: 12dp above dock, 12dp below app grid
```

### Search Bar (App Drawer bottom)
```
Position: bottom of app drawer, above navigation bar
Height: 44dp
Radius: 999px (pill)
Background: glass G1
Padding: 0 16dp
Placeholder: "Search", 14dp/400, left-aligned, var(--text-3)
Overflow icon: [⋮] right-aligned, 24×24dp
Margin: 8dp above navigation bar, 16dp below page indicator
Full-width minus 32dp (16dp each side)
```

---

## 8. Container Nesting Rules

### Card Internal Structure
```
Card (radius: 26dp, padding: 16-20dp)
├── Header Row (optional)
│   ├── Icon/Avatar: 40×40dp
│   ├── gap: 12dp
│   ├── Title: 15dp/600
│   └── Subtitle: 13dp/400, color: var(--text-2)
├── gap: 12dp
├── Content Area
│   └── (varies by card type)
├── gap: 16dp (before actions)
└── Action Row (optional)
    ├── align: right or space-between
    └── Button gap: 8dp
```

### Dialog Internal Structure (from Image 1)
```
Dialog (radius: 26dp top, padding: 24dp)
├── Title: 18dp/700, color: var(--text)
├── gap: 8dp
├── Description: 14dp/400, color: var(--text-2)
│   line-height: 1.5
├── gap: 24dp
└── Button Row
    ├── height: 48dp
    ├── border-top: 1px solid var(--divider)
    ├── Cancel (flex:1, flat, left)
    ├── divider: 1px solid var(--divider), vertical
    └── Apply (flex:1, flat, right)
```

### Notification Card Internal Structure
```
Notification (radius: 999px, padding: 16dp 20dp)
├── App Icon: 20×20dp, circle
├── gap: 8dp
├── App Name: 12dp/500, color: var(--text-3)
├── flex spacer
├── Timestamp: 11dp/400, color: var(--text-3)
├── (second line, full width)
├── Title: 14dp/600, color: var(--text)
├── gap: 2dp
└── Preview: 13dp/400, color: var(--text-2), max 2 lines
```

---

## 9. Z-Layer & Overlay System

### Z-Index Stack
| Layer | Z-Index | Elements | Material |
|---|---|---|---|
| Base | 0 | Content, lists, grids | Opaque or surface |
| Floating | 10 | FAB, Bottom Nav, Pill Tab | Glass G1 |
| Elevated | 20 | Snackbar, Toast | Glass G2 |
| Panel | 50 | Bottom Sheet, QS Panel | Glass G2 + dim |
| Overlay | 90 | Bottom Sheet (expanded) | Glass G2 + dim |
| Modal | 100 | Dialog | Glass G2 + dim(0.65) |
| System | 200 | Status Bar, Nav Bar | Transparent or glass G0 |
| Now Bar | 150 | Now Bar (above panels) | Tinted glass G2 |

### Overlay Dim Rules
- **Dialog**: `rgba(0,0,0,0.65)` full viewport behind
- **Bottom Sheet**: `rgba(0,0,0,0.4)` behind, touch-to-dismiss
- **QS Panel**: none (replaces content, not overlaid)
- **Snackbar**: no dim, floats above content
- **Rule**: only ONE overlay layer active at a time (Dialog > Sheet > Snackbar priority)

---

## 10. Scroll Behavior & Anchoring

### Fixed Elements (never scroll)
- Status Bar: always fixed top
- Navigation Bar: always fixed bottom
- Bottom Nav: fixed bottom (above nav bar)
- FAB: fixed bottom-right, 16dp from edges
- Now Bar: fixed bottom (lock screen only)

### Scroll-Reactive Elements
- **App Bar**: fades opacity 1→0 during downward scroll, reappears on upward scroll
- **Floating Pill Tab**: parallax slight upward shift during scroll (2dp max)
- **Section headers**: sticky top below AppBar on their respective sections

### Content Anchoring
| Anchor | Behavior | Clear Zone |
|---|---|---|
| Top | Content starts below AppBar | AppBar height (56dp) |
| Bottom (BottomNav) | Content ends above nav | 64dp + 20dp nav = 84dp |
| Bottom (no nav) | Content ends above gesture bar | 20dp |
| Center-V | Used for lock screen, empty states | Equal top/bottom padding |
| FAB | Bottom-right corner | 16dp from right, 16dp above BottomNav |

---

## 11. Touch Target & Clearance

### Minimum Touch Targets
| Element | Min Touch Size | Visual Size |
|---|---|---|
| Button (any) | 48×48dp | 48×height |
| Icon button | 48×48dp | 24×24dp visual |
| List item | full-width × 56dp | full-width × 56dp |
| QS Toggle | 72×72dp | 64×64dp visual |
| Chip | 48×32dp | auto×32dp |
| Switch | 52×48dp | 52×32dp visual |
| Bottom Nav item | 72×64dp | 24×24dp icon + label |
| Tab | 48×46dp | auto×46dp |

### Touch Clearance Between Interactive Elements
- **Vertical gap**: minimum 8dp between interactive elements
- **Horizontal gap**: minimum 8dp between touch targets
- **FAB clearance**: 16dp from nearest interactive element
- **Edge clearance**: interactive elements minimum 8dp from screen edge
- **Bottom safe area**: 20dp from physical bottom (gesture bar zone)

---

## 12. Responsive Breakpoints

| Viewport | Columns | Side Padding | Card Width | Behavior |
|---|---|---|---|---|
| < 360dp | 1 | 16dp | full - 32dp | Single column, compact |
| 360-479dp | 1 | 24dp | full - 48dp | Standard mobile |
| 480-691dp | 1-2 | 24dp | max 420dp or 2-col | Large phone / small tablet |
| 692-987dp | 2 | 32dp | (width-72dp)/2 | Tablet |
| 988dp+ | 2-3 | 40dp | max 400dp per column | Desktop |

### Grid Behavior at Breakpoints
- **QS Grid**: always 4 columns on mobile, expands to 6 on tablet
- **Widget Grid**: 4-column base, widget sizes snap to grid
- **Card Grid**: 1 column mobile, 2 column tablet, 2-3 desktop
- **Bottom Nav**: pill shape on mobile, expands to side rail on tablet/desktop

---

## 13. Screen Composition Templates

### Login Screen Assembly
```
[Status Bar — 24dp, static]
  gap: 0
[Content — center-v aligned]
  padding: 0 24dp
  ├── Logo/Brand: center, 48dp from top-third
  ├── gap: 32dp
  ├── Title: 24dp/700, center
  ├── gap: 8dp
  ├── Subtitle: 14dp/400, center, var(--text-2)
  ├── gap: 32dp
  ├── Input (Email): full-width, h:48dp
  ├── gap: 16dp
  ├── Input (Password): full-width, h:48dp
  ├── gap: 8dp
  ├── Forgot Password: right-aligned, 13dp, var(--primary)
  ├── gap: 24dp
  ├── Button (Sign In): full-width, h:48dp, contained
  ├── gap: 12dp
  ├── Divider with text "or"
  ├── gap: 12dp
  ├── Social buttons row: gap 12dp, each 48×48dp circle
  ├── flex spacer
  └── Sign up link: center, 13dp, bottom 34dp from screen bottom
[Nav Bar — 20dp]
```

### Home Screen Assembly (measured from reference images)
```
┌────────────────────────────────────────┐
│ Status Bar (24dp)                      │  time(left) icons(right)
│ 12:45                    ☰ ▮▮ 📶 [100]│
├────────────────────────────────────────┤
│                                        │
│ Wallpaper — full bleed background      │  z:0
│ (content floats over wallpaper)        │
│                                        │
│ ┌── Widget Zone ──────────────────┐    │  starts ~140-200dp from top
│ │ 2-column widget grid            │    │  padding: 0 16dp
│ │ gap: 8dp H, 8dp V              │    │  max 3-4 rows visible
│ │                                 │    │
│ │ ┌─ 2×2 ──┐ 8dp ┌─ 2×1 ──┐    │    │  Row 1: mixed sizes OK
│ │ │Weather  │     │Greeting │    │    │
│ │ │176×176dp│     │176×80dp │    │    │
│ │ │         │     ├─────────┤    │    │
│ │ │         │ 8dp │Health   │    │    │  2×1 widgets stack
│ │ │         │     │176×80dp │    │    │  in same column
│ │ └─────────┘     └─────────┘    │    │
│ └─────────────────────────────────┘    │
│                                        │
│ ┌── Search Bar ───────────────────┐    │  full-width - 32dp margin
│ │ [G] ─────────────── [🎤] [📷]  │    │  h:48dp, radius:999px
│ └─────────────────────────────────┘    │  padding: 0 16dp, bg: white/glass
│                                        │  gap: 16dp above/below
│ ┌── App Icon Grid ────────────────┐    │
│ │ 4 columns × 1-2 rows           │    │  padding: 0 24dp
│ │ [icon] [icon] [icon] [icon]     │    │  icon: 60×60dp, radius:18dp
│ │ Store  Gallery Play   Google    │    │  label: 11dp, gap 6dp below icon
│ │                                 │    │  col-gap: ~28dp (evenly fills width)
│ └─────────────────────────────────┘    │  row-gap: 20dp
│                                        │
│          ● ○ ○  (page indicators)      │  dot: 6dp, gap: 6dp, centered
│                                        │  gap: 12dp above dock
│ ┌── Dock (4 icons) ──────────────┐     │  glass pill bg or no bg
│ │ [📞] [💬] [🌐] [📷]           │     │  icon: 60×60dp
│ │ gap: 24dp between icons         │     │  padding: 0 40dp
│ └─────────────────────────────────┘     │  position: ~48dp above nav
│                                        │
│ Navigation Bar (48dp)                  │  [|||] [○] [<] centered
│           ───────                      │  pill: 134×5dp
└────────────────────────────────────────┘
```

### Home Screen — Widget-Heavy Layout (from Image 2, 3)
When homescreen is widget-focused (no app icon grid visible):
```
[Status Bar — 24dp]
  gap: 0
[Widget Area — starts immediately below status bar, ~56dp from top]
  padding: 0 16dp
  
  Row 1: Full-width widget (4×2)
  ┌─────────────────────────────────┐
  │ Calendar/Schedule Widget        │  368×160dp (4×2)
  │ "Today, Wed, Jan 22"    [+]    │  radius: 26dp
  │ ├ 9:30AM  Meeting              │  padding: 16dp 20dp
  │ ├ 1:00PM  Lunch with Luca     │  list items: h:40dp each
  │ └ 5:00PM  Gym                  │  divider: left colored bar 3dp
  └─────────────────────────────────┘
  gap: 8dp
  
  Row 2: 2-column mixed
  ┌─── 2×2 ───┐ 8dp ┌─── 2×1 ───┐
  │ Steps      │     │ Weather   │  80dp
  │ 4,350      │     │ 10° Seoul │
  │ /6,000     │     ├───────────┤
  │ [progress] │     │ Calendar  │  80dp
  │ 176×176dp  │     │ JAN 22   │
  └────────────┘     └───────────┘
  gap: 8dp
  
  Row 3: 2-column equal
  ┌─── 2×2 ───┐ 8dp ┌─── 2×2 ───┐
  │ Photo      │     │ Health    │
  │ (image)    │     │ Rings     │
  │ 176×176dp  │     │ 176×176dp │
  └────────────┘     └───────────┘

[Dock — 4 icons, glass pill or transparent]
[Navigation Bar — 48dp]
```

### Home Screen — App Drawer (from Image 5)
```
[Status Bar — 24dp]
  gap: 0
[App Icon Grid — full screen]
  padding: 24dp 24dp 0
  ├── 4 columns × N rows
  ├── Icon: 60×60dp
  │   ├── Folder icon: same 60×60dp, radius 18dp
  │   │   └── Contains 2×2 mini-icons (16×16dp each) inside
  │   ├── Standard icon: radius 18dp, subtle drop shadow
  │   └── Label: 11dp/400, center-aligned, gap 6dp below
  ├── Column gap: ~28dp (evenly distributed across 360dp - 48dp padding)
  ├── Row gap: 24dp
  └── Max rows visible: ~5 before scroll
  
[flex spacer]
[Page Indicator — 3 dots, centered]
  gap: 16dp below last row
[Search Bar]
  padding: 0 16dp
  height: 44dp
  radius: 999px
  bg: glass G1
  ├── Placeholder: "Search", left-aligned, 14dp
  └── Overflow icon: [⋮] right, 24×24dp
  margin-bottom: 8dp above nav
[Navigation Bar — 48dp (3-button)]
```

### Quick Settings Assembly
```
[Status Bar — 24dp, static]
  gap: 0
[Action Bar — 48dp]
  padding: 0 16dp
  icons: right-aligned [edit, power, settings]
  gap: 0
[QS Toggle Grid]
  padding: 0 24dp
  4 columns × 2 rows (page 1)
  toggle: 64dp circle + label below
  grid-gap: 12dp H, 16dp V
  gap: 12dp
[Page Indicator — 3 dots]
  gap: 16dp
[Brightness Slider]
  padding: 0 24dp
  height: 48dp
  gap: 16dp
[Tile Cards — 2 column grid]
  padding: 0 16dp
  gap: 8dp
  cards: [SmartThings, Modes, etc.]
  gap: 12dp
[Media Control]
  padding: 0 16dp
  2 chips: [Play music, Media output]
  gap: 12dp
[Bottom Shortcuts]
  padding: 0 16dp
  2 items: [Smart View, Song Search]
[Navigation Bar — 48dp (3-button)]
```

### Lock Screen Assembly
```
[Status Bar — 24dp, transparent]
  gap: 0
[Wallpaper — full bleed, z:0]
[Clock — centered or adaptive position]
  position: ~25-35% from top
  font: 64-96dp, SamsungSharpSans, weight 200-300
  gap: 4dp
  date: 16dp, weight 400
  gap: 16dp
[Widgets — optional, below clock]
  max: 2 compact widgets side by side
  gap: 8dp
[flex spacer]
[Now Bar Row — bottom anchored]
  position: bottom 72dp (20dp nav + 52dp clear)
  layout: [quick-action] [now-bar flex] [quick-action]
  gap: 8dp
  quick actions: 48×48dp circles, glass G1
[Navigation Bar — 20dp, gesture]
```

---

## 14. Animation Sequencing in Composition

### Entry Stagger Order
When a screen loads, elements animate in this order:

1. **Static chrome** (0-40ms): Status bar, App bar, Bottom nav — fadeIn
2. **Primary content** (100-200ms): Main heading, hero image — slideUp
3. **Secondary content** (200-350ms): Cards, list items — slideUp with stagger 40ms each
4. **Tertiary** (350-500ms): Chips, badges, metadata — fadeIn
5. **Floating** (400-600ms): FAB, Now Bar — scaleUp + spring

### Transition Between Density Layers
- **Lock → Notification Shade**: slideDown 400ms, gen curve
- **Notification Shade → QS Full**: expand 500ms, gen curve
- **QS Full → Notification Shade**: collapse 400ms, gen curve
- **Any → Dialog**: fadeIn 200ms dim + scaleUp 300ms dialog

---

## 15. Connected Component Pairs

Components that frequently combine and have specific spatial rules:

| Pair | Rule |
|---|---|
| AppBar + SearchBar | Search below AppBar, gap 0, or embedded in AppBar |
| Card + ActionSheet | Sheet rises from card, shares radius on connected edge |
| List + FAB | FAB floats over list, last list item has 72dp bottom padding |
| Input + ErrorText | Error 4dp below input, 12dp font, color: var(--error) |
| Tabs + TabContent | 0 gap, content swipes horizontally, tabs remain fixed |
| Now Bar + Lock Shortcuts | Same horizontal row, Now Bar flex:1, shortcuts fixed 48dp |
| Dialog + Dim | Dim covers everything below z:100, dialog centered or bottom |
| Notification + Notification | Stack vertically, gap 8dp, same radius/material |
| QS Toggle + QS Toggle | Grid layout, never free-positioned |
| Widget + Widget | Grid snapping only, gap 8dp, sizes from fixed set |

---

## 16. Anti-Patterns (Do NOT)

| Anti-Pattern | Correct Pattern |
|---|---|
| Card inside Card | Flat content sections within card, no nested cards |
| Dialog with more than 2 buttons | Max 2 buttons; use ActionSheet for 3+ options |
| FAB overlapping Bottom Nav | FAB positioned 16dp above Bottom Nav top edge |
| Full-width button inside narrow card | Button matches card padding (inset 16-20dp) |
| Scrollable content inside scrollable content | Nested scroll only for horizontal within vertical |
| Opaque overlay on glass surface | Always use glass material for floating elements |
| Mixed radius in same container | All children share parent's radius system |
| Interactive elements under 8dp gap | Minimum 8dp between any two tappable elements |
| Text directly on wallpaper without scrim | Always use glass container or text shadow for readability |
| More than 5 items in Bottom Nav | Maximum 5 items; use "More" for overflow |

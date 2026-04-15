# Gen UI Principles for Samsung One UI 8.5

## A Formal Specification of Generative User Interface Composition in Mobile Operating Systems

---

**Document Version:** 1.0  
**Date:** April 2026  
**Classification:** Research Specification  
**Platform:** Samsung One UI 8.5 (Android 16)  
**Authors:** Design Systems Research Group  

---

## Abstract

This document presents a formal specification of Generative UI (Gen UI) principles derived from empirical analysis of Samsung One UI 8.5, with particular focus on the Quick Settings (QS) design kit and system-level surface composition. We introduce a dichotomous classification model --- Static versus Generative components --- and define twelve governing principles that describe how One UI 8.5 dynamically assembles, stratifies, and renders interface elements across system surfaces. The specification includes a component taxonomy, a formal composition grammar, implementation guidelines, and an evaluation rubric for assessing Gen UI compliance. This work provides a replicable analytical framework for studying generative interface systems in production mobile operating systems.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Component Taxonomy](#3-component-taxonomy)
4. [The Static/Generative Model](#4-the-staticgenerative-model)
5. [Principles](#5-principles)
6. [Component Composition Grammar](#6-component-composition-grammar)
7. [Implementation Guidelines](#7-implementation-guidelines)
8. [Evaluation Framework](#8-evaluation-framework)
9. [Cross-Reference Matrix](#9-cross-reference-matrix)
10. [Conclusion](#10-conclusion)
11. [References](#11-references)

---

## 1. Introduction

### 1.1 Background

Contemporary mobile operating systems have shifted from static, developer-authored layouts toward dynamically composed interfaces that assemble components based on runtime context. Samsung One UI 8.5 represents a mature implementation of this paradigm, where system surfaces such as the lock screen, notification shade, and Quick Settings panel serve as canvases onto which the OS projects contextually appropriate UI components.

We refer to this paradigm as **Generative UI (Gen UI)** --- a system in which interface composition is determined at runtime by evaluating user state, temporal context, active services, and device conditions, then selecting, parameterizing, and arranging components from a finite vocabulary according to a set of compositional rules.

### 1.2 Scope

This specification covers:

- All system-level surfaces in One UI 8.5 (lock screen, notification shade, Quick Settings, Now Bar, edge panels, home screen widgets)
- The component vocabulary available on each surface
- The rules governing component selection, parameterization, and layout
- Visual and motion design constants
- A formal grammar for component composition

This specification does not cover in-app UI patterns beyond system chrome elements (App Bar, Bottom Navigation, Status Bar) that persist across application contexts.

### 1.3 Methodology

Analysis was conducted through systematic decomposition of the Samsung One UI 8.5 Quick Settings design kit, supplemented by observation of live system behavior. Components were catalogued, classified, and their compositional relationships mapped. Principles were derived inductively from recurring structural patterns.

---

## 2. Terminology

| Term | Definition |
|---|---|
| **Gen UI** | Generative User Interface; a system where component composition is determined at runtime based on contextual inputs |
| **Static Component** | A UI element whose presence and position are fixed within a surface; part of the persistent chrome |
| **Gen Component** | A UI element whose presence, configuration, and content are determined dynamically at runtime |
| **Surface** | A full-screen or overlay canvas onto which components are projected (e.g., lock screen, notification shade) |
| **Chrome** | The persistent structural frame of a surface (status bar, navigation bar, app bar) |
| **Composition** | The act of selecting, parameterizing, and arranging Gen Components within a surface |
| **Slot** | A designated region within a surface that accepts Gen Components |
| **Context Vector** | The set of runtime inputs (time, activity, notifications, device state) that drives composition |
| **Pill** | A container shape with border-radius >= 999px, the dominant morphology in One UI 8.5 |
| **Squircle** | A superelliptical rounded rectangle (border-radius ~26px), used for cards and toggles |
| **Glass** | A frosted-blur material treatment with variable opacity, used to communicate depth |
| **Now Bar** | A polymorphic dock component at the bottom of the lock screen that assumes different forms based on active services |

---

## 3. Component Taxonomy

### 3.1 Static Components (Persistent Chrome)

Static components define the structural frame of each surface. Their presence is unconditional; only their content parameters (e.g., time value, battery percentage) change.

| Component | Location | Structure | Behavior |
|---|---|---|---|
| **Status Bar** | Top edge, all surfaces | Time (left), live notification pill (center), Wi-Fi + signal + battery icons (right) | Always visible; icons toggle based on connectivity state |
| **Navigation Bar** | Bottom edge, all surfaces | Gesture bar (thin horizontal line, 134x5dp) OR 3-button row (Recent \|\|\|, Home O, Back <) | Mode set in system settings; persists across all contexts |
| **App Bar** | Top of in-app surfaces | Back arrow (left) + title (center or left-aligned) + overflow menu (right) | Title text and action icons are parameterized per app |
| **Bottom Navigation** | Bottom of in-app surfaces | 4--5 icon+label tab items, evenly distributed | Active tab indicated by filled icon + label color shift |

### 3.2 Generative Components

Gen Components are selected and configured at runtime. Each has a defined structure, a set of parameters, and conditions under which it is instantiated.

#### 3.2.1 Notification Card

| Property | Value |
|---|---|
| **Shape** | Pill (border-radius: 999px) |
| **Material** | Dark glass (blur + 1px border + low-opacity fill) |
| **Structure** | Icon + App Name + Content Text + Timestamp + Action Buttons |
| **Actions** | Checkmark (dismiss/complete), expand, reply |
| **Grouping** | Stratified into Live / Other / Silent sections |
| **Trigger** | Any pending notification from installed applications |

#### 3.2.2 Now Bar

| Property | Value |
|---|---|
| **Shape** | Pill (border-radius: 999px), bottom-docked |
| **Material** | Tinted glass; tint color varies by active state |
| **States** | Media Player, Timer, Delivery Tracker, Battery Charging |
| **Media Player State** | Album art (left) + title/artist (center) + playback controls (right); teal glass background |
| **Timer State** | Timer icon + elapsed time + controls; green accent |
| **Delivery State** | Service icon + status text + ETA; service-branded color |
| **Charging State** | Battery icon + percentage + time remaining; gradient green background |
| **Trigger** | Active foreground service (media, timer, delivery, charging) |

#### 3.2.3 Lock Screen Widget

| Property | Value |
|---|---|
| **Shape** | Squircle (border-radius: 26px) or circular gauge |
| **Material** | Dark-on-dark, minimal contrast for ambient visibility |
| **Layout** | 2-column grid, small form factor (approx. 2x1 grid units) |
| **Types** | Weather (temperature + icon), Health (activity rings, heart rate), Clock (analog/digital) |
| **Trigger** | User configuration + data availability from paired services |

#### 3.2.4 Quick Settings Toggle

| Property | Value |
|---|---|
| **Shape** | Rounded squircle icon on colored circular background |
| **Layout** | 6-column x 4-row grid |
| **Material** | Opaque colored fill (active) or muted glass (inactive) |
| **Color** | Category-coded (see Principle P3) |
| **Interaction** | Tap to toggle; long-press for settings |
| **Trigger** | System capabilities; user-configurable arrangement |

#### 3.2.5 Media Player Card

| Property | Value |
|---|---|
| **Shape** | Large squircle (border-radius: 26px) |
| **Structure** | Album art (full bleed or contained) + title + artist + progress bar + playback controls |
| **Material** | Extracted palette from album art applied to background |
| **Trigger** | Active media session |

#### 3.2.6 Home Screen Widget

| Property | Value |
|---|---|
| **Shape** | Squircle (border-radius: 26px) |
| **Sizes** | 2x1, 2x2, 4x2 grid units (based on 8px base grid) |
| **Material** | Opaque fill with light/dark mode variants |
| **Trigger** | User placement; data from widget provider |

#### 3.2.7 Compound Components

| Component | Structure | Notes |
|---|---|---|
| **SmartThings Card** | Header pill (icon + title + subtitle) + action icon row (up to 4 icons) | Connected composition (P11) |
| **Snackbar** | Text button + contained button, bottom-anchored | Transient; auto-dismiss or user action |
| **Dialog (Bottom Sheet)** | Title + description + Cancel/Apply button pair | Modal; blocks underlying surface |
| **Edge Panel** | Vertical panel (Large or Small variant) with glass tint | Slide-in from screen edge |
| **Keyboard** | Key grid + number row + suggestion chips row | Dark/light variants; chips are Gen components |
| **Browser Top Bar** | Row of circular icon buttons (History, Downloads, Galaxy AI, Add Page, Settings) | Dark/light variants |
| **Page Indicator** | Vertical dot column (1--5 dots) | Indicates pagination state |
| **Connected Tab** | Outlined pill with "+" text | Tap to add/connect a new item |
| **Bottom FAB** | Circular button, coral/red fill | Primary creation action |
| **Slide Nav Button** | Icon + label (e.g., "Send"), 4 variants (light/dark x outlined/filled) | Contextual action |

---

## 4. The Static/Generative Model

### 4.1 Conceptual Framework

The Static/Generative (S/G) model partitions all UI elements into two disjoint classes:

```
U = S + G

where:
  U = the set of all UI elements on a given surface
  S = {e in U | presence(e) is unconditional on context vector}
  G = {e in U | presence(e) is conditional on context vector}
```

**Static elements** (S) form the container --- the skeletal frame that persists regardless of what the user is doing, what notifications exist, or what services are running. They provide spatial anchoring and navigational affordance.

**Generative elements** (G) fill the container --- they are projected into slots within the static frame based on the current context vector. Their presence, quantity, parameterization, and arrangement are all runtime decisions.

### 4.2 The Container/Content Relationship

```
Surface = Chrome(S) + Canvas(G*)

where:
  Chrome(S) = fixed layout of static elements
  Canvas(G*) = zero or more generative elements in slotted regions
```

A surface with no active context vector may render only its Chrome. For example, a clean lock screen with no notifications, no active media, and no timers displays only the Status Bar (S), clock (S), and Navigation Bar (S). As context accumulates, Gen components populate the canvas.

### 4.3 Classification Decision Procedure

To classify a component as Static or Generative, apply the following test:

1. **Presence Test:** Can this component be absent from the surface under any valid system state? If yes, it is Generative.
2. **Position Test:** Does this component occupy a fixed position in the layout hierarchy regardless of other components? If yes, it is Static.
3. **Parameterization Test:** Is the component's structure (not just its data) determined at runtime? If yes, it is Generative.

A component that passes all three tests as "no, yes, no" is Static. Any other result classifies the component as Generative.

### 4.4 Boundary Cases

| Component | Classification | Rationale |
|---|---|---|
| Status Bar clock | Static | Always present, fixed position, fixed structure |
| Status Bar notification pill | Generative | Absent when no live notifications; content varies |
| Navigation Bar | Static | Always present, fixed position, mode set at settings level |
| Now Bar | Generative | Absent when no foreground service; polymorphic structure |
| App Bar title | Static (parameterized) | Always present in-app; text content varies but structure is fixed |
| Notification Cards | Generative | Absent when no notifications; quantity and content vary |

---

## 5. Principles

### P1: Component Role Classification

| Field | Value |
|---|---|
| **ID** | P1 |
| **Name** | Component Role Classification |
| **Definition** | Every UI element in a One UI 8.5 surface is classified as either Static (persistent chrome that defines the container) or Generative (dynamically composed content that fills the container). No element exists outside this dichotomy. |
| **Rationale** | Binary classification enables predictable spatial reasoning. Users develop stable mental models of where container boundaries are, allowing them to focus cognitive resources on interpreting Gen content rather than re-learning the frame. |
| **Implementation Rule** | Before rendering any surface, partition all elements into S and G sets. Render S elements first to establish the spatial frame. Then evaluate the context vector and project G elements into available slots. S elements must never be displaced by G elements. |
| **Examples** | Status Bar (S) remains fixed while notification cards (G) scroll beneath it. Bottom Navigation (S) persists while tab content (G) swaps. Now Bar (G) appears only when a foreground service provides content. |
| **Cross-references** | P4 (Progressive Density), P5 (Glass Hierarchy) |

---

### P2: Contextual Assembly

| Field | Value |
|---|---|
| **ID** | P2 |
| **Name** | Contextual Assembly |
| **Definition** | Generative components are assembled from atomic sub-components based on a runtime context vector comprising time, user activity, active services, device state, and notification queue. The same slot may host structurally different components depending on context. |
| **Rationale** | Contextual assembly enables a finite component vocabulary to serve an unbounded set of user scenarios. Rather than pre-authoring screens for every state combination, the system composes appropriate interfaces on demand. |
| **Implementation Rule** | Define a context vector `C = {t, a, s, d, n}` where t=time, a=activity, s=services, d=device state, n=notifications. For each Gen slot, define a selection function `f(C) -> Component | null` that maps context to the appropriate component (or empty). Components must be fully parameterized by the context vector; no component should require out-of-band configuration at render time. |
| **Examples** | Now Bar slot: if `s` contains active media session, render MediaPlayer variant. If `s` contains active timer, render Timer variant. If `s` contains delivery tracking, render DeliveryTracker variant. If `s` is empty, render nothing. Lock Screen widget slot: if `t` is morning, prioritize weather widget. If `a` indicates workout, prioritize health rings. |
| **Cross-references** | P1 (Classification), P9 (Notification Stratification), P10 (Ambient Reactivity) |

---

### P3: Semantic Color Mapping

| Field | Value |
|---|---|
| **ID** | P3 |
| **Name** | Semantic Color Mapping |
| **Definition** | Each functional category in the system is assigned a dedicated color that is used consistently across all components belonging to that category. Color assignment is informational, not decorative; it encodes functional meaning. |
| **Rationale** | Consistent color-function mapping enables pre-attentive processing. Users learn category associations through repeated exposure, allowing them to identify component function from color alone without reading labels. This reduces cognitive load on information-dense surfaces like Quick Settings. |
| **Implementation Rule** | Maintain a global semantic color registry. Each functional category is assigned exactly one hue. All components in that category must use the assigned hue for their active/accent state. The mapping must be stable across surfaces and sessions. |

**Semantic Color Registry (One UI 8.5):**

| Category | Hue | Hex (approx.) | Usage Examples |
|---|---|---|---|
| Connectivity | Blue | #4A90D9 | Wi-Fi, Bluetooth, Mobile Data, NFC toggles |
| Accessibility | Green | #4CAF50 | Accessibility toggles, timer accents |
| AI / Bixby | Purple | #9C27B0 | Bixby toggle, Galaxy AI browser icon |
| Health / Fitness | Pink | #E91E63 | Health rings, heart rate widget |
| Battery / Power | Orange | #FF9800 | Battery toggle, power mode, charging status |
| Settings / System | Teal | #009688 | Settings toggles, media player glass tint |
| Communication | Coral/Red | #FF5252 | FAB button, missed call indicators |

| **Examples** | Quick Settings toggles use category color as background fill when active. Now Bar uses teal glass for media (Settings/System), green for timer (Accessibility), gradient green for charging (contextual blend). Lock screen health widget uses pink rings. |
| **Cross-references** | P5 (Glass Hierarchy), P10 (Ambient Reactivity), P12 (Dual-Mode Rendering) |

---

### P4: Progressive Density

| Field | Value |
|---|---|
| **ID** | P4 |
| **Name** | Progressive Density |
| **Definition** | Information density increases monotonically as the user navigates from ambient surfaces to active surfaces. Each successive layer adds information without removing the context established by previous layers. |
| **Rationale** | Progressive density respects the user's attention gradient. Ambient surfaces (lock screen) present minimal, glanceable information. As the user engages more deeply (pulling down notification shade, expanding Quick Settings), the system reveals additional density proportional to the user's demonstrated intent. |
| **Implementation Rule** | Define a density ordering: Lock Screen (D1) < Notification Shade (D2) < Quick Settings expanded (D3) < Full Application (D4). Each layer D_n must contain all information from D_{n-1} plus additional content. Transitions between layers must be continuous (no abrupt jumps in density). |

**Density Progression:**

| Layer | Density Level | Content | Component Count (typical) |
|---|---|---|---|
| Lock Screen | D1 - Ambient | Time, date, Now Bar, 1--2 widgets | 3--5 |
| Notification Shade (collapsed) | D2 - Glance | D1 + notification cards (top 3--5), 6 QS toggles | 10--15 |
| Quick Settings (expanded) | D3 - Operational | D2 + full QS grid (6x4), brightness slider, media player card | 30--40 |
| Full Application | D4 - Immersive | App-specific content, full navigation, all interactive elements | 50+ |

| **Examples** | Lock screen shows time + weather widget + Now Bar media pill. Swipe down reveals notification cards above QS toggles. Swipe down again expands QS to full 6x4 grid with brightness and media controls. Tap a toggle to enter full Settings app. |
| **Cross-references** | P1 (Classification), P5 (Glass Hierarchy), P7 (Grid Quantization) |

---

### P5: Glass Hierarchy

| Field | Value |
|---|---|
| **ID** | P5 |
| **Name** | Glass Hierarchy |
| **Definition** | Frosted glass material treatments are applied at varying opacity levels to communicate z-depth, interactivity, and importance. Higher opacity indicates greater interactivity or importance. |
| **Rationale** | Glass hierarchy provides a continuous depth cue without relying on drop shadows (which conflict with the flat-glass aesthetic of One UI 8.5). Users intuitively perceive more opaque elements as "closer" and more interactive, enabling rapid visual parsing of layered surfaces. |
| **Implementation Rule** | Define a glass opacity scale with at minimum three tiers. All Gen components on a given surface must use the tier appropriate to their interactivity level. Glass treatment includes: backdrop-filter blur (range: 16--40px), border (1px, white at 8--15% opacity), and background fill (category color or neutral at 10--60% opacity). |

**Glass Tier Definitions:**

| Tier | Opacity Range | Blur | Border | Usage |
|---|---|---|---|---|
| G0 - Background | 5--15% | 40px | 1px @ 8% white | Wallpaper overlay, surface scrim |
| G1 - Container | 15--30% | 24px | 1px @ 10% white | Notification cards, inactive toggles |
| G2 - Interactive | 30--50% | 16px | 1px @ 12% white | Active toggles, Now Bar, media player |
| G3 - Elevated | 50--70% | 12px | 1px @ 15% white | Dialogs, bottom sheets, focused inputs |

| **Examples** | Lock screen wallpaper has G0 scrim. Notification cards use G1. Active Now Bar media player uses G2 with teal tint. Bottom sheet dialog uses G3. |
| **Cross-references** | P1 (Classification), P3 (Semantic Color), P4 (Progressive Density), P12 (Dual-Mode Rendering) |

---

### P6: Pill Morphology

| Field | Value |
|---|---|
| **ID** | P6 |
| **Name** | Pill Morphology |
| **Definition** | The pill shape (border-radius >= 999px or equivalent full rounding) is the dominant container morphology in One UI 8.5. It is used for primary interactive elements, transient containers, and status indicators. Secondary containers use squircle morphology (border-radius: 26px). |
| **Rationale** | The pill shape maximizes touch target efficiency for single-axis content (text labels, status indicators, media controls) while providing strong visual differentiation from the rectangular grid of the underlying system. Pills read as "objects on a surface" rather than "regions of a surface," reinforcing the Gen component model. |
| **Implementation Rule** | Apply pill morphology (border-radius: 999px) to: Now Bar, notification pills, chips, Connected Tabs, suggestion chips, and any single-row interactive element. Apply squircle morphology (border-radius: 26px) to: cards, dialogs, widgets, media players, and any multi-row container. Apply circular morphology (border-radius: 50%) to: toggles, icon buttons, FABs, and avatar containers. Never use sharp corners (border-radius: 0) on Gen components. |

**Shape Registry:**

| Shape | Border Radius | Application |
|---|---|---|
| Pill | 999px | Now Bar, notification pill, chips, Connected Tab, slide nav buttons |
| Squircle | 26px | Cards, widgets, media player, dialogs, image containers |
| Circle | 50% | QS toggle icons, browser top bar icons, FAB, page indicator dots |
| Rounded Rectangle | 18px | Contained buttons, text fields, snackbar actions |

| **Examples** | Now Bar is a full-width pill. Each notification card is a pill. QS toggle icons are circles on colored circle backgrounds. Media player card is a squircle. Dialog bottom sheet has squircle top corners. |
| **Cross-references** | P7 (Grid Quantization), P11 (Connected Composition) |

---

### P7: Grid Quantization

| Field | Value |
|---|---|
| **ID** | P7 |
| **Name** | Grid Quantization |
| **Definition** | All spatial dimensions --- component sizes, margins, padding, and gaps --- are quantized to multiples of an 8dp base unit. Widget sizing follows a discrete grid system with defined size classes. |
| **Rationale** | Grid quantization ensures visual rhythm and alignment across heterogeneous Gen components. When all components share a common spatial frequency, they align naturally even when composed dynamically. This eliminates the visual noise that arises from pixel-level variation in auto-generated layouts. |
| **Implementation Rule** | All spacing values must be a member of the set {4, 8, 12, 16, 24, 32, 40, 48, 64}dp, with 8dp as the base unit (4dp and 12dp permitted as half/1.5x exceptions for tight contexts). Widget sizes must conform to defined grid classes. Component internal padding must be >= 16dp. |

**Widget Size Classes:**

| Class | Grid Units | Approximate Dimensions | Usage |
|---|---|---|---|
| Compact | 2x1 | 176 x 80dp | Single-metric widgets (weather temp, step count) |
| Standard | 2x2 | 176 x 176dp | Multi-metric widgets (weather detail, clock, health) |
| Wide | 4x2 | 368 x 176dp | Rich widgets (calendar, music, SmartThings) |
| Full | 4x4 | 368 x 368dp | Immersive widgets (photo frame, map) |

**Spacing Scale:**

| Token | Value | Usage |
|---|---|---|
| `space-xs` | 4dp | Icon-to-label gap within a toggle |
| `space-sm` | 8dp | Between items in a dense row |
| `space-md` | 16dp | Card internal padding; between notification cards |
| `space-lg` | 24dp | Section spacing in QS panel |
| `space-xl` | 32dp | Between major surface regions |

| **Examples** | QS toggle grid: 6 columns with 8dp column gap and 16dp row gap. Notification cards: 16dp internal padding, 8dp gap between cards. Widget placement snaps to grid intersections. |
| **Cross-references** | P4 (Progressive Density), P6 (Pill Morphology), P11 (Connected Composition) |

---

### P8: Motion as Meaning

| Field | Value |
|---|---|
| **ID** | P8 |
| **Name** | Motion as Meaning |
| **Definition** | Animation curves and durations encode component classification. Static components use restrained, direct motion (Basic Path). Generative components use expressive, spring-based motion (Emphasized Path). Motion is not decorative --- it communicates whether an element is structural or dynamic. |
| **Rationale** | Motion differentiation reinforces the S/G classification at a perceptual level. Users process motion pre-attentively; consistent motion signatures allow them to distinguish chrome transitions from content transitions without conscious analysis. |
| **Implementation Rule** | Assign motion profiles based on component classification. Static components: Basic Path curve (cubic-bezier(0.22, 0.25, 0, 1)), duration 200--300ms. Generative components: Emphasized Path curve (cubic-bezier(0.05, 0.7, 0.1, 1.0)) or spring dynamics (stiffness: 300, damping: 25), duration 300--500ms. Transitions between density layers (P4) use Emphasized Path at 400--500ms. |

**Motion Profiles:**

| Profile | Curve | Duration | Application |
|---|---|---|---|
| Basic Path | `cubic-bezier(0.22, 0.25, 0, 1)` | 200--300ms | Status bar transitions, nav bar mode switch, app bar title change |
| Emphasized Path | `cubic-bezier(0.05, 0.7, 0.1, 1.0)` | 300--500ms | Notification card entry/exit, Now Bar state morph, widget appearance |
| Spring | stiffness: 300, damping: 25 | Variable (settles ~400ms) | Toggle activation, pull-to-refresh, overscroll |
| Density Transition | `cubic-bezier(0.05, 0.7, 0.1, 1.0)` | 400--500ms | Lock screen to notification shade, QS collapse/expand |

| **Examples** | Pulling down notification shade: shade surface uses Density Transition (400ms). Individual notification cards within the shade use staggered Emphasized Path (300ms each, 50ms stagger). Status bar crossfades using Basic Path (200ms). |
| **Cross-references** | P1 (Classification), P4 (Progressive Density) |

---

### P9: Notification Stratification

| Field | Value |
|---|---|
| **ID** | P9 |
| **Name** | Notification Stratification |
| **Definition** | Notifications are partitioned into three urgency tiers --- Live, Other, and Silent --- each with distinct visual weight, position, and interaction affordances. Tier assignment is determined by notification priority flags and active state. |
| **Rationale** | Stratification prevents notification fatigue by ensuring high-urgency items are visually dominant while low-urgency items are present but subdued. Users can triage notifications by spatial position alone, without reading each one. |
| **Implementation Rule** | Render notification sections in fixed vertical order: Live (top) > Other (middle) > Silent (bottom). Each section has a text header label. Visual weight decreases per tier: Live uses G2 glass with accent color indicators; Other uses G1 glass with neutral styling; Silent uses G0 glass with reduced opacity text. Live notifications may include inline interactive controls (buttons, progress indicators). |

**Notification Tiers:**

| Tier | Header Text | Glass Level | Text Opacity | Interactive | Position |
|---|---|---|---|---|---|
| Live | "Live notifications" | G2 | 100% | Yes (buttons, controls) | Top |
| Other | "Other notifications" | G1 | 90% | Limited (expand, dismiss) | Middle |
| Silent | "Silent notifications" | G0 | 60% | Minimal (dismiss only) | Bottom |

| **Examples** | An ongoing phone call appears as a Live notification with answer/decline buttons. A messaging notification appears in Other with expand to reply. A weather update appears in Silent with only a dismiss action. |
| **Cross-references** | P2 (Contextual Assembly), P4 (Progressive Density), P5 (Glass Hierarchy) |

---

### P10: Ambient Reactivity

| Field | Value |
|---|---|
| **ID** | P10 |
| **Name** | Ambient Reactivity |
| **Definition** | UI elements passively adapt their visual properties in response to ambient conditions: wallpaper color palette, time of day, user activity state, and device orientation. These adaptations are continuous and non-disruptive. |
| **Rationale** | Ambient reactivity creates a sense of environmental coherence. The interface feels like a living surface that breathes with the user's context rather than a static overlay. This increases perceived quality and reduces the cognitive dissonance between wallpaper content and UI chrome. |
| **Implementation Rule** | Extract a 5-color palette from the active wallpaper at set time. Apply palette to glass tints (P5), accent colors (where not overridden by semantic color P3), and surface fills. Time-of-day adaptation: shift color temperature warmer after sunset. Activity adaptation: refresh widget data and Now Bar state when activity changes are detected. All ambient changes must use Basic Path motion (P8) with duration >= 500ms to avoid perceptible jumps. |
| **Examples** | Blue-toned wallpaper produces blue-tinted glass on notification cards. Evening hours shift glass tints warmer. Starting a run foregrounds the health widget on the lock screen. Plugging in the charger transitions the Now Bar to charging state. |
| **Cross-references** | P2 (Contextual Assembly), P3 (Semantic Color), P5 (Glass Hierarchy), P8 (Motion as Meaning) |

---

### P11: Connected Composition

| Field | Value |
|---|---|
| **ID** | P11 |
| **Name** | Connected Composition |
| **Definition** | Two or more Gen components can be "connected" --- rendered with zero inter-component spacing within a shared container --- to form compound widgets. Connected components share a visual boundary but maintain independent internal structure and data bindings. |
| **Rationale** | Connected composition enables complex information displays without requiring monolithic mega-components. Each sub-component retains its own identity and can be independently updated, but the visual grouping communicates functional relationship to the user. |
| **Implementation Rule** | When connecting components: set inter-component gap to 0dp. Apply a shared container with the appropriate shape (P6) --- typically squircle for multi-row compounds, pill for single-row compounds. Each sub-component retains its internal padding (P7). The shared container's glass level (P5) should be the maximum of its children's glass levels. |
| **Examples** | SmartThings card: header pill (icon + title + subtitle) connected to action icon row (4 circular icon buttons), wrapped in a shared squircle container. Snackbar: text label connected to contained action button within a shared pill. Button pair in dialogs: "Cancel" (flat) connected to "Apply" (contained) within a shared row. |
| **Cross-references** | P6 (Pill Morphology), P7 (Grid Quantization), P5 (Glass Hierarchy) |

---

### P12: Dual-Mode Rendering

| Field | Value |
|---|---|
| **ID** | P12 |
| **Name** | Dual-Mode Rendering |
| **Definition** | Every component must render correctly in both dark and light appearance modes. Mode switching is not limited to color inversion; it requires a complete material treatment change. Dark mode uses glass treatments on dark surfaces; light mode uses opaque fills on light surfaces. |
| **Rationale** | Dark and light modes serve different environmental contexts (low-light vs. bright ambient). A naive color inversion produces illegible or aesthetically broken results. Complete material treatment switching ensures each mode is independently optimized for its target environment. |
| **Implementation Rule** | For each component, define two material treatments: Dark (glass-based: frosted blur + tinted fill + thin bright border) and Light (opaque-based: solid fill + subtle shadow + no blur). Surface colors: dark mode base #171717, light mode base #FCFCFC. Text: dark mode white at 87/60/38% opacity (primary/secondary/disabled), light mode black at 87/60/38%. All semantic colors (P3) must have dark-mode and light-mode variants with matched perceived brightness. |

**Mode Material Comparison:**

| Property | Dark Mode | Light Mode |
|---|---|---|
| Surface base | #171717 | #FCFCFC |
| Card material | Glass (blur + tinted fill + 1px border) | Opaque (#FFFFFF, elevation shadow 1dp) |
| Text primary | #FFFFFF @ 87% | #000000 @ 87% |
| Text secondary | #FFFFFF @ 60% | #000000 @ 60% |
| Toggle active | Semantic color @ 100% on dark fill | Semantic color @ 100% on light fill |
| Toggle inactive | #FFFFFF @ 15% fill | #000000 @ 8% fill |
| Now Bar | Tinted glass (blur + category color fill) | Tinted opaque (category color @ 15% + solid white) |
| Keyboard | Dark keys on #1E1E1E surface | Light keys on #F0F0F0 surface |

| **Examples** | Dark mode notification card: G1 glass with white text. Light mode notification card: white opaque fill with dark text and 1dp shadow. Dark mode QS toggle: colored circle on dark glass. Light mode QS toggle: colored circle on light opaque fill. Browser top bar icons: white strokes on dark, dark strokes on light. |
| **Cross-references** | P3 (Semantic Color), P5 (Glass Hierarchy), P10 (Ambient Reactivity) |

---

## 6. Component Composition Grammar

The following grammar defines the valid compositions of Gen UI components on One UI 8.5 surfaces. The notation uses a BNF-style formalism extended with quantifiers.

### 6.1 Terminal Symbols

```
<status-bar>      ::= TIME NOTIFICATION-PILL? SYSTEM-ICONS
<nav-bar>         ::= GESTURE-BAR | BUTTON-ROW
<app-bar>         ::= BACK-ICON TITLE OVERFLOW-MENU?
<bottom-nav>      ::= TAB-ITEM{4,5}
<notification>    ::= ICON APP-NAME CONTENT TIMESTAMP ACTION*
<now-bar>         ::= MEDIA-STATE | TIMER-STATE | DELIVERY-STATE | CHARGING-STATE
<qs-toggle>       ::= ICON COLOR-BG LABEL?
<widget>          ::= WIDGET-CONTENT SIZE-CLASS
<media-player>    ::= ALBUM-ART TITLE ARTIST PROGRESS CONTROLS
<dialog>          ::= TITLE DESCRIPTION? BUTTON-PAIR
<snackbar>        ::= TEXT-LABEL ACTION-BUTTON
<fab>             ::= ICON
<chip>            ::= LABEL ICON?
<edge-panel>      ::= PANEL-CONTENT PANEL-SIZE
<page-indicator>  ::= DOT{1,5}
<connected-tab>   ::= "+" LABEL?
<keyboard>        ::= KEY-GRID NUMBER-ROW? CHIP-ROW?
```

### 6.2 Non-Terminal Productions

```
<surface>         ::= <lock-screen> | <notification-shade> | <qs-panel>
                    | <app-surface> | <home-screen>

<lock-screen>     ::= <chrome>
                       <widget-area>?
                       <now-bar>?

<notification-shade> ::= <chrome>
                          <qs-mini>
                          <notification-list>

<qs-panel>        ::= <chrome>
                       <qs-grid>
                       <brightness-slider>?
                       <media-player>?
                       <device-control>?

<app-surface>     ::= <chrome>
                       <app-content>
                       <bottom-nav>?

<home-screen>     ::= <chrome>
                       <widget-grid>
                       <app-icon-grid>
                       <page-indicator>?

<chrome>          ::= <status-bar> <nav-bar>

<widget-area>     ::= <widget>{0,4}

<notification-list> ::= <live-section>? <other-section>? <silent-section>?

<live-section>    ::= HEADER("Live notifications") <notification>{1,}

<other-section>   ::= HEADER("Other notifications") <notification>{1,}

<silent-section>  ::= HEADER("Silent notifications") <notification>{1,}

<qs-mini>         ::= <qs-toggle>{6}

<qs-grid>         ::= <qs-toggle>{6,24}

<widget-grid>     ::= <widget>{0,8}

<compound>        ::= <connected-header> <connected-body>
                    | <snackbar>
                    | <dialog>

<connected-header> ::= ICON TITLE SUBTITLE?

<connected-body>  ::= ICON-BUTTON{1,4}
                    | CONTENT-BLOCK

<button-pair>     ::= FLAT-BUTTON CONTAINED-BUTTON
                    | OUTLINED-BUTTON OUTLINED-BUTTON

<menu>            ::= MENU-ITEM{1,6}
```

### 6.3 Constraints (Well-Formedness Rules)

```
C1: Every <surface> must contain exactly one <chrome>.
C2: <now-bar> may appear on at most one surface at a time.
C3: <notification-list> sections must appear in order: live > other > silent.
C4: <qs-grid> column count is fixed at 6; row count is variable (1--4).
C5: <widget> SIZE-CLASS must be one of {2x1, 2x2, 4x2, 4x4}.
C6: <button-pair> members must have contrasting visual weight (flat+contained or outlined+outlined).
C7: <compound> children share a single container boundary (gap = 0).
C8: <menu> items must not exceed 6 per column; overflow requires a second column or scroll.
C9: <notification> within <live-section> must include at least one ACTION.
C10: <chrome> elements must render before any Gen elements on the same surface.
```

### 6.4 Composition Example

A lock screen with active media and two widgets:

```
<lock-screen>
  <chrome>
    <status-bar> 9:41 [notification-pill:"Spotify"] [wifi, signal-4, battery-85] </status-bar>
    <nav-bar> GESTURE-BAR </nav-bar>
  </chrome>
  <widget-area>
    <widget> Weather(72F, Sunny) 2x1 </widget>
    <widget> HeartRate(72bpm) 2x1 </widget>
  </widget-area>
  <now-bar>
    MEDIA-STATE(album:"Kind of Blue", artist:"Miles Davis", playing:true, tint:teal)
  </now-bar>
</lock-screen>
```

---

## 7. Implementation Guidelines

### 7.1 Rendering Pipeline

The following pipeline describes the order of operations for composing a Gen UI surface:

```
1. RESOLVE context vector C = {t, a, s, d, n}
2. SELECT surface template based on user interaction state
3. RENDER chrome (Static components) into fixed positions
4. EVALUATE Gen slots:
   For each slot in surface template:
     a. APPLY selection function f(C) to determine component (or null)
     b. If component != null:
        i.   PARAMETERIZE component with context data
        ii.  APPLY material treatment based on glass tier (P5) and mode (P12)
        iii. APPLY semantic color (P3) if applicable
        iv.  APPLY shape (P6) based on component type
        v.   SIZE component to grid (P7)
        vi.  QUEUE entry animation (P8)
5. LAYOUT Gen components within slots using grid quantization (P7)
6. APPLY ambient reactivity adjustments (P10)
7. EXECUTE queued animations
```

### 7.2 Visual Constants Reference

| Constant | Value | Notes |
|---|---|---|
| Base grid unit | 8dp | All spacing derives from this |
| Card corner radius | 26px | Squircle morphology |
| Pill corner radius | 999px | Full rounding |
| Button corner radius | 18px | Rounded rectangle |
| Icon container radius | 50% | Circular |
| Glass blur range | 12--40px | Varies by tier |
| Glass border | 1px solid rgba(255,255,255,0.08--0.15) | Varies by tier |
| Dark surface | #171717 | RGB(23,23,23) |
| Light surface | #FCFCFC | RGB(252,252,252) |
| Min touch target | 48dp | Per Android accessibility guidelines |
| Status bar height | 24dp | System-defined |
| Navigation bar height | 48dp (buttons) / 20dp (gesture) | Mode-dependent |
| QS toggle grid | 6 columns | Fixed column count |
| Now Bar height | 64dp | Approximate; content-dependent |
| Animation fps | 60--120fps | Adaptive to device capability |
| Image container radius | 26px | Matches card radius |
| Dashed placeholder border | 1px dashed rgba(255,255,255,0.3) | For empty image slots |

### 7.3 Typography Scale

One UI 8.5 uses the Samsung One font family. The following scale applies within Gen components:

| Role | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display | 34sp | Light (300) | 40sp | Lock screen clock |
| Headline | 22sp | Medium (500) | 28sp | Card titles, dialog titles |
| Title | 18sp | Medium (500) | 24sp | App bar title, section headers |
| Body | 16sp | Regular (400) | 22sp | Notification content, descriptions |
| Label | 14sp | Medium (500) | 18sp | Button labels, tab labels, toggle labels |
| Caption | 12sp | Regular (400) | 16sp | Timestamps, secondary metadata |

### 7.4 Interaction Patterns

| Pattern | Gesture | Response | Notes |
|---|---|---|---|
| Toggle activation | Single tap | State toggle + spring animation (P8) | Haptic feedback: light tick |
| Toggle settings | Long press | Navigate to full settings screen | 300ms hold threshold |
| Notification expand | Tap | Expand card to reveal full content + actions | Emphasized Path (P8) |
| Notification dismiss | Horizontal swipe | Slide out + fade | 200ms, Basic Path |
| Now Bar expand | Tap | Expand to full media / timer control | Density Transition (P8) |
| QS pull-down | Vertical swipe from status bar | Reveal notification shade (D1 to D2) | Spring dynamics |
| QS expand | Second vertical swipe | Expand to full QS grid (D2 to D3) | Density Transition |
| Edge panel reveal | Swipe from screen edge | Slide in edge panel | Emphasized Path, 300ms |
| Widget resize | Long press + drag handles | Snap to grid size class (P7) | Grid quantization enforced |

---

## 8. Evaluation Framework

### 8.1 Compliance Rubric

The following rubric assesses the degree to which a component or surface conforms to the Gen UI principles. Each principle is scored on a 0--3 scale.

| Score | Label | Criteria |
|---|---|---|
| 0 | Non-compliant | Principle is violated or not addressed |
| 1 | Partial | Principle is partially implemented with significant gaps |
| 2 | Compliant | Principle is fully implemented with minor deviations |
| 3 | Exemplary | Principle is fully implemented and serves as a reference example |

### 8.2 Principle Evaluation Matrix

For each component under evaluation, score every applicable principle:

| Principle | ID | Weight | Score (0--3) | Weighted Score |
|---|---|---|---|---|
| Component Role Classification | P1 | 1.0 | ___ | ___ |
| Contextual Assembly | P2 | 1.5 | ___ | ___ |
| Semantic Color Mapping | P3 | 1.0 | ___ | ___ |
| Progressive Density | P4 | 1.0 | ___ | ___ |
| Glass Hierarchy | P5 | 1.5 | ___ | ___ |
| Pill Morphology | P6 | 0.5 | ___ | ___ |
| Grid Quantization | P7 | 1.0 | ___ | ___ |
| Motion as Meaning | P8 | 1.0 | ___ | ___ |
| Notification Stratification | P9 | 0.5 | ___ | ___ |
| Ambient Reactivity | P10 | 1.0 | ___ | ___ |
| Connected Composition | P11 | 0.5 | ___ | ___ |
| Dual-Mode Rendering | P12 | 1.5 | ___ | ___ |
| **Total** | | **12.0** | | **/36.0** |

**Compliance Thresholds:**

| Score Range | Rating | Interpretation |
|---|---|---|
| 30.0--36.0 | Fully Compliant | Component meets all Gen UI principles at a high standard |
| 24.0--29.9 | Substantially Compliant | Component meets most principles; minor remediation needed |
| 18.0--23.9 | Partially Compliant | Component meets core principles but has significant gaps |
| 12.0--17.9 | Minimally Compliant | Component violates several principles; major revision needed |
| 0.0--11.9 | Non-Compliant | Component does not follow the Gen UI framework |

### 8.3 Surface-Level Evaluation Procedure

To evaluate a complete surface (e.g., lock screen, notification shade):

1. **Inventory:** List all components present on the surface.
2. **Classify:** Assign each component as Static or Generative (P1).
3. **Validate Grammar:** Verify the composition against Section 6 grammar rules and well-formedness constraints.
4. **Score Components:** Apply the Principle Evaluation Matrix (Section 8.2) to each Gen component.
5. **Assess Transitions:** Evaluate motion profiles for all entry, exit, and state-change animations (P8).
6. **Mode Test:** Verify rendering in both dark and light modes (P12).
7. **Ambient Test:** Verify behavior with at least 3 different wallpaper color palettes (P10).
8. **Density Walk:** Navigate through all density layers (D1 through D4) and verify progressive density (P4).
9. **Aggregate:** Compute mean weighted score across all components. Apply compliance thresholds.

### 8.4 Evaluation Checklist (Quick Reference)

| # | Check | Principle | Pass/Fail |
|---|---|---|---|
| 1 | All components classified as S or G | P1 | ___ |
| 2 | Gen components absent when context is empty | P2 | ___ |
| 3 | Functional categories use consistent colors | P3 | ___ |
| 4 | Deeper layers contain strictly more information | P4 | ___ |
| 5 | Glass opacity correlates with interactivity | P5 | ___ |
| 6 | Pills for single-row, squircles for multi-row | P6 | ___ |
| 7 | All spacing is a multiple of 8dp (or 4/12 exceptions) | P7 | ___ |
| 8 | S components use Basic Path; G components use Emphasized/Spring | P8 | ___ |
| 9 | Notifications ordered: Live > Other > Silent | P9 | ___ |
| 10 | Glass tints adapt to wallpaper palette | P10 | ___ |
| 11 | Connected components share container with 0dp gap | P11 | ___ |
| 12 | Dark/light modes use distinct material treatments (not just color swap) | P12 | ___ |

---

## 9. Cross-Reference Matrix

This matrix shows which principles directly interact with or depend on each other. An "X" indicates a direct cross-reference documented in the principle definitions.

|  | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 | P11 | P12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **P1** | -- | . | . | X | X | . | . | X | . | . | . | . |
| **P2** | X | -- | . | . | . | . | . | . | X | X | . | . |
| **P3** | . | . | -- | . | X | . | . | . | . | X | . | X |
| **P4** | X | . | . | -- | X | . | X | . | . | . | . | . |
| **P5** | X | . | X | X | -- | . | . | . | . | . | X | X |
| **P6** | . | . | . | . | . | -- | X | . | . | . | X | . |
| **P7** | . | . | . | X | . | X | -- | . | . | . | X | . |
| **P8** | X | . | . | X | . | . | . | -- | . | . | . | . |
| **P9** | . | X | . | X | X | . | . | . | -- | . | . | . |
| **P10** | . | X | X | . | X | . | . | X | . | -- | . | . |
| **P11** | . | . | . | . | X | X | X | . | . | . | -- | . |
| **P12** | . | . | X | . | X | . | . | . | . | X | . | -- |

---

## 10. Conclusion

The twelve principles defined in this specification constitute a formal framework for understanding and evaluating Generative UI composition in Samsung One UI 8.5. The framework rests on two foundational observations:

First, the **Static/Generative dichotomy** (P1) provides a clean partition of all UI elements into structural chrome and dynamic content. This partition is not merely taxonomic --- it drives material treatment (P5, P12), motion design (P8), and layout strategy (P4, P7).

Second, **contextual assembly** (P2) transforms the interface from a fixed artifact into a responsive system that composes itself from a finite component vocabulary based on runtime state. The composition grammar (Section 6) formalizes the rules governing this assembly, making the system amenable to automated verification and generative extension.

Together, these principles describe a UI system that is simultaneously constrained (by grid quantization, semantic color, shape morphology) and adaptive (through contextual assembly, ambient reactivity, progressive density). This tension between constraint and adaptivity is the defining characteristic of Gen UI: the system is generative within bounds, producing novel compositions that are always recognizably "One UI."

The evaluation framework (Section 8) provides a practical instrument for assessing Gen UI compliance, applicable both to Samsung's own design decisions and to third-party components that operate within the One UI ecosystem.

---

## 11. References

1. Samsung Electronics. "One UI 8.5 Design Guidelines." Samsung Developers, 2025--2026.
2. Samsung Electronics. "Quick Settings Design Kit for One UI 8.5." Figma Community, 2025.
3. Google. "Material Design 3 Specification." material.io, 2024.
4. Google. "Android Accessibility Guidelines." developer.android.com, 2025.
5. Oulasvirta, A., Dayama, N. R., Shiripour, M., John, M., and Karrenbauer, A. "Combinatorial Optimization of Graphical User Interface Designs." *Proceedings of the IEEE*, 108(3), 434--464, 2020.
6. Swearngin, A. and Li, Y. "Modeling Mobile Interface Tappability Using Crowdsourcing and Deep Learning." *CHI 2019*, ACM, 2019.
7. Dayama, N. R., Shiripour, M., Oulasvirta, A., and Igarashi, T. "Grounding of Graphic Design Attributes." *CHI 2021*, ACM, 2021.
8. Apple Inc. "Human Interface Guidelines: Materials." developer.apple.com, 2025.
9. Deka, B., Huang, Z., Franber, C., Hibschman, J., Afergan, D., Li, Y., Nichols, J., and Kumar, R. "Rico: A Mobile App Dataset for Building Data-Driven Design Applications." *UIST 2017*, ACM, 2017.
10. Li, G., Baechler, G., Tragut, M., and Li, Y. "Learning to Denoise Raw Mobile UI Layouts for Improving Datasets at Scale." *CHI 2022*, ACM, 2022.

---

*End of specification.*

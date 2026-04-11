# Samsung Design System

Design tokens and visual catalog extracted from Samsung's web presence and One UI design philosophy.

## Source Sites
- [samsung.com/sec](https://www.samsung.com/sec/) - Korean official site
- [samsung.com/us](https://www.samsung.com/us/) - US official site
- [Samsung Brand Identity](https://www.samsung.com/sec/about-us/brand-identity/) - Brand heritage
- [One UI Design System](https://design.samsung.com/global/contents/one-ui/) - Design principles

## Sources
- [One UI Developer Docs](https://developer.samsung.com/one-ui) - Component specs
- [oneui-design (GitHub)](https://github.com/OneUIProject/oneui-design) - Open-source resource files

## Files
| File | Purpose |
|------|---------|
| `DESIGN.md` | The design system (what agents read) |
| `preview.html` | Visual catalog - light mode |
| `preview-dark.html` | Visual catalog - dark mode |
| `components.html` | Full One UI component library (22 components) |
| `motion.html` | Motion & animation library with interactive demos |

## Key Design Tokens

### Colors (One UI)
| Token | Light | Dark | Use |
|-------|-------|------|-----|
| Primary | `#0381FE` | `#0381FE` | FAB, sliders, accent |
| Primary Dark | `#0072DE` | `#3E91FF` | Contained buttons |
| Activated | `#3E91FF` | `#3E91FF` | Checkboxes, toggles |
| Surface | `#FCFCFC` | `#171717` | Page background |
| Text Primary | `#252525` | `#FAFAFA` | Body text |
| Divider | `#E4E4E4` | `#47E4E4E4` | Borders |

### Radius Scale
| Token | Value | Use |
|-------|-------|-----|
| Checkbox | 4dp | Small controls |
| List item | 8dp | Item backgrounds |
| Bottom nav | 12dp | Nav buttons |
| Switch | 16dp | Toggle track |
| Button | 18dp | All buttons |
| Chip | 22dp | Tags, filters |
| Card/Dialog/Sheet | 26dp | Containers |
| FAB | 50% | Floating action |
| Search/Pill | 999dp | Search bars |

### Motion
| Token | Value | Use |
|-------|-------|-----|
| ease-emphasized | `(0.2, 0, 0, 1)` | Hero transitions, sheets |
| ease-spring | `(0.2, 0.6, 0.4, 1)` | Dialogs, FAB, scale |
| ease-bounce | `(0.34, 1.56, 0.64, 1)` | Celebration, success |
| dur-normal | 300ms | Standard transitions |
| dur-slow | 400ms | Bottom sheets, dialogs |
| dur-page | 800ms | Page transitions |

# Theme: Light Green + Blue

**Date**: 2026-05-23
**Summary**: Replace the warm coral-red theme with light-green primary and sky-blue secondary, suited to a 7-year-old boy's preference.

## Approach

Targeted token swap — only `tokens.ts` and `global.css`. No structural or component-level changes.

## Color Palette

| Token | Old | New |
|-------|-----|-----|
| `primary` | `#FF6B6B` | `#6DBF6E` |
| `primaryLight` | `#FF8E8E` | `#8FD490` |
| `primaryDark` | `#E55A5A` | `#4FA050` |
| `secondary` | `#4ECDC4` | `#4DABF7` |
| `secondaryLight` | `#6ED8D1` | `#74C0FC` |
| `accent` | `#FFE66D` | `#FFD43B` |
| `warm` | `#FF8E72` | `#69C76E` |
| `bg` | `#FFF8F0` | `#F0F7F4` |
| `bgCard` | `#FFFFFF` | `#FFFFFF` |
| `text` | `#3D3D3D` | `#2C3E34` |
| `textMuted` | `#B0A8A0` | `#94A89C` |
| `textLight` | `#888888` | `#888888` |
| `success` | `#52C41A` | unchanged |
| `warning` | `#FAAD14` | unchanged |
| `danger` | `#FF4D4F` | unchanged |
| `zone.target` | `#FF6B6B` | `#6DBF6E` |
| `zone.scout` | `#FFE66D` | `#FFD43B` |
| `zone.ally` | `#4ECDC4` | `#4DABF7` |
| `zone.lost` | `#B0A8A0` | `#BCCFC2` |

## Shadows

Replace red-tinted shadows with green-tinted:
- `card`: `0 4px 16px rgba(109, 191, 110, 0.12)`
- `button`: `0 4px 12px rgba(109, 191, 110, 0.25)`
- `hover`: `0 6px 20px rgba(109, 191, 110, 0.20)`
- `popup`: `0 8px 32px rgba(0, 0, 0, 0.10)`

## CSS Variables

Sync `:root` block in `global.css` with updated token values.

## Files Changed

- `frontend/src/theme/tokens.ts` — color and shadow values
- `frontend/src/theme/global.css` — CSS variables and Ant Design overrides (box-shadows)

## Not Changed

- Zone system logic, API, component structure — zero impact
- Ant Design `ConfigProvider` theme — left at defaults; the CSS overrides handle the visual layer
- Radius, font, animations — unchanged

# Category Logos

Place logo images here. They automatically replace emojis in the nav, hero, and footer of generated business websites.

## Naming Convention
Same as category images — lowercase with hyphens.

| Category | Filename |
|---|---|
| Plumber | `plumber.png` |
| Electrician | `electrician.png` |
| Landscaping | `landscaping.png` |
| House Cleaning | `house-cleaning.png` |
| Roofing | `roofing.png` |
| HVAC | `hvac.png` |
| Painter | `painter.png` |
| Handyman | `handyman.png` |
| Auto Repair | `auto-repair.png` |
| Barber | `barber.png` |
| Nail Salon | `nail-salon.png` |
| Pet Grooming | `pet-grooming.png` |
| Tree Service | `tree-service.png` |
| Pest Control | `pest-control.png` |
| Pool Service | `pool-service.png` |
| Pressure Washing | `pressure-washing.png` |

## Design Tips
- **Format**: PNG with transparent background works best
- **Size**: 400x400px or larger (square or landscape)
- **Style**: White or light logos show well on the gradient hero backgrounds
  (the site CSS applies `filter: brightness(0) invert(1)` on the hero to make any logo white)
- **Fallback**: If no logo is found for a category, the emoji icon shows automatically — no broken images

## Where logos appear
1. **Nav bar** — top left, next to business name, small (36px tall)
2. **Hero section** — centered above business name, large (64px tall), white filter
3. **Footer** — centered, small (36px tall), subtle dim white

After uploading logos, commit and push — all future generated sites pick them up automatically.
Existing sites show the logo immediately on next page load (no regeneration needed).

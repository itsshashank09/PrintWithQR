# Design System: Deep Neon Elegance

## 1. Overview & Creative North Star
**Creative North Star: "Deep Neon Elegance"**
This aesthetic brings PrintWithQR into a sleek, nocturnal world. It rejects flat, sterile interfaces in favor of deep, infinite navys, rich blacks, and sharp, glowing electric accents (green and cyan). It feels highly technical but exceptionally premium—like holding a piece of advanced glass hardware.

The UI relies heavily on **Glassmorphism**, ambient lighting, and tonal layering rather than borders or solid blocks. It should feel lightweight yet grounded in deep space.

---

## 2. Colors & Atmospheric Depth
The color palette uses the deep void of space contrasted with surgical strikes of neon.

*   **Background (`#060913`):** An ultra-deep navy, almost black. It provides the infinite canvas.
*   **Primary Accent (`#00E5FF` to `#00E676`):** We use electric cyan and neon green for primary actions. These should feel like active laser lights in a dark room.
*   **Surface Tiers:** 
    *   *Base:* `surface` (`#060913`)
    *   *Mid:* `surface_container_low` (`#0F1528`)
    *   *High:* `surface_container_highest` (`#1A2442`)
*   **The Glass & Glow Rule:** For primary buttons and active cards, use a backdrop blur with a subtle glowing shadow (e.g., `box-shadow: 0 0 15px rgba(0, 229, 255, 0.4)`).
*   **No Solid Borders:** Do not use 1px solid borders. Separate components using spacing, tonal shifts, or "Ghost Borders" (`#2E3C62` at 20% opacity).

---

## 3. Typography: Technical & Premium
*   **Display & Headlines:** Use **Outfit** or **Manrope** for numbers and bold statements. They feel architectural and futuristic.
*   **Body & Labels:** Use **Inter** for supreme legibility. Use `label-sm` in `on_surface_variant` (a muted steel-blue) for metadata.
*   **Contrast:** Pair a giant, bright white (`#FFFFFF`) headline with muted, small metadata text to create a striking "premium tech" hierarchy.

---

## 4. Components

### Buttons: The Neon Pulse
*   **Primary Action:** A capsule button (fully rounded corners). Background is a subtle gradient of deep blue (`#0D1B36`), but the border and text glow with `primary` (`#00E5FF`). Use an outer glow shadow.
*   **Secondary Action:** Ghost style. No background, subtle grey/blue text, fading into the background.

### Cards & Surfaces
*   **Style:** `xl` (24px) border radius. Background is `surface_container_highest` at 70% opacity with a `backdrop-blur` of 20px. 
*   **Separation:** Do not use dividers inside cards. Group items with whitespace.

### Inputs & Forms
*   **Visuals:** Floating labels. The input field background is completely transparent, with a glowing "Ghost Border" that ignites to full neon brightness when focused.

---

## 5. Do's and Don'ts
*   **Do** use massive amounts of whitespace. Let the dark background consume the empty areas.
*   **Do** use gradients on text to highlight the most important words (e.g., "Scan. Print. Done.").
*   **Don't** use standard, flat hex colors for primary CTAs. Always include a slight gradient or glow to simulate light.
*   **Don't** use sharp square corners anywhere; everything must be fluid and rounded (`lg` or `xl` radius).

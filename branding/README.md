# InstaGrab: brand assets

App icon and logo for **InstaGrab**, the app that saves photos and videos from Instagram links.
The mark is **Frame Grab**: viewfinder corners catch the post, and the arrow pulls it down to your device.

---

## What's inside

```
InstaGrab-brand-assets/
├── svg/                     Master vector files (edit/scale these)
│   ├── icon-rounded.svg       Icon with rounded corners (marketing, docs, web)
│   ├── icon-square.svg        Full-bleed square (source for App Store / Play Store)
│   ├── icon-circle.svg        Circular icon
│   ├── icon-dark.svg          Icon on ink background
│   ├── glyph-white.svg        Mark only, white, transparent
│   ├── glyph-black.svg        Mark only, ink, transparent
│   ├── android-adaptive-foreground.svg / -background.svg
│   ├── logo-horizontal-light.svg / -dark.svg
│   ├── logo-stacked-light.svg / -dark.svg
│   └── wordmark-light.svg / -dark.svg
├── png/
│   ├── icon/                Rounded icon at 1024/512/256/128/64, dark icon, glyphs
│   └── logo/                All logos at @1x, @2x, @4x (transparent)
├── ios/
│   └── AppIcon.appiconset/  Drop-in Xcode app icon (1024, opaque, single-size)
├── android/
│   ├── res/mipmap-*/        Legacy, round and adaptive layers for every density
│   ├── res/mipmap-anydpi-v26/  Adaptive icon XML (incl. Android 13 themed icon)
│   └── playstore-icon-512.png  Google Play listing icon (opaque)
└── web/
    ├── favicon.ico, favicon.svg, favicon-16/32/48.png
    ├── apple-touch-icon.png (180)
    ├── icon-192.png, icon-512.png, icon-maskable-512.png
    └── site.webmanifest
```

The **light** logos are for light backgrounds and the **dark** logos are for dark backgrounds.
The wordmark text is converted to outlines, so you don't need the font installed to use the SVGs.

---

## Brand basics

| Token | Hex | Use |
|---|---|---|
| Violet | `#6B2BFF` | Gradient, top-right |
| Pink | `#FF2E78` | Gradient, middle |
| Amber | `#FFA53A` | Gradient, bottom-left |
| Ink | `#17131F` | Text, dark backgrounds |
| Grab pink (light bg) | `#E0195F` | "Grab" in the wordmark on light backgrounds |
| Grab pink (dark bg) | `#FF6A95` | "Grab" in the wordmark on dark backgrounds |

**Icon gradient:** linear, from bottom-left to top-right: Amber, then Pink (at 50%), then Violet.

**Typeface:** [Sora](https://fonts.google.com/specimen/Sora), Bold 700, with letter-spacing of −0.028em. It's free under the SIL Open Font License.
Use Sora Regular or SemiBold for supporting UI and marketing text.

**Mark geometry (on a 1024 grid):** corner brackets 64 px stroke, arrow 80 px stroke, all with round caps and joins.
The icon's corner radius is 230 px, roughly the iOS superellipse.

---

## Usage

- **Clear space:** leave at least the height of one corner bracket (about ¼ of the icon size) clear on every side.
- **Minimum size:** 16 px for the icon and 96 px wide for the horizontal logo.
- **Don't** recolour the gradient, rotate the mark, add shadows or outlines, or stretch the logo.
- **Don't** set the wordmark in another typeface. Use the supplied SVGs or PNGs.
- **Note:** InstaGrab is an independent app. Don't place Instagram's logo next to the mark or imply endorsement, and use the name "Instagram" only in plain descriptive text.

---

## Installing the icons

### iOS (Xcode 14+)
Replace `Assets.xcassets/AppIcon.appiconset` with the supplied folder.
The 1024 px PNG is square and opaque. iOS applies the rounded mask itself, so never upload the rounded version.

### Android
Copy the contents of `android/res/` into `app/src/main/res/`, overwriting the existing `mipmap-*` folders.
In `AndroidManifest.xml`:
```xml
<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round" ... >
```
- API 26+ uses the adaptive layers. The mark sits inside the 66 dp safe zone, so it survives any launcher mask.
- Android 13+ themed icons use `ic_launcher_monochrome`.
- Upload `playstore-icon-512.png` to the Google Play Console. Google Play rounds the corners itself.

### Web / PWA
Copy `web/` to your site root and add:
```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#17131F">
```

---

## Regenerating

All PNGs are rendered from the SVGs in `svg/`. Edit those, then re-export at the same sizes.

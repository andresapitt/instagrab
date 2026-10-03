# InstaGrab 📸 ⚡

**InstaGrab** is a high-performance, mobile-first Progressive Web App (PWA) designed to download photos, reels, and video carousels directly from Instagram links. It can be installed as a native app on iOS and Android devices, allowing you to share posts directly from the Instagram app into InstaGrab with automatic link detection.

Hosted seamlessly on **Vercel**.

---

## 🌟 Key Features

- **📱 Installable Mobile PWA**: Add to Home Screen on iOS and Android with custom app icons, splash screens, and standalone window experience.
- **🔄 Web Share Target**: Tap **Share** inside Instagram &rarr; Select **InstaGrab** &rarr; The app launches and automatically parses the media!
- **📋 Smart Clipboard Watcher**: Automatically detects when an Instagram link is in your clipboard and prompts you with a single-tap "Paste & Grab".
- **🎬 Full Media Support**:
  - High-Definition Reels & Videos (MP4)
  - Single Photos (JPG)
  - Multi-item Carousel albums with sequential previews and **"Download All as ZIP"**.
- **🚀 One-Tap Direct Downloads**: Powered by `/api/download` proxy streaming with `Content-Disposition: attachment` so files save directly to your mobile device's files/photos rather than opening in a new tab.
- **🛡️ Multi-Engine Fallback**: Cascades through multiple public extractors and embed decoders to maximize availability.
- **🔐 Session ID & Private Support (Optional)**: In Settings, users can optionally supply an Instagram session cookie or custom Cobalt instance for 100% reliable downloads (including private accounts followed and stories).
- **📂 Download History**: Saves your previous grabs locally for quick re-inspection and re-downloading.
- **✨ Aesthetics**: Styled using the official InstaGrab design system with dark ink atmosphere, glowing violet/pink/amber gradients, and smooth micro-animations.

---

## 📲 How to Install & Use on Mobile

### Android (Chrome / Brave / Edge)
1. Visit the hosted URL in your mobile browser.
2. Tap the **Install** button in the header (or tap the 3-dot browser menu &rarr; **"Install app"**).
3. Open Instagram, tap the **Share** icon on any Reel or Post, and select **InstaGrab**.
4. The media will appear instantly—tap **Download**!

### iOS (Safari)
1. Open the URL in Safari on iPhone or iPad.
2. Tap the **Share** button in Safari's bottom toolbar (the square with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top right.
5. In Instagram, tap **Share** &rarr; **Copy link**, then open InstaGrab and tap **Paste Link**.

---

## 🚀 Deploying to Vercel

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit of InstaGrab"
   git remote add origin https://github.com/andresapitt/instagrab.git
   git push -u origin main
   ```
2. In [Vercel](https://vercel.com/new), import the `instagrab` repository.
3. Keep default settings (Framework Preset: **Next.js**).
4. *(Optional)* Under **Environment Variables**, you can set:
   - `INSTAGRAM_SESSION_ID`: An optional Instagram session cookie for dedicated server-side extraction without rate limits.
   - `COBALT_INSTANCE`: Optional self-hosted Cobalt instance URL (e.g., `https://cobalt.yourdomain.com`).
   - `COBALT_API_KEY`: Optional API key for the Cobalt instance.
5. Click **Deploy**. Your app is live!

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

---

## 📄 License
MIT License. For educational and personal archiving purposes only. Not affiliated with Meta or Instagram.

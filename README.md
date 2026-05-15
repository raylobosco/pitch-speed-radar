# PitchSpeed Radar (v5.0)

A professional-grade, browser-based baseball radar gun using Computer Vision and advanced physics modeling.

## Features
- **Release Velocity Calculation:** Uses air drag compensation ($k=0.0015$) for accurate release speeds.
- **Break Analysis:** Tracks flight path to calculate vertical drop and horizontal break in inches.
- **Environment Intelligence:** Auto-detects lighting conditions (Day/Night) or allows manual selection (Indoor/Overcast).
- **Perspective Correction:** Adjustable camera offset to maintain accuracy when not standing directly behind the catcher.
- **PWA Ready:** Installable on any smartphone for a native-like experience.
- **Robust Caching:** Service worker implemented for offline reliability with automated cache invalidation.

## Live Deployment
The application is live at: [https://fastball-f438c.web.app](https://fastball-f438c.web.app)

## Local Development & Deployment
1. Clone the repository.
2. Open in any modern web browser (requires camera permissions).
3. To deploy to Firebase:
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Login: `firebase login`
   - Deploy: `firebase deploy`

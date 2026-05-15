# PitchSpeed Radar (v5.0)

A professional-grade, browser-based baseball radar gun using Computer Vision and advanced physics modeling.

## Features
- **Release Velocity Calculation:** Uses air drag compensation ($k=0.0015$) for accurate release speeds.
- **Break Analysis:** Tracks flight path to calculate vertical drop and horizontal break in inches.
- **Environment Intelligence:** Auto-detects lighting conditions (Day/Night) or allows manual selection (Indoor/Overcast).
- **Perspective Correction:** Adjustable camera offset to maintain accuracy when not standing directly behind the catcher.
- **PWA Ready:** Installable on any smartphone for a native-like experience.

## Deployment
This app is designed for Firebase Hosting.

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Deploy: `firebase deploy`

## Local Development
1. Clone the repository.
2. Open in any modern web browser (requires camera permissions).
3. No build step required (Standalone PWA).

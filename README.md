# Attendance.io

Attendance.io is a browser-based student attendance tracker. It stores records in the current browser and works without an account or cloud sync.

## Timetable import

Import a CSV timetable or upload a PDF. The PDF importer reads selectable text and uses in-browser OCR for scanned pages. Review and edit detected days, subjects, times, and rooms before confirming the weekly timetable.

## Run locally

```sh
npm install --legacy-peer-deps
npm test
npm run build
npm run dev
```

## Deploy

The GitHub Actions workflow runs parser tests, builds the app, and deploys the dist output to GitHub Pages from main. In repository settings, choose **Pages → Build and deployment → Source: GitHub Actions**.

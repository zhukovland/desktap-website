# Desktap Website

Static website for [Desktap](https://desktap.app) — turn your iPhone or iPad into a programmable command center for Mac.

## Local Development

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

## Structure

```
├── index.html         — Landing page
├── privacy.html       — Privacy Policy
├── terms.html         — Terms of Use
└── assets/
    ├── style.css      — Stylesheet
    ├── screenshot.png — Hero screenshot (placeholder)
    ├── icon.png       — App icon (placeholder)
    └── favicon.ico
```

## Deployment

GitHub Pages + Cloudflare. Push to `main` to deploy.

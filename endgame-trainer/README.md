# Coach Dinosaur Endgame Trainer static site

This folder is a self-contained static website. It is intentionally separate
from the Flutter app and the Node backend.

## Files

- `index.html` — public landing page
- `privacy-policy/index.html` — Android app privacy policy
- `styles.css` — shared landing-page styles
- `privacy.css` — privacy-page styles
- `assets/` — local favicon and app preview images

## Use it

Serve the repository over HTTP and open `/endgame-trainer/`. The public routes
are:

- `https://cddigital.top/endgame-trainer/`
- `https://cddigital.top/endgame-trainer/privacy-policy/`

All internal links and image paths are relative to those route directories.
Keep the full `endgame-trainer/` tree together when moving or publishing the
site.

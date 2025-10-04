# ESSER – Foundry System (v0.1.23)

## Installation (Development)

1. Copy the `esser` folder from this repository into your Foundry data directory under `Data/systems/` so the final path is `Data/systems/esser`.
2. Restart Foundry VTT.
3. Create a new World and select the ESSER system.

## Hosting on GitHub (Install via Manifest URL)

Use GitHub Releases to host installable builds and provide a stable manifest URL to Foundry.

1) Prepare `esser/system.json`
- Ensure fields are present and consistent for a release (replace OWNER/REPO/VERSION):
  - `version`: e.g., `0.1.23` (must match the tag below)
  - `url`: `https://github.com/OWNER/REPO`
  - `manifest`: `https://raw.githubusercontent.com/OWNER/REPO/vVERSION/esser/system.json`
  - `download`: `https://github.com/OWNER/REPO/releases/download/vVERSION/esser-vVERSION.zip`

2) Create the release zip (zip root must contain the `esser` folder)
```sh
VERSION=0.1.23
rm -f esser-v$VERSION.zip
zip -r esser-v$VERSION.zip esser
```

3) Tag and push the release tag
```sh
git tag v$VERSION
git push origin v$VERSION
```

4) Create a GitHub Release for `vVERSION`
- On GitHub, create a Release targeting tag `vVERSION` and upload `esser-vVERSION.zip` as a release asset.

5) Manifest URL to share/install in Foundry
- Use this as the Install System manifest URL:
  - `https://raw.githubusercontent.com/OWNER/REPO/vVERSION/esser/system.json`

Notes
- Keep the `system.json` `version` and the Git tag (vVERSION) in sync; Foundry uses these for update checks.
- The zip must unpack to a folder named exactly `esser` at the top level.
- Current repo `esser/system.json` shows `version: 0.1.23`; update VERSION above to match when releasing.

Alternative: GitHub Pages (advanced)
- You can enable GitHub Pages and host the raw `system.json` at a Pages URL (e.g., `https://OWNER.github.io/REPO/esser/system.json`).
- You still need a downloadable zip for the `download` field; you can link the Release asset URL as above.

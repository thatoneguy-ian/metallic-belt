# Technology Stack

**Analysis Date:** 2026-08-25

## Languages

**Primary:**
- JavaScript (ES6 modules) - All source files across Chrome extension, Foundry module, and tests

**Secondary:**
- JSON - Configuration (manifest.json, module.json, rules.json, package.json)

## Runtime

**Environment:**
- Node.js (no version specified in `.nvmrc` or `package.json`)
- Chrome Browser (MV3 extension target, minimum manifest_version 3)
- Foundry VTT (12.x - 14.363 compatibility, verified on 14.359)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json` ~80KB)

## Frameworks

**Core:**
- Foundry VTT v12–14.363 (RPG Virtual Tabletop platform)
  - Actor Sheet system for character display
  - Hook system for event handling
  - Actor/Item document APIs for character data manipulation
  - Message system for chat card rendering and auto-clicking

**Testing:**
- Vitest v1.6.0 - Unit and integration testing framework
  - Configuration: `@vitest-environment jsdom` directive in test files (no vitest.config.js needed)
  - JSDOM v29.1.1 - DOM simulation for browser API testing

**Chrome Extension:**
- Chrome MV3 (Manifest Version 3)
  - Service Worker (background.js)
  - Content Scripts (content.js, shim.js)
  - Declarative Net Request API for header manipulation

## Key Dependencies

**Critical:**
- `chrome-remote-interface` v0.34.0 - Node.js library for Chrome DevTools Protocol interaction (support utilities, not core runtime)

**Testing:**
- `jsdom` v29.1.1 - DOM environment for Vitest (required for testing DOM APIs)
- `vitest` v1.6.0 - Test runner and assertions

## Configuration

**Environment:**
- No `.env` file required - extension operates via Chrome cookies and localStorage
- D&D Beyond authentication: `CobaltSession` cookie (injected by background.js)
- D&D Beyond Character API endpoint: `https://character-service.dndbeyond.com/character/v5/character/{characterId}`

**Build:**
- No build step configured
- ES6 modules loaded directly by:
  - Foundry (via `"esmodules"` in `foundry-module/module.json`)
  - Chrome extension (via `"js"` in `manifest.json` content_scripts)
  - Vitest (native ESM support)

## Platform Requirements

**Development:**
- Node.js runtime (for running tests)
- npm (for dependency management)

**Chrome Extension:**
- Chrome Browser MV3 compatible version
- D&D Beyond login with active `CobaltSession` cookie
- Permission scopes:
  - `declarativeNetRequest` - Header manipulation for CORS bypass
  - `cookies` - D&D Beyond session cookie access
  - Host access: `https://*.dndbeyond.com/*`

**Foundry VTT:**
- Foundry VTT v12 minimum, v14.359 verified, v14.363 maximum
- D&D 5e System v3.0.0 minimum (defined in `foundry-module/module.json` relationships.systems)
- Module loaded via `"esmodules"` and `"styles"` manifest entries

**Production:**
- Deployment: Chrome Web Store (for extension), Foundry module repository (for module)
- Two separate deliverables:
  - Chrome MV3 Extension: `alphaTest/chrome-extension/`
  - Foundry VTT Module: `alphaTest/foundry-module/`

## Test Status

**Current:** 55 total tests, 25 failing
- `tests/importer.test.js`: 14 passing
- `tests/content.test.js`: 20 failing (syntax parsing errors in vitest import analysis)
- `tests/router.test.js`: 21 tests (16 passing, 5 failing - assertion mismatches)

**Configuration:**
- Test command: `npm test` → `vitest run`
- Watch mode: `npm run test:watch` → `vitest`
- No coverage threshold configured

---

*Stack analysis: 2026-08-25*

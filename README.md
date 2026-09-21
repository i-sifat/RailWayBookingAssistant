# Railway Booking Assistant

Local-first Chrome MV3 extension that **reduces form-filling time** on a railway
website you are **already manually logged into**.

## Safety principles (non-negotiable)

- You log in manually. The extension never asks for, stores, or uses passwords.
- No payment credentials, OTPs, CAPTCHA solutions, banking secrets, or auth tokens.
- No CAPTCHA/OTP/queue/rate-limit bypass, no stealth, no fingerprint spoofing,
  no proxy rotation, no request forgery, no hidden API abuse.
- Operates only through normal DOM interaction as a logged-in user would.
- On CAPTCHA / OTP / payment auth / queue / login-required / ambiguous page:
  automation **stops** and hands control back with a clear status.
- No remote code, no eval, no analytics, no external server. All data stays in
  `chrome.storage.local` on your device.

## Target site

Default match (edit in `manifest.json` + `src/shared/constants.ts`):

- `https://eticket.railway.gov.bd/*`

To retarget: update `manifest.json` (`host_permissions`, `content_scripts.matches`)
and `RAILWAY_ORIGINS` / `BOOKING_PAGE_URL_PATTERNS` in `src/shared/constants.ts`,
then rebuild. The adapter layer (`src/adapters/railway/*`) isolates all
site-specific selectors.

## Develop

```powershell
npm install
npm run typecheck
npm run build
npm test
```

Load unpacked from `dist/` in `chrome://extensions` (Developer mode).

Configure from popup or options page. Use **Clear Passenger Data** /
**Clear All Extension Data** to wipe local storage.

## Architecture

```
Chrome Browser
     |
 +---+---+--------------+
 |                      |
Popup UI          Railway Website
 |                      |
 v                      v
Extension State   Content Script
 |                      |
 v                      v
Service Worker <-> Page Adapter
 |
 v
chrome.storage.local
```

See `src/` for `core/` (types, state machine, scheduler, validation, storage,
logging, errors), `adapters/railway/` (selectors, parser, form-filler,
booking-flow), `content/`, `background/`, `popup/`, `options/`, `shared/`.

## State machine

IDLE → ARMED → WAITING_FOR_TIME → WAITING_FOR_PAGE → PAGE_READY →
FILLING_FORM → VERIFYING_FORM → SEARCHING → WAITING_FOR_RESULTS →
EVALUATING_RESULTS → SELECTING_TICKET → CHECKOUT_READY → USER_ACTION_REQUIRED
(any state may go to STOPPED / ERROR / USER_ACTION_REQUIRED on safety triggers).
Add aesthetic Breaf Details

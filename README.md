# Sandbox — USA Swimming API Explorer

## What this is

A standalone browser tool that exercises the USA Swimming public Times API,
showing raw request/response details for both phases of the lookup:

1. **GET** `/GetBestTimesForMember/{id}` — lists events with best times
2. **POST** `/BestTimes` — detailed results for one event (distance + stroke)

The main MeetReady app calls the same API via `lookup.js`.
This explorer is the debugging companion — use it when `lookup.js` breaks and
you need to see the raw HTTP traffic.

## Quick start

1. Get a Device-Id from [USA Swimming Data Hub](https://data.usaswimming.org/):
   - Log in → F12 → Network → filter `times-api`
   - Open any athlete page → click a `times-api` request → copy `Device-Id` header
2. Open `api-explorer.html` in a browser — works from **anywhere** (GitHub Pages,
   localhost, `file://`, Netlify, Vercel, etc.)
3. Paste your Device-Id into the panel and click **Save**
4. Paste a USA Swimming Member ID, hit **Look up**

The Device-Id is stored in `localStorage` under `usas-did`. It never appears
in source code and never leaves your browser.

## Why no Device-Id is included in source

The Device-Id is tied to a real user session on the Data Hub. Including one in
public source code would:

- Expose it to abuse (it's your personal session token)
- Break when the token expires

Each user should get their own from the Data Hub.

## The Device-Id gate — investigation (updated 2026-07-13)

### Background

The API requires a `Device-Id` request header. The API returns 400 with
`Invalid Device-Id format` when the value is unacceptable.

### Observed behavior

| Client | Origin | Result |
|--------|--------|--------|
| Real browser (Chrome) | `https://*.github.io` | ✅ 200 (with valid Device-Id) |
| Real browser (Chrome) | `http://localhost:3000` | ✅ 200 (with valid Device-Id) |
| Real browser (Chrome) | `file://` | ✅ 200 (with valid Device-Id) |
| curl (all headers copied from browser) | (none) | ❌ 400 |

> **Earlier diagnosis was partially wrong.** The 400 errors on localhost and
> `file://` were caused by an expired/corrupt Device-Id, not by the Origin
> domain. With a fresh Device-Id from the Data Hub, the API accepts requests
> from any origin. There is no domain whitelist.

### Root cause: TLS fingerprint gate

The API (behind Azure API Management) enforces a **TLS fingerprint (JA3/JA4)**
check. Only real browser TLS handshakes pass. `curl`, Python `requests`,
Node.js `fetch()` — all fail with 400 regardless of what HTTP headers they
send, even with a valid Device-Id.

### What this means for you

- **Real browser + valid Device-Id:** Works from any origin — GitHub Pages,
  localhost, `file://`, anything.
- **curl / scripts / automation:** Dead end. Use a browser-automation tool
  (Playwright, Puppeteer) that performs real TLS handshakes.

## Related files

| File | Role |
|------|------|
| `../lookup.js` | Main app's API client — same endpoints, same headers |
| `../.tmp/usa-swimming-api.md` | Earlier API exploration notes |
| `../.tmp/device-id-handoff.md` | Previous (partially incorrect) diagnosis |
| `https-server.js` | Quick HTTPS server for testing (Node.js) |

## Test commands

```bash
# These will all return 400 regardless of headers — TLS fingerprint gate.
# Only a real browser works.

# Phase 1 — list events for a member
curl -s -w "\nHTTP %{http_code}" \
  -X GET "https://times-api.usaswimming.org/swims/TimesSearch/GetBestTimesForMember/9688AB9C4AFF4B" \
  -H "AppName: DataHub" \
  -H "Usas-Sub-Id: Anonymous" \
  -H "Device-Id: YOUR_DEVICE_ID_HERE" \
  -H "Content-Type: application/json"

# Phase 2 — best times for 100 Free
curl -s -w "\nHTTP %{http_code}" \
  -X POST "https://times-api.usaswimming.org/swims/TimesSearch/BestTimes" \
  -H "AppName: DataHub" \
  -H "Usas-Sub-Id: Anonymous" \
  -H "Device-Id: YOUR_DEVICE_ID_HERE" \
  -H "Content-Type: application/json" \
  -d '{"memberId":"9688AB9C4AFF4B","distance":100,"strokeAbbreviation":"FR"}'
```

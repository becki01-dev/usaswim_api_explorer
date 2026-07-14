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

1. Deploy `api-explorer.html` to a **public HTTPS origin** (GitHub Pages, Netlify, Vercel, etc.)
2. Get a Device-Id from [USA Swimming Data Hub](https://data.usaswimming.org/):
   - Log in → F12 → Network → filter `times-api`
   - Open any athlete page → click a `times-api` request → copy `Device-Id` header
3. Paste your Device-Id into the tool and click **Save**
4. Paste a USA Swimming Member ID, hit **Look up**

Localhost and `file://` will NOT work — the API requires a public HTTPS origin.

## Why no Device-Id is included in source

The Device-Id is tied to a real user session on the Data Hub. Including one in
public source code would:

- Expose it to abuse (it's your personal session token)
- Break when the token expires (the one from MeetReady's public source already
  returns "Invalid Device-Id format")

Each user should get their own from the Data Hub. It's stored in `localStorage`
under `usas-did` and never leaves your browser.

## The Device-Id gate — investigation

### Background

The API requires a `Device-Id` request header. The API returns 400 with
`Invalid Device-Id format` when the value is unacceptable — either because the
token is expired/corrupt, or because the request comes from a non-browser TLS
context.

### Observed behavior

| Client | Origin | Result |
|--------|--------|--------|
| Real browser (Chrome) | `https://*.github.io` | ✅ 200 (with valid Device-Id) |
| Real browser (Chrome) | `https://localhost:8443` (self-signed cert) | ❌ 400 |
| Real browser (Chrome) | `http://localhost:3000` | ❌ 400 |
| Real browser (Chrome) | `file://` | ❌ 500 |
| curl (all headers copied from browser) | (none) | ❌ 400 |
| curl + `Origin: https://d4f-gif.github.io` | (none) | ❌ 400 |
| curl + all browser headers verbatim | (none) | ❌ 400 |

### Root cause: two-layer gate

The API (behind Azure API Management) enforces two independent checks:

1. **TLS fingerprint (JA3/JA4).** Only real browser TLS handshakes pass.
   `curl`, Python `requests`, Node.js `fetch()` — all fail regardless of
   what HTTP headers they send.

2. **Origin domain.** The request must originate from a public HTTPS domain.
   `localhost` and `file://` are rejected even from a real browser.

3. **Device-Id validity.** The API now actively validates the Device-Id format.
   Old/corrupted tokens return `Invalid Device-Id format`.

### What this means for you

- **curl / scripts / automation:** Dead end. You cannot bypass the TLS
  fingerprint check. Use a real browser or a browser-automation tool
  (Playwright, Puppeteer) that performs real TLS handshakes.
- **localhost dev:** Will get 400. The page works structurally, but you'll
  need a fresh Device-Id from the Data Hub.
- **GitHub Pages / Netlify / Vercel:** Works — real browser + real domain +
  valid Device-Id = success.

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
# Only a real browser from a public HTTPS origin works.

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

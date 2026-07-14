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

Serve `api-explorer.html` from a **public HTTPS origin** (GitHub Pages,
Netlify, Vercel, etc.) and open it in a real browser. Paste a USA Swimming
Member ID, hit **Look up**. Localhost and `file://` will NOT work — see below.

## The Device-Id gate — full investigation (2026-07-12)

### Background

The API requires a `Device-Id` request header. The value in both `lookup.js:12`
and this explorer is a static base64 blob:

```
cGxhdGZvcm0gLSBcGxhd2ZWbmRvciAtIHVua25vd24gLSAxNzUxNzI0MDAwMDAwMA==
```

This decodes to: `platform - Xplawendor - unknown - 1751724000000`
(Unix ms timestamp = July 5, 2025 — over a year old).

### Observed behavior

| Client | Origin | Result |
|--------|--------|--------|
| Real browser (Chrome) | `https://d4f-gif.github.io` | ✅ 200 |
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
   what HTTP headers they send. Every header was replicated exactly
   (Origin, Referer, Sec-\*, User-Agent, priority, even lowercase header
   names), but curl still gets 400.

2. **Origin domain.** The request must originate from a public HTTPS domain.
   `localhost` and `file://` are rejected even from a real browser.

> The author (d4f-gif) is a small indie dev — no special whitelist. The gate
> looks like a generic anti-bot layer: real browsers from real domains get
> relaxed Device-Id validation; scripts and local contexts get the strict path.

### What this means for you

- **curl / scripts / automation:** Dead end. You cannot bypass the TLS
  fingerprint check. Use a real browser or a browser-automation tool
  (Playwright, Puppeteer) that performs real TLS handshakes.
- **localhost dev:** Will get 400. The page works structurally, but you'll
  need a fresh Device-Id from the Data Hub (see override below).
- **GitHub Pages / Netlify / Vercel:** Works out of the box — real browser
  real domain. This is the recommended way to use the explorer.

### Workaround for local development

The bottom of the page has a collapsed **Device-Id override** section.
If you get a 400 on localhost:

1. Open [USA Swimming Data Hub](https://data.usaswimming.org/), log in
2. F12 → Network, filter `times-api`
3. Navigate to any athlete page
4. Click a `times-api` request, copy the `Device-Id` header value
5. Paste into the override field and click **Save**

Stored in `localStorage` under `usas-did`. Click **Clear** to go back to
the default. A fresh Device-Id from a real browser session has a current
timestamp and correct TLS context, so the strict validation passes.

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
  -H "Device-Id: cGxhdGZvcm0gLSBcGxhd2V5kb3IgLSB1bmtub3duIC0gMTc1MTcyNDAwMDAwMA==" \
  -H "Content-Type: application/json"

# Phase 2 — best times for 100 Free
curl -s -w "\nHTTP %{http_code}" \
  -X POST "https://times-api.usaswimming.org/swims/TimesSearch/BestTimes" \
  -H "AppName: DataHub" \
  -H "Usas-Sub-Id: Anonymous" \
  -H "Device-Id: cGxhdGZvcm0gLSBcGxhd2V5kb3IgLSB1bmtub3duIC0gMTc1MTcyNDAwMDAwMA==" \
  -H "Content-Type: application/json" \
  -d '{"memberId":"9688AB9C4AFF4B","distance":100,"strokeAbbreviation":"FR"}'
```

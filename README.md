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
2. Open `api-explorer.html` in a browser — works from anywhere (GitHub Pages,
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

## The Device-Id gate

### The only rule

The API requires a **valid `Device-Id`** header. That's it.

| Client | Device-Id | Result |
|--------|-----------|--------|
| Browser (any origin) | ✅ valid | ✅ 200 |
| Browser (any origin) | ❌ expired/corrupt | ❌ 400 `Invalid Device-Id format` |
| curl / scripts | ✅ valid | ✅ 200 |
| curl / scripts | ❌ expired/corrupt | ❌ 400 `Invalid Device-Id format` |

No TLS fingerprint check. No Origin domain whitelist. No JA3/JA4 gate.
Just a valid Device-Id.

> **Note:** An earlier version of this README described a "two-layer gate"
> (TLS fingerprint + Origin domain). That diagnosis was wrong — it was based
> entirely on tests with an expired Device-Id. With a valid Device-Id, every
> client works from every origin.

## Related files

| File | Role |
|------|------|
| `../lookup.js` | Main app's API client — same endpoints, same headers |
| `../.tmp/usa-swimming-api.md` | Earlier API exploration notes |
| `../.tmp/device-id-handoff.md` | Previous (incorrect) diagnosis |
| `https-server.js` | Quick HTTPS server for testing (Node.js) |

## Test commands

```bash
# Works fine with a valid Device-Id — from any client, any origin.
# Replace YOUR_DEVICE_ID_HERE with your actual Device-Id.

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

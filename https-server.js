#!/usr/bin/env node
// Tiny HTTPS server for api-explorer.html testing
// Run: node sandbox/https-server.js
// Open: https://localhost:8443/api-explorer.html (cert warning expected)

const https = require("https");
const fs = require("fs");
const path = require("path");

const SANDBOX = __dirname;
const MIME = {
  ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png",
};

const opts = {
  key: fs.readFileSync(path.join(SANDBOX, "key.pem")),
  cert: fs.readFileSync(path.join(SANDBOX, "cert.pem")),
};

https.createServer(opts, (req, res) => {
  let p = path.join(SANDBOX, req.url === "/" ? "api-explorer.html" : req.url.split("?")[0]);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    res.writeHead(404); return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p).toLowerCase()] || "text/plain" });
  fs.createReadStream(p).pipe(res);
}).listen(8443, () => {
  console.log("https://localhost:8443/api-explorer.html");
});

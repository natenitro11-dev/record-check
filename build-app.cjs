const fs = require('fs');
const p = require('path');
const f = p.join(process.env.HOME,'projects/record-check/src/App.jsx');
fs.writeFileSync(f, [
  'import "./index.css";',
  'import { useState, useEffect, useRef } from "react";',
  '',
  'const IS_BROWSER = typeof window !== "undefined";',
  'const HOST = IS_BROWSER ? window.location.hostname : "";',
  'const IS_LOCAL = HOST === "localhost" || HOST === "127.0.0.1";',
  'const IS_DEPLOYED = IS_BROWSER && !IS_LOCAL && (HOST.includes("pages.dev") || HOST.includes("netlify") || HOST.includes("vercel") || !HOST.includes("claude"));',
  'const PROXIES = [',
  '  u => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u),',
  '  u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),',
  '];',
  'async function proxied(url) {',
  '  if (IS_DEPLOYED || IS_LOCAL) {',
  '    return fetch(url.replace("https://api.congress.gov/v3", "/api/congress"));',
  '  }',
  '  let lastErr = null;',
  '  for (const wrap of PROXIES) {',
  '    try { const r = await fetch(wrap(url),{headers:{Accept:"application/json"}}); if(r.ok) return r; lastErr="HTTP "+r.status; }',
  '    catch(e) { lastErr = e.message; }',
  '  }',
  '  throw new Error("Deploy to Cloudflare for reliable access: " + lastErr);',
  '}',
  'const CONGRESS_BASE = "https://api.congress.gov/v3";',
  'const CONGRESS_KEY = "CLIENT";',
].join('\n'));
console.log('Written start — file size:', fs.statSync(f).size);

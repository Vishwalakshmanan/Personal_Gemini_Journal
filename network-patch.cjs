const dns = require("node:dns");
const tls = require("node:tls");

// 1. Force IPv4 across all DNS lookups
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const origLookup = dns.lookup;
dns.lookup = function (hostname, options, cb) {
  if (typeof options === "function") {
    cb = options;
    options = {};
  }
  const opts = typeof options === "object" ? { ...options, family: 4 } : { family: 4 };
  return origLookup(hostname, opts, (err, address, family) => {
    if (err) return cb(err, address, family);
    if (Array.isArray(address)) {
      const v4Only = address.filter((a) => a.family === 4);
      return cb(null, v4Only.length > 0 ? v4Only : address);
    }
    return cb(null, address, family);
  });
};

// 2. Clamp TLS max send fragment size to 1024 to fit inside MTU 1280
const origTlsConnect = tls.connect;
tls.connect = function (...args) {
  const socket = origTlsConnect.apply(this, args);
  if (socket && typeof socket.setMaxSendFragment === "function") {
    socket.setMaxSendFragment(1024);
  }
  return socket;
};

'use strict';

// Patch raw TCP before loading modules whose Agent implementations may capture connection functions.
const net = require('node:net');

const originalNetConnect = net.connect;
const originalNetCreateConnection = net.createConnection;
const originalSocketConnect = net.Socket.prototype.connect;

function deny(boundary) {
  return function deniedExternalBoundary() {
    throw new Error(`TEST_NETWORK_SENTINEL: ${boundary} was invoked`);
  };
}

function isNumericPort(value) {
  return (
    (typeof value === 'number' && Number.isInteger(value) && value >= 0) ||
    (typeof value === 'string' && /^[0-9]+$/.test(value))
  );
}

function isLoopbackHost(value) {
  const host = String(value ?? 'localhost')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  const ipv4 = host.split('.');
  return (
    ipv4.length === 4 &&
    ipv4[0] === '127' &&
    ipv4.every((part) => /^[0-9]{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  );
}

function isLocalIpcOrLoopback(args) {
  const first = args[0];
  // Node's internal net.normalizeArgs may pass Socket.connect one normalized argument-array.
  if (Array.isArray(first)) return isLocalIpcOrLoopback(first);
  if (first && typeof first === 'object') {
    if (typeof first.path === 'string' && first.path.length > 0) return true;
    if (isNumericPort(first.port)) return isLoopbackHost(first.host ?? first.hostname);
    return false;
  }

  if (isNumericPort(first)) {
    const explicitHost = typeof args[1] === 'string' ? args[1] : undefined;
    return isLoopbackHost(explicitHost);
  }

  // A non-numeric string is a Unix-domain socket or Windows named-pipe path.
  return typeof first === 'string' && first.length > 0;
}

net.Socket.prototype.connect = function guardedSocketConnect(...args) {
  if (!isLocalIpcOrLoopback(args)) return deny('net.Socket.connect')();
  return originalSocketConnect.apply(this, args);
};
net.connect = function guardedNetConnect(...args) {
  if (!isLocalIpcOrLoopback(args)) return deny('net.connect')();
  return originalNetConnect.apply(this, args);
};
net.createConnection = function guardedNetCreateConnection(...args) {
  if (!isLocalIpcOrLoopback(args)) return deny('net.createConnection')();
  return originalNetCreateConnection.apply(this, args);
};

// TLS loads after raw TCP is guarded. HTTPS then sees the guarded TLS/TCP functions during module initialization.
const tls = require('node:tls');
tls.connect = deny('tls.connect');

const http = require('node:http');
const https = require('node:https');
const originalHttpAgentCreateConnection = http.Agent.prototype.createConnection;
const originalHttpsAgentCreateConnection = https.Agent.prototype.createConnection;

http.Agent.prototype.createConnection = function guardedHttpAgentConnection(options, callback) {
  if (!isLocalIpcOrLoopback([options])) return deny('http.Agent.createConnection')();
  return originalHttpAgentCreateConnection.call(this, options, callback);
};
https.Agent.prototype.createConnection = function guardedHttpsAgentConnection(options, callback) {
  if (!isLocalIpcOrLoopback([options])) return deny('https.Agent.createConnection')();
  return originalHttpsAgentCreateConnection.call(this, options, callback);
};

globalThis.fetch = deny('fetch');
http.request = deny('http.request');
http.get = deny('http.get');
https.request = deny('https.request');
https.get = deny('https.get');

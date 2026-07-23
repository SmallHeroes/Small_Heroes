'use strict';

const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');

const originalNetConnect = net.connect;
const originalNetCreateConnection = net.createConnection;

function deny(boundary) {
  return function deniedExternalBoundary() {
    throw new Error(`TEST_NETWORK_SENTINEL: ${boundary} was invoked`);
  };
}

function isLocalIpcOrLoopback(args) {
  const first = args[0];
  if (typeof first === 'string') return true;
  if (first && typeof first === 'object') {
    if (typeof first.path === 'string') return true;
    return ['127.0.0.1', '::1', 'localhost'].includes(first.host);
  }
  // `net.connect(port)` defaults to localhost.
  return typeof first === 'number';
}

globalThis.fetch = deny('fetch');
http.request = deny('http.request');
http.get = deny('http.get');
https.request = deny('https.request');
https.get = deny('https.get');
net.connect = function guardedNetConnect(...args) {
  if (!isLocalIpcOrLoopback(args)) return deny('net.connect')();
  return originalNetConnect.apply(this, args);
};
net.createConnection = function guardedNetCreateConnection(...args) {
  if (!isLocalIpcOrLoopback(args)) return deny('net.createConnection')();
  return originalNetCreateConnection.apply(this, args);
};
tls.connect = deny('tls.connect');

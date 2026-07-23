'use strict';

// Independent lower-level brake for the sentinel's positive-control subprocesses. It loads first; the sentinel
// under test replaces these methods. If that sentinel accidentally allows an external path, the captured original
// lands here instead of reaching the operating system.
function deny(boundary) {
  return function deniedByFailsafe() {
    throw new Error(`TEST_NETWORK_FAILSAFE: ${boundary} escaped the primary sentinel`);
  };
}

const net = require('node:net');
globalThis.fetch = deny('fetch');
net.connect = deny('net.connect');
net.createConnection = deny('net.createConnection');
net.Socket.prototype.connect = deny('net.Socket.connect');

const tls = require('node:tls');
tls.connect = deny('tls.connect');

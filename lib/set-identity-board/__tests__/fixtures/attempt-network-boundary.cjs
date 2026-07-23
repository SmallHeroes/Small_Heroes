'use strict';

const boundary = process.argv[2];

switch (boundary) {
  case 'fetch':
    globalThis.fetch('https://example.com/');
    break;
  case 'http.get':
    require('node:http').get('http://example.com/');
    break;
  case 'https.get':
    require('node:https').get('https://example.com/');
    break;
  case 'tls.connect':
    require('node:tls').connect(443, 'example.com');
    break;
  case 'net.connect.local-default':
    require('node:net').connect(443);
    break;
  case 'net.connect.port-host':
    require('node:net').connect(443, 'example.com');
    break;
  case 'net.connect.numeric-string-host':
    require('node:net').connect('443', 'example.com');
    break;
  case 'net.connect.options':
    require('node:net').connect({ port: '443', host: 'example.com' });
    break;
  case 'net.createConnection.port-host':
    require('node:net').createConnection(443, 'example.com');
    break;
  case 'net.createConnection.numeric-string-host':
    require('node:net').createConnection('443', 'example.com');
    break;
  case 'net.createConnection.options':
    require('node:net').createConnection({ port: '443', host: 'example.com' });
    break;
  case 'net.Socket.connect.options': {
    const net = require('node:net');
    new net.Socket().connect({ port: '443', host: 'example.com' });
    break;
  }
  case 'http.Agent.createConnection':
    new (require('node:http').Agent)().createConnection({ port: 80, host: 'example.com' });
    break;
  case 'https.Agent.createConnection':
    new (require('node:https').Agent)().createConnection({ port: 443, host: 'example.com' });
    break;
  default:
    throw new Error(`unknown network-boundary fixture "${boundary}"`);
}

throw new Error(`UNEXPECTED_NETWORK_BOUNDARY_NOT_BLOCKED: ${boundary}`);

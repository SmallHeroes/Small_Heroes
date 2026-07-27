'use strict';

const fs = require('node:fs');

const boundary = process.argv[2];

if (boundary === 'credential') {
  void process.env.OPENAI_API_KEY;
} else if (boundary === 'write') {
  fs.writeFileSync('sentinel-must-not-exist.txt', 'blocked');
} else if (boundary === 'fetch') {
  void fetch('https://network.invalid');
} else {
  throw new Error(`unknown positive-control boundary: ${boundary}`);
}

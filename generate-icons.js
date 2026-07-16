
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Generate 192x192 icon
const canvas192 = createCanvas(192, 192);
const ctx192 = canvas192.getContext('2d');

// Background
ctx192.fillStyle = '#00754a';
ctx192.fillRect(0, 0, 192, 192);

// Text
ctx192.fillStyle = '#ffffff';
ctx192.font = 'bold 80px Arial';
ctx192.textAlign = 'center';
ctx192.textBaseline = 'middle';
ctx192.fillText('SM', 96, 96);

// Save
const buffer192 = canvas192.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'public', 'icon-192.png'), buffer192);

// Generate 512x512 icon
const canvas512 = createCanvas(512, 512);
const ctx512 = canvas512.getContext('2d');

// Background
ctx512.fillStyle = '#00754a';
ctx512.fillRect(0, 0, 512, 512);

// Text
ctx512.fillStyle = '#ffffff';
ctx512.font = 'bold 200px Arial';
ctx512.textAlign = 'center';
ctx512.textBaseline = 'middle';
ctx512.fillText('SM', 256, 256);

// Save
const buffer512 = canvas512.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'public', 'icon-512.png'), buffer512);

console.log('Icons generated!');

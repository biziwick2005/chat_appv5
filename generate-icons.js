const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

console.log('🎨 Generating PWA icons...');

const sizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' }
];

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

sizes.forEach(({ size, name }) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Draw chat bubble
  ctx.fillStyle = 'white';
  const bubbleSize = size * 0.6;
  const bubbleX = (size - bubbleSize) / 2;
  const bubbleY = (size - bubbleSize) / 2;
  
  // Rounded rectangle for bubble
  const radius = size * 0.05;
  ctx.beginPath();
  ctx.moveTo(bubbleX + radius, bubbleY);
  ctx.lineTo(bubbleX + bubbleSize - radius, bubbleY);
  ctx.quadraticCurveTo(bubbleX + bubbleSize, bubbleY, bubbleX + bubbleSize, bubbleY + radius);
  ctx.lineTo(bubbleX + bubbleSize, bubbleY + bubbleSize - radius);
  ctx.quadraticCurveTo(bubbleX + bubbleSize, bubbleY + bubbleSize, bubbleX + bubbleSize - radius, bubbleY + bubbleSize);
  ctx.lineTo(bubbleX + radius, bubbleY + bubbleSize);
  ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleSize, bubbleX, bubbleY + bubbleSize - radius);
  ctx.lineTo(bubbleX, bubbleY + radius);
  ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
  ctx.closePath();
  ctx.fill();
  
  // Draw chat emoji
  ctx.fillStyle = '#007AFF';
  ctx.font = `bold ${bubbleSize * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💬', size / 2, size / 2);
  
  // Save the icon
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(publicDir, name), buffer);
  console.log(`✅ Created ${name}`);
});

// Also create favicon.ico and other needed icons
console.log('\n📁 Creating additional icons...');

// Create favicon.ico (16x16 and 32x32)
const faviconSizes = [16, 32];
faviconSizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Simple colored circle for favicon
  ctx.fillStyle = '#007AFF';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Add chat bubble outline
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.1;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/3, 0, Math.PI * 2);
  ctx.stroke();
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(publicDir, `icon-${size}x${size}.png`), buffer);
  console.log(`✅ Created icon-${size}x${size}.png`);
});

// Create maskable icon for Android
const maskableCanvas = createCanvas(512, 512);
const maskableCtx = maskableCanvas.getContext('2d');

// Background with safe zone (for maskable icons)
const safeZone = 512 * 0.2; // 20% safe zone
maskableCtx.fillStyle = '#007AFF';
maskableCtx.fillRect(safeZone, safeZone, 512 - safeZone*2, 512 - safeZone*2);

// Chat bubble in center
maskableCtx.fillStyle = 'white';
const centerBubble = 512 * 0.4;
const centerX = 512/2;
const centerY = 512/2;
maskableCtx.beginPath();
maskableCtx.arc(centerX, centerY, centerBubble/2, 0, Math.PI * 2);
maskableCtx.fill();

// Chat emoji
maskableCtx.fillStyle = '#007AFF';
maskableCtx.font = 'bold 80px Arial';
maskableCtx.textAlign = 'center';
maskableCtx.textBaseline = 'middle';
maskableCtx.fillText('💬', centerX, centerY);

const maskableBuffer = maskableCanvas.toBuffer('image/png');
fs.writeFileSync(path.join(publicDir, 'icon-maskable-512x512.png'), maskableBuffer);
console.log('✅ Created icon-maskable-512x512.png');

console.log('\n🎉 All PWA icons generated successfully!');
console.log('\n📋 Files created in public/ folder:');
sizes.forEach(({ name }) => console.log(`  • ${name}`));
console.log('  • icon-16x16.png');
console.log('  • icon-32x32.png');
console.log('  • icon-maskable-512x512.png');
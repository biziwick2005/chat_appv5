const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [
  { name: 'iphone5', width: 320, height: 568 },
  { name: 'iphone6', width: 375, height: 667 },
  { name: 'iphoneplus', width: 414, height: 736 },
  { name: 'iphonex', width: 375, height: 812 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: 'ipadpro1', width: 834, height: 1112 },
  { name: 'ipadpro2', width: 1024, height: 1366 }
];

sizes.forEach(size => {
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d');
  
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, size.width, size.height);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.width, size.height);
  
  // App icon
  const iconSize = Math.min(size.width, size.height) * 0.3;
  const iconX = (size.width - iconSize) / 2;
  const iconY = (size.height - iconSize) / 2;
  
  // Draw icon background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(size.width / 2, size.height / 2, iconSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw chat bubble
  ctx.fillStyle = 'white';
  const bubbleSize = iconSize * 0.6;
  const bubbleX = (size.width - bubbleSize) / 2;
  const bubbleY = (size.height - bubbleSize) / 2;
  
  ctx.beginPath();
  const radius = 15;
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
  
  // Draw chat icon
  ctx.fillStyle = '#007AFF';
  ctx.font = `bold ${bubbleSize * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💬', size.width / 2, size.height / 2);
  
  // App name
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size.width * 0.06}px Arial`;
  ctx.fillText('RealTime Chat', size.width / 2, size.height * 0.85);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, 'public', `splash-${size.name}.png`), buffer);
  console.log(`Generated splash-${size.name}.png`);
});

console.log('Splash screens generated!');
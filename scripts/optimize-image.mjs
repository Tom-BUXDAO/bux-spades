import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const inputBase64 = `data:image/png;base64,${process.argv[2]}`;
const outputPath = path.join(process.cwd(), 'public', 'bux-neon-logo.png');

// Remove the data URL prefix and convert base64 to buffer
const base64Data = inputBase64.replace(/^data:image\/\w+;base64,/, '');
const imageBuffer = Buffer.from(base64Data, 'base64');

// Optimize the image
sharp(imageBuffer)
  .resize(192, 192, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .png({ quality: 90 })
  .toFile(outputPath)
  .then(() => console.log('Image optimized and saved successfully'))
  .catch(err => console.error('Error optimizing image:', err)); 
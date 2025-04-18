import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const inputImagePath = path.join(process.cwd(), 'public', 'IMG_3591.png'); // Look in the public directory
const outputPath = path.join(process.cwd(), 'public', 'bux-neon-logo.png');

// Read the image file
fs.readFile(inputImagePath)
  .then(imageBuffer => {
    // Optimize the image
    return sharp(imageBuffer)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 90 })
      .toFile(outputPath);
  })
  .then(() => console.log('Image optimized and saved successfully to public/bux-neon-logo.png'))
  .catch(err => console.error('Error optimizing image:', err)); 
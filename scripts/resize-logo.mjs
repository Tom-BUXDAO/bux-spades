import sharp from 'sharp';
import path from 'path';

const inputPath = path.join(process.cwd(), 'public', 'BUX.png');
const outputPath = path.join(process.cwd(), 'public', 'bux-logo.png');

sharp(inputPath)
  .resize(256, 256, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .png({ quality: 90 })
  .toFile(outputPath)
  .then(() => console.log('Logo resized successfully'))
  .catch(err => console.error('Error resizing logo:', err)); 
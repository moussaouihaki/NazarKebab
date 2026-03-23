const Jimp = require('jimp');
const path = require('path');

async function createFavicon() {
  const logoPath = path.join(process.cwd(), 'assets/images/logo.png');
  const image = await Jimp.read(logoPath);
  
  // Create small 32x32 version for ICO-style (keeping PNG format but small)
  await image
    .resize(32, 32)
    .write(path.join(process.cwd(), 'public/favicon-small.png'));
    
  // Also standard 64x64
  await image
    .resize(64, 64)
    .write(path.join(process.cwd(), 'public/favicon.png'));
    
  console.log('Favicons generated successfully.');
}

createFavicon().catch(console.error);

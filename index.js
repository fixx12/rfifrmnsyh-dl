const detect = require('./utils/detect');

const platforms = {
  tiktok: require('./lib/tiktok'),
  tiktoklite: require('./lib/tiktoklite'),
  instagram: require('./lib/instagram'),
  instagramlite: require('./lib/instagramlite'),
  facebook: require('./lib/facebook'),
  facebooklite: require('./lib/facebooklite'),
  pinterest: require('./lib/pinterest'),
  soundcloud: require('./lib/soundcloud'),
  spotify: require('./lib/spotify'),
  youtube: require('./lib/youtube'),
};

async function download(url) {
  const platform = detect(url);
  if (!platform) throw new Error('Unsupported platform or invalid URL');
  
  const handler = platforms[platform];
  if (!handler) throw new Error(`No handler for platform: ${platform}`);
  
  return await handler.download(url);
}

module.exports = { download };

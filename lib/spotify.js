const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function download(url) {
  try {
    console.log('\x1b[33m[DEBUG] Menggunakan yt-dlp engine untuk Spotify\x1b[0m');
    
    const command = `yt-dlp --dump-json --no-playlist --extract-audio --audio-format mp3 "${url}"`;
    const { stdout } = await execPromise(command);
    const data = JSON.parse(stdout);
    
    return {
      platform: 'spotify',
      type: 'audio',
      title: data.title || 'Spotify Track',
      author: data.uploader || 'Unknown',
      audio: data.url,
      thumbnail: data.thumbnail,
    };
    
  } catch (error) {
    throw new Error(`Spotify: ${error.message}`);
  }
}

module.exports = { download };

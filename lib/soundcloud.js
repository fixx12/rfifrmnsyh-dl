const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function download(url) {
  try {
    console.log('\x1b[33m[DEBUG] Menggunakan yt-dlp engine untuk SoundCloud\x1b[0m');
    
    const command = `yt-dlp --dump-json --no-playlist "${url}"`;
    const { stdout } = await execPromise(command);
    const data = JSON.parse(stdout);
    
    return {
      platform: 'soundcloud',
      type: 'audio',
      title: data.title || 'SoundCloud Track',
      author: data.uploader || 'Unknown',
      audio: data.url,
      thumbnail: data.thumbnail,
    };
    
  } catch (error) {
    throw new Error(`SoundCloud: ${error.message}`);
  }
}

module.exports = { download };

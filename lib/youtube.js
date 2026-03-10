const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function download(url) {
  try {
    console.log('\x1b[33m[DEBUG] Menggunakan yt-dlp engine untuk YouTube\x1b[0m');
    
    const command = `yt-dlp --dump-json --no-playlist "${url}"`;
    const { stdout } = await execPromise(command);
    const data = JSON.parse(stdout);
    
    return {
      platform: 'youtube',
      type: 'video',
      title: data.title || 'YouTube Video',
      author: data.uploader || 'Unknown',
      video: data.url,
      audio: null,
      thumbnail: data.thumbnail,
    };
    
  } catch (error) {
    throw new Error(`YouTube: ${error.message}`);
  }
}

module.exports = { download };

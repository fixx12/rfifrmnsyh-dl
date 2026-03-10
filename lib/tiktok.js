const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');
const cheerio = require('cheerio');

async function download(url, requestedFormat = 'video') {
  try {
    console.log('\x1b[33m[DEBUG] Menggunakan yt-dlp engine untuk TikTok\x1b[0m');
    
    // ========== COBA DENGAN YT-DLP DULU ==========
    try {
      const command = `yt-dlp --dump-json --no-playlist "${url}"`;
      const { stdout } = await execPromise(command);
      const data = JSON.parse(stdout);
      
      console.log('[DEBUG] Data dari yt-dlp:');
      console.log('  Title:', data.title);
      console.log('  Uploader:', data.uploader);
      console.log('  URL:', data.url ? 'ADA' : 'TIDAK ADA');
      console.log('  Thumbnails:', data.thumbnails?.length || 0);
      
      // DETEKSI JENIS KONTEN
      const isPhoto = !data.url && data.thumbnails && data.thumbnails.length > 1;
      const isPhotoUrl = data.original_url && data.original_url.includes('/photo/');
      const hasManyThumbnails = data.thumbnails && data.thumbnails.length > 3;
      
      // KALAU FOTO / SLIDE SHOW
      if (isPhoto || isPhotoUrl || hasManyThumbnails) {
        console.log('[DEBUG] ✅ Terdeteksi sebagai FOTO/SLIDE SHOW TikTok');
        
        let images = [];
        
        if (data.thumbnails) {
          images = data.thumbnails
            .filter(t => t.url && !t.url.includes('default') && !t.url.includes('avatar'))
            .map(t => t.url);
        }
        
        images = [...new Set(images)];
        
        if (images.length <= 1 && data.thumbnail) {
          images = [data.thumbnail];
        }
        
        console.log(`[DEBUG] ✅ Mendapatkan ${images.length} gambar`);
        
        return {
          platform: 'tiktok',
          type: 'image',
          title: data.title || 'TikTok Photo',
          author: data.uploader || 'Unknown',
          images: images,
          thumbnail: data.thumbnail,
        };
      }
      
      // KALAU VIDEO
      else if (data.url) {
        console.log('[DEBUG] ✅ Terdeteksi sebagai VIDEO TikTok');
        
        const result = {
          platform: 'tiktok',
          type: 'video',
          title: data.title || 'TikTok Video',
          author: data.uploader || 'Unknown',
          video: data.url,
          thumbnail: data.thumbnail,
        };
        
        if (data.formats) {
          const audioFormat = data.formats.find(f => f.vcodec === 'none' && f.acodec !== 'none');
          if (audioFormat) {
            result.audio = audioFormat.url;
          }
        }
        
        return result;
      }
      
    } catch (ytError) {
      // ========== FALLBACK: KALAU YT-DLP GAGAL ==========
      console.log('[DEBUG] yt-dlp gagal, mencoba fallback method...');
      console.log('[DEBUG] Error:', ytError.message);
      
      // Cek apakah ini foto TikTok (dari pesan error)
      if (ytError.message.includes('/photo/')) {
        console.log('[DEBUG] ✅ Terdeteksi sebagai FOTO TikTok (fallback)');
        
        // Extract username dan photo ID dari URL
        const photoMatch = ytError.message.match(/https:\/\/www\.tiktok\.com\/(@[^\/]+)\/photo\/(\d+)/);
        
        if (photoMatch) {
          const username = photoMatch[1];
          const photoId = photoMatch[2];
          
          console.log(`[DEBUG] Username: ${username}, Photo ID: ${photoId}`);
          
          // Fallback: ambil thumbnail dari URL
          const thumbnailUrl = `https://www.tiktok.com/og/image/${photoId}`;
          
          return {
            platform: 'tiktok',
            type: 'image',
            title: `TikTok Photo by ${username}`,
            author: username.replace('@', ''),
            images: [thumbnailUrl],
            thumbnail: thumbnailUrl,
          };
        }
      }
      
      // Cek apakah ini regional block
      if (ytError.message.includes('Unsupported URL') || 
          ytError.message.includes('discontinued')) {
        console.log('[DEBUG] ⚠️  Kemungkinan terkena regional block');
        
        // Coba extract langsung dari URL
        const originalUrl = ytError.message.match(/https:[^\s]+/)?.[0] || url;
        
        if (originalUrl.includes('/photo/')) {
          return {
            platform: 'tiktok',
            type: 'image',
            title: 'TikTok Photo (Regional Block)',
            author: 'Unknown',
            images: [], // Gak bisa dapet gambar
            thumbnail: null,
            error: 'Regional block - coba gunakan VPN',
          };
        }
      }
      
      // Kalau semua gagal, lempar error asli
      throw ytError;
    }
    
  } catch (error) {
    throw new Error(`TikTok: ${error.message}`);
  }
}

module.exports = { download };

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');
const cheerio = require('cheerio');

async function download(url) {
  try {
    console.log('\x1b[33m[DEBUG] Menggunakan yt-dlp engine untuk Pinterest\x1b[0m');
    
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
      console.log('  Formats:', data.formats?.length || 0);
      
      // ========== DETEKSI VIDEO ==========
      let isVideo = false;
      let videoUrl = null;
      let debug = {
        hasVideoKeyword: false,
        videoKeywordsFound: []
      };
      
      // Cek 1: Ada URL langsung
      if (data.url) {
        isVideo = true;
        videoUrl = data.url;
        console.log('[DEBUG] ✅ Video terdeteksi (langsung dari URL)');
      }
      
      // Cek 2: Ada di formats (untuk kasus video stream)
      else if (data.formats && data.formats.length > 0) {
        const videoFormat = data.formats.find(f => f.vcodec !== 'none');
        if (videoFormat) {
          isVideo = true;
          videoUrl = videoFormat.url;
          console.log('[DEBUG] ✅ Video terdeteksi (dari formats)');
        }
      }
      
      // Cek 3: Judul mengandung kata kunci video/animasi
      const title = data.title || '';
      const titleLower = title.toLowerCase();
      const videoKeywords = ['video', 'animated', 'animation', 'gif', 'animasi', 'mov', 'mp4', 'reel'];
      
      debug.hasVideoKeyword = videoKeywords.some(keyword => titleLower.includes(keyword));
      debug.videoKeywordsFound = videoKeywords.filter(k => titleLower.includes(k));
      
      if (debug.hasVideoKeyword && !isVideo) {
        console.log('[DEBUG] ⚠️ Judul mengandung kata video/animasi, tapi yt-dlp tidak menemukan URL video');
        console.log('[DEBUG]   Kata kunci ditemukan:', debug.videoKeywordsFound);
      }
      
      // ========== DETEKSI GAMBAR ==========
      if (!isVideo) {
        console.log('[DEBUG] Tidak terdeteksi sebagai video, proses sebagai gambar');
        
        let images = [];
        
        // Ambil dari thumbnails
        if (data.thumbnails && data.thumbnails.length > 0) {
          images = data.thumbnails
            .filter(t => t.url && !t.url.includes('default') && !t.url.includes('Placeholder'))
            .map(t => t.url);
        }
        
        // Hapus duplikat
        images = [...new Set(images)];
        
        // Fallback ke thumbnail utama
        if (images.length === 0 && data.thumbnail) {
          images = [data.thumbnail];
        }
        
        console.log(`[DEBUG] ✅ Gambar: ${images.length} buah`);
        
        return {
          platform: 'pinterest',
          type: 'image',
          title: data.title || 'Pinterest Pin',
          author: data.uploader || 'Unknown',
          images: images,
          thumbnail: data.thumbnail,
          isVideo: false,
          debug: debug
        };
      }
      
      // ========== KALAU VIDEO ==========
      else {
        console.log('[DEBUG] ✅ Diproses sebagai VIDEO');
        
        return {
          platform: 'pinterest',
          type: 'video',
          title: data.title || 'Pinterest Video',
          author: data.uploader || 'Unknown',
          video: videoUrl,
          thumbnail: data.thumbnail,
          isVideo: true,
          debug: debug
        };
      }
      
    } catch (ytError) {
      // ========== FALLBACK: KALAU YT-DLP GAGAL TOTAL ==========
      console.log('[DEBUG] yt-dlp gagal, mencoba fallback scraping...');
      console.log('[DEBUG] Error:', ytError.message);
      
      // Ambil HTML halaman Pinterest
      const html = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }).then(r => r.data);
      
      const $ = cheerio.load(html);
      
      // ========== CEK VIDEO DULU ==========
      let videoUrl = $('meta[property="og:video"]').attr('content') ||
                     $('meta[property="og:video:url"]').attr('content') ||
                     $('meta[name="twitter:player:stream"]').attr('content');
      
      if (videoUrl) {
        console.log('[DEBUG] ✅ Video ditemukan via fallback scraping');
        
        return {
          platform: 'pinterest',
          type: 'video',
          title: $('meta[property="og:title"]').attr('content') || 'Pinterest Video',
          author: $('meta[property="og:description"]').attr('content')?.split('|')[0]?.trim() || 'Unknown',
          video: videoUrl,
          thumbnail: $('meta[property="og:image"]').attr('content') || null,
          isVideo: true
        };
      }
      
      // ========== KALAU GAK ADA VIDEO, AMBIL GAMBAR ==========
      let ogImage = $('meta[property="og:image"]').attr('content');
      
      if (!ogImage) {
        ogImage = $('meta[name="twitter:image"]').attr('content');
      }
      
      if (!ogImage) {
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
          try {
            const data = JSON.parse(jsonLd);
            if (data.image) ogImage = data.image;
          } catch (e) {}
        }
      }
      
      if (ogImage) {
        console.log('[DEBUG] ✅ Gambar ditemukan via fallback scraping');
        return {
          platform: 'pinterest',
          type: 'image',
          title: $('meta[property="og:title"]').attr('content') || 'Pinterest Pin',
          author: 'Unknown',
          images: [ogImage],
          thumbnail: ogImage,
          isVideo: false
        };
      }
      
      // Kalau semua gagal
      throw new Error('Tidak bisa extract video atau gambar dari Pinterest');
    }
    
  } catch (error) {
    throw new Error(`Pinterest: ${error.message}`);
  }
}

module.exports = { download };

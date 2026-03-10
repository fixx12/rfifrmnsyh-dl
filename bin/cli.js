#!/usr/bin/env node

const { download } = require('../index');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const axios = require('axios');
const path = require('path');

// ========== PARSING ARGUMEN ==========
const args = process.argv.slice(2);
const url = args[0];
let requestedFormat = 'video'; // default

if (args.length >= 2) {
  if (args[1].toLowerCase() === 'audio' || args[1].toLowerCase() === 'mp3') {
    requestedFormat = 'audio';
  } else if (args[1].toLowerCase() === 'video' || args[1].toLowerCase() === 'mp4') {
    requestedFormat = 'video';
  }
}

if (!url) {
  console.error('\n\x1b[31m❌ Usage: rfifrmnsyh-dl <URL> [video/audio]\x1b[0m');
  console.log('   Contoh:');
  console.log('   rfifrmnsyh-dl https://youtu.be/FRXm-WHH57Y video');
  console.log('   rfifrmnsyh-dl https://youtu.be/FRXm-WHH57Y audio');
  console.log('   rfifrmnsyh-dl https://vt.tiktok.com/ZSuhTXSSa/ video');
  console.log('   rfifrmnsyh-dl https://on.soundcloud.com/9i4bdoyoKuuBfAg5jA audio\n');
  process.exit(1);
}

console.log('\n\x1b[36m╔════════════════════════════════════╗\x1b[0m');
console.log('\x1b[36m║    RFIFRMNSYH DOWNLOADER v1.0     ║\x1b[0m');
console.log('\x1b[36m╚════════════════════════════════════╝\x1b[0m\n');

// ========== FUNGSI DOWNLOAD FILE ==========
async function downloadFile(fileUrl, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.pinterest.com/',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
    },
    timeout: 10000,
    maxRedirects: 5
  });

  const contentType = response.headers['content-type'];
  if (contentType && contentType.includes('text/html')) {
    throw new Error('Server mengembalikan halaman HTML (mungkin 403), bukan gambar');
  }

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      const stats = fs.statSync(outputPath);
      if (stats.size < 1024) {
        fs.unlinkSync(outputPath);
        reject(new Error('File terlalu kecil, kemungkinan error'));
      } else {
        console.log(`   \x1b[32m✅ Saved: ${outputPath}\x1b[0m`);
        resolve();
      }
    });
    writer.on('error', reject);
  });
}

// ========== FUNGSI DOWNLOAD GAMBAR DENGAN MULTIPLE FALLBACK ==========
async function downloadImageWithFallback(imageUrls, outputPath) {
  for (const [index, imgUrl] of imageUrls.entries()) {
    try {
      console.log(`   [${index + 1}/${imageUrls.length}] Mencoba URL ${index + 1}...`);
      await downloadFile(imgUrl, outputPath);
      return true;
    } catch (err) {
      console.log(`   ⚠️  URL ${index + 1} gagal: ${err.message}`);
    }
  }
  throw new Error('Semua URL gagal');
}

// ========== FUNGSI DOWNLOAD DENGAN YT-DLP (FIX UNTUK FACEBOOK, SOUNDCLOUD, PINTEREST) ==========
async function downloadWithYtDlp(url, platform, requestedFormat) {
  try {
    console.log(`📥 Menggunakan yt-dlp untuk download ${platform}...`);

    // ========== SOUNDCLOUD: PAKSA AUDIO ==========
    if (platform === 'soundcloud') {
      requestedFormat = 'audio';
    }

    const cookieOption = fs.existsSync('cookies.txt') ? '--cookies cookies.txt' : '';

    let command = '';
    let outputFile = 'video.%(ext)s';

    // ========== PINTEREST: COBA TANPA FILTER DULU ==========
    if (platform === 'pinterest' && requestedFormat === 'video') {
      command = `yt-dlp ${cookieOption} -o "${outputFile}" "${url}"`;
      console.log('   🎬 Mode: VIDEO (Pinterest - tanpa filter)');
    }
    // ========== FACEBOOK: TAMBAH TIMEOUT ==========
    else if (platform === 'facebook') {
      command = `yt-dlp --socket-timeout 30 ${cookieOption} -o "${outputFile}" "${url}"`;
      console.log('   🎬 Mode: VIDEO (Facebook - timeout 30s)');
    }
    // ========== AUDIO ==========
    else if (requestedFormat === 'audio') {
      outputFile = 'audio.%(ext)s';
      command = `yt-dlp -x --audio-format mp3 ${cookieOption} -o "${outputFile}" "${url}"`;
      console.log('   🎵 Mode: AUDIO');
    }
    // ========== VIDEO DEFAULT DENGAN FILTER ==========
    else {
      command = `yt-dlp -f "best[height<=1080]" ${cookieOption} -o "${outputFile}" "${url}"`;
      console.log('   🎬 Mode: VIDEO');
    }

    console.log(`   Running: ${command.substring(0, 80)}...`);
    const { stdout, stderr } = await execPromise(command);

    if (stderr && !stderr.includes('WARNING')) {
      console.log('   ⚠️  yt-dlp stderr:', stderr);
    }

    const files = fs.readdirSync('.');
    let savedFile = '';

    if (outputFile.startsWith('audio')) {
      savedFile = files.find(f => f.startsWith('audio.'));
    } else {
      savedFile = files.find(f => f.startsWith('video.'));
    }

    if (savedFile) {
      console.log(`   \x1b[32m✅ Saved: ${savedFile}\x1b[0m`);
      return true;
    } else {
      console.log('   ⚠️  File tidak ditemukan, tapi mungkin sudah terdownload');
      return false;
    }

  } catch (error) {
    console.error('   \x1b[31m❌ Download error:\x1b[0m', error.message);

    // ========== FALLBACK UNTUK FACEBOOK TIMEOUT ==========
    if (platform === 'facebook' && error.message.includes('timed out')) {
      console.log('   📌 Facebook timeout, coba dengan --force-ipv4...');
      try {
        const fallbackCmd = `yt-dlp --force-ipv4 --socket-timeout 60 ${cookieOption} -o "video.%(ext)s" "${url}"`;
        console.log(`   Running fallback: ${fallbackCmd.substring(0, 80)}...`);
        await execPromise(fallbackCmd);
        const files = fs.readdirSync('.');
        const savedFile = files.find(f => f.startsWith('video.'));
        if (savedFile) {
          console.log(`   \x1b[32m✅ Saved: ${savedFile}\x1b[0m`);
          return true;
        }
      } catch (fbError) {
        console.log('   ❌ Fallback juga gagal');
      }
    }

    // ========== FALLBACK UNTUK PINTEREST VIDEO ==========
    if (platform === 'pinterest' && requestedFormat === 'video' &&
        error.message.includes('Requested format is not available')) {

      console.log('   📌 Pinterest video gagal, fallback ke download gambar...');

      // Panggil ulang fungsi download untuk dapat gambar
      const result = await download(url, 'video');

      if (result.images && result.images.length > 0) {
        console.log(`   🖼️ Mendownload ${result.images.length} gambar sebagai fallback...`);

        for (let i = 0; i < result.images.length; i++) {
          const imgUrl = result.images[i];
          let ext = 'jpg';
          try {
            const urlObj = new URL(imgUrl);
            const pathname = urlObj.pathname;
            const extMatch = pathname.match(/\.(\w+)(\?|$)/);
            if (extMatch) ext = extMatch[1];
          } catch (e) {}

          const filename = `image_${i+1}.${ext}`;
          await downloadFile(imgUrl, filename);
        }
        return true;
      }
    }

    throw error;
  }
}

// ========== FUNGSI UNTUK MENAMPILKAN PESAN REGIONAL BLOCK ==========
function showRegionalBlockMessage(platform, username, photoId) {
  console.log('\n\x1b[33m⚠️  Konten tidak bisa didownload karena:\x1b[0m');
  console.log('   • Terdeteksi regional block (kemungkinan Hong Kong)');
  console.log('   • Server mengembalikan error 403/302');
  console.log('\n\x1b[36m💡 Saran:\x1b[0m');
  console.log('   • Gunakan VPN ke negara lain (Indonesia, Singapore, US)');
  console.log('   • Setelah VPN aktif, coba lagi:');
  console.log(`     node bin/cli.js ${url}`);

  if (platform === 'tiktok' && username && photoId) {
    console.log('\n   • Atau akses langsung di browser:');
    console.log(`     https://www.tiktok.com/@${username.replace('@', '')}/photo/${photoId}`);
  }
  console.log();
}

// ========== MAIN FUNCTION ==========
(async () => {
  try {
    console.log(`🔍 Mendeteksi platform dari URL...`);
    const result = await download(url, requestedFormat);

    console.log(`\n\x1b[33m📊 INFORMASI MEDIA\x1b[0m`);
    console.log(`   Platform : \x1b[36m${result.platform}\x1b[0m`);
    console.log(`   Title    : ${result.title || '-'}`);
    console.log(`   Author   : ${result.author || '-'}`);
    console.log(`   Type     : \x1b[35m${result.type}\x1b[0m`);
    console.log(`   Request  : \x1b[33m${requestedFormat}\x1b[0m`);

    if (result.isVideo !== undefined) {
      console.log(`   Konten   : \x1b[36m${result.isVideo ? '🎬 VIDEO' : '🖼️ GAMBAR'}\x1b[0m`);
    }
    if (result.debug && result.debug.hasVideoKeyword) {
      console.log(`   Catatan  : Judul mengandung kata "animated/video"`);
    }
    console.log();

    // ========== HANDLE GAMBAR ==========
    if (result.images && result.images.length > 0) {
      console.log(`🖼️  Mendownload ${result.images.length} gambar...`);

      const username = result.author ? `@${result.author}` : null;
      const photoId = result.title?.match(/\d+/)?.[0] || null;
      let successCount = 0;

      for (let i = 0; i < result.images.length; i++) {
        const imgUrl = result.images[i];
        let ext = 'jpg';
        try {
          const urlObj = new URL(imgUrl);
          const pathname = urlObj.pathname;
          const extMatch = pathname.match(/\.(\w+)(\?|$)/);
          if (extMatch) ext = extMatch[1];
        } catch (e) {}

        const filename = `image_${i+1}.${ext}`;
        process.stdout.write(`   [${i+1}/${result.images.length}] Downloading... `);
        try {
          if (result.images.length === 1 && result.images.length < 3) {
            await downloadImageWithFallback(result.images, filename);
          } else {
            await downloadFile(imgUrl, filename);
          }
          successCount++;
        } catch (err) {
          console.log(`\x1b[31m❌ Gagal: ${err.message}\x1b[0m`);
        }
      }

      if (successCount === 0) {
        showRegionalBlockMessage(result.platform, username, photoId);
      }
    }
    // ========== HANDLE VIDEO/AUDIO ==========
    else {
      if (result.error) {
        console.log(`\n\x1b[33m⚠️  ${result.error}\x1b[0m`);
        console.log('   Saran: Coba gunakan VPN atau proxy');
        showRegionalBlockMessage(result.platform, result.author, null);
      } else if (requestedFormat === 'audio' && result.type === 'video') {
        console.log('🎵 User minta AUDIO dari video...');
        if (result.audio) {
          console.log('   Audio URL tersedia langsung, download audio...');
          await downloadWithYtDlp(url, result.platform, 'audio');
        } else {
          console.log('   Audio tidak tersedia langsung, akan diekstrak dari video...');
          await downloadWithYtDlp(url, result.platform, 'audio');
        }
      } else {
        const success = await downloadWithYtDlp(url, result.platform, requestedFormat);
        if (!success) {
          console.log('   ⚠️ Download gagal, tapi fallback sudah dicoba');
        }
      }
    }

    console.log('\n\x1b[32m✅✅✅ DOWNLOAD SELESAI! ✅✅✅\x1b[0m\n');

  } catch (error) {
    console.error('\n\x1b[31m❌ ERROR:', error.message, '\x1b[0m\n');
  }
})();

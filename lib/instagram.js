async function download(url) {
  throw new Error(
    '❌ Instagram tidak didukung dalam library ini.\n' +
    'Alasan: Memerlukan cookie login dan sering kena rate-limit.\n' +
    'Silakan gunakan yt-dlp langsung dengan opsi:\n' +
    'yt-dlp --cookies-from-browser chrome URL_INSTA'
  );
}

module.exports = { download };

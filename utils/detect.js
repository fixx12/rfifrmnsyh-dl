function detect(url) {
  const patterns = {
    tiktok: /(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i,
    tiktoklite: /(tiktoklite\.com|vt\.tiktoklite\.com|vm\.tiktoklite\.com)/i,
    instagram: /(instagram\.com|instagr\.am)/i,
    instagramlite: /(instagramlite\.com)/i,
    facebook: /(facebook\.com|fb\.watch|fb\.com)/i,
    facebooklite: /(facebooklite\.com)/i,
    pinterest: /(pinterest\.com|pin\.it)/i,
    soundcloud: /(soundcloud\.com|on\.soundcloud\.com)/i, // ✅ TAMBAH on.soundcloud.com
    spotify: /(spotify\.com|open\.spotify\.com)/i,
    youtube: /(youtube\.com|youtu\.be)/i,
  };
  
  for (const [platform, pattern] of Object.entries(patterns)) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

module.exports = detect;

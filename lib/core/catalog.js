export function normalizeVolumeKey(volumeNumero) {
  return String(volumeNumero).trim();
}

export function getChaptersForVolume(chaptersByVolume, volumeNumero) {
  const key = normalizeVolumeKey(volumeNumero);

  if (chaptersByVolume.has(key)) {
    return chaptersByVolume.get(key);
  }

  for (const [volumeKey, capitulos] of chaptersByVolume) {
    if (volumeKey.toLowerCase() === key.toLowerCase()) {
      return capitulos;
    }
  }

  return [];
}

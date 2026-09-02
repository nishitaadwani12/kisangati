// Classify a stored media URL by extension, for the OrderMedia.kind column and UI rendering.
export function mediaKind(url: string): "photo" | "voice" | "file" {
  if (/\.(jpg|jpeg|png|webp|heic|gif)$/i.test(url)) return "photo";
  if (/\.(m4a|ogg|mp3|aac|wav|webm)$/i.test(url)) return "voice";
  return "file";
}

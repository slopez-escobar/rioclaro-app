// Hash SHA-256 (hexadecimal) del contenido de un archivo o Blob.
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

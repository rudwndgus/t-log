import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../public/icons/icon.svg', import.meta.url))
await Promise.all([
  sharp(source).resize(192, 192).png().toFile(fileURLToPath(new URL('../public/icons/pwa-192.png', import.meta.url))),
  sharp(source).resize(512, 512).png().toFile(fileURLToPath(new URL('../public/icons/pwa-512.png', import.meta.url))),
  sharp(source).resize(180, 180).png().toFile(fileURLToPath(new URL('../public/icons/apple-touch-icon.png', import.meta.url)))
])

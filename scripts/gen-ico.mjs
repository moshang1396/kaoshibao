// 生成 Windows exe 图标 build/icon.ico（与手机端 public/icon-512.png 同款）
import Jimp from 'jimp'
import pngToIco from 'png-to-ico'
import { mkdirSync, writeFileSync } from 'fs'

const sizes = [256, 128, 64, 48, 32, 16]
const img = await Jimp.read('public/icon-512.png')
const pngs = []
for (const s of sizes) {
  pngs.push(await img.clone().resize(s, s).getBufferAsync(Jimp.MIME_PNG))
}
mkdirSync('build', { recursive: true })
const ico = await pngToIco(pngs)
writeFileSync('build/icon.ico', ico)
console.log('build/icon.ico 生成成功,', ico.length, 'bytes')

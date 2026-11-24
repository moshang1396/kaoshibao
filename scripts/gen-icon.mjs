// 生成 PWA 应用图标（192/512 PNG）：蓝色圆角底 + 白色对勾
// 纯 Node 实现，无第三方依赖
import zlib from 'zlib'
import fs from 'fs'

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  const ex = x1 + t * dx, ey = y1 + t * dy
  return Math.hypot(px - ex, py - ey)
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4)
  const r = size * 0.22 // 圆角半径
  const maxR = r - 0.5
  const half = size / 2
  const w = size * 0.105 // 描边宽度
  const segs = [
    [0.28, 0.55, 0.44, 0.71],
    [0.44, 0.71, 0.74, 0.34]
  ].map(([a, b, c, d]) => [a * size, b * size, c * size, d * size])

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // 圆角矩形内部判定
      const qx = x < r ? r - x : x > size - 1 - r ? x - (size - 1 - r) : 0
      const qy = y < r ? r - y : y > size - 1 - r ? y - (size - 1 - r) : 0
      const outside = Math.hypot(qx, qy) > maxR
      if (outside) continue
      let R = 0x3b, G = 0x6e, B = 0xf5 // 蓝底
      for (const [x1, y1, x2, y2] of segs) {
        if (distToSeg(x + 0.5, y + 0.5, x1, y1, x2, y2) < w / 2) {
          R = 255; G = 255; B = 255
          break
        }
      }
      px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = 255
    }
  }

  // PNG 组装
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter none
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

for (const s of [192, 512]) {
  fs.writeFileSync(`public/icon-${s}.png`, makeIcon(s))
  console.log(`icon-${s}.png done`)
}

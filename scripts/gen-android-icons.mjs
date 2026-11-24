// 生成安卓启动图标：从 public/icon-512.png 缩放到各 mipmap 密度
import Jimp from "jimp";
import { mkdirSync } from "fs";

const src = "public/icon-512.png";
const resDir = "android/app/src/main/res";
const sizes = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

const img = await Jimp.read(src);
for (const [dir, size] of sizes) {
  mkdirSync(`${resDir}/${dir}`, { recursive: true });
  for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
    await img.clone().resize(size, size).quality(90).writeAsync(`${resDir}/${dir}/${name}`);
  }
  console.log(`done ${dir} ${size}px`);
}
console.log("ALL ICONS OK");

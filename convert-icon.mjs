import { Jimp } from 'jimp'
import { writeFileSync } from 'fs'

async function convertToIco() {
  const image = await Jimp.read('src/logo/GitTrace.jpg')
  
  // 创建多个尺寸的图标
  const sizes = [16, 32, 48, 64, 128, 256]
  const images = []
  
  for (const size of sizes) {
    const resized = image.clone().resize({ w: size, h: size })
    const buffer = await resized.getBuffer('image/png')
    images.push(buffer)
  }
  
  // 简单的 ICO 文件格式
  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0)      // 保留
  icoHeader.writeUInt16LE(1, 2)      // 类型: ICO
  icoHeader.writeUInt16LE(sizes.length, 4) // 图像数量
  
  let offset = 6 + sizes.length * 16 // 头部 + 目录
  const directory = Buffer.alloc(sizes.length * 16)
  const imageBuffers = []
  
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const png = images[i]
    const entry = directory.slice(i * 16, (i + 1) * 16)
    
    entry.writeUInt8(size === 256 ? 0 : size, 0)  // 宽度
    entry.writeUInt8(size === 256 ? 0 : size, 1)  // 高度
    entry.writeUInt8(0, 2)           // 调色板
    entry.writeUInt8(0, 3)           // 保留
    entry.writeUInt16LE(1, 4)        // 颜色平面
    entry.writeUInt16LE(32, 6)       // 每像素位数
    entry.writeUInt32LE(png.length, 8)  // 数据大小
    entry.writeUInt32LE(offset, 12)  // 数据偏移
    
    offset += png.length
    imageBuffers.push(png)
  }
  
  const ico = Buffer.concat([icoHeader, directory, ...imageBuffers])
  writeFileSync('build/icon.ico', ico)
  console.log('Icon converted successfully!')
}

convertToIco().catch(console.error)

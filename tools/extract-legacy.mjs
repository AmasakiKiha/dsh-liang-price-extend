// 一次性抽取：从原 client.js 取出 FRAMES（31 张 base64 头像）与 STYLE（CSS 字符串数组），
// 之后的构建都从 src/frames.js / src/style.js 读取，不再依赖原文件。
import fs from 'node:fs';
import path from 'node:path';

const root = 'E:/dsh-plugins/dsh-liang-price-extend';
const legacy = fs.readFileSync(path.join(root, 'client.js'), 'utf8').split('\n');

// 行号以原始文件为准（1-based）：FRAMES 29..61，STYLE 162..178
const framesBlock = legacy.slice(28, 61).join('\n'); // const FRAMES = [ ... ];
const styleBlock = legacy.slice(161, 178).join('\n'); // const STYLE = [ ... ].join('\n');

fs.mkdirSync(path.join(root, 'src'), { recursive: true });

const framesOut =
  '// 31 张档位头像（MIT-0，脸部裁切）。构建时内联进 client.js，运行时零网络请求。\n' +
  'export ' + framesBlock.trimStart() + '\n';
fs.writeFileSync(path.join(root, 'src', 'frames.js'), framesOut, 'utf8');

const styleOut =
  '// 侧边栏底栏样式：使用 DSH 主题变量，深浅色自动跟随。\n' +
  'export ' + styleBlock.trimStart() + '\n';
fs.writeFileSync(path.join(root, 'src', 'style.js'), styleOut, 'utf8');

console.log('frames lines:', framesBlock.split('\n').length, 'chars:', framesBlock.length);
console.log('style lines:', styleBlock.split('\n').length, 'chars:', styleBlock.length);
console.log('frames head:', framesBlock.slice(0, 60));
console.log('style head:', styleBlock.slice(0, 60));
console.log('style tail:', styleBlock.slice(-80));

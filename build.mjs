// 构建：把 src/ 下的逻辑、日历、头像、样式内联进一个自包含的 client.js。
// client.js 是 classic script（DSH 的 __ModuleLoader__ 直接执行），不能 import，
// 所以这里做一次文本内联。产物随时可由源码重建。
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(url.fileURLToPath(import.meta.url));

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

/** 去掉 ESM 的 import/export 语法，保留声明本体，缩进对齐到模板里的 4 空格。 */
function inline(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*import\s.*from\s+['"].*['"];?\s*$/.test(line))
    .filter((line) => !/^\s*export\s*\{[^}]*\}\s*;?\s*$/.test(line))
    .join('\n')
    .replace(/^export\s+/gm, '')
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line.replace(/^ {4}/, '') : line))
    .join('\n');
}

// v1.2.0 起不再内联节假日表：峰谷状态优先取鲸鱼挂件的 /dsh-whale/balance.json，
// 取不到才退回 src/logic.mjs 里的"周末 + 工作时段"规则。
const logic = inline(read('src/logic.mjs'));
const frames = inline(read('src/frames.js'));
const style = inline(read('src/style.js'));
const template = read('src/ui.template.js');

const out = template
  .replace('__LOGIC__', logic)
  .replace('__FRAMES__', frames)
  .replace('__STYLE__', style);

if (/__[A-Z]+__/.test(out)) {
  throw new Error('template placeholder left unfilled: ' + out.match(/__[A-Z]+__/g).join(','));
}

const target = path.join(root, 'client.js');
fs.writeFileSync(target, out, 'utf8');

const pkg = JSON.parse(read('package.json'));
const version = read('src/logic.mjs').match(/VERSION = '([^']+)'/)[1];
pkg.version = version;
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log('built client.js:', fs.statSync(target).size, 'bytes, version', version);

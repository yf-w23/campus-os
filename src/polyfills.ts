import 'react-native-get-random-values';

declare global {
  // eslint-disable-next-line no-var
  var atob: (data: string) => string;
  // eslint-disable-next-line no-var
  var btoa: (data: string) => string;
  // eslint-disable-next-line no-var
  var Buffer: any;
}

if (typeof global.atob === 'undefined') {
  const base64 = require('base-64');
  global.atob = base64.decode;
  global.btoa = base64.encode;
}

// Buffer 需要给 iconv-lite 等 Node 风格依赖用（教务系统 URL 里的建筑名需 GB2312 编码）
if (typeof global.Buffer === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {Buffer} = require('buffer');
  global.Buffer = Buffer;
}

// process polyfill 给同样依赖 Node 环境的库使用（用 any 避开和 @types/node 的 Process 冲突）
const g = global as any;
if (typeof g.process === 'undefined') {
  g.process = {env: {}, browser: true};
} else if (!g.process.env) {
  g.process.env = {};
}

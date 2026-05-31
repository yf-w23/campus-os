import 'react-native-get-random-values';

declare global {
  var Buffer: any;
}

const globalAny = global as any;

if (typeof globalAny.atob === 'undefined') {
  const base64 = require('base-64');
  globalAny.atob = base64.decode;
  globalAny.btoa = base64.encode;
}

// Buffer 需要给 iconv-lite 等 Node 风格依赖用（教务系统 URL 里的建筑名需 GB2312 编码）
if (typeof globalAny.Buffer === 'undefined') {
  const {Buffer} = require('buffer');
  globalAny.Buffer = Buffer;
}

// process polyfill 给同样依赖 Node 环境的库使用（用 any 避开和 @types/node 的 Process 冲突）
if (typeof globalAny.process === 'undefined') {
  globalAny.process = {env: {}, browser: true};
} else if (!globalAny.process.env) {
  globalAny.process.env = {};
}

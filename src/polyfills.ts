import 'react-native-get-random-values';

declare global {
  var Buffer: any;
}

const globalAny = global as any;

if (typeof globalAny.atob === 'undefined') {
  try {
    const base64 = require('base-64');
    globalAny.atob = base64.decode;
    globalAny.btoa = base64.encode;
  } catch {
    globalAny.atob = (input: string) => input;
    globalAny.btoa = (input: string) => input;
  }
}

if (typeof globalAny.Buffer === 'undefined') {
  try {
    const {Buffer: Buf} = require('buffer');
    globalAny.Buffer = Buf;
  } catch {
    // Buffer polyfill 不可用时降级：GBK 编码功能将不可用但 App 不崩溃
  }
}

if (typeof globalAny.process === 'undefined') {
  globalAny.process = {env: {}, browser: true};
} else if (typeof globalAny.process.env !== 'object' || globalAny.process.env === null) {
  globalAny.process.env = {};
}

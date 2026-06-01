module.exports = {
  preset: 'react-native',
  setupFiles: ['./__mocks__/jest.setup.ts'],
  transformIgnorePatterns: [
    // uuid v9+ 默认 ESM-only，必须让 babel-jest 转一下；
    // 同时保留 RN 相关包的转换（这是 RN preset 的默认要求）。
    'node_modules/(?!(react-native|@react-native|@react-navigation|uuid|immer|@reduxjs|jsencrypt)/)',
  ],
  // upstream/ 是上游仓库源码副本，不参与本仓库测试
  testPathIgnorePatterns: ['/node_modules/', '/upstream/'],
};

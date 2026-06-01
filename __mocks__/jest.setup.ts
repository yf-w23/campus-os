(global as any).self = global;
(global as any).window = global;
(global as any).navigator = {userAgent: 'jest'};

const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockStorage[key];
    }),
    clear: jest.fn(async () => {
      Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    }),
  },
}));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => null),
  resetGenericPassword: jest.fn(async () => true),
}));

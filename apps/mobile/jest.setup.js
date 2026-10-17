// AsyncStorage is a native module; the package ships an in-memory mock for Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The Settings screen asks the secure store whether an AI key is saved. Native module → in-memory stand-in.
jest.mock('expo-secure-store', () => {
  const values = new Map();
  return {
    getItemAsync: async (k) => values.get(k) ?? null,
    setItemAsync: async (k, v) => void values.set(k, v),
    deleteItemAsync: async (k) => void values.delete(k),
  };
});

// React Navigation's screen transitions schedule state updates on timers outside RNTL's act() boundary.
// They are benign in a smoke test and drown real failures in CI logs, so drop that one warning only.
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act(')) return;
  originalError(...args);
};

import "@testing-library/jest-dom/vitest";

// Node 25+ defines its own global `localStorage`, which shadows jsdom's and is unusable
// without --localstorage-file. Give tests a predictable in-memory Storage instead.
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
Object.defineProperty(window, "localStorage", { value: storage, configurable: true, writable: true });

afterEach(() => {
  storage.clear();
});

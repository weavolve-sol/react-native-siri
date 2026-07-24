import { registerWebModule, NativeModule } from 'expo';

// Siri App Intents do not exist on the web platform; every method is a no-op
// so shared application code can call the API unconditionally.
class ReactNativeSiriModule extends NativeModule {
  getAppGroup(): string | null {
    return null;
  }
  async syncEntities(_collection: string, _items: Record<string, string>[]): Promise<void> {}
  async getSharedData(_key: string): Promise<string | null> {
    return null;
  }
  async setSharedData(_key: string, _value: string | null): Promise<void> {}
  async updateShortcuts(): Promise<void> {}
  async donateUserActivity(_options: unknown): Promise<void> {}
  async clearUserActivity(): Promise<void> {}
}

export default registerWebModule(ReactNativeSiriModule, 'ReactNativeSiriModule');

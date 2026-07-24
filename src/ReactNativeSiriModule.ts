import { NativeModule, requireNativeModule } from 'expo';

declare class ReactNativeSiriModule extends NativeModule {
  getAppGroup(): string | null;
  syncEntities(collection: string, items: Record<string, string>[]): Promise<void>;
  getSharedData(key: string): Promise<string | null>;
  setSharedData(key: string, value: string | null): Promise<void>;
  updateShortcuts(): Promise<void>;
  donateUserActivity(options: {
    activityType: string;
    title: string;
    userInfo: Record<string, string>;
    keywords: string[];
    persistentIdentifier: string | null;
    eligibleForSearch: boolean;
    eligibleForPrediction: boolean;
  }): Promise<void>;
  clearUserActivity(): Promise<void>;
}

export default requireNativeModule<ReactNativeSiriModule>('ReactNativeSiri');

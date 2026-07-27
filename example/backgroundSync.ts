import { syncEntities } from '@weavolve/react-native-siri';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { fetchLatestTrains } from './trains';

export const SIRI_SYNC_TASK = 'siri-data-sync';

// Defined at module scope (imported from App.tsx) so the executor is also
// available when iOS launches the app headlessly for a background task.
TaskManager.defineTask(SIRI_SYNC_TASK, async () => {
  try {
    const trains = await fetchLatestTrains();
    await syncEntities('trains', trains);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('Background Siri sync failed', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Registers the periodic background sync that keeps the App Group store
 * (and therefore Siri's answers and phrase suggestions) fresh while the
 * app is closed. iOS schedules it opportunistically: 15 minutes is the
 * floor, actual runs are usually much rarer, and force-quitting the app
 * stops background execution entirely.
 */
export async function registerSiriBackgroundSync(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    return;
  }
  await BackgroundTask.registerTaskAsync(SIRI_SYNC_TASK, { minimumInterval: 15 });
}

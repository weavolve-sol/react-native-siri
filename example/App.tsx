import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addIntentListener,
  donateUserActivity,
  syncEntities,
} from '@weavolve/react-native-siri';

type Train = {
  id: string;
  name: string;
  destination: string;
  arrivalTime: string;
  status: 'On time' | 'Delayed' | 'Arrived';
};

const INITIAL_TRAINS: Train[] = [
  { id: 'RMEGR', name: 'RMEGR', destination: 'Medina', arrivalTime: '10:45 AM', status: 'On time' },
  { id: 'KLM12', name: 'KLM12', destination: 'Gregory', arrivalTime: '11:10 AM', status: 'Delayed' },
  { id: 'QPX07', name: 'QPX07', destination: 'Medina', arrivalTime: '11:35 AM', status: 'On time' },
  { id: 'ZTA44', name: 'ZTA44', destination: 'Harlow', arrivalTime: '12:05 PM', status: 'On time' },
  { id: 'BNC91', name: 'BNC91', destination: 'Gregory', arrivalTime: '12:40 PM', status: 'On time' },
];

const ACTIVITY_TYPE = 'com.example.reactnativesiri.example.viewing';

const STATUS_COLORS: Record<Train['status'], string> = {
  'On time': '#1a7f37',
  Delayed: '#b35900',
  Arrived: '#57606a',
};

export default function App() {
  const [trains, setTrains] = useState<Train[]>(INITIAL_TRAINS);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSiriAction, setLastSiriAction] = useState<string | null>(null);

  // Use case foundation: mirror the train list into the App Group store so
  // the generated App Intents can answer Siri while the app is closed.
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    syncEntities('trains', trains).catch((error) => {
      console.warn('Failed to sync trains to Siri', error);
    });
  }, [trains]);

  // Use case 3: "Follow train RMEGR" — the generated FollowTrain intent opens
  // the app with trains://follow?id=<id>, which we handle here.
  useEffect(() => {
    const subscription = addIntentListener((event) => {
      if (event.scheme === 'trains' && event.host === 'follow' && event.params.id) {
        const id = event.params.id;
        setFollowedIds((current) => new Set(current).add(id));
        setSelectedId(id);
        setLastSiriAction(`Siri asked to follow train ${id}`);
      }
    });
    return () => subscription.remove();
  }, []);

  // Use case 4: donate the currently viewed train so Siri/Shortcuts know what
  // "this train" refers to.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !selectedId) {
      return;
    }
    const train = trains.find((item) => item.id === selectedId);
    if (!train) {
      return;
    }
    donateUserActivity({
      activityType: ACTIVITY_TYPE,
      title: `Train ${train.name} to ${train.destination}`,
      userInfo: { id: train.id },
      keywords: ['train', train.name, train.destination],
      persistentIdentifier: train.id,
    }).catch((error) => {
      console.warn('Failed to donate user activity', error);
    });
  }, [selectedId, trains]);

  const toggleFollow = useCallback((id: string) => {
    setFollowedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const simulateDelays = useCallback(() => {
    setTrains((current) =>
      current.map((train, index) =>
        index % 2 === 0
          ? { ...train, status: 'Delayed', arrivalTime: bumpTime(train.arrivalTime) }
          : train
      )
    );
  }, []);

  const resetTrains = useCallback(() => setTrains(INITIAL_TRAINS), []);

  const selectedTrain = useMemo(
    () => trains.find((train) => train.id === selectedId) ?? null,
    [trains, selectedId]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>TrainTracker</Text>
        <Text style={styles.subtitle}>
          Try Siri: “Are there trains to Medina in TrainTracker”
        </Text>
      </View>

      {lastSiriAction ? (
        <View style={styles.siriBanner}>
          <Text style={styles.siriBannerText}>{lastSiriAction}</Text>
        </View>
      ) : null}

      <FlatList
        data={trains}
        keyExtractor={(train) => train.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TrainRow
            train={item}
            selected={item.id === selectedId}
            followed={followedIds.has(item.id)}
            onSelect={() => setSelectedId(item.id)}
            onToggleFollow={() => toggleFollow(item.id)}
          />
        )}
      />

      {selectedTrain ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>
            Viewing {selectedTrain.name} → {selectedTrain.destination}
          </Text>
          <Text style={styles.detailBody}>
            Arrives {selectedTrain.arrivalTime} · {selectedTrain.status}
          </Text>
          <Text style={styles.detailHint}>
            This screen is donated to Siri as the current activity.
          </Text>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <ToolbarButton label="Simulate delays" onPress={simulateDelays} />
        <ToolbarButton label="Reset data" onPress={resetTrains} />
      </View>
    </SafeAreaView>
  );
}

function TrainRow(props: {
  train: Train;
  selected: boolean;
  followed: boolean;
  onSelect: () => void;
  onToggleFollow: () => void;
}) {
  const { train, selected, followed, onSelect, onToggleFollow } = props;
  return (
    <Pressable
      onPress={onSelect}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{train.name}</Text>
        <Text style={styles.rowDestination}>→ {train.destination}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowTime}>{train.arrivalTime}</Text>
        <Text style={[styles.rowStatus, { color: STATUS_COLORS[train.status] }]}>
          {train.status}
        </Text>
      </View>
      <Pressable onPress={onToggleFollow} style={styles.followButton} hitSlop={8}>
        <Text style={styles.followButtonText}>{followed ? '★' : '☆'}</Text>
      </Pressable>
    </Pressable>
  );
}

function ToolbarButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={styles.toolbarButton}>
      <Text style={styles.toolbarButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function bumpTime(time: string): string {
  const match = time.match(/^(\d+):(\d+) (AM|PM)$/);
  if (!match) {
    return time;
  }
  let hours = parseInt(match[1], 10);
  let minutes = parseInt(match[2], 10) + 20;
  let suffix = match[3];
  if (minutes >= 60) {
    minutes -= 60;
    hours += 1;
    if (hours === 12) {
      suffix = suffix === 'AM' ? 'PM' : 'AM';
    } else if (hours > 12) {
      hours -= 12;
    }
  }
  return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 32, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#57606a', marginTop: 4 },
  siriBanner: {
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: '#e7f0ff',
    borderRadius: 10,
    padding: 12,
  },
  siriBannerText: { color: '#0550ae', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingVertical: 8, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: { borderColor: '#0969da' },
  rowMain: { flex: 1 },
  rowName: { fontSize: 18, fontWeight: '700', color: '#111' },
  rowDestination: { fontSize: 14, color: '#57606a', marginTop: 2 },
  rowMeta: { alignItems: 'flex-end' },
  rowTime: { fontSize: 16, fontWeight: '600', color: '#111' },
  rowStatus: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  followButton: { paddingLeft: 4 },
  followButtonText: { fontSize: 24, color: '#e3a008' },
  detailCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  detailBody: { fontSize: 14, color: '#333', marginTop: 4 },
  detailHint: { fontSize: 12, color: '#8b949e', marginTop: 6 },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  toolbarButton: {
    flex: 1,
    backgroundColor: '#0969da',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toolbarButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

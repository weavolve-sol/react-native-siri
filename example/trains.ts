export type Train = {
  id: string;
  name: string;
  destination: string;
  arrivalTime: string;
  status: 'On time' | 'Delayed' | 'Arrived';
};

export const INITIAL_TRAINS: Train[] = [
  { id: 'RMEGR', name: 'RMEGR', destination: 'Medina', arrivalTime: '10:45 AM', status: 'On time' },
  { id: 'KLM12', name: 'KLM12', destination: 'Gregory', arrivalTime: '11:10 AM', status: 'Delayed' },
  { id: 'QPX07', name: 'QPX07', destination: 'Medina', arrivalTime: '11:35 AM', status: 'On time' },
  { id: 'ZTA44', name: 'ZTA44', destination: 'Harlow', arrivalTime: '12:05 PM', status: 'On time' },
  { id: 'BNC91', name: 'BNC91', destination: 'Gregory', arrivalTime: '12:40 PM', status: 'On time' },
];

export function bumpTime(time: string): string {
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

/**
 * Stands in for your real data source. A production app would call its
 * backend API here; the demo derives "live" statuses from the clock so
 * background syncs visibly change the data Siri reads.
 */
export async function fetchLatestTrains(): Promise<Train[]> {
  const minute = new Date().getMinutes();
  return INITIAL_TRAINS.map((train, index) => {
    if ((minute + index) % 3 === 0) {
      return { ...train, status: 'Delayed', arrivalTime: bumpTime(train.arrivalTime) };
    }
    return train;
  });
}

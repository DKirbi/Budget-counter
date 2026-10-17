import { BillsScreen } from '@tbc/screens-native';
import { useRouter } from 'expo-router';

/** Bills tab: scan button, inbox, timeline, kept copies. */
export default function Bills() {
  const router = useRouter();
  return (
    <BillsScreen
      onScan={() => router.push('/scan')}
      onOpenReceipt={(id) => router.push({ pathname: '/receipt/[id]', params: { id } })}
      onCreateTrip={() => router.push('/trip/new')}
    />
  );
}

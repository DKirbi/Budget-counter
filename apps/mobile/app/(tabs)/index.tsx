import { TodayScreen } from '@tbc/screens-native';
import { useRouter } from 'expo-router';

/** Today tab. */
export default function Today() {
  const router = useRouter();
  return (
    <TodayScreen
      onAddSpend={(date) => router.push({ pathname: '/spend/new', params: { date } })}
      onOpenSpend={(id) => router.push({ pathname: '/spend/[id]', params: { id } })}
      onOpenDay={(date) => router.push({ pathname: '/day/[date]', params: { date } })}
      onCreateTrip={() => router.push('/trip/new')}
    />
  );
}

import { DayScreen } from '@tbc/screens-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Day detail (push). */
export default function Day() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  return (
    <DayScreen
      date={date}
      onAddSpend={(d) => router.push({ pathname: '/spend/new', params: { date: d } })}
      onOpenSpend={(id) => router.push({ pathname: '/spend/[id]', params: { id } })}
    />
  );
}

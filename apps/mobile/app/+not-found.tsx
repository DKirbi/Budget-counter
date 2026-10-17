import { Button, EmptyState, Screen, Text } from '@tbc/ui-native';
import { useRouter } from 'expo-router';
import { Compass } from 'lucide-react-native';

/** Fallback for unknown deep links. */
export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That link doesn't lead anywhere in this app."
        action={
          <Button onPress={() => router.replace('/')}>
            <Text>Go to Today</Text>
          </Button>
        }
      />
    </Screen>
  );
}

/**
 * SettingsScreen — appearance, the active trip's overspend rule, trip management and data reset.
 * @module screens/SettingsScreen
 */
import {
  type OverspendPolicy,
  type ThemePreference,
  formatDayLabel,
  formatMoney,
  seedDemoTrip,
} from '@tbc/core';
import { useActiveTrip, useBudget, useBudgetActions, useToday } from '@tbc/core/react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Icon,
  RadioCard,
  RadioGroup,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Separator,
  Text,
} from '@tbc/ui-native';
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { OVERSPEND_COPY } from '../lib/copy';
import { BillsSettingsCard } from './BillsSettingsCard';

/** Props for {@link SettingsScreen}. */
export interface SettingsScreenProps {
  onCreateTrip: () => void;
  /** Shown in the About card. */
  appVersion?: string;
}

/**
 * Settings.
 * @example
 * <SettingsScreen onCreateTrip={…} appVersion={Constants.expoConfig?.version} />
 */
export function SettingsScreen({ onCreateTrip, appVersion = '0.1.0' }: SettingsScreenProps) {
  const actions = useBudgetActions();
  const theme = useBudget((s) => s.settings.theme);
  const trips = useBudget((s) => s.trips);
  const activeTrip = useActiveTrip();
  const today = useToday();
  const [toDelete, setToDelete] = React.useState<string | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const deleting = trips.find((t) => t.id === toDelete);

  return (
    <Screen testID="screen-settings">
      <ScreenHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <SegmentedControl<ThemePreference>
            value={theme}
            onValueChange={actions.setTheme}
            accessibilityLabel="Theme"
            options={[
              { value: 'system', label: 'System', testID: 'theme-system' },
              { value: 'light', label: 'Light', testID: 'theme-light' },
              { value: 'dark', label: 'Dark', testID: 'theme-dark' },
            ]}
          />
        </CardContent>
      </Card>

      {activeTrip ? (
        <Card>
          <CardHeader>
            <CardTitle>If you overspend</CardTitle>
            <Text variant="muted">Applies to “{activeTrip.name}”.</Text>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={activeTrip.overspendPolicy}
              onValueChange={(v) =>
                actions.updateTrip(activeTrip.id, { overspendPolicy: v as OverspendPolicy })
              }
              accessibilityLabel="Overspend rule"
            >
              {(Object.keys(OVERSPEND_COPY) as OverspendPolicy[]).map((p) => (
                <RadioCard
                  key={p}
                  value={p}
                  selected={activeTrip.overspendPolicy === p}
                  title={OVERSPEND_COPY[p].title}
                  description={OVERSPEND_COPY[p].description}
                  testID={`settings-policy-${p}`}
                />
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      ) : null}

      <BillsSettingsCard />

      <Card>
        <CardHeader>
          <CardTitle>Trips</CardTitle>
        </CardHeader>
        <CardContent className="gap-1">
          {trips.length === 0 ? <Text variant="muted">No trips yet.</Text> : null}
          {trips.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 ? <Separator /> : null}
              <View className="min-h-touch flex-row items-center gap-2 py-1">
                <Pressable
                  role="button"
                  onPress={() => actions.setActiveTrip(t.id)}
                  accessibilityLabel={`${t.name}${t.id === activeTrip?.id ? ', active' : ''}`}
                  accessibilityState={{ selected: t.id === activeTrip?.id }}
                  testID={`trip-item-${t.id}`}
                  className="flex-1 gap-0.5 py-1"
                >
                  <View className="flex-row items-center gap-2">
                    <Text variant="body" className="font-medium">
                      {t.name}
                    </Text>
                    {t.id === activeTrip?.id ? (
                      <Badge variant="default">
                        <Icon as={Check} size={12} className="text-primary-foreground" />
                        <Text>Active</Text>
                      </Badge>
                    ) : null}
                  </View>
                  <Text variant="caption">
                    {formatDayLabel(t.startDate)} – {formatDayLabel(t.endDate)} ·{' '}
                    {formatMoney(t.totalBudget, t.currency)}
                  </Text>
                </Pressable>
                <Button
                  variant="ghost"
                  size="icon"
                  accessibilityLabel={`Delete ${t.name}`}
                  onPress={() => setToDelete(t.id)}
                  testID={`delete-trip-${t.id}`}
                >
                  <Icon as={Trash2} size={20} className="text-destructive" />
                </Button>
              </View>
            </React.Fragment>
          ))}
          <View className="gap-2 pt-2">
            <Button variant="outline" onPress={onCreateTrip} testID="new-trip">
              <Icon as={Plus} size={20} />
              <Text>New trip</Text>
            </Button>
            <Button
              variant="secondary"
              onPress={() => seedDemoTrip(actions, today)}
              testID="load-demo"
            >
              <Icon as={Sparkles} size={20} />
              <Text>Load demo trip</Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <Text variant="muted">Everything is stored on this device.</Text>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onPress={() => setConfirmReset(true)} testID="reset-data">
            <Text className="text-destructive">Erase all trips and spends</Text>
          </Button>
        </CardContent>
      </Card>

      <Text variant="caption" className="text-center" testID="app-version">
        Budget Counter · v{appVersion}
      </Text>

      <ConfirmDialog
        testID="confirm-delete-trip"
        open={!!deleting}
        onOpenChange={(open) => !open && setToDelete(null)}
        destructive
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="All of its spends will be deleted too. This cannot be undone."
        confirmLabel="Delete trip"
        onConfirm={() => {
          if (toDelete) actions.deleteTrip(toDelete);
          setToDelete(null);
        }}
      />
      <ConfirmDialog
        testID="confirm-reset"
        open={confirmReset}
        onOpenChange={setConfirmReset}
        destructive
        title="Erase everything?"
        description="All trips and spends on this device will be removed."
        confirmLabel="Erase"
        onConfirm={() => {
          for (const t of [...trips]) actions.deleteTrip(t.id);
          setConfirmReset(false);
        }}
      />
    </Screen>
  );
}

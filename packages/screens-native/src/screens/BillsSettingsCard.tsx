/**
 * BillsSettingsCard — how bills are filed, and the optional AI helper.
 *
 * AI is off by default and never runs on its own: the review screen asks for confirmation each time.
 * The API key lives in the device's secure storage; only provider, model, address and the daily cap are
 * kept with the app's data.
 * @module screens/BillsSettingsCard
 */
import { AI_KEY_NAME, AI_PROVIDERS, type AiProviderId } from '@tbc/core';
import { useAiQuota, useBudget, useBudgetActions } from '@tbc/core/react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  RadioCard,
  RadioGroup,
  Separator,
  Stepper,
  Switch,
  Text,
} from '@tbc/ui-native';
import * as React from 'react';
import { View } from 'react-native';
import { useScanServices } from '../lib/services';

/**
 * Settings card for bills and AI.
 * @example
 * <BillsSettingsCard />
 */
export function BillsSettingsCard() {
  const services = useScanServices();
  const actions = useBudgetActions();
  const autoConfirm = useBudget((s) => s.settings.autoConfirmReceipts);
  const ai = useBudget((s) => s.settings.ai);
  const quota = useAiQuota();
  const [hasKey, setHasKey] = React.useState<boolean | null>(null);
  const [draftKey, setDraftKey] = React.useState('');
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    void services.secrets.get(AI_KEY_NAME).then(
      (k) => mounted.current && setHasKey(!!k),
      () => mounted.current && setHasKey(false),
    );
    return () => {
      mounted.current = false;
    };
  }, [services, ai.provider]);

  const provider = AI_PROVIDERS.find((p) => p.id === ai.provider);

  const saveKey = async () => {
    const key = draftKey.trim();
    if (!key) return;
    await services.secrets.set(AI_KEY_NAME, key);
    setDraftKey('');
    setHasKey(true);
  };
  const removeKey = async () => {
    await services.secrets.remove(AI_KEY_NAME);
    setHasKey(false);
  };

  return (
    <Card testID="card-bills-settings">
      <CardHeader>
        <CardTitle>Bills & AI</CardTitle>
        <Text variant="muted">
          Bills are read on this device. AI is optional and only used when you ask.
        </Text>
      </CardHeader>
      <CardContent className="gap-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text variant="small" className="leading-5">
              File clean bills automatically
            </Text>
            <Text variant="caption">
              A bill that reads cleanly and fits today or the trip is counted without asking. Odd
              bills always ask.
            </Text>
          </View>
          <Switch
            checked={autoConfirm}
            onCheckedChange={actions.setAutoConfirmReceipts}
            accessibilityLabel="File clean bills automatically"
            testID="settings-auto-confirm"
          />
        </View>

        <Separator />

        <Field label="AI help for hard-to-read bills">
          <RadioGroup
            value={ai.provider}
            onValueChange={(v) => actions.setAiSettings({ provider: v as AiProviderId })}
            accessibilityLabel="AI provider"
          >
            <RadioCard
              value="none"
              selected={ai.provider === 'none'}
              title="Off"
              description="Stay offline. Fill in what the scan could not read."
              testID="settings-ai-none"
            />
            {AI_PROVIDERS.map((p) => (
              <RadioCard
                key={p.id}
                value={p.id}
                selected={ai.provider === p.id}
                title={p.label}
                description={p.note}
                testID={`settings-ai-${p.id}`}
              />
            ))}
          </RadioGroup>
        </Field>

        {provider ? (
          <View className="gap-4" testID="settings-ai-details">
            <Field
              label="API key"
              description="Stored in the device's secure storage. Never shown again, never sent anywhere except the AI service."
            >
              <View className="gap-2">
                {hasKey ? (
                  <View className="flex-row items-center justify-between">
                    <Badge variant="success" testID="settings-ai-key-saved">
                      <Text>Key saved</Text>
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={removeKey}
                      testID="settings-ai-key-remove"
                    >
                      <Text className="text-destructive">Remove key</Text>
                    </Button>
                  </View>
                ) : null}
                <Input
                  accessibilityLabel="API key"
                  placeholder={hasKey ? 'Paste a new key to replace it' : 'Paste your key'}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={draftKey}
                  onChangeText={setDraftKey}
                  testID="settings-ai-key"
                />
                <Button
                  variant="outline"
                  onPress={saveKey}
                  disabled={draftKey.trim() === ''}
                  testID="settings-ai-key-save"
                >
                  <Text>Save key</Text>
                </Button>
              </View>
            </Field>

            <Field
              label="Model"
              description="Providers retire models from time to time. If AI says the model was not found, change it here."
            >
              <Input
                accessibilityLabel="AI model"
                autoCapitalize="none"
                autoCorrect={false}
                value={ai.model}
                onChangeText={(model) => actions.setAiSettings({ model })}
                testID="settings-ai-model"
              />
            </Field>

            {ai.provider === 'openai' ? (
              <Field
                label="Address"
                description="Change it to use any service that speaks the OpenAI chat API."
              >
                <Input
                  accessibilityLabel="AI service address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  value={ai.baseUrl}
                  onChangeText={(baseUrl) => actions.setAiSettings({ baseUrl })}
                  testID="settings-ai-baseurl"
                />
              </Field>
            ) : null}

            <Field
              label="AI reads per day"
              description="A guard in this app, on top of the provider's own limits."
            >
              <Stepper
                label="daily AI reads"
                testID="settings-ai-limit"
                min={0}
                max={200}
                step={5}
                value={ai.dailyLimit}
                onValueChange={(dailyLimit) => actions.setAiSettings({ dailyLimit })}
                format={(n) => `${n} a day`}
              />
            </Field>
            <Text variant="caption" testID="settings-ai-usage">
              Used today: {quota.used} of {quota.limit}
            </Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Root layout: providers + the navigation stack.
 * Modals (add/edit spend, new trip) slide over the tabs; the day detail, the scan screen and a bill's review screen
 * are normal pushes.
 */
import '../global.css';
import { useTheme } from '@tbc/ui-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { AppProviders } from '../src/providers';

function ThemedStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="day/[date]" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="receipt/[id]" />
        <Stack.Screen name="spend/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="spend/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="trip/new" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <ThemedStack />
    </AppProviders>
  );
}

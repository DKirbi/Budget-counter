/** Bottom tabs: Today · Days · Summary · Settings. Labels and test ids match the Storybook MiniApp. */
import { useTheme } from '@tbc/ui-native';
import { Tabs } from 'expo-router';
import { CalendarDays, ChartNoAxesColumn, House, Settings } from 'lucide-react-native';
import * as React from 'react';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors['muted-foreground'],
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarButtonTestID: 'tab-today',
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="days"
        options={{
          title: 'Days',
          tabBarButtonTestID: 'tab-days',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarButtonTestID: 'tab-summary',
          tabBarIcon: ({ color, size }) => <ChartNoAxesColumn color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarButtonTestID: 'tab-settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

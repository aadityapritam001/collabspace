/**
 * Bottom tabs — 4 max: Discover, Requests, Messages, Profile.
 * We use expo-router's <Tabs> so the same file works on iOS and Android.
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@/src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: font.size.xs, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
          tabBarButtonTestID: 'tab-discover',
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => <Ionicons name="mail-outline" size={size} color={color} />,
          tabBarButtonTestID: 'tab-requests',
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
          tabBarButtonTestID: 'tab-messages',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}

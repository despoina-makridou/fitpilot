import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useAuth } from './context/AuthContext';
import AuthScreen from './screens/AuthScreen';
import ConsentScreen from './screens/ConsentScreen';
import InfoScreen from './screens/InfoScreen';
import EquipmentScreen from './screens/EquipmentScreen';
import GoalScreen from './screens/GoalScreen';
import HomeScreen from './screens/HomeScreen';
import ExerciseScreen from './screens/ExerciseScreen';
import ProfileScreen from './screens/ProfileScreen';
import { theme } from './theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{label}</Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="Exercise"
        component={ExerciseScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="⏱️" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
    </View>
  );
}

export default function RootNavigator() {
  const { loading, session, profile } = useAuth();

  if (loading) return <Loading />;

  // Decide which flow to show based on auth + onboarding progress:
  // Auth -> Consent -> Info (personal details) -> Goal -> Main.
  const signedIn = !!session?.user;
  const hasEquipment = !!(profile?.equipment && profile.equipment.length > 0);
  const needsConsent = signedIn && profile && !profile.consented_at;
  const needsInfo = signedIn && profile && profile.consented_at && !profile.name;
  const needsEquipment =
    signedIn && profile && profile.consented_at && profile.name && !hasEquipment;
  const needsGoal =
    signedIn && profile && profile.consented_at && profile.name && hasEquipment && !profile.onboarded_at;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!signedIn ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : needsConsent ? (
          <Stack.Screen name="Consent" component={ConsentScreen} />
        ) : needsInfo ? (
          <Stack.Screen name="Info" component={InfoScreen} />
        ) : needsEquipment ? (
          <Stack.Screen name="Equipment" component={EquipmentScreen} />
        ) : needsGoal ? (
          <Stack.Screen name="Goal" component={GoalScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

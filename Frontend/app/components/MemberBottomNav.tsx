// components/MemberBottomNav.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

type NavKey = 'home' | 'mycontributions' | 'meetings' | 'documents' | 'notifications' | 'none';

type Props = {
  current: NavKey;
};

const navItems: { key: NavKey; label: string; icon: string; route: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠', route: '/(member)/dashboard' },
  { key: 'mycontributions', label: 'Contributions', icon: '💰', route: '/(member)/mycontributions' },
  { key: 'meetings', label: 'Meetings', icon: '📅', route: '/(member)/meetings' },
  { key: 'documents', label: 'Documents', icon: '📂', route: '/(member)/documents' },
  { key: 'notifications', label: 'Notifications', icon: '🔔', route: '/(member)/notifications' },
];

export default function MemberBottomNav({ current }: Props) {
  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const isActive = current === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => router.replace(item.route)}
            style={[styles.navItem, isActive && styles.activeNavItem]}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#388E3C',
    justifyContent: 'space-around',
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  activeNavItem: {
    backgroundColor: '#C8E6C9', // Light transparent green
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 2,
  },
  activeLabel: {
    color: '#2E7D32', // Slightly darker green text for active
  },
});

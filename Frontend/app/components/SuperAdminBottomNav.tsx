// components/SuperAdminBottomNav.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

type Props = {
  current?: 'home' | 'members' | 'finance' | 'documents' | 'none';
};

export default function SuperAdminBottomNav({ current }: Props) {
  const navItems = [
    { key: 'home', label: 'Home', icon: '🏠', path: '/(superadmin)/dashboard' },
    { key: 'members', label: 'Members', icon: '👥', path: '/(superadmin)/member-management' },
    { key: 'finance', label: 'Finance', icon: '💰', path: '/(superadmin)/financial-management' },
    { key: 'documents', label: 'Documents', icon: '📁', path: '/(superadmin)/document-management' },
  ];

  return (
    <View style={styles.container}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.navItem}
          onPress={() => router.push(item.path)}
        >
          <View
            style={[
              styles.iconWrapper,
              current === item.key && styles.activeIconWrapper,
            ]}
          >
            <Text
              style={[
                styles.icon,
                current === item.key && styles.activeIcon,
              ]}
            >
              {item.icon}
            </Text>
          </View>
          <Text
            style={[
              styles.label,
              current === item.key && styles.activeLabel,
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FB8C00', // Orange
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EF6C00', // Darker orange border
  },
  navItem: {
    alignItems: 'center',
  },
  iconWrapper: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  activeIconWrapper: {
    backgroundColor: '#FFEB3B', // Yellow background for active icon
  },
  icon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  activeIcon: {
    color: '#FB8C00', // Icon turns orange inside yellow circle
  },
  label: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activeLabel: {
    color: '#FFEB3B', // Yellow label when active
  },
});

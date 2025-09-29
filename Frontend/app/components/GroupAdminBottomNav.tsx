import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type NavKey =
  | 'home'
  | 'create-group'
  | 'manage-groups'
  | 'group-members'
  | 'group-contributions'
  | 'record-contributions'
  | 'none';

type Props = {
  current: NavKey;
};

const navItems: {
  key: NavKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
  { key: 'home', label: 'Home', icon: 'home', route: '/(groupadmin)/dashboard' },
  //{ key: 'create-group', label: 'Group', icon: 'add-circle', route: '/(groupadmin)/create-group' },
  { key: 'record-contributions', label: 'Record', icon: 'create', route: '/(groupadmin)/record-contributions' },
  { key: 'manage-groups', label: 'Groups', icon: 'settings', route: '/(groupadmin)/manage-groups' },
  { key: 'group-members', label: 'Members', icon: 'people', route: '/(groupadmin)/group-members' },
  { key: 'group-contributions', label: 'Contributions', icon: 'cash', route: '/(groupadmin)/group-contributions' },
];

export default function GroupAdminBottomNav({ current }: Props) {
  const router = useRouter();

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
            <Ionicons
              name={item.icon}
              size={22}
              color={isActive ? '#2E7D32' : '#FFFFFF'}
              style={styles.icon}
            />
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
    backgroundColor: '#1976D2',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1565C0',
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
    backgroundColor: '#C8E6C9',
  },
  icon: {
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activeLabel: {
    color: '#2E7D32',
  },
});

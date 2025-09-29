// components/Header.tsx
import React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';

interface HeaderProps {
  user: string;
  role: 'Member' | 'GroupAdmin' | 'SuperAdmin';
  onLogout?: () => void;
  onMenuToggle?: () => void;
  onNavigate?: (screen: string) => void;
}

const Header: React.FC<HeaderProps> = ({ user, role, onLogout, onMenuToggle, onNavigate }) => {
  const navigation = useNavigation();

  const handleMenuPress = () => {
    if (onMenuToggle) {
      onMenuToggle();
    } else {
      navigation.dispatch(DrawerActions.openDrawer());
    }
  };

  const handleInternalNavigate = (screenName: string) => {
    if (onNavigate) {
      onNavigate(screenName);
    }
  };

  return (
    <View style={styles.header}>
      {/* Left side: Menu Toggle and Logo/App Name */}
      <View style={styles.leftHeader}>
        <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        <View style={styles.logoSection}>
          <Image
            // FIX: Corrected image path here
            source={require('../../assets/images/logo.png')} // Go up two levels from 'components' to reach the root 'MANPOWER' folder
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>
            <Text style={styles.man}>MAN</Text>
            <Text style={styles.power}>POWER</Text>
          </Text>
        </View>
      </View>

      {/* Right side: User Info and Action Buttons */}
      <View style={styles.userInfo}>
        <Text style={styles.roleBadge}>{role}</Text>
        <Text style={styles.userText}>👤 {user}</Text>
        {onNavigate && (
          <View style={styles.headerRightButtons}>
            <TouchableOpacity onPress={() => handleInternalNavigate('Profile')} style={styles.headerActionButton}>
              <Text style={styles.headerButtonText}>My Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleInternalNavigate('Settings')} style={styles.headerActionButton}>
              <Text style={styles.headerButtonText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onLogout || (() => {})} style={[styles.headerActionButton, { marginLeft: 5 }]}>
              <Text style={[styles.headerButtonText, styles.logoutButtonText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 8,
    marginRight: 10,
  },
  menuIcon: {
    fontSize: 24,
    color: '#333',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  man: {
    color: '#e53935',
  },
  power: {
    color: '#03a9f4',
  },
  userInfo: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  roleBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 5,
  },
  userText: {
    fontSize: 14,
    color: '#333',
    marginRight: 10,
  },
  headerRightButtons: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  headerActionButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  logoutButtonText: {
    color: '#D32F2F',
  },
});

export default Header;
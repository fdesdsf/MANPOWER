import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert, // Added Alert for better error handling
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api'; // Adjust based on backend IP

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  status: string; // Ensure this matches your backend's Member entity status field
  role: string;   // Ensure this matches your backend's Member entity role field
  email: string;  // Added email as it's useful for display/identification
}

export default function AdminDashboardScreen() {
  const { setUserRole } = useContext(AuthContext)!;
  const [adminName, setAdminName] = useState('Admin');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  // ✅ STEP 1: Add state for inactive Group Admins count
  const [inactiveGroupAdminsCount, setInactiveGroupAdminsCount] = useState(0);

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'userEmail', 'userFirstName',
        'userLastName', 'userRole', 'userStatus', 'userTenantId',
        'userGroupId', 'userPhoneNumber', 'userJoinDate', 'userCreatedBy',
        'userModifiedBy', 'userCreatedOn', 'userModifiedOn'
      ]); // Clear all relevant user data
      setUserRole(null);
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(`${BASE_URL}/members`); // Assuming this endpoint returns all members
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Member[] = await response.json();
      setMembers(data);

      // ✅ STEP 2: Calculate inactive Group Admins count after fetching members
      const count = data.filter(
        (m) => m.role === 'GroupAdmin' && m.status === 'Inactive' // Or 'INACTIVE' if that's your status
      ).length;
      setInactiveGroupAdminsCount(count);

    } catch (err) {
      console.error('Error fetching members:', err);
      Alert.alert('Error', 'Failed to load member data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`${BASE_URL}/meetings`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setMeetings(data);
    } catch (err) {
      console.error('❌ Failed to fetch meetings:', err);
      Alert.alert('Error', 'Failed to load meeting data.');
    }
  };

  const countByStatus = (status: string) =>
    members.filter((m) => m.status === status).length;

  const countGroupAdmins = () =>
    members.filter((m) => m.role === 'GroupAdmin').length;

  const getUpcomingMeetingsInfo = () => {
    const today = new Date();
    const upcoming = meetings.filter((m) => new Date(m.meetingDate) >= today);

    upcoming.sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());

    const count = upcoming.length;
    const nextDate = count > 0 ? new Date(upcoming[0].meetingDate).toDateString() : 'N/A';

    return { count, nextDate };
  };

  useEffect(() => {
    fetchMembers();
    fetchMeetings();
    const getAdminName = async () => {
      const fname = await AsyncStorage.getItem('userFirstName');
      const lname = await AsyncStorage.getItem('userLastName');
      setAdminName(`${fname ?? 'Admin'} ${lname ?? ''}`.trim());
    };
    getAdminName();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => router.push('/(superadmin)/admin-profile')}>
            <Text style={styles.headerButtonText}>My Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(superadmin)/admin-settings')}>
            <Text style={styles.headerButtonText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={[styles.headerButtonText, styles.logoutButtonText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContent}>
          <Text style={styles.welcomeText}>Welcome, {adminName} (SuperAdmin)!</Text>
          <Text style={styles.subtitle}>System Overview</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#4CAF50" />
          ) : (
            <View style={styles.dashboardOverviewContainer}>
              <View style={styles.dashboardCard}>
                <Text style={styles.dashboardCardTitle}>Total Members</Text>
                <Text style={styles.dashboardCardValue}>{members.length}</Text>
              </View>
              <View style={styles.dashboardCard}>
                <Text style={styles.dashboardCardTitle}>Active Members</Text>
                <Text style={styles.dashboardCardValue}>{countByStatus('Active')}</Text>
              </View>
              <View style={styles.dashboardCard}>
                <Text style={styles.dashboardCardTitle}>Terminated Members</Text>
                <Text style={styles.dashboardCardValue}>{countByStatus('Terminated')}</Text>
              </View>
              <View style={styles.dashboardCard}>
                <Text style={styles.dashboardCardTitle}>Inactive Members</Text>
                <Text style={styles.dashboardCardValue}>{countByStatus('Inactive')}</Text>
              </View>
              <View style={styles.dashboardCard}>
                <Text style={styles.dashboardCardTitle}>Total Group Admins</Text>
                <Text style={styles.dashboardCardValue}>{countGroupAdmins()}</Text>
              </View>
              {/* ✅ STEP 3: Add the new card for Inactive Group Admins */}
              <View style={styles.dashboardCard}>
                <Text style={styles.dashboardCardTitle}>Inactive Group Admins</Text>
                <Text style={styles.dashboardCardValue}>{inactiveGroupAdminsCount}</Text>
              </View>
              {(() => {
                const { count, nextDate } = getUpcomingMeetingsInfo();
                return (
                  <View style={styles.dashboardCard}>
                    <Text style={styles.dashboardCardTitle}>Upcoming Meetings</Text>
                    <Text style={styles.dashboardCardValue}>
                      {count} {count > 0 ? `(Next: ${nextDate})` : ''}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}

          {/* Actions */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickLinksRow}>
              {/* Add navigation to a screen where inactive Group Admins can be managed */}
              {inactiveGroupAdminsCount > 0 && (
                <TouchableOpacity
                  style={styles.quickLinkButton}
                  onPress={() => router.push('/(superadmin)/manage-group-admins')} // You'll create this screen next
                >
                  <Text style={styles.quickLinkText}>Review Inactive Groupadmins</Text>
                </TouchableOpacity>
              )}
              {/* Existing quick links (commented out in your original code) */}
              {/* <TouchableOpacity
                style={styles.quickLinkButton}
                onPress={() => router.push('/(superadmin)/add-member')}
              >
                <Text style={styles.quickLinkText}>+ Add New Member</Text>
              </TouchableOpacity>*/}
              {/* <TouchableOpacity
                style={styles.quickLinkButton}
                onPress={() => router.push('/(superadmin)/record-contribution')}
              >
                <Text style={styles.quickLinkText}>+ Record Contribution</Text>
              </TouchableOpacity> */}
              {/* <TouchableOpacity
                style={styles.quickLinkButton}
                onPress={() => router.push('/(superadmin)/schedule-meeting')}
              >
                <Text style={styles.quickLinkText}>+ Schedule Meeting</Text>
              </TouchableOpacity> */}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Powered by: <Text style={styles.footerBrand}>MANSOFT</Text>
            </Text>
            <Text style={styles.footerSub}>Infinite Possibilities</Text>
          </View>
        </View>
      </ScrollView>

      <SuperAdminBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E9' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFE0B2',
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
    elevation: 3,
  },
  logoNameWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 40, height: 40, resizeMode: 'contain' },
  textLogoContainer: { flexDirection: 'row', alignItems: 'center' },
  titleBlack: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  titleRed: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', marginLeft: 4 },
  headerButtons: { flexDirection: 'row', gap: 15 },
  headerButtonText: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },
  logoutButtonText: { color: '#D32F2F' },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  mainContent: { padding: 20 },
  welcomeText: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 25, color: '#666' },
  dashboardOverviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    width: '48%', // Adjusted to fit two cards per row with gap
    elevation: 4,
  },
  dashboardCardTitle: { fontSize: 14, color: '#777', marginBottom: 5 },
  dashboardCardValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    elevation: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  quickLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 10,
  },
  quickLinkButton: {
    backgroundColor: '#66BB6A',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 10, // Added for better spacing in wrapped rows
  },
  quickLinkText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  todoText: {
    fontSize: 15,
    color: '#444',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  footer: { marginTop: 40, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#555' },
  footerBrand: { fontWeight: 'bold', color: '#4CAF50' },
  footerSub: { fontSize: 13, color: '#888', marginTop: 2 },
});
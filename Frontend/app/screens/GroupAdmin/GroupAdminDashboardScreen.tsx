import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
}

interface Group {
  id: string;
  groupName: string;
  description: string;
  creationDate: string;
  members: Member[];
  status?: string;
}

interface Loan {
  id: string;
  member: Member;
  amount: number;
  status: string;
}

export default function GroupDashboardScreen() {
  const router = useRouter();
  const { setUserRole } = useContext(AuthContext)!;

  const [groupAdminName, setGroupAdminName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  const [inactiveMembersCount, setInactiveMembersCount] = useState(0);
  const [pendingLoans, setPendingLoans] = useState<Loan[]>([]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'userEmail', 'userFirstName', 'userLastName',
        'userRole', 'userStatus', 'userTenantId',
      ]);
      setUserRole(null);
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

  useEffect(() => {
    const fetchGroupDataAndContributions = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        const firstName = await AsyncStorage.getItem('userFirstName');
        const lastName = await AsyncStorage.getItem('userLastName');

        setGroupAdminName(`${firstName ?? ''} ${lastName ?? ''}`);

        if (!userId) {
          setLoading(false);
          router.replace('/(auth)');
          return;
        }

        const res = await fetch(`${BASE_URL}/groups/groupadmin/${userId}`);
        if (!res.ok) {
          Alert.alert('Error', 'Failed to load group data. Please try again.');
          setLoading(false);
          return;
        }

        const data: Group[] = await res.json();
        setGroups(data || []);

        const memberCount = data.reduce((sum, group) => sum + (group.members?.length || 0), 0);
        const inactiveCount = data.reduce((sum, group) => {
          const inactiveInGroup = group.members?.filter(m => m.status?.toLowerCase() === 'inactive').length || 0;
          return sum + inactiveInGroup;
        }, 0);

        setTotalMembers(memberCount);
        setInactiveMembersCount(inactiveCount);

        let total = 0;
        for (const group of data) {
          try {
            const res = await fetch(`${BASE_URL}/contributions/group/${group.id}`);
            if (res.ok) {
              const contributions = await res.json();
              const groupTotal = contributions.reduce(
                (sum: number, c: { amount: number }) => sum + c.amount,
                0
              );
              total += groupTotal;
            }
          } catch (err) {
            console.error(`Error fetching contributions for group ${group.id}:`, err);
          }
        }

        setTotalContributions(total);

        // Fetch and filter pending loans
        try {
          const loanRes = await fetch(`${BASE_URL}/loans`);
          if (loanRes.ok) {
            const allLoans: Loan[] = await loanRes.json();

            const allMemberIds = data.flatMap(group =>
              group.members?.map(member => member.id) || []
            );

            const filteredPendingLoans = allLoans.filter(
              loan =>
                loan.status?.toLowerCase() === 'pending' &&
                allMemberIds.includes(loan.member?.id)
            );

            setPendingLoans(filteredPendingLoans);
          } else {
            console.warn('Failed to fetch loans');
          }
        } catch (loanErr) {
          console.error('Error fetching loans:', loanErr);
        }

        setLoading(false);
      } catch (err) {
        console.error('❌ Error loading dashboard data:', err);
        Alert.alert('Error', 'An unexpected error occurred while loading dashboard data.');
        setLoading(false);
      }
    };

    fetchGroupDataAndContributions();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.appTitleContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>

        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => router.push('/(groupadmin)/group-admin-profile')}>
            <Text style={styles.headerButtonText}>My Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(groupadmin)/group-admin-settings')}>
            <Text style={styles.headerButtonText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={[styles.headerButtonText, styles.logoutButtonText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContent}>
          <Text style={styles.welcomeText}>Welcome, {groupAdminName}!</Text>
          <Text style={styles.subtitle}>Group Admin Dashboard</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : (
            <>
              <View style={styles.dashboardOverviewContainer}>
                <View style={styles.dashboardCard}>
                  <Text style={styles.dashboardCardTitle}>Total Groups Created</Text>
                  <Text style={styles.dashboardCardValue}>{groups.length}</Text>
                </View>
                <View style={styles.dashboardCard}>
                  <Text style={styles.dashboardCardTitle}>Active Groups</Text>
                  <Text style={styles.dashboardCardValue}>
                    {groups.filter(g => g.status?.toLowerCase() === 'active').length}
                  </Text>
                </View>
                <View style={styles.dashboardCard}>
                  <Text style={styles.dashboardCardTitle}>Total Group Members</Text>
                  <Text style={styles.dashboardCardValue}>{totalMembers}</Text>
                </View>
                <View style={styles.dashboardCard}>
                  <Text style={styles.dashboardCardTitle}>Inactive Members</Text>
                  <Text style={styles.dashboardCardValue}>{inactiveMembersCount}</Text>
                </View>
                <View style={styles.dashboardCard}>
                  <Text style={styles.dashboardCardTitle}>Total Contributions</Text>
                  <Text style={styles.dashboardCardValue}>
                    KES {totalContributions.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.dashboardCard}>
                  <TouchableOpacity onPress={() => router.push('/(groupadmin)/loan-management')}>
                    <Text style={styles.dashboardCardTitle}>Pending Loans Applications</Text>
                    <Text style={styles.dashboardCardValue}>{pendingLoans.length}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Group Actions</Text>
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => router.push('/(groupadmin)/record-contributions')}
                  >
                    <Text style={styles.quickActionText}>Record Contribution</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => router.push('/(groupadmin)/manage-groups')}
                  >
                    <Text style={styles.quickActionText}>Manage Groups</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => router.push('/(groupadmin)/group-members')}
                  >
                    <Text style={styles.quickActionText}>View Members</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => router.push('/(groupadmin)/notifications')}
                  >
                    <Text style={styles.quickActionText}>Send Notification</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => router.push('/(groupadmin)/loan-management')}
                >
                    <Text style={styles.quickActionText}>Loan Management</Text>
                  </TouchableOpacity>

                </View>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Powered by: <Text style={styles.footerBrand}>MANSOFT</Text>
            </Text>
            <Text style={styles.footerSub}>Infinite Possibilities</Text>
          </View>
        </View>
      </ScrollView>

      <GroupAdminBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: '#64B5F6',
    elevation: 3,
  },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  appTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  titleBlack: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  titleGreen: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50', marginLeft: 4 },
  headerButtons: { flexDirection: 'row', gap: 15 },
  headerButtonText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },
  logoutButtonText: { color: '#D32F2F' },
  scrollContent: { flexGrow: 1, paddingBottom: 80 },
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
    width: '48%',
    marginBottom: 10,
    elevation: 3,
  },
  dashboardCardTitle: { fontSize: 14, color: '#777', marginBottom: 5 },
  dashboardCardValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 10,
  },
  quickActionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 10,
  },
  quickActionText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  footer: { marginTop: 40, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#555' },
  footerBrand: { fontWeight: 'bold', color: '#4CAF50' },
  footerSub: { fontSize: 13, color: '#888', marginTop: 2 },
});

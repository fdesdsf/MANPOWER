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
  useColorScheme,
  RefreshControl,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://192.168.0.101:8080/api';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  member: Member;
  group: Group;
}

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  route?: string;
}

export default function GroupDashboardScreen() {
  const router = useRouter();
  const { setUserRole } = useContext(AuthContext)!;
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [groupAdminName, setGroupAdminName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  const [inactiveMembersCount, setInactiveMembersCount] = useState(0);
  const [investmentsCount, setInvestmentsCount] = useState(0);
  const [recentContributions, setRecentContributions] = useState<Contribution[]>([]);
  const [activeGroupsCount, setActiveGroupsCount] = useState(0);

  // Dynamic sizing calculations for both summary cards and quick actions
  const CARD_MARGIN = SCREEN_WIDTH * 0.02;
  const STAT_CARD_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * 8)) / 3;
  const QUICK_ACTION_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * 8)) / 3;

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleSwitchToMemberView = async () => {
    try {
      // Store a flag to indicate the user switched to member view
      await AsyncStorage.setItem('userViewMode', 'member');
      router.replace('/(member)/dashboard');
    } catch (error) {
      console.error('Failed to switch to member view:', error);
      Alert.alert('Error', 'Could not switch to member view. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroupDataAndContributions();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'userEmail', 'userFirstName', 'userLastName',
        'userRole', 'userStatus', 'userTenantId', 'userViewMode'
      ]);
      setUserRole(null);
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

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
      const activeGroups = data.filter(g => g.status?.toLowerCase() === 'active').length;

      setTotalMembers(memberCount);
      setInactiveMembersCount(inactiveCount);
      setActiveGroupsCount(activeGroups);

      let total = 0;
      const recentContribs: Contribution[] = [];

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

            // Get recent contributions (last 5)
            const sortedContributions = contributions
              .sort((a: Contribution, b: Contribution) => 
                new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
              )
              .slice(0, 3);
            
            recentContribs.push(...sortedContributions);
          }
        } catch (err) {
          console.error(`Error fetching contributions for group ${group.id}:`, err);
        }
      }

      setTotalContributions(total);
      setRecentContributions(recentContribs.slice(0, 5));

      // Fetch investments count
      try {
        const investmentsRes = await fetch(`${BASE_URL}/investments/group/${data[0]?.id}`); // Get first group's investments
        if (investmentsRes.ok) {
          const investments = await investmentsRes.json();
          setInvestmentsCount(investments.length);
        } else {
          console.warn('Failed to fetch investments');
        }
      } catch (investmentsErr) {
        console.error('Error fetching investments:', investmentsErr);
      }

      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      Alert.alert('Error', 'An unexpected error occurred while loading dashboard data.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDataAndContributions();
  }, []);

  const statCards: StatCard[] = [
    {
      title: 'Total Groups Created',
      value: groups.length,
      icon: '🏢',
      color: '#2196F3',
      route: '/(groupadmin)/manage-groups'
    },
    {
      title: 'Total Group Members',
      value: totalMembers,
      icon: '👥',
      color: '#FF9800',
      route: '/(groupadmin)/group-members'
    },
    {
      title: 'Total Contributions',
      value: `KES ${totalContributions.toLocaleString()}`,
      icon: '💰',
      color: '#4CAF50',
      route: '/(groupadmin)/group-contributions'
    },
    {
      title: 'Active Groups',
      value: activeGroupsCount,
      icon: '✅',
      color: '#9C27B0',
      route: '/(groupadmin)/manage-groups'
    },
    {
      title: 'Inactive Members',
      value: inactiveMembersCount,
      icon: '⏸️',
      color: '#607D8B',
      route: '/(groupadmin)/group-members'
    },
    {
      title: 'Total Investments',
      value: investmentsCount,
      icon: '💹',
      color: '#F44336',
      route: '/(groupadmin)/investments'
    },
  ];

  const quickActions = [
    { name: 'Record Contribution', icon: '💰', route: '/(groupadmin)/record-contributions', color: '#4CAF50' },
    { name: 'Manage Groups', icon: '🏢', route: '/(groupadmin)/manage-groups', color: '#2196F3' },
    { name: 'View Members', icon: '👥', route: '/(groupadmin)/group-members', color: '#FF9800' },
    { name: 'Contribution Report', icon: '🥧', route: '/(superadmin)/contribution-report', color: '#4CAF50' },
    { name: 'Send Notification', icon: '🔔', route: '/(groupadmin)/notifications', color: '#9C27B0' },
    { name: 'Loan Management', icon: '📝', route: '/(groupadmin)/loan-management', color: '#F44336' },
    { name: 'Churn Analysis', icon: '📊', route: '/(groupadmin)/churn-analysis', color: '#9C27B0' },
    { name: 'Documents', icon: '📄', route: '/(groupadmin)/document-management', color: '#607D8B' },
    { name: 'Meeting Management', icon: '📅', route: '/(groupadmin)/meetings', color: '#9C27B0' },
    { name: 'Volunteer Campaign', icon: '🤝', route: '/(groupadmin)/create-campaign', color: '#FF9800' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={[styles.loadingText, isDarkMode && styles.darkLoadingText]}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
      {/* Enhanced Header */}
      <View style={[styles.headerContainer, isDarkMode && styles.darkHeaderContainer]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.appTitleContainer}>
            <Text style={[styles.titleBlack, isDarkMode && styles.darkTitleBlack]}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>

        <View style={styles.headerIconsContainer}>
          {/* Dark Mode button removed from header */}
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={handleSwitchToMemberView}
          >
            <Ionicons 
              name="people" 
              size={24} 
              color={isDarkMode ? "#81C784" : "#4CAF50"} 
            />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>
              Member View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(groupadmin)/group-admin-profile')}
          >
            <Ionicons name="person" size={24} color={isDarkMode ? "#90CAF9" : "#2196F3"} />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#F44336" />
            <Text style={[styles.headerIconText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDarkMode && styles.darkScrollContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor={isDarkMode ? '#90CAF9' : '#2196F3'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, isDarkMode && styles.darkWelcomeText]}>
              Welcome back, {groupAdminName}!
            </Text>
            <Text style={[styles.subtitle, isDarkMode && styles.darkSubtitle]}>
              Role: Group Admin
            </Text>
            <Text style={[styles.dateText, isDarkMode && styles.darkDateText]}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>

          {/* Statistics Grid - 3 columns layout */}
          <View style={styles.statsGrid}>
            {statCards.map((card, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.statCard, 
                  isDarkMode && styles.darkStatCard,
                  { width: STAT_CARD_WIDTH }
                ]}
                onPress={() => card.route && router.push(card.route)}
              >
                <View style={styles.statCardContent}>
                  <View style={styles.statIconContainer}>
                    <View style={[styles.statIconCircle, { backgroundColor: card.color }]}>
                      <Text style={styles.statIconText}>{card.icon}</Text>
                    </View>
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statValue, isDarkMode && styles.darkStatValue]}>
                      {card.value}
                    </Text>
                    <Text style={[styles.statTitle, isDarkMode && styles.darkStatTitle]}>
                      {card.title}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Actions - Updated to match the image design */}
          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                Quick Actions
              </Text>
            </View>
            
            {/* Divider line like in the image */}
            <View style={[styles.divider, isDarkMode && styles.darkDivider]} />
            
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickActionButton, 
                    isDarkMode && styles.darkQuickActionButton,
                    { width: QUICK_ACTION_WIDTH }
                  ]}
                  onPress={() => router.push(action.route)}
                >
                  <View style={styles.quickActionContent}>
                    <View style={[styles.quickActionIconContainer, { backgroundColor: action.color }]}>
                      <Text style={styles.quickActionIcon}>{action.icon}</Text>
                    </View>
                    <Text style={[styles.quickActionText, isDarkMode && styles.darkQuickActionText]}>
                      {action.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Contributions */}
          {recentContributions.length > 0 && (
            <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                  Recent Contributions
                </Text>
                <TouchableOpacity onPress={() => router.push('/(groupadmin)/record-contributions')}>
                  <Text style={styles.link}>View All</Text>
                </TouchableOpacity>
              </View>
              {recentContributions.slice(0, 3).map((contribution, index) => (
                <View key={index} style={styles.contributionItem}>
                  <View style={styles.contributionInfo}>
                    <Text style={[styles.contributionName, isDarkMode && styles.darkContributionName]}>
                      {contribution.member.firstName} {contribution.member.lastName}
                    </Text>
                    <Text style={[styles.contributionGroup, isDarkMode && styles.darkContributionGroup]}>
                      {contribution.group.groupName}
                    </Text>
                  </View>
                  <View style={styles.contributionMeta}>
                    <Text style={[styles.contributionAmount, isDarkMode && styles.darkContributionAmount]}>
                      KES {contribution.amount.toLocaleString()}
                    </Text>
                    <Text style={[styles.contributionDate, isDarkMode && styles.darkContributionDate]}>
                      {new Date(contribution.transactionDate).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Groups Overview */}
          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                Your Groups
              </Text>
              <TouchableOpacity onPress={() => router.push('/(groupadmin)/manage-groups')}>
                <Text style={styles.link}>Manage</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.groupsList}>
              {groups.slice(0, 3).map((group, index) => (
                <View key={index} style={styles.groupItem}>
                  <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, isDarkMode && styles.darkGroupName]}>
                      {group.groupName}
                    </Text>
                    <Text style={[styles.groupMembers, isDarkMode && styles.darkGroupMembers]}>
                      {group.members?.length || 0} members
                    </Text>
                  </View>
                  <View style={[
                    styles.groupStatus,
                    { backgroundColor: group.status?.toLowerCase() === 'active' ? '#4CAF50' : '#F44336' }
                  ]}>
                    <Text style={styles.groupStatusText}>
                      {group.status || 'Inactive'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, isDarkMode && styles.darkFooterText]}>
              Powered by: <Text style={styles.footerBrand}>MANSOFT</Text>
            </Text>
            <Text style={[styles.footerSub, isDarkMode && styles.darkFooterSub]}>
              Infinite Possibilities
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Dark Mode FAB Button */}
      <TouchableOpacity
        style={[
          styles.floatingDarkModeButton,
          isDarkMode && styles.floatingDarkModeButtonDark
        ]}
        onPress={toggleDarkMode}
      >
        <Ionicons 
          name={isDarkMode ? "sunny" : "moon"} 
          size={24} 
          color={isDarkMode ? "#FFD700" : "#FFFFFF"} 
        />
      </TouchableOpacity>

      <GroupAdminBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  darkSafeArea: { backgroundColor: '#121212' },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#555' 
  },
  darkLoadingText: {
    color: '#B0B0B0'
  },

  // Header Styles
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
  darkHeaderContainer: {
    backgroundColor: '#1E1E1E',
    borderBottomColor: '#333',
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  logo: { 
    width: 35, 
    height: 35, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  appTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  titleBlack: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  darkTitleBlack: {
    color: '#FFFFFF'
  },
  titleGreen: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#4CAF50', 
    marginLeft: 4 
  },
  headerIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    minWidth: 40,
  },
  headerIconText: {
    fontSize: 8,
    color: '#1565C0',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  darkHeaderIconText: {
    color: '#90CAF9',
  },
  logoutText: {
    color: '#F44336',
  },

  // Floating Dark Mode FAB Button
  floatingDarkModeButton: {
    position: 'absolute',
    right: 20,
    top: Dimensions.get('window').height / 2 - 28, // Center vertically
    backgroundColor: '#2196F3',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  floatingDarkModeButtonDark: {
    backgroundColor: '#333',
  },

  scrollContent: { 
    flexGrow: 1, 
    paddingBottom: 80 
  },
  darkScrollContent: { 
    backgroundColor: '#121212' 
  },
  mainContent: { 
    padding: 16 
  },

  // Welcome Section
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 4, 
    color: '#333' 
  },
  darkWelcomeText: { 
    color: '#FFFFFF' 
  },
  subtitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 6, 
    color: '#666' 
  },
  darkSubtitle: { 
    color: '#B0B0B0' 
  },
  dateText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  darkDateText: {
    color: '#888',
  },

  // Statistics Grid - 3 columns layout
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  darkStatCard: {
    backgroundColor: '#1E1E1E',
  },
  statCardContent: {
    alignItems: 'center',
    width: '100%',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconText: {
    fontSize: 18,
  },
  statTextContainer: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  darkStatValue: {
    color: '#FFFFFF',
  },
  statTitle: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  darkStatTitle: {
    color: '#B0B0B0',
  },

  // Section Styles
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkSectionContainer: {
    backgroundColor: '#1E1E1E',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  darkSectionTitle: {
    color: '#FFFFFF',
  },
  link: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },

  // Divider style
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  darkDivider: {
    backgroundColor: '#333',
  },

  // Quick Actions - Updated styles to match the image
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    minHeight: 90,
    justifyContent: 'center',
  },
  darkQuickActionButton: {
    backgroundColor: '#1E1E1E',
    borderColor: '#333',
  },
  quickActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  quickActionText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 13,
  },
  darkQuickActionText: {
    color: '#FFFFFF',
  },

  // Contribution Items
  contributionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contributionInfo: {
    flex: 1,
  },
  contributionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  darkContributionName: {
    color: '#FFFFFF',
  },
  contributionGroup: {
    fontSize: 12,
    color: '#666',
  },
  darkContributionGroup: {
    color: '#B0B0B0',
  },
  contributionMeta: {
    alignItems: 'flex-end',
  },
  contributionAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 2,
  },
  darkContributionAmount: {
    color: '#81C784',
  },
  contributionDate: {
    fontSize: 11,
    color: '#999',
  },
  darkContributionDate: {
    color: '#888',
  },

  // Groups List
  groupsList: {
    gap: 12,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  darkGroupName: {
    color: '#FFFFFF',
  },
  groupMembers: {
    fontSize: 12,
    color: '#666',
  },
  darkGroupMembers: {
    color: '#B0B0B0',
  },
  groupStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  // Footer
  footer: { 
    marginTop: 30, 
    alignItems: 'center' 
  },
  footerText: { 
    fontSize: 13, 
    color: '#555' 
  },
  darkFooterText: {
    color: '#B0B0B0',
  },
  footerBrand: { 
    fontWeight: 'bold', 
    color: '#4CAF50' 
  },
  footerSub: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  darkFooterSub: {
    color: '#888',
  },
});
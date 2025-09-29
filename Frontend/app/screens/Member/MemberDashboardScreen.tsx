import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert, // Add Alert for better error messages
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../../app/_layout';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

interface LoggedInMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  mansoftTenantId: string;
}

interface Contribution {
  id: string;
  member: { id: string };
  group: { id: string };
  transactionType: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  status: string;
  description?: string;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
}

// Define Notification type here for clarity, assuming it's the same as NotificationsScreen
type Notification = {
    id: string;
    member: { id: string };
    type: string;
    messageContent: string;
    sendDate: string;
    channel: string;
    read: boolean;
    // Add other fields from your Notification entity if they exist and are useful
    createdOn: string; // Used for sorting
};


function MemberDashboardScreen() {
  const { setUserRole } = useContext(AuthContext)!;

  const [memberData, setMemberData] = useState<LoggedInMember | null>(null);
  const [loadingMemberData, setLoadingMemberData] = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(true);
  // Changed to an object to store both message and read status
  const [notificationStatus, setNotificationStatus] = useState<{ message: string; unread: boolean } | null>(null);
  const [upcomingMeeting, setUpcomingMeeting] = useState<{ date: string; title: string } | null>(null);

  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userId');
        const storedFirstName = await AsyncStorage.getItem('userFirstName');
        const storedLastName = await AsyncStorage.getItem('userLastName');
        const storedEmail = await AsyncStorage.getItem('userEmail');
        const storedRole = await AsyncStorage.getItem('userRole');
        const storedStatus = await AsyncStorage.getItem('userStatus');
        const storedTenantId = await AsyncStorage.getItem('userTenantId');

        if (storedId && storedFirstName && storedLastName && storedEmail && storedRole && storedStatus && storedTenantId) {
          setMemberData({
            id: storedId,
            firstName: storedFirstName,
            lastName: storedLastName,
            email: storedEmail,
            role: storedRole,
            status: storedStatus,
            mansoftTenantId: storedTenantId,
          });
        } else {
          handleLogout();
        }
      } catch (error) {
        console.error('Error fetching member data from storage:', error); // More specific error
        handleLogout();
      } finally {
        setLoadingMemberData(false);
      }
    };

    fetchMemberData();
  }, []);

  useEffect(() => {
    const fetchContributions = async () => {
      if (!memberData?.id) return;
      setLoadingContributions(true);
      try {
        const response = await fetch(`${BASE_URL}/contributions/member/${memberData.id}`);
        if (response.ok) {
          const data: Contribution[] = await response.json();
          setContributions(data);
        } else {
          console.error(`Error fetching contributions: ${response.status} ${response.statusText}`);
          // Optionally show an alert
          // Alert.alert('Error', 'Failed to load contributions.');
        }
      } catch (error) {
        console.error('Error fetching contributions:', error);
        // Alert.alert('Error', 'Failed to load contributions due to network error.');
      } finally {
        setLoadingContributions(false);
      }
    };

    if (memberData?.id) {
      fetchContributions();
    }
  }, [memberData?.id]);

  useEffect(() => {
    const fetchDashboardData = async () => { // Combined into one async function
        if (!memberData?.id) return; // Ensure memberData is loaded

        // Fetch Latest Notification
        try {
            const response = await fetch(`${BASE_URL}/notifications`);
            if (response.ok) {
                const allNotifications: Notification[] = await response.json();
                
                // Filter notifications for the current user
                const userNotifications = allNotifications.filter(
                    (n) => n.member?.id === memberData.id
                );

                // Sort by creation date to get the truly latest notification
                userNotifications.sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime());

                // Find the latest notification
                const latest = userNotifications.length > 0 ? userNotifications[userNotifications.length - 1] : null;

                if (latest) {
                    // Check if it's unread
                    if (!latest.read) {
                        setNotificationStatus({
                            message: latest.messageContent || latest.type || 'New unread notification 🔔',
                            unread: true
                        });
                    } else {
                        // It's read, just show its content without implying "new"
                        setNotificationStatus({
                            message: latest.messageContent || latest.type || 'Latest notification',
                            unread: false
                        });
                    }
                } else {
                    setNotificationStatus(null); // No notifications for the user
                }
            } else {
                console.error(`Error fetching notifications: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }

        // Fetch Upcoming Meeting
        try {
            const response = await fetch(`${BASE_URL}/meetings`);
            if (response.ok) {
                const meetings = await response.json();
                const now = new Date();
                // Filter for meetings that are specific to the user's group, if applicable
                // (Assuming `memberData.groupId` would be available, or meetings are public)
                const upcoming = meetings.find((m: any) => new Date(m.date || m.startTime) > now);
                if (upcoming) {
                    const dateStr = new Date(upcoming.date || upcoming.startTime).toLocaleString('en-KE', {
                        weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    });
                    setUpcomingMeeting({
                        date: dateStr,
                        title: upcoming.title || 'Upcoming Meeting',
                    });
                } else {
                    setUpcomingMeeting(null);
                }
            } else {
                console.error(`Error fetching meetings: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching meetings:', error);
        }
    };

    if (memberData?.id) { // Only run if memberData is available
        fetchDashboardData();
    }
  }, [memberData?.id]); // Depend on memberData.id to re-fetch when it becomes available


  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'userEmail', 'userFirstName',
        'userLastName', 'userRole', 'userStatus', 'userTenantId',
        'userGroupId', 'userPhoneNumber', 'userJoinDate', 'userCreatedBy',
        'userModifiedBy', 'userCreatedOn', 'userModifiedOn'
      ]);
      setUserRole(null);
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Failed to log out.'); // User feedback for logout error
    }
  };

  const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);

  if (loadingMemberData || loadingContributions) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  if (!memberData) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Error loading user data. Please log in again.</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const displayName = `${memberData.firstName} ${memberData.lastName}`;
  const displayRole = memberData.role;
  const groupName = 'Finance Circle'; // This might need to be fetched dynamically if members belong to different groups

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => router.push('/(member)/profile')}>
            <Text style={styles.headerButtonText}>My Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(member)/settings')}>
            <Text style={styles.headerButtonText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={[styles.headerButtonText, styles.logoutButtonText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          <Text style={styles.groupText}>{groupName}</Text>
          <Text style={styles.welcomeText}>Welcome, {displayName}!</Text>
          <Text style={styles.roleText}>Role: {displayRole}</Text>

          <View style={styles.cardContainer}>
            {/* Current Balance */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current Balance</Text>
              <Text style={styles.cardValue}>KES {totalContributed.toLocaleString('en-KE')}</Text>
              <TouchableOpacity onPress={() => router.push('/(member)/mycontributions')}>
                <Text style={styles.link}>View Details</Text>
              </TouchableOpacity>
            </View>

            {/* Upcoming Meeting */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Upcoming Meeting</Text>
              {upcomingMeeting ? (
                <>
                  <Text style={styles.cardValue}>{upcomingMeeting.title} on {upcomingMeeting.date}</Text>
                  <TouchableOpacity onPress={() => router.push('/(member)/meetings')}>
                    <Text style={styles.link}>View Details</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.cardValue}>No upcoming meeting</Text>
                  <TouchableOpacity onPress={() => router.push('/(member)/meetings')}>
                    <Text style={styles.link}>View All</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Latest Announcement */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Latest Announcement</Text>
              {notificationStatus ? (
                <>
                  <Text style={[styles.cardValue, notificationStatus.unread && styles.unreadNotificationText]}>
                    {notificationStatus.message} {notificationStatus.unread ? ' 🔔' : ''}
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(member)/notifications')}>
                    <Text style={styles.link}>View Details</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.cardValue}>No announcements</Text>
                  <TouchableOpacity onPress={() => router.push('/(member)/notifications')}>
                    <Text style={styles.link}>View All</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* <View style={styles.activitySection}>
            <Text style={styles.activityTitle}>Recent Activity</Text>
            <Text style={styles.activityItem}>• Contributed KES 2,000 on 20 Jun</Text>
            <Text style={styles.activityItem}>• Attended meeting "Monthly Review"</Text>
            <Text style={styles.activityItem}>• Minutes posted for May Meeting</Text>
            <Text style={styles.activityItem}>• Downloaded Financial Report</Text>
            <Text style={styles.activityItem}>• Sent suggestion to admin</Text>
            <Text style={styles.activityItem}>• Updated contact info</Text>
          </View> */}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Powered by: <Text style={styles.footerBrand}>MANSOFT</Text>
            </Text>
            <Text style={styles.footerSub}>Infinite Possibilities</Text>
          </View>
        </View>
      </ScrollView>

      <MemberBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F1F8E9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F8E9' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  button: { backgroundColor: '#4CAF50', paddingVertical: 12, borderRadius: 8, width: '60%', marginTop: 20, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16, textAlign: 'center' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#C8E6C9', borderBottomWidth: 1, borderBottomColor: '#A5D6A7', elevation: 3 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 18, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#D32F2F' },
  headerButtons: { flexDirection: 'row', gap: 15 },
  headerButtonText: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },
  logoutButtonText: { color: '#D32F2F' },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  mainContent: { flexGrow: 1, padding: 20 },
  groupText: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', marginBottom: 10 },
  welcomeText: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  roleText: { fontSize: 16, color: '#666', marginBottom: 20 },
  cardContainer: { flexDirection: 'column', gap: 12, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, width: '100%', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardTitle: { fontSize: 15, color: '#777' },
  cardValue: { fontSize: 20, fontWeight: 'bold', marginTop: 5, color: '#333' },
  // Added a style for unread notification text to make it stand out
  unreadNotificationText: {
    color: '#D32F2F', // A color that indicates importance or newness
    fontWeight: 'bold',
  },
  link: { marginTop: 10, fontSize: 14, color: '#2196F3', fontWeight: '600' },
  activitySection: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, elevation: 4, marginBottom: 20 },
  activityTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  activityItem: { fontSize: 15, marginBottom: 6, color: '#444' },
  footer: { marginTop: 40, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#555' },
  footerBrand: { fontWeight: 'bold', color: '#4CAF50' },
  footerSub: { fontSize: 13, color: '#888', marginTop: 2 },
});

export default MemberDashboardScreen;
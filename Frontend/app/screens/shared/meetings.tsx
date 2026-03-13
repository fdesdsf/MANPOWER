import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const BASE_URL = 'http://192.168.0.101:8080/api';

type UserRole = 'SuperAdmin' | 'GroupAdmin' | 'Member';
type Meeting = {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string;
  meetingLink?: string;
  agenda?: string;
  targetAudience: string;
  calledByRole: string;
  group?: {
    id: string;
    groupName: string;
  };
  createdBy?: string;
};

function MeetingManagementScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    role: UserRole;
    groupId?: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  // Load user data - USING THE SAME PATTERN AS DOCUMENTS SCREEN
  const loadUserData = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userRole = await AsyncStorage.getItem('userRole') as UserRole;
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      const userFirstName = await AsyncStorage.getItem('userFirstName');
      const userLastName = await AsyncStorage.getItem('userLastName');

      if (userEmail && userRole && userFirstName && userLastName) {
        const user = {
          email: userEmail,
          role: userRole,
          groupId: userGroupId || undefined,
          firstName: userFirstName,
          lastName: userLastName,
        };
        setCurrentUser(user);
        await loadMeetings(user);
      } else {
        // Fallback to old storage keys if new ones don't exist
        await loadUserFromLegacyStorage();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
      setLoading(false);
    }
  };

  // Fallback to legacy storage (for backward compatibility)
  const loadUserFromLegacyStorage = async () => {
    try {
      // Try to get admin first
      const adminData = await AsyncStorage.getItem('admin');
      if (adminData) {
        const admin = JSON.parse(adminData);
        setCurrentUser({
          email: admin.email || 'admin@example.com',
          role: 'SuperAdmin',
          firstName: admin.firstName || 'Admin',
          lastName: admin.lastName || 'User',
        });
        await loadMeetings({
          email: admin.email || 'admin@example.com',
          role: 'SuperAdmin',
          firstName: admin.firstName || 'Admin',
          lastName: admin.lastName || 'User',
        });
        return;
      }

      // Try to get group admin
      const groupAdminData = await AsyncStorage.getItem('groupAdmin');
      if (groupAdminData) {
        const groupAdmin = JSON.parse(groupAdminData);
        setCurrentUser({
          email: groupAdmin.email || 'groupadmin@example.com',
          role: 'GroupAdmin',
          groupId: groupAdmin.group?.id,
          firstName: groupAdmin.firstName || 'Group',
          lastName: groupAdmin.lastName || 'Admin',
        });
        await loadMeetings({
          email: groupAdmin.email || 'groupadmin@example.com',
          role: 'GroupAdmin',
          groupId: groupAdmin.group?.id,
          firstName: groupAdmin.firstName || 'Group',
          lastName: groupAdmin.lastName || 'Admin',
        });
        return;
      }

      // Try to get member
      const memberData = await AsyncStorage.getItem('loggedMember');
      if (memberData) {
        const member = JSON.parse(memberData);
        setCurrentUser({
          email: member.email || 'member@example.com',
          role: 'Member',
          groupId: member.group?.id,
          firstName: member.firstName || 'Member',
          lastName: member.lastName || 'User',
        });
        await loadMeetings({
          email: member.email || 'member@example.com',
          role: 'Member',
          groupId: member.group?.id,
          firstName: member.firstName || 'Member',
          lastName: member.lastName || 'User',
        });
        return;
      }

      Alert.alert('Error', 'User data not found. Please login again.');
      router.replace('/login');
    } catch (error) {
      console.error('Error loading legacy user data:', error);
      Alert.alert('Error', 'Failed to load user data');
      setLoading(false);
    }
  };

  const loadMeetings = async (user: {
    email: string;
    role: UserRole;
    groupId?: string;
    firstName: string;
    lastName: string;
  }) => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/meetings?userEmail=${encodeURIComponent(user.email)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to fetch meetings');
      }
      
      const data = await response.json();
      
      console.log('All meetings from API:', data);
      console.log('User context:', { 
        role: user.role, 
        groupId: user.groupId,
        email: user.email 
      });

      // Filter meetings based on user role - ONLY AFTER WE HAVE USER DATA
      let filteredMeetings = data;
      
      if (user.role === 'GroupAdmin' && user.groupId) {
        filteredMeetings = data.filter((meeting: Meeting) => 
          meeting.group?.id === user.groupId
        );
        console.log('Filtered for GroupAdmin:', filteredMeetings);
      } else if (user.role === 'Member' && user.groupId) {
        filteredMeetings = data.filter((meeting: Meeting) => 
          meeting.group?.id === user.groupId
        );
        console.log('Filtered for Member:', filteredMeetings);
      }
      // Admin sees all meetings (no filter)
      
      setMeetings(filteredMeetings);
    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('Error', 'Could not load meetings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const goToScheduleMeeting = () => {
     router.push('/screens/shared/ScheduleNewMeeting');
  };

  const getScreenTitle = () => {
    if (!currentUser) return 'Meetings';
    
    switch (currentUser.role) {
      case 'SuperAdmin': return 'All Meetings (System-Wide)';
      case 'GroupAdmin': return 'My Group Meetings';
      case 'Member': return 'My Meetings';
      default: return 'Meetings';
    }
  };

  const getSubtitle = () => {
    if (!currentUser) return 'View scheduled meetings';
    
    switch (currentUser.role) {
      case 'SuperAdmin': return 'View and manage all meetings across all groups';
      case 'GroupAdmin': return 'View and manage meetings for your group';
      case 'Member': return 'View your upcoming meetings';
      default: return 'View scheduled meetings';
    }
  };

  const canScheduleMeetings = () => {
    return currentUser && (currentUser.role === 'SuperAdmin' || currentUser.role === 'GroupAdmin');
  };

  const handleJoinMeeting = (meetingLink?: string) => {
    if (!meetingLink) {
      Alert.alert('No Meeting Link', 'This meeting does not have a join link yet.');
      return;
    }
    
    Alert.alert(
      'Join Meeting',
      'Would you like to join this meeting?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Join', 
          onPress: () => {
            Linking.openURL(meetingLink).catch(() => {
              Alert.alert('Error', 'Could not open meeting link');
            });
          }
        },
      ]
    );
  };

  const canUserManageMeeting = (meeting: Meeting): boolean => {
    if (!currentUser) return false;
    
    // Admin can manage all meetings
    if (currentUser.role === 'SuperAdmin') return true;
    
    // GroupAdmin can only manage meetings from their group
    if (currentUser.role === 'GroupAdmin' && 
        currentUser.groupId && 
        meeting.group?.id === currentUser.groupId) {
      return true;
    }
    
    // Members cannot manage meetings
    return false;
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header - Matching Documents Screen Style */}
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userInfo}>
            {currentUser.firstName} {currentUser.lastName} ({currentUser.role})
          </Text>
          <TouchableOpacity onPress={() => {
            // Navigate to appropriate dashboard based on role
            if (currentUser.role === 'SuperAdmin') {
              router.push('/(superadmin)/dashboard');
            } else if (currentUser.role === 'GroupAdmin') {
              router.push('/(groupadmin)/dashboard');
            } else {
              router.push('/(member)/dashboard');
            }
          }}>
            <Text style={styles.homeLink}>🏠 Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Role-based header */}
        <View style={styles.header}>
          <Text style={styles.roleBadge}>{currentUser.role}</Text>
          <Text style={styles.title}>{getScreenTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>
        </View>

        {/* Schedule Button - Only for Admins and GroupAdmins */}
        {canScheduleMeetings() && (
          <TouchableOpacity style={styles.scheduleButton} onPress={goToScheduleMeeting}>
            <Text style={styles.scheduleText}>➕ Schedule New Meeting</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionHeader}>
          {currentUser.role === 'SuperAdmin' ? '📋 All Meetings' : '📋 My Meetings'}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 20 }} />
        ) : meetings.length === 0 ? (
          <Text style={styles.noMeetingsText}>
            {currentUser.role === 'SuperAdmin' 
              ? 'No meetings scheduled yet.' 
              : 'No meetings scheduled for your group yet.'
            }
          </Text>
        ) : (
          meetings.map((meeting: Meeting) => (
            <View key={meeting.id} style={styles.card}>
              <Text style={styles.cardTitle}>{meeting.title}</Text>
              <Text style={styles.cardDetail}>📅 {meeting.meetingDate}</Text>
              <Text style={styles.cardDetail}>🕒 {meeting.meetingTime}</Text>

              {/* Display Meeting Link */}
              {meeting.meetingLink && (
                <Text style={styles.cardLink}>🔗 {meeting.meetingLink}           Copy The link and paste in a new window in order to join the meeting</Text>
              )}
              
              {meeting.agenda && (
                <Text style={styles.cardAgenda}>📝 {meeting.agenda}</Text>
              )}
              
              {meeting.group && (
                <Text style={styles.cardDetail}>👥 Group: {meeting.group.groupName}</Text>
              )}
              
              <Text style={styles.cardDetail}>🎯 {meeting.targetAudience}</Text>
              <Text style={styles.cardDetail}>👤 Called by: {meeting.calledByRole}</Text>

              {/* Show group badge if meeting belongs to user's group */}
              {currentUser.groupId && meeting.group?.id === currentUser.groupId && (
                <Text style={styles.yourGroupBadge}>Your Group</Text>
              )}

              {/* Join Meeting Button */}
              {meeting.meetingLink && (
                <TouchableOpacity 
                  style={styles.joinButton}
                  onPress={() => handleJoinMeeting(meeting.meetingLink)}
                >
                  <Text style={styles.joinButtonText}>🎥 Join Meeting</Text>
                </TouchableOpacity>
              )}

              {/* Management Actions - Only for authorized users */}
              {canUserManageMeeting(meeting) && (
                <View style={styles.managementActions}>
                  <TouchableOpacity style={styles.editButton}>
                    <Text style={styles.editButtonText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
  },
  logoNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  textLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlack: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  titleRed: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginLeft: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  userInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  homeLink: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  container: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2E7D32',
    color: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 15,
    color: '#2E7D32',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardAgenda: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 6,
    marginTop: 4,
  },
  cardLink: {
    fontSize: 12,
    color: '#1976D2',
    marginBottom: 6,
    fontStyle: 'italic',
    backgroundColor: '#E3F2FD',
    padding: 6,
    borderRadius: 4,
  },
  scheduleButton: {
    backgroundColor: '#388E3C',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  scheduleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  joinButton: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  noMeetingsText: {
    color: '#777',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
    fontStyle: 'italic',
  },
  yourGroupBadge: {
    fontSize: 10,
    color: '#2E7D32',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  managementActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  editButton: {
    backgroundColor: '#FFB74D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#E57373',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
});

export default MeetingManagementScreen;
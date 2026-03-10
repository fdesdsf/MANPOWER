import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const BASE_URL = 'http://192.168.0.101:8080/api';

interface Group {
  id: string;
  groupName: string;
}

interface User {
  email: string;
  role: string;
  groupId?: string;
  firstName: string;
  lastName: string;
}

interface MeetingFormData {
  title: string;
  agenda: string;
  meetingDate: string;
  meetingTime: string;
  targetAudience: string;
  meetingType: 'zoom' | 'teams' | 'google_meet' | 'in_person' | 'webview';
  groupId: string;
  duration: number;
}

interface Meeting {
  id: string;
  title: string;
  meetingLink?: string;
  meetingType: string;
  meetingDate: string;
  meetingTime: string;
}

export default function ScheduleNewMeetingScreen() {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState<MeetingFormData>({
    title: '',
    agenda: '',
    meetingDate: '',
    meetingTime: '',
    targetAudience: 'GroupMembers',
    meetingType: 'webview', // Default to webview
    groupId: '',
    duration: 60,
  });

  // WebView meeting states
  const [showWebView, setShowWebView] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);

  // Custom modal-based date/time picker states
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempTime, setTempTime] = useState('');

  useEffect(() => {
    loadUserDataAndGroups();
  }, []);

  const loadUserDataAndGroups = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userRole = await AsyncStorage.getItem('userRole');
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      const userFirstName = await AsyncStorage.getItem('userFirstName');
      const userLastName = await AsyncStorage.getItem('userLastName');

      if (userEmail && userRole && userFirstName && userLastName) {
        const user: User = {
          email: userEmail,
          role: userRole,
          groupId: userGroupId || undefined,
          firstName: userFirstName,
          lastName: userLastName,
        };
        setCurrentUser(user);
        await loadGroups(user);
        
        if (user.role === 'GroupAdmin' && user.groupId) {
          setFormData(prev => ({ ...prev, groupId: user.groupId! }));
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const loadGroups = async (user: User) => {
    try {
      if (user.role === 'GroupAdmin' && user.groupId) {
        const response = await fetch(`${BASE_URL}/groups/${user.groupId}`);
        if (response.ok) {
          const groupData = await response.json();
          setGroups([groupData]);
        } else {
          console.error('Failed to fetch group:', response.status);
        }
      } else if (user.role === 'Admin') {
        const response = await fetch(`${BASE_URL}/groups`);
        if (response.ok) {
          const groupsData = await response.json();
          setGroups(groupsData);
        } else {
          console.error('Failed to fetch groups:', response.status);
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      Alert.alert('Error', 'Failed to load groups. Please check your connection.');
    }
  };

  // Custom date picker handlers
  const handleOpenDatePicker = () => {
    setTempDate(formData.meetingDate);
    setShowDateModal(true);
  };

  const handleOpenTimePicker = () => {
    setTempTime(formData.meetingTime);
    setShowTimeModal(true);
  };

  const handleDateConfirm = () => {
    setFormData(prev => ({ ...prev, meetingDate: tempDate }));
    setShowDateModal(false);
  };

  const handleTimeConfirm = () => {
    setFormData(prev => ({ ...prev, meetingTime: tempTime }));
    setShowTimeModal(false);
  };

  const handleDateCancel = () => {
    setShowDateModal(false);
  };

  const handleTimeCancel = () => {
    setShowTimeModal(false);
  };

  // Convert time string "HH:MM" to backend time format "HH:MM:00"
  const formatTimeForBackend = (timeString: string): string => {
    if (timeString && timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':');
      return `${hours}:${minutes}:00`;
    }
    return '00:00:00';
  };

  const generateMeetingLink = (meetingType: string, title: string): string => {
    const baseUrls: { [key: string]: string } = {
      zoom: 'https://zoom.us/j/',
      teams: 'https://teams.microsoft.com/l/meetup-join/',
      google_meet: 'https://meet.google.com/',
      webview: `https://meet.jit.si/${generateMeetingId(title)}` // Jitsi Meet for in-app meetings
    };

    const base = baseUrls[meetingType] || '';
    const randomId = Math.random().toString(36).substring(2, 15);
    return `${base}${randomId}`;
  };

  const generateMeetingId = (title: string): string => {
    // Create a URL-friendly meeting ID from title
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    const randomId = Math.random().toString(36).substring(2, 8);
    return `${cleanTitle}-${randomId}`;
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a meeting title');
      return false;
    }
    if (!formData.meetingDate) {
      Alert.alert('Error', 'Please select a meeting date');
      return false;
    }
    if (!formData.meetingTime) {
      Alert.alert('Error', 'Please select a meeting time');
      return false;
    }
    if (!formData.groupId) {
      Alert.alert('Error', 'Please select a group');
      return false;
    }
    if (formData.duration < 15 || formData.duration > 480) {
      Alert.alert('Error', 'Duration must be between 15 minutes and 8 hours');
      return false;
    }

    const meetingDateTime = new Date(`${formData.meetingDate}T${formData.meetingTime}`);
    if (meetingDateTime <= new Date()) {
      Alert.alert('Error', 'Meeting must be scheduled for a future date and time');
      return false;
    }

    return true;
  };

  const handleCreateMeeting = async () => {
    if (!validateForm()) {
      return;
    }
    
    if (!currentUser) {
      Alert.alert('Error', 'User not found');
      return;
    }

    try {
      setLoading(true);

      // Generate meeting link based on type
      const meetingLink = formData.meetingType !== 'in_person' 
        ? generateMeetingLink(formData.meetingType, formData.title)
        : undefined;

      // Prepare meeting data according to backend expectations
      const meetingData = {
        group: {
          id: formData.groupId,
        },
        meetingDate: formData.meetingDate,
        meetingTime: formatTimeForBackend(formData.meetingTime),
        meetingLink: meetingLink,
        title: formData.title,
        agenda: formData.agenda,
        calledByRole: currentUser.role,
        targetAudience: formData.targetAudience,
        duration: formData.duration,
        createdBy: currentUser.email,
        modifiedBy: currentUser.email,
        createdOn: new Date().toISOString(),
        modifiedOn: new Date().toISOString(),
        mansoftTenantId: "default-tenant"
      };

      const response = await fetch(`${BASE_URL}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(meetingData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create meeting: ${errorText}`);
      }

      const createdMeeting = await response.json();
      
      // If it's a WebView meeting, show option to join immediately
      if (formData.meetingType === 'webview' && meetingLink) {
        Alert.alert(
          'Meeting Scheduled Successfully!', 
          `Would you like to join the meeting now?`,
          [
            {
              text: 'Join Now',
              onPress: () => {
                setCurrentMeeting({
                  id: createdMeeting.id,
                  title: formData.title,
                  meetingLink: meetingLink,
                  meetingType: formData.meetingType,
                  meetingDate: formData.meetingDate,
                  meetingTime: formData.meetingTime
                });
                setShowWebView(true);
              }
            },
            {
              text: 'Later',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert(
          'Success', 
          `Meeting "${formData.title}" scheduled successfully!${meetingLink ? `\n\nMeeting Link: ${meetingLink}` : ''}`,
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      }

    } catch (error) {
      console.error('Error creating meeting:', error);
      Alert.alert(
        'Error', 
        `Failed to create meeting: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date for date input (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // WebView for in-app meetings
  const renderWebViewMeeting = () => {
    if (!currentMeeting?.meetingLink) return null;

    return (
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>Meeting: {currentMeeting.title}</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowWebView(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: currentMeeting.meetingLink }}
            style={styles.webview}
            allowsFullscreenVideo={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2E7D32" />
                <Text style={styles.loadingText}>Loading meeting...</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>JUMUIYA</Text>
            <Text style={styles.titleRed}>CAPITAL</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        <Text style={styles.title}>Schedule New Meeting</Text>
        <Text style={styles.subtitle}>
          Create a new meeting for your {currentUser?.role === 'GroupAdmin' ? 'group' : 'organization'}
        </Text>

        {/* Meeting Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Meeting Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter meeting title"
            value={formData.title}
            onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
          />
        </View>

        {/* Agenda */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Agenda</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Describe what this meeting is about..."
            value={formData.agenda}
            onChangeText={(text) => setFormData(prev => ({ ...prev, agenda: text }))}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Date and Time - Cross Platform Solution */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={handleOpenDatePicker}
            >
              <Text style={styles.dateTimeText}>
                {formData.meetingDate || 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Time *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={handleOpenTimePicker}
            >
              <Text style={styles.dateTimeText}>
                {formData.meetingTime || 'Select time'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration (minutes) *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="60"
            value={formData.duration.toString()}
            onChangeText={(text) => {
              const duration = parseInt(text) || 60;
              setFormData(prev => ({ ...prev, duration }));
            }}
            keyboardType="numeric"
          />
        </View>

        {/* Meeting Type */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Meeting Type *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.meetingType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, meetingType: value }))}
              style={styles.picker}
            >
              <Picker.Item label="In-App Video Meeting" value="webview" />
              <Picker.Item label="Zoom Meeting" value="zoom" />
              <Picker.Item label="Microsoft Teams" value="teams" />
              <Picker.Item label="Google Meet" value="google_meet" />
              <Picker.Item label="In-Person" value="in_person" />
            </Picker>
          </View>
          {formData.meetingType === 'webview' && (
            <Text style={styles.helperText}>
              Join the meeting directly within the app using video and audio
            </Text>
          )}
        </View>

        {/* Target Audience */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Target Audience *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.targetAudience}
              onValueChange={(value) => setFormData(prev => ({ ...prev, targetAudience: value }))}
              style={styles.picker}
            >
              <Picker.Item label="Group Members" value="GroupMembers" />
              <Picker.Item label="Group Admins" value="GroupAdmins" />
              <Picker.Item label="All Users" value="AllUsers" />
            </Picker>
          </View>
        </View>

        {/* Group Selection (Only for Admin) */}
        {(currentUser?.role === 'Admin' && groups.length > 0) && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Group *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.groupId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, groupId: value }))}
                style={styles.picker}
              >
                <Picker.Item label="Select a group" value="" />
                {groups.map((group) => (
                  <Picker.Item 
                    key={group.id} 
                    label={group.groupName} 
                    value={group.id} 
                  />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Show warning if no groups available */}
        {currentUser?.role === 'Admin' && groups.length === 0 && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>No groups available. Please create groups first.</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.cancelButton, loading && styles.buttonDisabled]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreateMeeting}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>
                {formData.meetingType === 'webview' ? 'Create Meeting' : 'Create Meeting'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Custom Date Picker Modal */}
        <Modal
          visible={showDateModal}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <input
                type="date"
                value={tempDate}
                onChange={(e) => setTempDate(e.target.value)}
                min={getMinDate()}
                style={styles.modalInput}
              />
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancelButton} onPress={handleDateCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalConfirmButton} onPress={handleDateConfirm}>
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Custom Time Picker Modal */}
        <Modal
          visible={showTimeModal}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <input
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                style={styles.modalInput}
              />
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancelButton} onPress={handleTimeCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalConfirmButton} onPress={handleTimeConfirm}>
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {/* WebView Meeting Modal */}
      {renderWebViewMeeting()}
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
  backButton: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 20,
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
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  dateTimeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#333',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 50,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  warningContainer: {
    backgroundColor: '#FFEAA7',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    color: '#E17055',
    textAlign: 'center',
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    padding: 10,
    backgroundColor: '#2E7D32',
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // WebView Styles
  webviewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  webviewTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
});
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '@/app/components/MemberBottomNav';

const BASE_URL =  'http://192.168.0.103:8080/api'; // Update this if your backend IP changes

interface LoggedInMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
  mansoftTenantId: string;
  joinDate: string;
  created_by: string;
  modified_by: string;
  created_on: string;
  modified_on: string;
  group_id: string | null;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<LoggedInMember | null>(null);
  const [editedProfile, setEditedProfile] = useState<LoggedInMember | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          router.replace('/(auth)');
          return;
        }

        const res = await fetch(`${BASE_URL}/members/${userId}`);
        const data = await res.json();

        const fetchedProfile: LoggedInMember = {
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          role: data.role,
          status: data.status,
          mansoftTenantId: data.mansoftTenantId,
          joinDate: data.joinDate ?? 'N/A',
          created_by: data.createdBy ?? 'N/A',
          modified_by: data.modifiedBy ?? 'N/A',
          created_on: data.createdOn ?? new Date().toISOString(),
          modified_on: data.modifiedOn ?? new Date().toISOString(),
          group_id: data.groupId ?? null,
        };

        setProfile(fetchedProfile);
        setEditedProfile(fetchedProfile);

        // Fetch group name if groupId exists
        if (data.groupId) {
          const groupRes = await fetch(`${BASE_URL}/groups/${data.groupId}`);
          const groupData = await groupRes.json();
          setGroupName(groupData.groupName); // ✅ groupName from backend
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        router.replace('/(auth)');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleEditToggle = () => {
    setEditing(true);
    if (profile) setEditedProfile(profile);
  };

  const handleCancel = () => {
    setEditing(false);
    if (profile) setEditedProfile(profile);
  };

  const handleSave = () => {
    if (editedProfile) {
      setProfile(editedProfile);
      setEditing(false);
      Alert.alert('Success', 'Profile updated locally. Add API call here to persist changes.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Account', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove([
            'userToken', 'userId', 'userEmail', 'userFirstName',
            'userLastName', 'userRole', 'userStatus', 'userTenantId',
            'userPhoneNumber',
          ]);
          router.replace('/(auth)');
        },
      },
    ]);
  };

  const renderTableRow = (
    label: string,
    value: string,
    editableKey?: keyof LoggedInMember
  ) => (
    <View style={styles.tableRow}>
      <Text style={styles.tableLabel}>{label}</Text>
      {editing && editableKey && (editableKey === 'firstName' || editableKey === 'lastName' || editableKey === 'email' || editableKey === 'phoneNumber') ? (
        <TextInput
          style={styles.tableInput}
          value={editedProfile?.[editableKey] || ''}
          onChangeText={(text) =>
            setEditedProfile((prev) => prev ? ({ ...prev, [editableKey]: text }) : prev)
          }
        />
      ) : (
        <Text style={styles.tableValue}>{value}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Error loading profile.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>My Profile</Text>

        <View style={styles.tableCard}>
          <Text style={styles.sectionTitle}>Profile Info</Text>

          {renderTableRow('ID', profile.id)}
          {renderTableRow('First Name', profile.firstName, 'firstName')}
          {renderTableRow('Last Name', profile.lastName, 'lastName')}
          {renderTableRow('Email', profile.email, 'email')}
          {renderTableRow('Phone Number', profile.phoneNumber, 'phoneNumber')}
          {renderTableRow('Role', profile.role)}
          {renderTableRow('Status', profile.status)}
          {renderTableRow('Group', groupName ?? 'Not Assigned')}
          {renderTableRow('Join Date', profile.joinDate)}
          {renderTableRow('Created by', profile.created_by)}
          {renderTableRow('Created on', new Date(profile.created_on).toLocaleString())}
          {renderTableRow('Modified by', profile.modified_by)}
          {renderTableRow('Modified on', new Date(profile.modified_on).toLocaleString())}
          {renderTableRow('Tenant ID', profile.mansoftTenantId)}
        </View>

        {!editing ? (
          <TouchableOpacity style={styles.editBtn} onPress={handleEditToggle}>
            <Text style={styles.btnText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.btnText}>✅ Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.btnText}>❌ Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteText}>🗑️ Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    {/* Bottom Nav (not highlighting any tab) */}
    <MemberBottomNav current="none" />
  </SafeAreaView> 
  );
  
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  loadingText: { marginTop: 10, fontSize: 16, textAlign: 'center' },
  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#C8E6C9',
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 18, fontWeight: 'bold' },
  brandMan: { color: '#000' },
  brandPower: { color: '#D32F2F' },
  returnButton: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },

  scroll: { padding: 16, paddingBottom: 90 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center' },

  tableCard: { backgroundColor: '#fff', padding: 16, borderRadius: 10, elevation: 2, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#4CAF50' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  tableLabel: { fontSize: 14, color: '#555', flex: 1.2 },
  tableValue: { fontSize: 15, fontWeight: '600', color: '#222', flex: 1.8, textAlign: 'right' },
  tableInput: {
    fontSize: 15, borderBottomWidth: 1, borderColor: '#CCC', paddingVertical: 2,
    color: '#000', textAlign: 'right', flex: 1.8,
  },

  editBtn: { backgroundColor: '#2E7D32', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  saveBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, flex: 1, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#D32F2F', padding: 15, borderRadius: 8, flex: 1, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { marginTop: 20, alignItems: 'center' },
  deleteText: { color: '#D32F2F', fontSize: 14, fontWeight: 'bold' },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

interface AdminProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
  joinDate: string;
  created_by: string;
  modified_by: string;
  created_on: string;
  modified_on: string;
  mansoft_tenant_id: string;
}

export default function AdminProfileScreen() {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          router.replace('/(auth)');
          return;
        }

        const response = await fetch(`${BASE_URL}/members/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();

        const formattedData: AdminProfile = {
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          role: data.role,
          status: data.status,
          joinDate: data.joinDate ?? 'N/A',
          created_by: data.createdBy ?? 'N/A',
          modified_by: data.modifiedBy ?? 'N/A',
          created_on: data.createdOn ?? new Date().toISOString(),
          modified_on: data.modifiedOn ?? new Date().toISOString(),
          mansoft_tenant_id: data.mansoftTenantId,
        };

        setFormData(formattedData);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load admin profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (field: keyof AdminProfile, value: string) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!formData) return;
    try {
      const updated = {
        ...formData,
        modified_on: new Date().toISOString(),
      };
      const res = await fetch(`${BASE_URL}/members/${formData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (!res.ok) throw new Error('Failed to update profile');
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save changes.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={{ marginTop: 12 }}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!formData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={{ textAlign: 'center', marginTop: 20 }}>
          Could not load profile.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(superadmin)/dashboard')}>
          <Text style={styles.homeLink}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>SuperAdmin Profile</Text>
        <Text style={styles.subtitle}>
          {editMode ? 'Edit your profile below' : 'View your profile information'}
        </Text>

        <View style={styles.profileCard}>
          {Object.entries({
            firstName: 'First Name',
            lastName: 'Last Name',
            email: 'Email',
            phoneNumber: 'Phone Number',
            role: 'Role',
            status: 'Status',
            joinDate: 'Join Date',
            created_by: 'Created By',
            modified_by: 'Modified By',
            created_on: 'Created On',
            modified_on: 'Modified On',
            mansoft_tenant_id: 'Tenant ID',
          }).map(([key, label]) => (
            <View key={key} style={styles.profileRow}>
              <Text style={styles.label}>{label}</Text>
              {editMode && ['firstName', 'lastName', 'email', 'phoneNumber'].includes(key) ? (
                <TextInput
                  style={styles.input}
                  value={formData[key as keyof AdminProfile]}
                  onChangeText={(text) => handleChange(key as keyof AdminProfile, text)}
                />
              ) : (
                <Text style={styles.value}>{formData[key as keyof AdminProfile]}</Text>
              )}
            </View>
          ))}
        </View>

        {!editMode ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditMode(true)}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <SuperAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E9' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
  },
  logoNameWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 40, height: 40, resizeMode: 'contain' },
  textLogoContainer: { flexDirection: 'row', alignItems: 'center' },
  titleBlack: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  titleRed: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', marginLeft: 4 },
  homeLink: { fontSize: 14, color: '#D84315', fontWeight: '600' },
  container: { padding: 20, paddingBottom: 100 },
  title: {
    fontSize: 24, fontWeight: 'bold', color: '#2E7D32',
    marginBottom: 10, textAlign: 'center'
  },
  subtitle: {
    fontSize: 16, color: '#666',
    textAlign: 'center', marginBottom: 20
  },
  profileCard: {
    backgroundColor: '#FFFFFF', padding: 18,
    borderRadius: 12, elevation: 2, marginBottom: 25
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    flexShrink: 1,
    maxWidth: '40%',
  },
  value: {
    fontSize: 15,
    color: '#333',
    maxWidth: '60%',
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 6,
    fontSize: 15,
    textAlign: 'right',
    minWidth: 120,
    maxWidth: '60%',
  },
  editButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

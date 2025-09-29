import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

function GroupAdminProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [adminGroups, setAdminGroups] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfileAndGroups = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        const firstName = await AsyncStorage.getItem('userFirstName');
        const lastName = await AsyncStorage.getItem('userLastName');
        const email = await AsyncStorage.getItem('userEmail');
        const phoneNumber = await AsyncStorage.getItem('userPhoneNumber');
        const joinDate = await AsyncStorage.getItem('userJoinDate');
        const status = await AsyncStorage.getItem('userStatus');
        const role = await AsyncStorage.getItem('userRole');
        const tenantId = await AsyncStorage.getItem('userTenantId');
        const createdBy = await AsyncStorage.getItem('userCreatedBy');
        const modifiedBy = await AsyncStorage.getItem('userModifiedBy');
        const createdOn = await AsyncStorage.getItem('userCreatedOn');
        const modifiedOn = await AsyncStorage.getItem('userModifiedOn');

        const profile = {
          id,
          firstName,
          lastName,
          email,
          phoneNumber,
          joinDate,
          status,
          role,
          created_by: createdBy,
          modified_by: modifiedBy,
          created_on: createdOn,
          modified_on: modifiedOn,
          mansoft_tenant_id: tenantId,
        };

        setAdminProfile(profile);

        // Fetch groups created by this admin
        if (id) {
          const response = await fetch(`${BASE_URL}/groups/groupadmin/${id}`);
          if (response.ok) {
            const groups = await response.json();
            setAdminGroups(groups);
          } else {
            console.warn('Failed to fetch groups.');
          }
        }
      } catch (error) {
        console.error('Error fetching profile or groups:', error);
      }
    };

    fetchProfileAndGroups();
  }, []);

  if (!adminProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={{ textAlign: 'center', marginTop: 50 }}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Group Admin Profile</Text>
        {Object.entries(adminProfile).map(([key, value]) => (
          <View key={key} style={styles.item}>
            <View style={styles.row}>
              <Text style={styles.label}>{formatLabel(key)}:</Text>
              <Text style={styles.value}>{String(value ?? '—')}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.title, { marginTop: 40 }]}>Groups You Created</Text>
        {adminGroups.length > 0 ? (
          adminGroups.map((group, index) => (
            <View key={group.id || index} style={styles.groupCard}>
              <Text style={styles.groupTitle}>{group.groupName}</Text>
              <Text style={styles.groupText}>Description: {group.description || 'N/A'}</Text>
              <Text style={styles.groupText}>Created On: {group.creationDate?.split('T')[0] || 'N/A'}</Text>
            </View>
          ))
        ) : (
          <Text style={{ textAlign: 'center', marginTop: 10 }}>No groups created.</Text>
        )}
      </ScrollView>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const formatLabel = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  backToHome: {
    color: '#1565C0',
    fontWeight: 'bold',
    fontSize: 14,
  },
  container: {
    padding: 20,
    backgroundColor: '#fff',
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 20,
    textAlign: 'center',
  },
  item: {
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    maxWidth: '50%',
  },
  value: {
    fontSize: 15,
    color: '#444',
    maxWidth: '50%',
    textAlign: 'right',
  },
  groupCard: {
  backgroundColor: '#F1F8E9',
  padding: 15,
  marginBottom: 15,
  borderRadius: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 2,
},

groupTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#2E7D32',
  marginBottom: 8,
},

groupText: {
  fontSize: 14,
  color: '#4E4E4E',
  marginBottom: 4,
},
});

export default GroupAdminProfileScreen;

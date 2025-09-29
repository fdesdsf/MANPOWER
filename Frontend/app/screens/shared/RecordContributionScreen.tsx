import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://192.168.0.103:8080/api';

type Group = {
  id: string;
  name: string;
  // Add other fields as needed
};

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  group: Group;
  mansoftTenantId: string;
};

type FormEntry = {
  amount?: string;
  paymentMethod?: string;
  description?: string;
};

export default function RecordContributionScreen(): React.JSX.Element {
  const router = useRouter();

  const [groupId, setGroupId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [formData, setFormData] = useState<Record<string, FormEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const storedGroupId = await AsyncStorage.getItem('userGroupId');
        const storedAdminId = await AsyncStorage.getItem('userId');

        if (storedGroupId && storedAdminId) {
          setGroupId(storedGroupId);
          setAdminId(storedAdminId);
          await fetchGroup(storedGroupId);
          await fetchMembers(storedGroupId);
        } else {
          Alert.alert('Error', 'User session is invalid. Please log in again.');
        }
      } catch (err) {
        console.error('❌ Failed to load storage:', err);
        Alert.alert('Error', 'Could not load user or group data.');
      }
    };
    fetchInitialData();
  }, []);

  const fetchGroup = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups/${gId}`);
      setGroupData(response.data);
    } catch (err) {
      console.error('❌ Error fetching group:', err);
      Alert.alert('Error', 'Could not fetch group details.');
    }
  };

  const fetchMembers = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/members/by-group/${gId}`);
      setMembers(response.data);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error fetching members:', err);
      Alert.alert('Error', 'Could not fetch members.');
    }
  };

  const updateForm = (memberId: string, field: keyof FormEntry, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!groupData) {
      Alert.alert('Error', 'Group information not loaded.');
      return;
    }

    const entries = Object.entries(formData);
    if (entries.length === 0) {
      Alert.alert('Validation', 'Please enter at least one contribution.');
      return;
    }

    try {
      for (const [memberId, data] of entries) {
        const member = members.find((m) => m.id === memberId);
        if (!member) continue;

        const payload = {
          member: {
            ...member,
            group: groupData,
          },
          group: groupData,
          transactionType: 'Contribution',
          amount: parseFloat(data.amount || '0'),
          transactionDate: new Date().toISOString().split('T')[0],
          paymentMethod: data.paymentMethod || 'M-Pesa',
          status: 'Completed',
          description: data.description || '',
          createdBy: adminId,
          modifiedBy: adminId,
          createdOn: new Date().toISOString(),
          modifiedOn: new Date().toISOString(),
          mansoftTenantId: member.mansoftTenantId || '',
        };

        await axios.post(`${API_BASE_URL}/contributions`, payload);
      }

      Alert.alert('Success', 'Contributions recorded successfully.');
      setFormData({});
    } catch (err: unknown) {
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Server error.'
        : 'Unexpected error occurred.';
      console.error('❌ Submission error:', errorMessage);
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        <Text style={styles.title}>Record Member Contributions</Text>
        <Text style={styles.subtitle}>Enter contributions for each group member below:</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" />
        ) : (
          members.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <Text style={styles.memberName}>
                {member.firstName} {member.lastName}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Amount (KES)"
                keyboardType="numeric"
                value={formData[member.id]?.amount || ''}
                onChangeText={(val) => updateForm(member.id, 'amount', val)}
              />
              <Picker
                selectedValue={formData[member.id]?.paymentMethod || 'M-Pesa'}
                onValueChange={(val) => updateForm(member.id, 'paymentMethod', val)}
                style={styles.picker}
              >
                <Picker.Item label="M-Pesa" value="M-Pesa" />
                <Picker.Item label="Bank Transfer" value="Bank" />
                <Picker.Item label="Cash" value="Cash" />
              </Picker>
              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                value={formData[member.id]?.description || ''}
                onChangeText={(val) => updateForm(member.id, 'description', val)}
              />
            </View>
          ))
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>Submit Contributions</Text>
        </TouchableOpacity>
      </ScrollView>

      <GroupAdminBottomNav current="record-contributions" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  container: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1733a5ff', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  memberCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 2,
  },
  memberName: { fontWeight: 'bold', fontSize: 16, marginBottom: 5, color: '#333' },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderColor: '#ccc',
    borderWidth: 1,
  },
  picker: { backgroundColor: '#f9f9f9', marginTop: 8 },
  submitBtn: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

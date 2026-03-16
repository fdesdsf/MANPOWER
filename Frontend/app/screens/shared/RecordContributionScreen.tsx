import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  // Alert, // COMMENT OUT THIS IMPORT
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform, // ADD THIS
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://192.168.0.101:8080/api';

// ADD THIS HELPER FUNCTION at the top (after imports, before component)
const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
  }
};

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
  transactionDate?: string; // New field
  transactionType?: string; // New field
};

// Enum values from your Java code
enum TransactionType {
  Contribution = 'Contribution',
  Expense = 'Expense',
  Loan_Payment = 'Loan_Payment',
  Monthly = 'Monthly',
  volunteer = 'volunteer'
}

export default function RecordContributionScreen(): React.JSX.Element {
  const router = useRouter();

  const [groupId, setGroupId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [formData, setFormData] = useState<Record<string, FormEntry>>({});
  const [loading, setLoading] = useState(true);

  // Get today's date in YYYY-MM-DD format for default value
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
          showAlert('Error', 'User session is invalid. Please log in again.');
        }
      } catch (err) {
        console.error('❌ Failed to load storage:', err);
        showAlert('Error', 'Could not load user or group data.');
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
      showAlert('Error', 'Could not fetch group details.');
    }
  };

  const fetchMembers = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/members/by-group/${gId}`);
      setMembers(response.data);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error fetching members:', err);
      showAlert('Error', 'Could not fetch members.');
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
      showAlert('Error', 'Group information not loaded.');
      return;
    }

    const entries = Object.entries(formData);
    if (entries.length === 0) {
      showAlert('Validation', 'Please enter at least one contribution.');
      return;
    }

    try {
      for (const [memberId, data] of entries) {
        const member = members.find((m) => m.id === memberId);
        if (!member) continue;

        // Get values with defaults
        const amount = parseFloat(data.amount || '0');
        const transactionDate = data.transactionDate || getTodayDate();
        // Default to 'Contribution' for this screen since we're recording contributions
        const transactionType = data.transactionType || TransactionType.Contribution;
        const paymentMethod = data.paymentMethod || 'M-Pesa';
        const description = data.description || '';

        // Validation
        if (amount <= 0) {
          showAlert(
            'Validation Error', 
            `Amount must be greater than 0 for ${member.firstName} ${member.lastName}`
          );
          return;
        }

        if (!transactionDate) {
          showAlert(
            'Validation Error', 
            `Transaction date is required for ${member.firstName} ${member.lastName}`
          );
          return;
        }

        const payload = {
          member: {
            ...member,
            group: groupData,
          },
          group: groupData,
          transactionType: transactionType,
          amount: amount,
          transactionDate: transactionDate,
          paymentMethod: paymentMethod,
          status: 'Completed',
          description: description,
          createdBy: adminId,
          modifiedBy: adminId,
          createdOn: new Date().toISOString(),
          modifiedOn: new Date().toISOString(),
          mansoftTenantId: member.mansoftTenantId || '',
        };

        await axios.post(`${API_BASE_URL}/contributions`, payload);
      }

      showAlert('Success', 'Contributions recorded successfully.', () => {
        setFormData({});
      });
      
    } catch (err: unknown) {
      console.error('❌ Submission error:', err);
      
      // Better error message extraction
      let errorMessage = 'Failed to record contributions.';
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Server responded with error
          if (err.response.status === 500) {
            if (err.response.data?.message?.includes('Duplicate')) {
              errorMessage = 'Duplicate entry. This contribution may already exist.';
            } else {
              errorMessage = err.response.data?.message || 'Server error. Please try again.';
            }
          } else if (err.response.status === 400) {
            errorMessage = err.response.data?.message || 'Invalid data. Please check your inputs.';
          } else {
            errorMessage = err.response.data?.message || `Error: ${err.response.status}`;
          }
        } else if (err.request) {
          errorMessage = 'No response from server. Check your network connection.';
        } else {
          errorMessage = err.message;
        }
      }
      
      showAlert('Error', errorMessage);
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

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
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
                
                {/* Amount Input */}
                <TextInput
                  style={styles.input}
                  placeholder="Amount (KES)"
                  keyboardType="numeric"
                  value={formData[member.id]?.amount || ''}
                  onChangeText={(val) => updateForm(member.id, 'amount', val)}
                />

                {/* Contribution Type Picker - Using actual TransactionType enum */}
                <Text style={styles.label}>Contribution Type</Text>
                <Picker
                  selectedValue={formData[member.id]?.transactionType || TransactionType.Contribution}
                  onValueChange={(val) => updateForm(member.id, 'transactionType', val)}
                  style={styles.picker}
                >
                  <Picker.Item label="Contribution" value={TransactionType.Contribution} />
                  <Picker.Item label="Monthly Contribution" value={TransactionType.Monthly} />
                  <Picker.Item label="Loan Payment" value={TransactionType.Loan_Payment} />
                  <Picker.Item label="Volunteer Contribution" value={TransactionType.volunteer} />
                  <Picker.Item label="Expense Contribution" value={TransactionType.Expense} />
                </Picker>

                {/* Transaction Date Input */}
                <Text style={styles.label}>Contribution Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={formData[member.id]?.transactionDate || getTodayDate()}
                  onChangeText={(val) => updateForm(member.id, 'transactionDate', val)}
                />

                {/* Payment Method Picker */}
                <Text style={styles.label}>Payment Method</Text>
                <Picker
                  selectedValue={formData[member.id]?.paymentMethod || 'M-Pesa'}
                  onValueChange={(val) => updateForm(member.id, 'paymentMethod', val)}
                  style={styles.picker}
                >
                  <Picker.Item label="M-Pesa" value="M-Pesa" />
                  <Picker.Item label="Bank Transfer" value="Bank" />
                  <Picker.Item label="Cash" value="Cash" />
                  <Picker.Item label="Cheque" value="Cheque" />
                </Picker>

                {/* Description Input */}
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Description (optional)"
                  value={formData[member.id]?.description || ''}
                  onChangeText={(val) => updateForm(member.id, 'description', val)}
                  multiline
                  numberOfLines={3}
                />
              </View>
            ))
          )}
          
          {/* Add extra padding at bottom for FAB */}
          <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      {/* FAB - Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleSubmit}
        activeOpacity={0.8}
      >
        <View style={styles.fabContent}>
          <Text style={styles.fabIcon}>+</Text>
          <Text style={styles.fabText}>Submit</Text>
        </View>
      </TouchableOpacity>

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
    zIndex: 10,
  },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  scrollContainer: { 
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: { 
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1733a5ff', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  memberCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  memberName: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 10, 
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 10,
  },
  picker: { 
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginTop: 5,
  },
  
  // FAB Styles
  fab: {
    position: 'absolute',
    bottom: 90, // Above bottom navigation
    right: 20,
    backgroundColor: '#2E7D32',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#1B5E20',
    zIndex: 1000,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
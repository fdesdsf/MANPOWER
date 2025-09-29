import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import axios from 'axios';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

export default function ContributionSummaryScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    fetchGroups();
    fetchContributions(); // Initial load with all groups
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      fetchContributionsByGroup(selectedGroup);
    } else {
      fetchContributions();
    }
  }, [selectedGroup]);

  const fetchGroups = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchContributions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:8080/api/contributions');
      setContributions(response.data);
    } catch (error) {
      console.error('Failed to fetch contributions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContributionsByGroup = async (groupId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:8080/api/contributions/group/${groupId}`);
      setContributions(response.data);
    } catch (error) {
      console.error('Failed to fetch contributions by group:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = (items: { amount: number }[]) =>
    items.reduce((sum, item) => sum + item.amount, 0);

  const totalContributions = totalAmount(contributions);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.logoWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.appName}>
            <Text style={styles.black}>MAN</Text>
            <Text style={styles.red}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(superadmin)/dashboard')}>
          <Text style={styles.homeLink}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Contribution Summary</Text>
        <Text style={styles.subtitle}>Overview of group contributions and balances.</Text>

        <View style={styles.selectorContainer}>
          <Text style={styles.label}>Filter by Group:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedGroup}
              onValueChange={(value) => setSelectedGroup(value)}
              style={styles.picker}
            >
              <Picker.Item label="All Groups" value={undefined} />
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

        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total Contributions</Text>
              <Text style={styles.amount}>KES {totalContributions.toLocaleString()}</Text>
            </View>

            {/* Placeholder cards for expenses and loans — To be replaced when backend is ready */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total Expenses</Text>
              <Text style={styles.amount}>KES 0</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total Loans</Text>
              <Text style={styles.amount}>KES 0</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Net Balance</Text>
              <Text style={[styles.amount, { color: '#2E7D32' }]}>
                KES {totalContributions.toLocaleString()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => alert('📊 Report generation coming soon')}
            >
              <Text style={styles.reportText}>📄 Generate Contribution Report</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <SuperAdminBottomNav current="finance" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomColor: '#A5D6A7',
    borderBottomWidth: 1,
    elevation: 3,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  black: {
    color: '#000',
  },
  red: {
    color: '#D32F2F',
  },
  homeLink: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  container: {
    padding: 20,
    paddingBottom: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
  },
  selectorContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    overflow: 'hidden',
  },
  picker: {
    height: 45,
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  amount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 6,
  },
  reportButton: {
    marginTop: 30,
    backgroundColor: '#388E3C',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

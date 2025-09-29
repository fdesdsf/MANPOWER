// File: MyContributionsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

interface Contribution {
  id: string;
  transactionDate: string;
  amount: number;
  transactionType: string;
  paymentMethod: string;
  status: string;
  description: string;
}

export default function MyContributionsScreen() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [filterType, setFilterType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const id = await AsyncStorage.getItem('userId');
      const group = await AsyncStorage.getItem('groupId');
      const tenant = await AsyncStorage.getItem('tenantId');
      if (!id) {
        router.replace('/(auth)');
      } else {
        setUserId(id);
        setGroupId(group);
        setTenantId(tenant);
      }
    };
    loadUser();
  }, []);

  const fetchContributions = async (memberId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/contributions/member/${memberId}`);
      if (res.ok) {
        const data: Contribution[] = await res.json();
        setContributions(data);
      } else {
        console.error('Failed to fetch contributions');
      }
    } catch (err) {
      console.error('Error fetching contributions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchContributions(userId);
  }, [userId]);

  const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
  const currentBalance = totalContributed;

  const filteredContributions = contributions.filter((c) => {
    const matchesType = filterType === 'All' || c.transactionType === filterType;
    const matchesSearch =
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.amount.toString().includes(searchQuery);
    return matchesType && matchesSearch;
  });

  const pollPaymentStatus = async (orderTrackingId: string, memberId: string, contributionPayload: Omit<Contribution, 'id' | 'status'>) => {
    let attempts = 0;
    const maxAttempts = 20; // Poll for up to 100 seconds (5s * 20 attempts)
    const pollInterval = 5000; // Poll every 5 seconds

    return new Promise<void>(async (resolve, reject) => {
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`${BASE_URL}/payments/status/${orderTrackingId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'COMPLETED') {
              clearInterval(interval);
              // Payment successful, now post the contribution
              await postContribution(memberId, contributionPayload);
              resolve();
            } else if (data.status === 'FAILED') {
              clearInterval(interval);
              reject(new Error('Payment failed. Please try again.'));
            } else if (attempts >= maxAttempts) {
              clearInterval(interval);
              reject(new Error('Payment timed out. Please check your transaction status or try again.'));
            }
          } else {
            clearInterval(interval);
            reject(new Error('Failed to retrieve payment status.'));
          }
        } catch (err) {
          clearInterval(interval);
          console.error('Error polling payment status:', err);
          reject(new Error('Network error during payment status check.'));
        }
      }, pollInterval);
    });
  };

  const postContribution = async (memberId: string, contributionData: Omit<Contribution, 'id' | 'status'>) => {
    try {
      const res = await fetch(`${BASE_URL}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contributionData, memberId }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to record contribution: ${errorText}`);
      }
    } catch (error) {
      console.error('Error posting contribution:', error);
      throw error;
    }
  };

  const handlePesapalPayment = async () => {
    if (!amount || !userId || !groupId || !tenantId || !phoneNumber) {
      Alert.alert('Error', 'Please fill in all the required fields');
      return;
    }

    setIsProcessingPayment(true);
    setModalVisible(false);

    const paymentPayload = {
      amount: parseFloat(amount),
      phoneNumber,
      memberId: userId,
      groupId,
      tenantId,
      description: 'Contribution via Pesapal',
    };

    const contributionPayload: Omit<Contribution, 'id' | 'status'> = {
      amount: parseFloat(amount),
      transactionDate: new Date().toISOString().split('T')[0],
      transactionType: 'Contribution',
      paymentMethod: 'Pesapal',
      description: 'Contribution via Pesapal',
    };

    try {
      const initiateRes = await fetch(`${BASE_URL}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentPayload),
      });

      if (!initiateRes.ok) {
        const errorText = await initiateRes.text();
        throw new Error(errorText || 'Failed to initiate payment.');
      }

      const { orderTrackingId } = await initiateRes.json();
      Alert.alert(
        'Payment Initiated',
        'You will receive a prompt on your phone to enter your MPesa/Airtel PIN. Waiting for payment confirmation...'
      );

      await pollPaymentStatus(orderTrackingId, userId, contributionPayload);

      Alert.alert('Success', 'Your contribution has been successfully recorded!');
      setAmount('');
      setPhoneNumber('');
      await fetchContributions(userId);
    } catch (err: any) {
      console.error('Pesapal Payment Process Error:', err);
      Alert.alert('Payment Error', err.message || 'An unexpected error occurred during payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading || isProcessingPayment) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>
          {isProcessingPayment ? 'Processing payment...' : 'Loading contributions...'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content View (Non-scrollable) */}
      <View style={styles.mainContent}>
        <Text style={styles.title}>My Contributions</Text>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Contributed</Text>
            <Text style={styles.cardValue}>
              KES {totalContributed.toLocaleString('en-KE')}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Current Balance</Text>
            <Text style={styles.cardValue}>
              KES {currentBalance.toLocaleString('en-KE')}
            </Text>
          </View>
        </View>

        {/* Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by Type:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterOptions}>
              {['All', 'Monthly', 'Emergency', 'Contribution'].map((type) => (
                <TouchableOpacity key={type} onPress={() => setFilterType(type)}>
                  <Text
                    style={[
                      styles.filterOption,
                      filterType === type && styles.activeFilter,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search contributions using either the amount or the month..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Date</Text>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Amount</Text>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Type</Text>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Status</Text>
          <Text style={[styles.columnHeader, { flex: 1.5 }]}>Method</Text>
          <Text style={[styles.columnHeader, { flex: 2.5 }]}>Description</Text>
        </View>
      </View>

      {/* Contributions List (Scrollable) */}
      <ScrollView style={styles.tableScrollArea}>
        {filteredContributions.length > 0 ? (
          filteredContributions.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1 }]}>{item.transactionDate}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{item.amount.toLocaleString('en-KE')}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{item.transactionType}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{item.status}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.paymentMethod}</Text>
              <Text style={[styles.tableCell, { flex: 2.5 }]}>{item.description}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No contributions found.</Text>
        )}

        {/* Quick Actions at the bottom of the scroll view */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.quickActionIcon}>💰</Text>
            <Text style={styles.quickActionTitle}>Contribute</Text>
            <Text style={styles.quickActionSubtitle}>Add funds to your account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(member)/loans')}
          >
            <Text style={styles.quickActionIcon}>💳</Text>
            <Text style={styles.quickActionTitle}>Loans</Text>
            <Text style={styles.quickActionSubtitle}>View and manage your loans</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Contribution Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Make a Contribution</Text>

            <TextInput
              placeholder="Enter Amount"
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              placeholder="Enter Phone Number (07...)"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={styles.input}
              keyboardType="phone-pad"
            />

            <TouchableOpacity style={styles.modalBtn} onPress={handlePesapalPayment}>
              <Text style={styles.modalBtnText}>Contribute</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MemberBottomNav current="mycontributions" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FBE7',
  },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    paddingHorizontal: 10,
    backgroundColor: '#C8E6C9',
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
    elevation: 3,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 18, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#D32F2F' },
  returnButton: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },

  // New styles for the non-scrollable area
  mainContent: {
    paddingHorizontal: 15,
  },

  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 16 },
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    flex: 1,
    marginHorizontal: 5,
    elevation: 3,
  },
  cardLabel: { fontSize: 14, color: '#777' },
  cardValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  filterSection: { marginBottom: 10 },
  filterLabel: { fontSize: 16, marginBottom: 6 },
  filterOptions: { flexDirection: 'row', gap: 10 },
  filterOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#C8E6C9',
    borderRadius: 20,
    color: '#2E7D32',
    fontSize: 14,
    marginRight: 10,
  },
  activeFilter: {
    backgroundColor: '#81C784',
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#FFF',
  },

  // New styles for the tabular format
  tableScrollArea: {
    flex: 1, // This makes the scroll view take up the remaining space
    paddingHorizontal: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#388E3C',
  },
  columnHeader: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 5,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  tableCell: {
    textAlign: 'center',
    color: '#555',
    fontSize: 12,
    paddingHorizontal: 5,
  },
  
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 14, color: '#999' },
  
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
    gap: 10,
  },
  quickActionCard: {
    backgroundColor: '#2E8B57',
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 30,
    marginBottom: 6,
    color: '#FFF',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  quickActionSubtitle: {
    fontSize: 11,
    color: '#E0F2F1',
    textAlign: 'center',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 6,
    width: '100%',
    padding: 10,
    marginBottom: 15,
  },
  modalBtn: {
    backgroundColor: '#2E7D32',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' },
  modalClose: { marginTop: 10, color: '#D32F2F', fontWeight: 'bold' },
});
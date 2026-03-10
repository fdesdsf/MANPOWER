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
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

interface Contribution {
  id: string;
  transactionDate: string;
  amount: number;
  transactionType: string;
  paymentMethod: string;
  status: string;
  description: string;
}

// Add Member interface
interface Member {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

// Add TransactionType type
type TransactionType = 
  | 'Contribution' 
  | 'Expense' 
  | 'Loan_Payment' 
  | 'Monthly' 
  | 'volunteer';

// ========== ADD NEW INTERFACES FOR VOLUNTEER CAMPAIGNS ==========
interface VolunteerCampaign {
  id: string;
  campaignName: string;
  description: string;
  targetAmount: number | null;
  raisedAmount: number;
  progress: number;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isOpen: boolean;
}
// ================================================================

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
  const [reminderMessage, setReminderMessage] = useState<string>('');
  const [reminderType, setReminderType] = useState<'none' | 'warning' | 'urgent' | 'critical'>('none');
  const [lastContributionDate, setLastContributionDate] = useState<string>('');
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>('Contribution');

  // ========== ADD NEW STATE FOR VOLUNTEER CAMPAIGNS ==========
  const [openCampaigns, setOpenCampaigns] = useState<VolunteerCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<VolunteerCampaign | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [showCampaignSelector, setShowCampaignSelector] = useState(false);
  // ===========================================================

  useEffect(() => {
    const loadUser = async () => {
      console.log('Loading user data from AsyncStorage...');
      
      // FIXED: Use the correct keys that match your login screen
      const id = await AsyncStorage.getItem('userId');
      const group = await AsyncStorage.getItem('userGroupId'); // ← CHANGED from 'groupId' to 'userGroupId'
      const tenant = await AsyncStorage.getItem('userTenantId'); // ← CHANGED from 'tenantId' to 'userTenantId'
      
      console.log('Retrieved userId:', id);
      console.log('Retrieved userGroupId:', group);
      console.log('Retrieved userTenantId:', tenant);
      
      // Debug: List all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('All AsyncStorage keys:', allKeys);
      
      if (!id) {
        router.replace('/(auth)');
      } else {
        setUserId(id);
        setGroupId(group);
        setTenantId(tenant);
        
        // Log if groupId is null
        if (!group) {
          console.error('⚠️ WARNING: userGroupId is null or undefined!');
          
          // Try alternative keys that might exist
          const alternativeKeys = ['groupId', 'group', 'userGroup', 'memberGroupId'];
          for (const key of alternativeKeys) {
            const value = await AsyncStorage.getItem(key);
            if (value) {
              console.log(`Found ${key}: ${value}`);
              setGroupId(value);
              await AsyncStorage.setItem('userGroupId', value); // Save for future
              break;
            }
          }
        }
        
        // Fetch member data including phone number
        await fetchMemberData(id);
      }
    };
    loadUser();
  }, []);

  // Add function to fetch member data
  const fetchMemberData = async (memberId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/members/${memberId}`);
      if (res.ok) {
        const data: Member = await res.json();
        console.log('Member data:', data);
        setMemberData(data);
        // Set phone number to member's registered phone
        if (data.phoneNumber) {
          setPhoneNumber(data.phoneNumber);
        }
      } else {
        console.error('Failed to fetch member data');
      }
    } catch (err) {
      console.error('Error fetching member data:', err);
    }
  };

  // ========== FIXED: Fetch open volunteer campaigns with correct stats ==========
  const fetchOpenCampaigns = async () => {
    if (!groupId) {
      console.log('No group ID, cannot fetch campaigns');
      return;
    }
    
    setLoadingCampaigns(true);
    try {
      // First fetch all campaigns
      const response = await fetch(`${BASE_URL}/volunteer-campaigns/group/${groupId}`);
      if (response.ok) {
        const allCampaigns = await response.json();
        
        // Filter to only open campaigns and fetch their contributions
        const today = new Date().toISOString().split('T')[0];
        const openCampaignsPromises = allCampaigns
          .filter((c: any) => c.status === 'ACTIVE' && c.endDate >= today)
          .map(async (campaign: any) => {
            try {
              // Fetch contributions for this campaign
              const contributionsResponse = await fetch(
                `${BASE_URL}/volunteer-contributions/campaign/${campaign.id}`
              );
              
              let totalRaised = 0;
              if (contributionsResponse.ok) {
                const contributions = await contributionsResponse.json();
                totalRaised = contributions.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
              }
              
              // Calculate progress
              const progress = campaign.targetAmount && campaign.targetAmount > 0
                ? (totalRaised / campaign.targetAmount) * 100
                : 0;
              
              // Calculate days remaining
              const endDate = new Date(campaign.endDate);
              const currentDate = new Date();
              const daysRemaining = Math.max(0, Math.ceil(
                (endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
              ));
              
              return {
                id: campaign.id,
                campaignName: campaign.campaignName,
                description: campaign.description,
                targetAmount: campaign.targetAmount,
                raisedAmount: totalRaised,
                progress: progress,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                daysRemaining: daysRemaining,
                isOpen: true
              };
            } catch (error) {
              console.error(`Error fetching contributions for campaign ${campaign.id}:`, error);
              return {
                id: campaign.id,
                campaignName: campaign.campaignName,
                description: campaign.description,
                targetAmount: campaign.targetAmount,
                raisedAmount: 0,
                progress: 0,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                daysRemaining: 0,
                isOpen: true
              };
            }
          });
        
        const openCampaigns = await Promise.all(openCampaignsPromises);
        console.log('Open campaigns with correct stats:', openCampaigns);
        setOpenCampaigns(openCampaigns);
      } else {
        console.error('Failed to fetch campaigns');
        setOpenCampaigns([]);
      }
    } catch (error) {
      console.error('Error fetching open campaigns:', error);
      setOpenCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };
  // ===================================================================

  const fetchContributions = async (memberId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/contributions/member/${memberId}`);
      if (res.ok) {
        const data: Contribution[] = await res.json();
        setContributions(data);
        checkMonthlyContribution(data);
      } else {
        console.error('Failed to fetch contributions');
      }
    } catch (err) {
      console.error('Error fetching contributions:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkMonthlyContribution = (contributions: Contribution[]) => {
    // Filter only completed contributions
    const completedContributions = contributions.filter(
      c => c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed'
    );

    if (completedContributions.length === 0) {
      setReminderMessage('You haven\'t made any contributions yet. Please make your first contribution!');
      setReminderType('urgent');
      setLastContributionDate('Never');
      return;
    }

    // Sort by date descending and get the latest contribution
    const sortedContributions = [...completedContributions].sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

    const lastContribution = sortedContributions[0];
    const lastContributionDate = new Date(lastContribution.transactionDate);
    const currentDate = new Date();

    // Format the date for display
    const formattedDate = lastContributionDate.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    setLastContributionDate(formattedDate);

    // Check if last contribution was in the current month and year
    const isPaidThisMonth = 
      lastContributionDate.getMonth() === currentDate.getMonth() &&
      lastContributionDate.getFullYear() === currentDate.getFullYear();

    if (isPaidThisMonth) {
      setReminderMessage('');
      setReminderType('none');
      return;
    }

    // Calculate how many months have passed since last contribution
    const monthsDiff = 
      (currentDate.getFullYear() - lastContributionDate.getFullYear()) * 12 + 
      (currentDate.getMonth() - lastContributionDate.getMonth());

    if (monthsDiff === 1) {
      setReminderMessage('Reminder: You haven\'t made your contribution for this month yet.');
      setReminderType('warning');
    } else if (monthsDiff === 2) {
      setReminderMessage('Urgent: You haven\'t contributed for 2 months. Please make your payment soon.');
      setReminderType('urgent');
    } else if (monthsDiff >= 3) {
      setReminderMessage(`Critical: You haven't contributed for ${monthsDiff} months! Your account may be suspended.`);
      setReminderType('critical');
    } else {
      setReminderMessage('Please make your monthly contribution.');
      setReminderType('warning');
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

  // ========== MODIFIED: Handle transaction type selection ==========
  const handleTransactionTypeSelect = (type: TransactionType) => {
    setTransactionType(type);
    if (type === 'volunteer') {
      setShowCampaignSelector(true);
      fetchOpenCampaigns();
      setSelectedCampaign(null);
    } else {
      setShowCampaignSelector(false);
      setSelectedCampaign(null);
    }
  };
  // =================================================================

  const handleMpesaPayment = async () => {
  if (!amount || !userId || !phoneNumber) {
    Alert.alert('Error', 'Please fill in all the required fields');
    return;
  }

  // Check if groupId exists
  if (!groupId) {
    Alert.alert('Group Information Missing', 'We could not find your group information. Please try logging out and logging back in.');
    return;
  }

  // ========== ADD VALIDATION FOR VOLUNTEER CAMPAIGN SELECTION ==========
  if (transactionType === 'volunteer' && !selectedCampaign) {
    Alert.alert('Error', 'Please select a volunteer campaign to contribute to');
    return;
  }
  // ====================================================================

  // Validate phone number format for Kenya
  const phoneRegex = /^(07\d{8}|7\d{8}|\+2547\d{8}|2547\d{8})$/;
  const cleanedPhone = phoneNumber.trim();
  
  if (!phoneRegex.test(cleanedPhone)) {
    Alert.alert('Invalid Phone Number', 'Please enter a valid Kenyan phone number (e.g., 0712345678)');
    return;
  }

  setIsProcessingPayment(true);
  setModalVisible(false);

  try {
    // Convert to 254 format if needed
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    }

    // ========== MODIFIED: Include campaign ID in contributionId for volunteer payments ==========
    let contributionId = `MPESA-${Date.now()}`;
    if (transactionType === 'volunteer' && selectedCampaign) {
      contributionId = `VOL-${selectedCampaign.id.substring(0, 8)}-${Date.now()}`;
    }

    // ========== 🔴 FIXED: Build URL with campaignId ==========
    let url = `${BASE_URL}/payments/initiate-contribution?amount=${amount}&transactionType=${transactionType}&phone=${formattedPhone}&memberId=${userId}&groupId=${groupId}&contributionId=${contributionId}`;
    
    // 🔴 CRITICAL: Add campaignId for volunteer contributions
    if (transactionType === 'volunteer' && selectedCampaign) {
      url += `&campaignId=${selectedCampaign.id}`;
      console.log('🎯 Volunteer contribution with campaign:', {
        campaignId: selectedCampaign.id,
        campaignName: selectedCampaign.campaignName,
        amount,
        contributionId
      });
    }
    // ========================================================

    const response = await fetch(url, { method: 'POST' });
    const result = await response.json();
    
    if (result.status === 200) {
      Alert.alert(
        '✅ STK Push Sent',
        'Check your phone for M-Pesa prompt. Enter PIN to complete payment.'
      );
      setAmount('');
      setTransactionType('Contribution'); // Reset to default
      setSelectedCampaign(null); // Reset selected campaign
      setShowCampaignSelector(false); // Hide campaign selector
      if (memberData?.phoneNumber) {
        setPhoneNumber(memberData.phoneNumber);
      }
      // Refresh after 5 seconds
      setTimeout(() => fetchContributions(userId), 5000);
    } else {
      Alert.alert('❌ Failed', result.message || 'Payment initiation failed');
    }
  } catch (err: any) {
    console.error('Payment error:', err);
    Alert.alert('Error', err.message || 'Network error');
  } finally {
    setIsProcessingPayment(false);
  }
};

  const getReminderStyle = (): ViewStyle => {
    switch (reminderType) {
      case 'warning':
        return styles.warningReminder;
      case 'urgent':
        return styles.urgentReminder;
      case 'critical':
        return styles.criticalReminder;
      default:
        return {
          backgroundColor: 'transparent',
          borderLeftWidth: 0,
        };
    }
  };

  // Add function to handle opening modal
  const handleOpenContributionModal = () => {
    // Ensure phone number is set to member's registered number when opening modal
    if (memberData?.phoneNumber && (!phoneNumber || phoneNumber !== memberData.phoneNumber)) {
      setPhoneNumber(memberData.phoneNumber);
    }
    // Reset transaction type to default
    setTransactionType('Contribution');
    setSelectedCampaign(null);
    setShowCampaignSelector(false);
    setModalVisible(true);
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
            <Text style={styles.brandMan}>JUMUIYA</Text>
            <Text style={styles.brandPower}>CAPITAL</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Debug Info - Will show in console */}
      {!groupId && (
        <View style={styles.debugWarning}>
          <Text style={styles.debugWarningText}>⚠️ No groupId found. Payments may not work.</Text>
        </View>
      )}

      {/* Main Content - Everything in one scrollable area */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Title */}
        <Text style={styles.title}>My Contributions</Text>

        {/* Monthly Contribution Reminder */}
        {reminderType !== 'none' && (
          <View style={[styles.reminderContainer, getReminderStyle()]}>
            <Text style={styles.reminderIcon}>
              {reminderType === 'warning' ? '⚠️' : 
               reminderType === 'urgent' ? '🚨' : 
               '🔴'}
            </Text>
            <Text style={styles.reminderText}>{reminderMessage}</Text>
            <TouchableOpacity 
              style={styles.reminderButton}
              onPress={handleOpenContributionModal}
            >
              <Text style={styles.reminderButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Last Contribution 📅</Text>
            <Text style={styles.cardValue}>
              {lastContributionDate}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Current Balance 💰</Text>
            <Text style={styles.cardValue}>
              KES {currentBalance.toLocaleString('en-KE')}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleOpenContributionModal}
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

        {/* Filter Section - UPDATED to include all transaction types */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by Type:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterOptions}>
              {['All', 'Contribution', 'Monthly', 'volunteer', 'Loan_Payment', 'Expense'].map((type) => (
                <TouchableOpacity key={type} onPress={() => setFilterType(type)}>
                  <Text
                    style={[
                      styles.filterOption,
                      filterType === type && styles.activeFilter,
                    ]}
                  >
                    {type.replace('_', ' ')}
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
        
        {/* Contributions Table */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.columnHeader, { flex: 1 }]}>Date</Text>
            <Text style={[styles.columnHeader, { flex: 1 }]}>Amount</Text>
            <Text style={[styles.columnHeader, { flex: 1 }]}>Type</Text>
            <Text style={[styles.columnHeader, { flex: 1 }]}>Status</Text>
            <Text style={[styles.columnHeader, { flex: 1.5 }]}>Method</Text>
            <Text style={[styles.columnHeader, { flex: 2.5 }]}>Description</Text>
          </View>

          {/* Table Body */}
          {filteredContributions.length > 0 ? (
            filteredContributions.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1 }]}>{item.transactionDate}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>KES {item.amount.toLocaleString('en-KE')}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{item.transactionType}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{item.status}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.paymentMethod}</Text>
                <Text style={[styles.tableCell, { flex: 2.5 }]}>{item.description}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No contributions found.</Text>
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Contribution Modal - UPDATED with volunteer campaign selector */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Make Contribution</Text>

            <TextInput
              placeholder="Enter Amount (KES)"
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
              keyboardType="numeric"
            />

            {/* Transaction Type Dropdown - UPDATED with new handler */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>Contribution Type:</Text>
              <View style={styles.dropdownOptions}>
                {(['Contribution', 'Monthly', 'volunteer', 'Expense'] as TransactionType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.dropdownOption,
                      transactionType === type && styles.selectedDropdownOption
                    ]}
                    onPress={() => handleTransactionTypeSelect(type)}
                  >
                    <Text style={[
                      styles.dropdownOptionText,
                      transactionType === type && styles.selectedDropdownOptionText
                    ]}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ========== VOLUNTEER CAMPAIGN SELECTOR - UPDATED with fixed progress display ========== */}
            {showCampaignSelector && (
              <View style={styles.campaignSelectorContainer}>
                <Text style={styles.dropdownLabel}>Select Campaign:</Text>
                
                {loadingCampaigns ? (
                  <ActivityIndicator size="small" color="#4CAF50" style={styles.campaignLoader} />
                ) : openCampaigns.length === 0 ? (
                  <View style={styles.noCampaignsContainer}>
                    <Text style={styles.noCampaignsText}>No open volunteer campaigns available</Text>
                    <Text style={styles.noCampaignsSubtext}>Check back later or contact your group admin</Text>
                  </View>
                ) : (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.campaignScroll}
                  >
                    {openCampaigns.map((campaign) => (
                      <TouchableOpacity
                        key={campaign.id}
                        style={[
                          styles.campaignCard,
                          selectedCampaign?.id === campaign.id && styles.selectedCampaignCard
                        ]}
                        onPress={() => setSelectedCampaign(campaign)}
                      >
                        <Text style={styles.campaignCardTitle}>{campaign.campaignName}</Text>
                        <Text style={styles.campaignCardDescription} numberOfLines={2}>
                          {campaign.description}
                        </Text>
                        <View style={styles.campaignCardProgress}>
                          <View style={styles.campaignCardProgressBar}>
                            <View 
                              style={[
                                styles.campaignCardProgressFill,
                                { width: `${Math.min(campaign.progress, 100)}%` }
                              ]} 
                            />
                          </View>
                          <Text style={styles.campaignCardProgressText}>
                            {campaign.progress < 0.01 
                              ? '< 0.01%' 
                              : campaign.progress < 0.1 
                                ? campaign.progress.toFixed(2) + '%' 
                                : campaign.progress.toFixed(1) + '%'}
                          </Text>
                        </View>
                        <View style={styles.campaignCardFooter}>
                          <Text style={styles.campaignCardAmount}>
                            KES {campaign.raisedAmount.toLocaleString()}
                          </Text>
                          <Text style={styles.campaignCardDays}>
                            {campaign.daysRemaining} days left
                          </Text>
                        </View>
                        {selectedCampaign?.id === campaign.id && (
                          <View style={styles.selectedCampaignCheck}>
                            <Text style={styles.selectedCampaignCheckText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
            {/* ================================================= */}

            <View style={styles.phoneInputContainer}>
              <TextInput
                placeholder="Enter Phone Number (07...)"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={10}
              />
              {memberData?.phoneNumber === phoneNumber && (
                <View style={styles.phoneHint}>
                  <Text style={styles.phoneHintText}>✓ Your registered number</Text>
                </View>
              )}
              {memberData?.phoneNumber && memberData.phoneNumber !== phoneNumber && (
                <View style={styles.phoneHintWarning}>
                  <Text style={styles.phoneHintText}>⚠️ Different from registered number</Text>
                </View>
              )}
            </View>

            <Text style={styles.phoneNote}>
              {memberData?.phoneNumber ? 
                `Registered number: ${memberData.phoneNumber}. You can change it if needed.` : 
                'Enter the phone number you want to use for payment'}
            </Text>

            <TouchableOpacity 
              style={[
                styles.modalBtn, 
                (!amount || !phoneNumber || !groupId || 
                 (transactionType === 'volunteer' && !selectedCampaign)) && styles.disabledBtn
              ]} 
              onPress={handleMpesaPayment}
              disabled={!amount || !phoneNumber || !groupId || 
                       (transactionType === 'volunteer' && !selectedCampaign)}
            >
              <Text style={styles.modalBtnText}>
                {!groupId ? 'Loading group info...' : 
                 transactionType === 'volunteer' && selectedCampaign 
                   ? `Pay to: ${selectedCampaign.campaignName.substring(0, 20)}...` 
                   : 'Pay via MPESA'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                setModalVisible(false);
                // Reset transaction type to default
                setTransactionType('Contribution');
                setSelectedCampaign(null);
                setShowCampaignSelector(false);
                // Reset phone number to registered number when closing modal
                if (memberData?.phoneNumber) {
                  setPhoneNumber(memberData.phoneNumber);
                }
              }}
            >
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <MemberBottomNav current="mycontributions" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f4f4f4' 
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FBE7',
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#555' 
  },
  // Debug warning
  debugWarning: {
    backgroundColor: '#FFE082',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB300',
  },
  debugWarningText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontWeight: 'bold',
  },
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
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  logo: { 
    width: 40, 
    height: 40, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  brandText: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  brandMan: { 
    color: '#000000' 
  },
  brandPower: { 
    color: '#D32F2F' 
  },
  returnButton: { 
    fontSize: 14, 
    color: '#2E7D32', 
    fontWeight: '600' 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginVertical: 16,
    textAlign: 'center',
  },

  // Reminder styles
  reminderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  warningReminder: {
    backgroundColor: '#FFF3CD',
    borderLeftColor: '#FFA000',
  },
  urgentReminder: {
    backgroundColor: '#FFEAA7',
    borderLeftColor: '#F39C12',
  },
  criticalReminder: {
    backgroundColor: '#F8D7DA',
    borderLeftColor: '#DC3545',
  },
  reminderIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  reminderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  reminderButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  reminderButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Summary section
  summaryContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    flex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardLabel: { 
    fontSize: 14, 
    color: '#777',
    marginBottom: 4,
  },
  cardValue: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333' 
  },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  quickActionCard: {
    backgroundColor: '#2E8B57',
    flex: 1,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  quickActionIcon: {
    fontSize: 30,
    marginBottom: 8,
    color: '#FFF',
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#E0F2F1',
    textAlign: 'center',
  },

  // Filter section
  filterSection: { 
    marginBottom: 12 
  },
  filterLabel: { 
    fontSize: 16, 
    marginBottom: 8,
    fontWeight: '600',
    color: '#333',
  },
  filterOptions: { 
    flexDirection: 'row', 
    gap: 10 
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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

  // Search
  searchInput: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: '#FFF',
  },

  // Table container
  tableContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 10,
  },

  // Table styles
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  columnHeader: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 4,
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
    minHeight: 50,
  },
  tableCell: {
    textAlign: 'center',
    color: '#555',
    fontSize: 12,
    paddingHorizontal: 4,
  },
  
  // Empty state
  emptyState: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: { 
    textAlign: 'center', 
    fontSize: 14, 
    color: '#999' 
  },

  // Bottom spacing for scroll view
  bottomSpacing: {
    height: 20,
  },

  // Modal styles
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
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15 
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 6,
    width: '100%',
    padding: 12,
    marginBottom: 5,
    fontSize: 16,
  },
  
  // Dropdown styles
  dropdownContainer: {
    width: '100%',
    marginBottom: 15,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dropdownOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  selectedDropdownOption: {
    backgroundColor: '#4CAF50',
    borderColor: '#2E7D32',
  },
  dropdownOptionText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  selectedDropdownOptionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  
  // ========== VOLUNTEER CAMPAIGN SELECTOR STYLES ==========
  campaignSelectorContainer: {
    width: '100%',
    marginBottom: 15,
  },
  campaignLoader: {
    marginVertical: 20,
  },
  noCampaignsContainer: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  noCampaignsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  noCampaignsSubtext: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  campaignScroll: {
    flexDirection: 'row',
  },
  campaignCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    width: 220,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCampaignCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  campaignCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  campaignCardDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  campaignCardProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  campaignCardProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  campaignCardProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  campaignCardProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
  },
  campaignCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignCardAmount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  campaignCardDays: {
    fontSize: 11,
    color: '#FF9800',
  },
  selectedCampaignCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  selectedCampaignCheckText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // =======================================================

  phoneInputContainer: {
    width: '100%',
    marginBottom: 5,
  },
  phoneHint: {
    backgroundColor: '#E8F5E9',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  phoneHintWarning: {
    backgroundColor: '#FFF3E0',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  phoneHintText: {
    fontSize: 12,
    color: '#2E7D32',
    textAlign: 'center',
  },
  phoneNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  disabledBtn: {
    backgroundColor: '#9E9E9E',
  },
  modalBtn: {
    backgroundColor: '#2E7D32',
    padding: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: { 
    color: '#FFF', 
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalClose: { 
    marginTop: 12, 
    color: '#D32F2F', 
    fontWeight: 'bold',
    fontSize: 14,
  },
});

// 1. Frontend → [Amount: 1, Type: volunteer, CampaignID, Phone, MemberID] → PaymentController
// 2. PaymentController → Caches 'volunteer' + CampaignID with Contribution ID as key
// 3. PaymentController → Sends STK Push to MPESA with TransactionDesc: 'volunteer_CampaignName'
// 4. MPESA → Processes payment, sends callback
// 5. PaymentCallbackController → Retrieves campaign ID from cache using Contribution ID
// 6. Database → Saves contribution with volunteer_campaign_id = CampaignID
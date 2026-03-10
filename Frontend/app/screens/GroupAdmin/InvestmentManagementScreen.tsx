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
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';
// import { getInvestmentAdvice } from '../../../services/geminiService';

const API_BASE_URL = 'http://192.168.0.101:8080/api';

type Group = {
  id: string;
  groupName: string;
  description: string;
  creationDate: string;
  status: string;
};

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
};

type Investment = {
  id: string;
  investmentName: string;
  investmentType: string;
  amountInvested: number;
  currentValue: number;
  investmentDate: string;
  maturityDate: string;
  expectedReturnRate: number;
  actualReturnRate: number;
  riskLevel: string;
  status: string;
  description: string;
  approvedBy: {
    firstName: string;
    lastName: string;
  };
};

type FormData = {
  investmentName: string;
  investmentType: string;
  amountInvested: string;
  currentValue: string;
  investmentDate: string;
  maturityDate: string;
  expectedReturnRate: string;
  riskLevel: string;
  description: string;
  approvedBy: string;
};

// Investment status types to match backend
type InvestmentStatus = 'ACTIVE' | 'MATURED' | 'SOLD' | 'UNDERPERFORMING' | 'DEFAULTED';

export default function InvestmentManagementScreen(): React.JSX.Element {
  const router = useRouter();

  const [groupId, setGroupId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupBalance, setGroupBalance] = useState<number>(0);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Enhanced states for investment tracking
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [newCurrentValue, setNewCurrentValue] = useState('');
  const [updating, setUpdating] = useState(false);
  
  // NEW: Filter states
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [nearingMaturity, setNearingMaturity] = useState<Investment[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    investmentName: '',
    investmentType: '',
    amountInvested: '',
    currentValue: '',
    investmentDate: new Date().toISOString().split('T')[0],
    maturityDate: '',
    expectedReturnRate: '',
    riskLevel: 'MEDIUM',
    description: '',
    approvedBy: '',
  });

  // Investment type options
  const investmentTypes = [
    'STOCKS', 'BONDS', 'REAL_ESTATE', 'MUTUAL_FUNDS', 
    'FIXED_DEPOSIT', 'BUSINESS', 'OTHER'
  ];

  // Risk level options
  const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

  // Status options for filtering
  const statusOptions: InvestmentStatus[] = ['ACTIVE', 'MATURED', 'SOLD', 'UNDERPERFORMING', 'DEFAULTED'];

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const storedGroupId = await AsyncStorage.getItem('userGroupId');
        const storedAdminId = await AsyncStorage.getItem('userId');

        if (storedGroupId && storedAdminId) {
          setGroupId(storedGroupId);
          setAdminId(storedAdminId);
          await Promise.all([
            fetchGroupData(storedGroupId),
            fetchGroupMembers(storedGroupId),
            fetchGroupBalance(storedGroupId),
            fetchGroupInvestments(storedGroupId),
            fetchNearingMaturity(storedGroupId)
          ]);
        } else {
          Alert.alert('Error', 'User session is invalid. Please log in again.');
        }
      } catch (err) {
        console.error('❌ Failed to load storage:', err);
        Alert.alert('Error', 'Could not load user or group data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // NEW: Reusable API error handler
  const handleApiError = (error: unknown, defaultMessage: string) => {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message || defaultMessage;
      console.error(`❌ API Error:`, error.response?.data);
      Alert.alert('Error', message);
    } else {
      console.error('❌ Unexpected error:', error);
      Alert.alert('Error', defaultMessage);
    }
  };

  const fetchGroupData = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups/${gId}`);
      setGroupData(response.data);
    } catch (err) {
      handleApiError(err, 'Could not fetch group details.');
    }
  };

  const fetchGroupMembers = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/members/by-group/${gId}`);
      setMembers(response.data);
      
      // Set current user as default approver if they are a member
      const currentUserId = await AsyncStorage.getItem('userId');
      if (currentUserId && response.data.find((m: Member) => m.id === currentUserId)) {
        setFormData(prev => ({ ...prev, approvedBy: currentUserId }));
      }
    } catch (err) {
      handleApiError(err, 'Could not fetch group members.');
    }
  };

  // UPDATED: Balance calculation now includes investments
  const fetchGroupBalance = async (gId: string) => {
    try {
      // Calculate balance from contributions, expenses, AND investments
      const [contributionsRes, expensesRes, investmentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/contributions/group/${gId}`),
        axios.get(`${API_BASE_URL}/expenses`),
        axios.get(`${API_BASE_URL}/investments/group/${gId}`)
      ]);

      const totalContributions = contributionsRes.data.reduce(
        (sum: number, contribution: any) => sum + contribution.amount, 0
      );

      const groupExpenses = expensesRes.data.filter(
        (expense: any) => expense.group?.id === gId
      );
      
      const totalExpenses = groupExpenses.reduce(
        (sum: number, expense: any) => sum + expense.amount, 0
      );

      const groupInvestments = investmentsRes.data.filter(
        (investment: any) => investment.group?.id === gId
      );
      
      const totalInvested = groupInvestments.reduce(
        (sum: number, investment: any) => sum + investment.amountInvested, 0
      );

      // Available balance = Contributions - Expenses - Investments
      const balance = totalContributions - totalExpenses - totalInvested;
      setGroupBalance(balance);
    } catch (err) {
      console.error('❌ Error calculating balance:', err);
      setGroupBalance(0);
    }
  };

  const fetchGroupInvestments = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/investments/group/${gId}`);
      const investmentsData = response.data.map((investment: any) => ({
        id: investment.id,
        investmentName: investment.investmentName,
        investmentType: investment.investmentType,
        amountInvested: investment.amountInvested,
        currentValue: investment.currentValue,
        investmentDate: investment.investmentDate,
        maturityDate: investment.maturityDate,
        expectedReturnRate: investment.expectedReturnRate,
        actualReturnRate: investment.actualReturnRate,
        riskLevel: investment.riskLevel,
        status: investment.status,
        description: investment.description,
        approvedBy: investment.approvedBy || { firstName: 'Unknown', lastName: '' }
      })).sort((a: Investment, b: Investment) => 
        new Date(b.investmentDate).getTime() - new Date(a.investmentDate).getTime()
      );

      setInvestments(investmentsData);
    } catch (err) {
      handleApiError(err, 'Could not fetch investments.');
      setInvestments([]);
    }
  };

  // NEW: Fetch portfolio analytics from backend
  const fetchPortfolioAnalytics = async (gId: string) => {
    try {
      const [totalInvestedRes, portfolioValueRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/investments/group/${gId}/total-invested`),
        axios.get(`${API_BASE_URL}/investments/group/${gId}/portfolio-value`)
      ]);

      return {
        serverTotalInvested: totalInvestedRes.data,
        serverPortfolioValue: portfolioValueRes.data
      };
    } catch (err) {
      console.error('❌ Error fetching portfolio analytics:', err);
      return null;
    }
  };

  // NEW: Fetch investments nearing maturity
  const fetchNearingMaturity = async (gId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/investments/nearing-maturity?days=30`
      );
      setNearingMaturity(response.data);
    } catch (err) {
      console.error('❌ Error fetching nearing maturity:', err);
      setNearingMaturity([]);
    }
  };

  // NEW: Update investment current value (IMPROVED VERSION)
  const updateInvestmentValue = async () => {
    if (!selectedInvestment || !newCurrentValue || parseFloat(newCurrentValue) < 0) {
      Alert.alert('Validation', 'Please enter a valid current value.');
      return;
    }

    setUpdating(true);
    try {
      const currentValue = parseFloat(newCurrentValue);
      
      await axios.patch(
        `${API_BASE_URL}/investments/${selectedInvestment.id}/current-value?currentValue=${currentValue}`
      );

      Alert.alert(
        'Success', 
        `Investment value updated to KES ${currentValue.toLocaleString()}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setUpdateModalVisible(false);
              setNewCurrentValue('');
              setSelectedInvestment(null);
              fetchGroupInvestments(groupId);
              fetchGroupBalance(groupId); // Also refresh balance
            }
          }
        ]
      );

    } catch (err: unknown) {
      handleApiError(err, 'Failed to update investment value.');
    } finally {
      setUpdating(false);
    }
  };

  // NEW: Close investment (FIXED VERSION)
  // NEW: Close investment (ENHANCED DEBUGGING VERSION)
const closeInvestment = async (investment: Investment) => {
  console.log('🔴 TEST: Starting close investment process');
  
  // Test the API call directly without any dialogs
  try {
    console.log('🔄 Making direct API call...');
    const response = await axios.patch(
      `${API_BASE_URL}/investments/${investment.id}/status`,
      {},
      { params: { status: 'SOLD' } }
    );
    
    console.log('✅ SUCCESS: API Response:', response.status, response.data);
    
    // Refresh data
    fetchGroupInvestments(groupId);
    fetchGroupBalance(groupId);
    
    Alert.alert('Success', 'Investment closed successfully!');
    
  } catch (err: any) {
    console.error('❌ FAILED: API Error:', err.message);
    console.error('Response:', err.response?.data);
    Alert.alert('Error', `Failed: ${err.message}`);
  }
};

  // NEW: Get status color
  const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE': return '#4CAF50';      // Green
    case 'SOLD': return '#757575';        // Gray
    case 'MATURED': return '#2196F3';     // Blue
    case 'UNDERPERFORMING': return '#FF9800'; // Orange/Yellow (warning)
    case 'DEFAULTED': return '#F44336';   // Red (danger)
    default: return '#FF9800';            // Orange for unknown
  }
  };

  // NEW: Filter investments
  const filteredInvestments = investments.filter(inv => {
    const typeMatch = filterType === 'ALL' || inv.investmentType === filterType;
    const statusMatch = filterStatus === 'ALL' || inv.status === filterStatus;
    return typeMatch && statusMatch;
  });

  // NEW: Show update modal
  const showUpdateModal = (investment: Investment) => {
    setSelectedInvestment(investment);
    setNewCurrentValue(investment.currentValue.toString());
    setUpdateModalVisible(true);
  };

  const updateForm = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Auto-set current value to match amount invested if empty
    if (field === 'amountInvested' && !formData.currentValue) {
      setFormData(prev => ({
        ...prev,
        currentValue: value,
      }));
    }
  };

  // NEW: Enhanced date validation
  const validateDates = (): boolean => {
    if (formData.maturityDate && formData.investmentDate) {
      const investmentDate = new Date(formData.investmentDate);
      const maturityDate = new Date(formData.maturityDate);
      
      if (maturityDate <= investmentDate) {
        Alert.alert('Validation', 'Maturity date must be after investment date.');
        return false;
      }
    }
    return true;
  };

  const validateForm = (): boolean => {
    if (!formData.investmentName.trim()) {
      Alert.alert('Validation', 'Please enter an investment name.');
      return false;
    }
    
    if (!formData.investmentType) {
      Alert.alert('Validation', 'Please select an investment type.');
      return false;
    }

    if (!formData.amountInvested || parseFloat(formData.amountInvested) <= 0) {
      Alert.alert('Validation', 'Please enter a valid investment amount.');
      return false;
    }

    if (!formData.approvedBy) {
      Alert.alert('Validation', 'Please select who approved this investment.');
      return false;
    }

    // Validate return rate
    if (formData.expectedReturnRate && parseFloat(formData.expectedReturnRate) < 0) {
      Alert.alert('Validation', 'Return rate cannot be negative.');
      return false;
    }

    // Add date validation
    if (!validateDates()) {
      return false;
    }

    // Check if group has sufficient balance
    const investmentAmount = parseFloat(formData.amountInvested);
    
    if (investmentAmount > groupBalance) {
      Alert.alert(
        'Insufficient Funds', 
        `Investment amount (KES ${investmentAmount.toLocaleString()}) exceeds available balance (KES ${groupBalance.toLocaleString()}).`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !groupData) {
      return;
    }

    setSubmitting(true);
    try {
      const approvedByMember = members.find(m => m.id === formData.approvedBy);
      
      if (!approvedByMember) {
        Alert.alert('Error', 'Selected approver not found in group members.');
        return;
      }

      const payload = {
        group: {
          id: groupData.id,
        },
        investmentName: formData.investmentName,
        investmentType: formData.investmentType,
        amountInvested: parseFloat(formData.amountInvested),
        currentValue: parseFloat(formData.currentValue || formData.amountInvested),
        investmentDate: `${formData.investmentDate}T00:00:00.000Z`,
        maturityDate: formData.maturityDate ? `${formData.maturityDate}T00:00:00.000Z` : null,
        expectedReturnRate: formData.expectedReturnRate ? parseFloat(formData.expectedReturnRate) : null,
        riskLevel: formData.riskLevel,
        status: 'ACTIVE',
        description: formData.description,
        approvedBy: {
          id: approvedByMember.id,
        },
        createdBy: adminId,
        modifiedBy: adminId,
        mansoftTenantId: await AsyncStorage.getItem('mansoftTenantId') || 'tenant-001',
      };

      console.log('Submitting investment payload:', JSON.stringify(payload, null, 2));

      await axios.post(`${API_BASE_URL}/investments`, payload);

      Alert.alert(
        'Success', 
        `Investment of KES ${parseFloat(formData.amountInvested).toLocaleString()} created successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form and refresh ALL data
              setFormData({
                investmentName: '',
                investmentType: '',
                amountInvested: '',
                currentValue: '',
                investmentDate: new Date().toISOString().split('T')[0],
                maturityDate: '',
                expectedReturnRate: '',
                riskLevel: 'MEDIUM',
                description: '',
                approvedBy: adminId,
              });
              
              // ✅ Refresh both balance and investments
              fetchGroupBalance(groupId);
              fetchGroupInvestments(groupId);
              fetchNearingMaturity(groupId);
            }
          }
        ]
      );

    } catch (err: unknown) {
      handleApiError(err, 'Failed to create investment.');
    } finally {
      setSubmitting(false);
    }
  };

  const investmentAmount = parseFloat(formData.amountInvested) || 0;
  const remainingBalance = groupBalance - investmentAmount;

  // Calculate portfolio performance
  const totalPortfolioValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
  const totalInvested = investments.reduce((sum, inv) => sum + inv.amountInvested, 0);
  const portfolioReturn = totalInvested > 0 ? ((totalPortfolioValue - totalInvested) / totalInvested) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            JUMUIYA<Text style={{ color: '#4CAF50' }}>CAPITAL</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Investment Management</Text>
        
        {/* Balance Information */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available for Investment</Text>
          <Text style={styles.balanceAmount}>KES {groupBalance.toLocaleString()}</Text>
          
          {investmentAmount > 0 && (
            <View style={styles.balancePreview}>
              <Text style={styles.remainingLabel}>Balance After Investment:</Text>
              <Text style={[
                styles.remainingAmount,
                { color: remainingBalance >= 0 ? '#2E7D32' : '#D32F2F' }
              ]}>
                KES {remainingBalance.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Portfolio Summary */}
        {investments.length > 0 && (
          <View style={styles.portfolioCard}>
            <Text style={styles.portfolioTitle}>Portfolio Summary</Text>
            <View style={styles.portfolioRow}>
              <View style={styles.portfolioItem}>
                <Text style={styles.portfolioLabel}>Total Invested</Text>
                <Text style={styles.portfolioValue}>KES {totalInvested.toLocaleString()}</Text>
              </View>
              <View style={styles.portfolioItem}>
                <Text style={styles.portfolioLabel}>Current Value</Text>
                <Text style={styles.portfolioValue}>KES {totalPortfolioValue.toLocaleString()}</Text>
              </View>
              <View style={styles.portfolioItem}>
                <Text style={styles.portfolioLabel}>Return</Text>
                <Text style={[
                  styles.portfolioReturn,
                  { color: portfolioReturn >= 0 ? '#2E7D32' : '#D32F2F' }
                ]}>
                  {portfolioReturn.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* NEW: Nearing Maturity Alert */}
        {nearingMaturity.length > 0 && (
          <View style={styles.nearingMaturitySection}>
            <Text style={styles.warningTitle}>⚠️ Investments Nearing Maturity</Text>
            <Text style={styles.warningText}>
              {nearingMaturity.length} investment(s) maturing in the next 30 days
            </Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" />
        ) : (
          <>
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>New Investment</Text>
              
              <Text style={styles.label}>Investment Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Tech Mutual Fund, Real Estate Property"
                value={formData.investmentName}
                onChangeText={(val) => updateForm('investmentName', val)}
              />

              <Text style={styles.label}>Investment Type *</Text>
              <Picker
                selectedValue={formData.investmentType}
                onValueChange={(val) => updateForm('investmentType', val)}
                style={styles.picker}
              >
                <Picker.Item label="Select investment type..." value="" />
                {investmentTypes.map((type) => (
                  <Picker.Item 
                    key={type} 
                    label={type.replace('_', ' ')} 
                    value={type} 
                  />
                ))}
              </Picker>

              <Text style={styles.label}>Amount Invested (KES) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                keyboardType="numeric"
                value={formData.amountInvested}
                onChangeText={(val) => updateForm('amountInvested', val)}
              />

              <Text style={styles.label}>Current Value (KES)</Text>
              <TextInput
                style={styles.input}
                placeholder="Current market value"
                keyboardType="numeric"
                value={formData.currentValue}
                onChangeText={(val) => updateForm('currentValue', val)}
              />

              <Text style={styles.label}>Investment Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={formData.investmentDate}
                onChangeText={(val) => updateForm('investmentDate', val)}
              />

              <Text style={styles.label}>Maturity Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD (optional)"
                value={formData.maturityDate}
                onChangeText={(val) => updateForm('maturityDate', val)}
              />

              <Text style={styles.label}>Expected Return Rate (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="Expected annual return"
                keyboardType="numeric"
                value={formData.expectedReturnRate}
                onChangeText={(val) => updateForm('expectedReturnRate', val)}
              />

              <Text style={styles.label}>Risk Level</Text>
              <Picker
                selectedValue={formData.riskLevel}
                onValueChange={(val) => updateForm('riskLevel', val)}
                style={styles.picker}
              >
                {riskLevels.map((level) => (
                  <Picker.Item 
                    key={level} 
                    label={level} 
                    value={level} 
                  />
                ))}
              </Picker>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Investment details, strategy, notes..."
                value={formData.description}
                onChangeText={(val) => updateForm('description', val)}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Approved By *</Text>
              <Picker
                selectedValue={formData.approvedBy}
                onValueChange={(val) => updateForm('approvedBy', val)}
                style={styles.picker}
              >
                <Picker.Item label="Select approver..." value="" />
                {members.map((member) => (
                  <Picker.Item 
                    key={member.id} 
                    label={`${member.firstName} ${member.lastName} (${member.role})`} 
                    value={member.id} 
                  />
                ))}
              </Picker>

              <Text style={styles.helperText}>
                * Investments will be deducted from the group's available balance
              </Text>
            </View>

            <TouchableOpacity 
              style={[
                styles.submitBtn, 
                submitting && styles.submitBtnDisabled
              ]} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  Create Investment {investmentAmount > 0 && `(KES ${investmentAmount.toLocaleString()})`}
                </Text>
              )}
            </TouchableOpacity>

            {/* Investment Portfolio Section */}
            <View style={styles.portfolioSection}>
              <View style={styles.portfolioHeader}>
                <Text style={styles.portfolioSectionTitle}>Investment Portfolio</Text>
                <Text style={styles.portfolioCount}>({filteredInvestments.length} investments)</Text>
              </View>

              {/* NEW: Filter Controls */}
              <View style={styles.filterContainer}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Type:</Text>
                  <Picker
                    selectedValue={filterType}
                    onValueChange={setFilterType}
                    style={styles.filterPicker}
                  >
                    <Picker.Item label="All Types" value="ALL" />
                    {investmentTypes.map(type => (
                      <Picker.Item key={type} label={type.replace('_', ' ')} value={type} />
                    ))}
                  </Picker>
                </View>
                
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Status:</Text>
                  <Picker
                    selectedValue={filterStatus}
                    onValueChange={setFilterStatus}
                    style={styles.filterPicker}
                  >
                    <Picker.Item label="All Statuses" value="ALL" />
                    {statusOptions.map(status => (
                      <Picker.Item key={status} label={status} value={status} />
                    ))}
                  </Picker>
                </View>
              </View>

              {filteredInvestments.length === 0 ? (
                <Text style={styles.noInvestments}>
                  {investments.length === 0 ? 'No investments yet' : 'No investments match your filters'}
                </Text>
              ) : (
                filteredInvestments.map((investment) => (
                  <View key={investment.id} style={styles.investmentCard}>
                    <View style={styles.investmentHeader}>
                      <Text style={styles.investmentName}>{investment.investmentName}</Text>
                      <View style={[
                        styles.statusBadge,
                        { 
                          backgroundColor: getStatusColor(investment.status)
                        }
                      ]}>
                        <Text style={styles.statusText}>{investment.status}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.investmentDetails}>
                      <Text style={styles.investmentType}>{investment.investmentType.replace('_', ' ')}</Text>
                      <Text style={styles.riskLevel}>Risk: {investment.riskLevel}</Text>
                    </View>

                    <View style={styles.investmentFinancials}>
                      <View style={styles.financialItem}>
                        <Text style={styles.financialLabel}>Invested</Text>
                        <Text style={styles.financialValue}>KES {investment.amountInvested.toLocaleString()}</Text>
                      </View>
                      <View style={styles.financialItem}>
                        <Text style={styles.financialLabel}>Current</Text>
                        <Text style={styles.financialValue}>KES {investment.currentValue.toLocaleString()}</Text>
                      </View>
                      <View style={styles.financialItem}>
                        <Text style={styles.financialLabel}>Return</Text>
                        <Text style={[
                          styles.returnValue,
                          { 
                            color: (investment.actualReturnRate || 0) >= 0 ? '#2E7D32' : '#D32F2F',
                            fontWeight: 'bold'
                          }
                        ]}>
                          {(investment.actualReturnRate || 0).toFixed(2)}%
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    {investment.status === 'ACTIVE' && (
                      <View style={styles.investmentActions}>
                        <TouchableOpacity 
                          style={styles.updateButton}
                          onPress={() => showUpdateModal(investment)}
                        >
                          <Text style={styles.updateButtonText}>Update Value</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.closeButton}
                          onPress={() => closeInvestment(investment)}
                        >
                          <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {investment.description && (
                      <Text style={styles.investmentDescription}>{investment.description}</Text>
                    )}
                    
                    <View style={styles.investmentFooter}>
                      <View>
                        <Text style={styles.investmentDate}>
                          Started: {new Date(investment.investmentDate).toDateString()}
                        </Text>
                        {investment.maturityDate && (
                          <Text style={[
                            styles.maturityDate,
                            { color: new Date(investment.maturityDate) < new Date() ? '#D32F2F' : '#F44336' }
                          ]}>
                            Matures: {new Date(investment.maturityDate).toDateString()}
                          </Text>
                        )}
                        <Text style={styles.lastUpdated}>
                          Track your investment performance regularly
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Update Investment Modal */}
      <Modal
        visible={updateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setUpdateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Update {selectedInvestment?.investmentName}
            </Text>
            
            <Text style={styles.label}>Current Market Value (KES) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current value"
              keyboardType="numeric"
              value={newCurrentValue}
              onChangeText={setNewCurrentValue}
            />

            {selectedInvestment && newCurrentValue && (
              <View style={styles.returnPreview}>
                <Text style={styles.returnPreviewText}>
                  New Return: {((parseFloat(newCurrentValue) - selectedInvestment.amountInvested) / selectedInvestment.amountInvested * 100).toFixed(2)}%
                </Text>
                <Text style={styles.returnPreviewSubtext}>
                  Previous: {selectedInvestment.actualReturnRate?.toFixed(2)}%
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setUpdateModalVisible(false);
                  setNewCurrentValue('');
                  setSelectedInvestment(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.updateModalButton]}
                onPress={updateInvestmentValue}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.updateButtonText}>Update Value</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <GroupAdminBottomNav current="none" />
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
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#1733a5ff', 
    marginBottom: 10,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceLabel: { 
    fontSize: 16, 
    color: '#666', 
    marginBottom: 8,
    fontWeight: '600',
  },
  balanceAmount: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#2E7D32',
  },
  balancePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  remainingLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  remainingAmount: { fontSize: 16, fontWeight: 'bold' },
  portfolioCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
  },
  portfolioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  portfolioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portfolioItem: {
    alignItems: 'center',
    flex: 1,
  },
  portfolioLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  portfolioValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  portfolioReturn: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // NEW: Nearing Maturity Styles
  nearingMaturitySection: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 5,
  },
  warningText: {
    fontSize: 14,
    color: '#FF9800',
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E3F2FD',
    paddingBottom: 10,
  },
  label: { 
    fontWeight: 'bold', 
    marginBottom: 8, 
    color: '#333',
    fontSize: 15,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderColor: '#ddd',
    borderWidth: 1,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  picker: { 
    backgroundColor: '#f9f9f9', 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#90CAF9',
  },
  submitBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16,
  },
  // Portfolio Section Styles
  portfolioSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    elevation: 2,
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    paddingBottom: 8,
  },
  portfolioSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  portfolioCount: {
    fontSize: 14,
    color: '#666',
  },
  // NEW: Filter Styles
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  filterPicker: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  noInvestments: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  investmentCard: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  investmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  investmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  investmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  investmentType: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  riskLevel: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  investmentFinancials: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
  },
  financialItem: {
    alignItems: 'center',
    flex: 1,
  },
  financialLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  financialValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  returnValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  investmentDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  investmentFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
  },
  investmentDate: {
    fontSize: 10,
    color: '#888',
  },
  maturityDate: {
    fontSize: 10,
    marginTop: 2,
  },
  // Investment tracking styles
  investmentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 8,
  },
  updateButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 5,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginLeft: 5,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  lastUpdated: {
    fontSize: 10,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  updateModalButton: {
    backgroundColor: '#2196F3',
  },
  returnPreview: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 6,
    marginBottom: 15,
  },
  returnPreviewText: {
    color: '#1565C0',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14,
  },
  returnPreviewSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
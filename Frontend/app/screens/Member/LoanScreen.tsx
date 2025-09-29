import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

// --- INTERFACES ---

interface MemberDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  joinDate: string;
  status: string;
  role: string;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
}

interface GroupDetails {
  id: string;
  groupName: string;
  description: string;
  creationDate: string;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
  status: string;
  members: string[] | MemberDetails[];
}

type LoanItem = {
  id: string;
  member: MemberDetails;
  group: GroupDetails;
  amount: number;
  interestRate: number;
  startDate: string;
  dueDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'PAID' | 'OVERDUE';
  outstandingBalance: number;
  totalPaid: number | null;
  reason: string;
  description: string;
  approvedBy?: MemberDetails | null;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
};

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  transactionType: string;
  status: string;
  description: string;
}

interface LoanScheduleItem {
  period: number;
  month: string;
  principal: number;
  interestRate: number;
  interestAmount: number;
  monthlyRepayment: number;
  refinance: number;
  deposit: number;
  balance: number;
}

// --- COMPONENT START ---

export default function LoanScreen() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'PAID' | 'OVERDUE'>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [loanAmountInput, setLoanAmountInput] = useState('');
  const [loanReason, setLoanReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberData, setMemberData] = useState<MemberDetails | null>(null);
  const [totalContributions, setTotalContributions] = useState<number>(0);
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [loanSchedule, setLoanSchedule] = useState<LoanScheduleItem[]>([]);

  const MIN_CONTRIBUTION_FOR_LOAN = 5000;
  const MAX_LOAN_FACTOR = 3;
  const DEFAULT_INTEREST_RATE = 0.10;
  const DEFAULT_REPAYMENT_MONTHS = 6;

  // Calculate loan schedule function
  const calculateLoanSchedule = (
    loanAmount: number, 
    interestRate: number, 
    repaymentMonths: number,
    startDate: string
  ): LoanScheduleItem[] => {
    const schedule: LoanScheduleItem[] = [];
    const monthlyInterestRate = interestRate / 100 / 12;
    const principalPayment = loanAmount / repaymentMonths;
    let balance = loanAmount;
    
    const start = new Date(startDate);
    
    for (let i = 0; i <= repaymentMonths; i++) {
      const currentDate = new Date(start);
      currentDate.setMonth(start.getMonth() + i);
      
      const monthYear = currentDate.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });

      if (i === 0) {
        // First period (grace period)
        schedule.push({
          period: i + 1,
          month: monthYear,
          principal: 0,
          interestRate: interestRate,
          interestAmount: 0,
          monthlyRepayment: 0,
          refinance: 0,
          deposit: 0,
          balance: balance
        });
      } else {
        const interestAmount = balance * monthlyInterestRate;
        const monthlyRepayment = principalPayment + interestAmount;
        
        schedule.push({
          period: i + 1,
          month: monthYear,
          principal: principalPayment,
          interestRate: interestRate,
          interestAmount: interestAmount,
          monthlyRepayment: monthlyRepayment,
          refinance: 0,
          deposit: 0,
          balance: balance - principalPayment
        });
        
        balance -= principalPayment;
      }
    }
    
    return schedule;
  };

  // View loan schedule
  const viewLoanSchedule = (loan: LoanItem) => {
    const schedule = calculateLoanSchedule(
      loan.amount,
      loan.interestRate,
      DEFAULT_REPAYMENT_MONTHS,
      loan.startDate
    );
    setLoanSchedule(schedule);
    setSelectedLoan(loan);
    setScheduleModalVisible(true);
  };

  const fetchData = useCallback(async (currentMemberId: string) => {
    if (!currentMemberId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const memberRes = await fetch(`${BASE_URL}/members/${currentMemberId}`);
      if (memberRes.ok) {
        const member: MemberDetails = await memberRes.json();
        setMemberData(member);
      } else {
        console.error('Failed to fetch member details:', memberRes.status, await memberRes.text());
        Alert.alert('Error', 'Could not load your member profile. Please try again.');
      }

      const contributionsRes = await fetch(`${BASE_URL}/contributions/member/${currentMemberId}`);
      if (contributionsRes.ok) {
        const data: Contribution[] = await contributionsRes.json();
        const sum = data.reduce((acc, current) => {
          if (current.transactionType === 'Contribution' && current.status === 'Completed') {
            return acc + current.amount;
          }
          return acc;
        }, 0);
        setTotalContributions(sum);
      } else {
        console.error('Failed to fetch contributions:', contributionsRes.status, await contributionsRes.text());
        Alert.alert('Error', 'Could not load your contributions. Loan eligibility might be inaccurate.');
      }

      const loansRes = await fetch(`${BASE_URL}/loans`);
      if (loansRes.ok) {
        const allLoans: LoanItem[] = await loansRes.json();
        const userLoans = allLoans.filter((loan) => loan.member?.id === currentMemberId);
        setLoans(userLoans);
      } else {
        console.error('Failed to fetch loans:', loansRes.status, await loansRes.text());
        Alert.alert('Error', 'Could not load your loans. Please try again.');
      }
    } catch (err) {
      console.error('Network or parsing error during data fetch:', err);
      Alert.alert('Connection Error', 'Failed to connect to the server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadAndFetch = async () => {
      const storedMemberId = await AsyncStorage.getItem('userId');
      if (!storedMemberId) {
        router.replace('/(auth)');
        return;
      }
      setMemberId(storedMemberId);
      fetchData(storedMemberId);
    };
    loadAndFetch();
  }, [fetchData]);

  const submitLoanRequest = async () => {
    if (!loanAmountInput || !loanReason) {
      Alert.alert('Validation Error', 'Please enter both the loan amount and reason.');
      return;
    }
    const requestedAmount = parseFloat(loanAmountInput);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive loan amount.');
      return;
    }

    if (!memberId || !memberData) {
      Alert.alert('Error', 'Member data is missing. Please refresh the app.');
      console.error('Missing data for loan submission: memberId', memberId, 'memberData', memberData);
      return;
    }

    if (totalContributions < MIN_CONTRIBUTION_FOR_LOAN) {
      Alert.alert(
        'Loan Ineligible',
        `You need a minimum total contribution of KES ${MIN_CONTRIBUTION_FOR_LOAN.toLocaleString('en-KE')} to apply for a loan. Your current total contribution is KES ${totalContributions.toLocaleString('en-KE')}.`
      );
      return;
    }

    const maxEligibleLoan = totalContributions * MAX_LOAN_FACTOR;
    if (requestedAmount > maxEligibleLoan) {
      Alert.alert(
        'Loan Limit Exceeded',
        `Based on your total contributions (KES ${totalContributions.toLocaleString('en-KE')}), the maximum loan you can apply for is KES ${maxEligibleLoan.toLocaleString('en-KE')}.`
      );
      return;
    }

    const hasActiveOrPendingLoan = loans.some(
      (loan) => ['PENDING', 'APPROVED', 'ACTIVE', 'OVERDUE'].includes(loan.status) && loan.outstandingBalance > 0
    );
    if (hasActiveOrPendingLoan) {
      Alert.alert(
        'Existing Loan',
        'You have an active, pending, or overdue loan. Please settle it before applying for a new one.'
      );
      return;
    }

    setIsSubmittingLoan(true);
    setModalVisible(false);

    try {
      const groupsRes = await fetch(`${BASE_URL}/groups`);
      if (!groupsRes.ok) {
        throw new Error('Failed to fetch groups to determine member affiliation.');
      }
      const allGroups: GroupDetails[] = await groupsRes.json();

      const memberGroup = allGroups.find(group => {
        if (Array.isArray(group.members) && typeof group.members[0] === 'object' && group.members[0] !== null) {
          const membersAsObjects = group.members as MemberDetails[];
          return membersAsObjects.some(member => member.id === memberData.id);
        }
        if (Array.isArray(group.members) && typeof group.members[0] === 'string') {
          return (group.members as string[]).includes(memberData.id);
        }
        return false;
      });

      if (!memberGroup) {
        throw new Error('Could not find the member\'s group. Loan cannot be submitted.');
      }

      const newLoanPayload = {
        member: { id: memberData.id },
        group: { id: memberGroup.id },
        amount: requestedAmount,
        interestRate: DEFAULT_INTEREST_RATE * 100,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(new Date().setMonth(new Date().getMonth() + DEFAULT_REPAYMENT_MONTHS)).toISOString().split('T')[0],
        status: 'PENDING',
        outstandingBalance: requestedAmount,
        reason: loanReason,
        approvedBy: { id: memberData.id },
        mansoftTenantId: memberData.mansoftTenantId,
      };

      console.log('Loan Request Payload (Final Format):', JSON.stringify(newLoanPayload, null, 2));

      const res = await fetch(`${BASE_URL}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLoanPayload),
      });

      if (res.ok) {
        Alert.alert('Success', 'Your loan request has been submitted and is pending approval!');
        setLoanAmountInput('');
        setLoanReason('');
        fetchData(memberId);
      } else {
        const errorDetail = await res.text();
        console.error('Loan submission API error:', res.status, errorDetail);
        Alert.alert('Submission Failed', `Failed to submit loan request: ${errorDetail || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Network or logic error during loan submission:', err);
      Alert.alert('Error', err.message || 'Could not connect to the server to submit your loan request.');
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const getLoanStatusStyle = (status: LoanItem['status']) => {
    switch (status) {
      case 'PENDING':
        return { color: '#FFA500' };
      case 'APPROVED':
        return { color: '#4CAF50' };
      case 'ACTIVE':
        return { color: '#2196F3' };
      case 'REJECTED':
        return { color: '#D32F2F' };
      case 'PAID':
        return { color: '#1B5E20' };
      case 'OVERDUE':
        return { color: '#FF4500' };
      default:
        return { color: '#333' };
    }
  };

  if (loading || isSubmittingLoan) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#388E3C" />
        <Text style={styles.loadingText}>
          {isSubmittingLoan ? 'Submitting loan request...' : 'Loading your financial data...'}
        </Text>
      </SafeAreaView>
    );
  }

  const filteredLoans = loans.filter(loan => filter === 'All' || loan.status === filter);
  const isLoanEligible = totalContributions >= MIN_CONTRIBUTION_FOR_LOAN;
  const maxEligibleLoanText = isLoanEligible
    ? `KES ${(totalContributions * MAX_LOAN_FACTOR).toLocaleString('en-KE')}`
    : 'Not Eligible';
  const maxEligibleLoanColor = isLoanEligible ? styles.summaryCardValue : styles.ineligibleText;

  const LoanTableRow = ({ item }: { item: LoanItem }) => (
    <TouchableOpacity 
      style={styles.tableRow} 
      onPress={() => viewLoanSchedule(item)}
    >
      <Text style={styles.tableCell}>{item.startDate}</Text>
      <Text style={[styles.tableCell, styles.amountCell]}>KES {item.amount.toLocaleString('en-KE')}</Text>
      <Text style={[styles.tableCell, getLoanStatusStyle(item.status), { fontWeight: 'bold' }]}>{item.status}</Text>
      <Text style={styles.tableCell}>KES {(item.totalPaid ?? 0).toLocaleString('en-KE')}</Text>
      <Text style={styles.tableCell}>KES {item.outstandingBalance.toLocaleString('en-KE')}</Text>
      <Text style={styles.tableCell}>{item.dueDate}</Text>
      <Text style={styles.tableCell}>{item.reason}</Text>
      <Text style={styles.tableCell}>{item.interestRate}%</Text>
    </TouchableOpacity>
  );

  const LoanScheduleRow = ({ item }: { item: LoanScheduleItem }) => (
    <View style={styles.scheduleRow}>
      <Text style={styles.scheduleCell}>{item.period}</Text>
      <Text style={styles.scheduleCell}>{item.month}</Text>
      <Text style={styles.scheduleCell}>{item.principal.toFixed(2)}</Text>
      <Text style={styles.scheduleCell}>{item.interestRate.toFixed(1)}%</Text>
      <Text style={styles.scheduleCell}>{item.interestAmount.toFixed(2)}</Text>
      <Text style={styles.scheduleCell}>{item.monthlyRepayment.toFixed(2)}</Text>
      <Text style={styles.scheduleCell}>{item.balance.toFixed(2)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header (Top Bar) */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.contributionsButton} onPress={() => router.replace('/(member)/mycontributions')}>
          <Text style={styles.contributionsButtonText}>↩️ Contributions</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>My Loans</Text>
        </View>

        {/* Summary Cards Section */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.totalContributionsCard]}>
            <Text style={styles.summaryCardLabel}>Total Contributions</Text>
            <Text style={styles.summaryCardValue}>KES {totalContributions.toLocaleString('en-KE')}</Text>
          </View>
          <View style={[styles.summaryCard, styles.maxLoanCard]}>
            <Text style={styles.summaryCardLabel}>Max Eligible Loan</Text>
            <Text style={maxEligibleLoanColor}>
              {maxEligibleLoanText}
            </Text>
          </View>
        </View>

        {/* Filter Buttons Section */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['All', 'PENDING', 'APPROVED', 'ACTIVE', 'PAID', 'OVERDUE', 'REJECTED'].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as LoanItem['status'] | 'All')}
              style={[styles.filterBtn, filter === f && styles.activeFilter]}
            >
              <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable Loans Table - Now covers full screen */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableHeaderCell}>Start Date</Text>
          <Text style={styles.tableHeaderCell}>Amount</Text>
          <Text style={styles.tableHeaderCell}>Status</Text>
          <Text style={styles.tableHeaderCell}>Paid</Text>
          <Text style={styles.tableHeaderCell}>Outstanding</Text>
          <Text style={styles.tableHeaderCell}>Due Date</Text>
          <Text style={styles.tableHeaderCell}>Reason</Text>
          <Text style={styles.tableHeaderCell}>Interest</Text>
        </View>
        <FlatList
          data={filteredLoans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LoanTableRow item={item} />}
          ListEmptyComponent={
            !loading && <Text style={styles.empty}>No loans found.</Text>
          }
        />
      </View>

      {/* Request New Loan Button */}
      <TouchableOpacity
        style={styles.requestButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.requestButtonText}>Request New Loan</Text>
      </TouchableOpacity>

      {/* Loan Request Modal Form */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Loan Request</Text>
            <View style={styles.modalInfoCard}>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Total Contributions:</Text>
                <Text style={styles.modalInfoValue}>KES {totalContributions.toLocaleString('en-KE')}</Text>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Max Eligible Loan:</Text>
                <Text style={styles.modalInfoValue}>KES {(totalContributions * MAX_LOAN_FACTOR).toLocaleString('en-KE')}</Text>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Interest Rate:</Text>
                <Text style={styles.modalInfoValue}>{DEFAULT_INTEREST_RATE * 100}%</Text>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Repayment Period:</Text>
                <Text style={styles.modalInfoValue}>{DEFAULT_REPAYMENT_MONTHS} months</Text>
              </View>
            </View>
            <TextInput
              placeholder="Enter Loan Amount (KES)"
              keyboardType="numeric"
              value={loanAmountInput}
              onChangeText={setLoanAmountInput}
              style={styles.input}
            />
            <TextInput
              placeholder="Reason for Loan (e.g., medical, school fees)"
              value={loanReason}
              onChangeText={setLoanReason}
              style={[styles.input, { height: 80 }]}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity onPress={submitLoanRequest} style={styles.submitBtn}>
              <Text style={styles.submitText}>Submit Request</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loan Schedule Modal */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.scheduleModalOverlay}>
          <View style={styles.scheduleModalCard}>
            <Text style={styles.scheduleModalTitle}>Loan Schedule</Text>
            
            {/* Loan Details Header */}
            {selectedLoan && (
              <View style={styles.loanDetailsHeader}>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Member's Name:</Text>
                  <Text style={styles.loanDetailValue}>
                    {selectedLoan.member?.firstName} {selectedLoan.member?.lastName}
                  </Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Start Period:</Text>
                  <Text style={styles.loanDetailValue}>{selectedLoan.startDate}</Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>End Period:</Text>
                  <Text style={styles.loanDetailValue}>{selectedLoan.dueDate}</Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Loan Reason:</Text>
                  <Text style={styles.loanDetailValue}>{selectedLoan.reason}</Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Loan Amount:</Text>
                  <Text style={styles.loanDetailValue}>KES {selectedLoan.amount.toLocaleString('en-KE')}</Text>
                </View>
              </View>
            )}

            {/* Schedule Table - Full width */}
            <View style={styles.scheduleTableContainer}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.scheduleHeaderCell}>Period</Text>
                <Text style={styles.scheduleHeaderCell}>Month</Text>
                <Text style={styles.scheduleHeaderCell}>Principal</Text>
                <Text style={styles.scheduleHeaderCell}>Int %</Text>
                <Text style={styles.scheduleHeaderCell}>Int Amt</Text>
                <Text style={styles.scheduleHeaderCell}>Monthly Repayment</Text>
                <Text style={styles.scheduleHeaderCell}>Balance CF</Text>
              </View>

              <FlatList
                data={loanSchedule}
                keyExtractor={(item) => item.period.toString()}
                renderItem={({ item }) => <LoanScheduleRow item={item} />}
                style={styles.scheduleList}
              />
            </View>

            <TouchableOpacity 
              onPress={() => setScheduleModalVisible(false)} 
              style={styles.closeScheduleButton}
            >
              <Text style={styles.closeScheduleText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

// --- STYLESHEET DEFINITION ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#388E3C',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
    marginRight: 8,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  brandMan: {
    color: '#388E3C',
  },
  brandPower: {
    color: '#1B5E20',
  },
  contributionsButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  contributionsButtonText: {
    color: '#388E3C',
    fontWeight: 'bold',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleSection: {
    backgroundColor: '#C8E6C9',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  totalContributionsCard: {},
  maxLoanCard: {},
  summaryCardLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#388E3C',
    marginTop: 5,
  },
  ineligibleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: 5,
  },
  filterRow: {
    flexGrow: 0,
    marginBottom: 10,
    paddingVertical: 5,
  },
  filterBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 5,
  },
  filterText: {
    color: '#555',
    fontWeight: 'bold',
    fontSize: 12,
  },
  activeFilter: {
    backgroundColor: '#388E3C',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  tableContainer: {
    flex: 1,
    paddingHorizontal: 0, // Remove horizontal padding to use full width
    backgroundColor: '#E8F5E9',
    marginHorizontal: 10, // Add small margin for visual separation
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#388E3C',
    paddingVertical: 12,
    paddingHorizontal: 5, // Reduced padding for full width
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderCell: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11, // Slightly smaller font for full width
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 5, // Reduced padding for full width
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tableCell: {
    flex: 1,
    fontSize: 11, // Slightly smaller font for full width
    color: '#333',
    textAlign: 'center',
  },
  amountCell: {
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  empty: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#777',
  },
  requestButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '90%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalInfoCard: {
    backgroundColor: '#f0f9f3',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#388E3C',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  cancelText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  // Loan Schedule Modal Styles
  scheduleModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  scheduleModalCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '95%',
    height: '90%',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scheduleModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B5E20',
    textAlign: 'center',
    marginBottom: 15,
  },
  loanDetailsHeader: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  loanDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  loanDetailLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  loanDetailValue: {
    fontSize: 12,
    color: '#666',
  },
  scheduleTableContainer: {
    flex: 1,
  },
  scheduleHeader: {
    flexDirection: 'row',
    backgroundColor: '#388E3C',
    paddingVertical: 8,
  },
  scheduleHeaderCell: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  scheduleList: {
    flex: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  scheduleCell: {
    flex: 1,
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  closeScheduleButton: {
    backgroundColor: '#D32F2F',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 15,
  },
  closeScheduleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
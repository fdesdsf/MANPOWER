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

const BASE_URL = 'http://192.168.0.101:8080/api';

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
  // ML Integration Fields
  mlDecisionLogId?: number;
  mlApprovedAmount?: number;
  mlRiskLevel?: string;
  mlConfidenceScore?: number;
  mlRecommendation?: string;
  isMlApproved?: boolean;
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

// ML Decision Response Interface - UPDATED WITH DETAILED EXPLANATIONS
interface MLDecisionResponse {
  memberId: string;
  loanAmountRequested: number;
  loanReason: string;
  finalRecommendation: 'APPROVE' | 'REJECT' | 'APPROVE WITH CAUTION' | 'APPROVE_WITH_CAUTION' | 'ERROR';
  finalConfidence: number;
  decisionReasoning: string;
  eligibilityAmount: number;
  eligibilityConfidence: number;
  loanRisk: string;
  riskProbability: number;
  riskConfidence: number;
  sentimentRisk: string;
  sentimentConfidence: number;
  memberStatus: string;
  memberRole: string;
  membershipMonths: number;
  processedAt: string;
  dataSource: string;
  mlOrchestratorVersion: string;
  success: boolean;
  errorMessage: string;
  decisionLogId?: number;
  
  // ✅ NEW: Detailed explanations fields
  detailedExplanations?: {
    memberId: string;
    explanations: Array<{
      category: string;
      decision: string;
      reason: string;
      keyFactor: string;
      impact: string;
    }>;
    summary: {
      keyRecommendation: string;
      primaryReason: string;
      interestRateJustification: string;
      confidenceLevel: string;
    };
  };
  
  decisionTable?: {
    interestRateBreakdown: Array<{component: string, value: string, reason: string}>;
    eligibilityFactors: Array<{factor: string, status: string, impact: string}>;
    riskAssessment: Array<{riskCategory: string, level: string, score: string}>;
    recommendations: Array<{action: string, status: string, details: string}>;
    summary: string;
  };
  
  htmlDecisionTable?: string;
}

// --- COMPONENT START ---

export default function LoanScreen() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'PAID' | 'OVERDUE'>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [mlDecisionModalVisible, setMlDecisionModalVisible] = useState(false);
  const [detailedExplanationsModalVisible, setDetailedExplanationsModalVisible] = useState(false);
  const [loanAmountInput, setLoanAmountInput] = useState('');
  const [loanReason, setLoanReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);
  const [isGettingMlDecision, setIsGettingMlDecision] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberData, setMemberData] = useState<MemberDetails | null>(null);
  const [totalContributions, setTotalContributions] = useState<number>(0);
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [loanSchedule, setLoanSchedule] = useState<LoanScheduleItem[]>([]);
  
  // ML Decision State
  const [mlDecision, setMlDecision] = useState<MLDecisionResponse | null>(null);
  const [mlDecisionLogId, setMlDecisionLogId] = useState<number | null>(null);

  const MIN_CONTRIBUTION_FOR_LOAN = 5000;
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

  // Helper function to extract interest rate from detailed explanations - IMPROVED VERSION
  const getInterestRateFromDetailedExplanations = (decision: MLDecisionResponse): number | null => {
    if (!decision.detailedExplanations?.summary?.interestRateJustification) {
      return null;
    }
    
    const rateText = decision.detailedExplanations.summary.interestRateJustification;
    console.log('📝 Rate justification text:', rateText);
    
    // Try multiple patterns to extract rate
    const patterns = [
      /Decision:\s*([\d.]+)%/,           // "Decision: 8.0%"
      /rate.*?([\d.]+)%/i,               // "rate of 8.0%"
      /([\d.]+)%\s*rate/i,               // "8.0% rate"
      /interest.*?([\d.]+)%/i,           // "interest rate 8.0%"
      /([\d.]+)%\s*interest/i,           // "8.0% interest"
      /([\d.]+)%/,                       // Just find any percentage
    ];
    
    for (const pattern of patterns) {
      const match = rateText.match(pattern);
      if (match && match[1]) {
        const rate = parseFloat(match[1]);
        if (!isNaN(rate)) {
          console.log('✅ Extracted rate using pattern:', pattern, '=', rate + '%');
          return rate;
        }
      }
    }
    
    // Also check if rate is in the text without % sign
    const numberPattern = /(\d+(?:\.\d+)?)\s*(?:percent|percentage|rate)/i;
    const numberMatch = rateText.match(numberPattern);
    if (numberMatch && numberMatch[1]) {
      const rate = parseFloat(numberMatch[1]);
      if (!isNaN(rate)) {
        console.log('✅ Extracted rate as number:', rate + '%');
        return rate;
      }
    }
    
    console.warn('❌ Could not extract rate from text:', rateText);
    return null;
  };

  // Calculate interest rate based on ML risk assessment - STRICT ML-ONLY VERSION
  const calculateMlBasedInterestRate = (decision: MLDecisionResponse): number => {
    if (!decision) {
      console.error('❌ ML decision is required for interest rate calculation');
      Alert.alert(
        'AI Assessment Error',
        'The AI system did not provide a decision. Please try again.',
        [{ text: 'OK', onPress: () => setMlDecisionModalVisible(false) }]
      );
      throw new Error('ML decision is required');
    }

    console.log('🔍 ML Decision for rate calculation:', {
      finalRecommendation: decision.finalRecommendation,
      loanRisk: decision.loanRisk,
      hasDetailedExpl: !!decision.detailedExplanations,
      hasDecisionTable: !!decision.decisionTable
    });

    // 1. Try to get rate from detailed explanations
    const detailedRate = getInterestRateFromDetailedExplanations(decision);
    if (detailedRate !== null) {
      console.log('✅ Rate from detailed explanations:', detailedRate + '%');
      return detailedRate;
    }

    // 2. Try to get rate from decision table
    if (decision.decisionTable?.interestRateBreakdown) {
      for (const item of decision.decisionTable.interestRateBreakdown) {
        const rateMatch = item.value.match(/([\d.]+)%/);
        if (rateMatch) {
          const rate = parseFloat(rateMatch[1]);
          if (!isNaN(rate)) {
            console.log('✅ Rate from decision table:', rate + '% (from:', item.component, ')');
            return rate;
          }
        }
      }
    }

    // 3. Check if backend is sending rate in a different field
    // Sometimes backend might send rate in unexpected fields
    const responseString = JSON.stringify(decision);
    const allRateMatches = responseString.match(/"rate":\s*([\d.]+)/gi) || 
                           responseString.match(/"interestRate":\s*([\d.]+)/gi) ||
                           responseString.match(/"interest":\s*([\d.]+)/gi);
    
    if (allRateMatches && allRateMatches.length > 0) {
      for (const match of allRateMatches) {
        const rateMatch = match.match(/([\d.]+)/);
        if (rateMatch) {
          const rate = parseFloat(rateMatch[0]);
          if (!isNaN(rate)) {
            console.log('✅ Found rate in response string:', rate + '%');
            return rate;
          }
        }
      }
    }

    // 4. If we reach here, ML didn't provide a rate - this is a backend issue
    console.error('❌ CRITICAL: ML decision contains NO interest rate:', decision);
    
    // Show user-friendly error
    Alert.alert(
      'AI Assessment Error',
      'The AI system did not provide an interest rate for your loan. Please contact support.',
      [{ text: 'OK', onPress: () => setMlDecisionModalVisible(false) }]
    );
    
    throw new Error('ML decision missing interest rate information');
  };

  // STAGE 1: Get ML Decision
  const getMlDecision = async () => {
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
      return;
    }

    // Basic eligibility check - ONLY check minimum contribution
    if (totalContributions < MIN_CONTRIBUTION_FOR_LOAN) {
      Alert.alert(
        'Loan Ineligible',
        `You need a minimum total contribution of KES ${MIN_CONTRIBUTION_FOR_LOAN.toLocaleString('en-KE')} to apply for a loan. Your current total contribution is KES ${totalContributions.toLocaleString('en-KE')}.`
      );
      return;
    }

    // REMOVED THE FRONTEND ELIGIBILITY CHECK - Let ML decide everything
    // const maxEligibleLoan = totalContributions * MAX_LOAN_FACTOR;
    // if (requestedAmount > maxEligibleLoan) {
    //   Alert.alert(
    //     'Loan Limit Exceeded',
    //     `Based on your total contributions (KES ${totalContributions.toLocaleString('en-KE')}), the maximum loan you can apply for is KES ${maxEligibleLoan.toLocaleString('en-KE')}.`
    //   );
    //   return;
    // }

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

    setIsGettingMlDecision(true);

    try {
      const mlAssessmentRequest = {
        memberId: memberData.id,
        memberStatus: memberData.status,
        memberRole: memberData.role,
        joinDate: memberData.joinDate,
        loanAmount: requestedAmount,
        loanReason: loanReason
      };

      console.log('Sending ML Assessment Request:', mlAssessmentRequest);

      const res = await fetch(`${BASE_URL}/loan/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mlAssessmentRequest),
      });

      if (res.ok) {
        const mlDecisionResponse: MLDecisionResponse = await res.json();
        setMlDecision(mlDecisionResponse);
        
        // Add debugging logs
        console.log('🔍 FULL ML RESPONSE:', JSON.stringify(mlDecisionResponse, null, 2));
        console.log('🔍 finalRecommendation:', mlDecisionResponse.finalRecommendation);
        console.log('🔍 loanRisk:', mlDecisionResponse.loanRisk);
        console.log('🔍 detailedExplanations:', mlDecisionResponse.detailedExplanations);
        
        // CAPTURE THE DECISION LOG ID FROM RESPONSE
        if (mlDecisionResponse.success && mlDecisionResponse.decisionLogId) {
          setMlDecisionLogId(mlDecisionResponse.decisionLogId);
          console.log('ML Decision Log ID captured:', mlDecisionResponse.decisionLogId);
        } else {
          console.warn('ML Decision Log ID not found in response');
        }
        
        // Log detailed explanations availability
        if (mlDecisionResponse.detailedExplanations) {
          console.log('✅ Detailed explanations received:', 
            mlDecisionResponse.detailedExplanations.explanations?.length, 'explanations');
        }
        
        if (mlDecisionResponse.success) {
          setMlDecisionModalVisible(true);
          setModalVisible(false);
        } else {
          Alert.alert('ML Assessment Failed', mlDecisionResponse.errorMessage || 'Failed to get ML decision');
        }
      } else {
        const errorDetail = await res.text();
        console.error('ML Decision API error:', res.status, errorDetail);
        Alert.alert('Assessment Failed', `Failed to get ML assessment: ${errorDetail || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Network error during ML assessment:', err);
      Alert.alert('Connection Error', 'Could not connect to the assessment service. Please try again.');
    } finally {
      setIsGettingMlDecision(false);
    }
  };

  // STAGE 2: Create Loan from ML Decision
  const createLoanFromMlDecision = async () => {
    if (!mlDecision || !memberId || !memberData) {
      Alert.alert('Error', 'Missing required data for loan creation.');
      return;
    }

    // CRITICAL FIX: Ensure we have mlDecisionLogId
    if (!mlDecisionLogId) {
      Alert.alert('Error', 'ML Decision reference is missing. Please restart the loan application process.');
      return;
    }

    setIsSubmittingLoan(true);

    try {
      // First, get the member's group
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

      // Use REQUESTED amount
      const approvedAmount = mlDecision.loanAmountRequested || parseFloat(loanAmountInput);
      let mlInterestRate;
      
      try {
        mlInterestRate = calculateMlBasedInterestRate(mlDecision);
      } catch (error: any) {
        console.error('Failed to calculate interest rate:', error);
        Alert.alert('Interest Rate Error', error.message || 'Could not determine interest rate from AI assessment.');
        setIsSubmittingLoan(false);
        return;
      }
      
      // FIXED PAYLOAD: Include mlDecisionLogId which is required by backend
      const mlLoanPayload = {
        member: { id: memberData.id },
        group: { id: memberGroup.id },
        amount: approvedAmount,
        interestRate: mlInterestRate,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(new Date().setMonth(new Date().getMonth() + DEFAULT_REPAYMENT_MONTHS)).toISOString().split('T')[0],
        status: 'APPROVED',
        outstandingBalance: approvedAmount,
        reason: mlDecision.loanReason || loanReason,
        approvedBy: { id: memberData.id },
        mansoftTenantId: memberData.mansoftTenantId,
        // ML Integration Fields
        mlDecisionLogId: mlDecisionLogId,
        mlApprovedAmount: approvedAmount,
        mlRiskLevel: mlDecision.loanRisk,
        mlConfidenceScore: mlDecision.finalConfidence,
        mlRecommendation: mlDecision.finalRecommendation,
        isMlApproved: true
      };

      console.log('Creating ML Loan with REQUESTED Amount:', approvedAmount);
      console.log('ML Interest Rate:', mlInterestRate);

      const res = await fetch(`${BASE_URL}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mlLoanPayload),
      });

      if (res.ok) {
        const createdLoan = await res.json();
        Alert.alert(
          '🎉 Loan Approved!', 
          `Your loan of KES ${approvedAmount.toLocaleString('en-KE')} has been approved via AI assessment!\n\nRisk Level: ${mlDecision.loanRisk}\nInterest Rate: ${mlInterestRate}%\nConfidence: ${(mlDecision.finalConfidence * 100).toFixed(1)}%`
        );
        setMlDecisionModalVisible(false);
        setLoanAmountInput('');
        setLoanReason('');
        setMlDecision(null);
        setMlDecisionLogId(null);
        fetchData(memberId);
      } else {
        const errorDetail = await res.text();
        console.error('Loan creation API error:', res.status, errorDetail);
        
        if (errorDetail.includes('ML Decision Log ID is required')) {
          Alert.alert(
            'System Error', 
            'ML decision reference was lost. Please restart the loan application process.'
          );
        } else {
          Alert.alert('Loan Creation Failed', `Failed to create loan: ${errorDetail || 'Unknown error'}`);
        }
      }
    } catch (err: any) {
      console.error('Network error during loan creation:', err);
      Alert.alert('Error', err.message || 'Could not connect to the server to create your loan.');
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

  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'VERY_LOW':
        return '#4CAF50';
      case 'LOW':
        return '#8BC34A';
      case 'MEDIUM':
        return '#FFC107';
      case 'HIGH':
        return '#FF9800';
      case 'VERY_HIGH':
        return '#F44336';
      default:
        return '#666';
    }
  };

  if (loading || isSubmittingLoan || isGettingMlDecision) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#388E3C" />
        <Text style={styles.loadingText}>
          {isGettingMlDecision ? '🤖 AI is assessing your loan...' : 
           isSubmittingLoan ? 'Creating your loan...' : 
           'Loading your financial data...'}
        </Text>
      </SafeAreaView>
    );
  }

  const filteredLoans = loans.filter(loan => filter === 'All' || loan.status === filter);

  const LoanTableRow = ({ item }: { item: LoanItem }) => {
  const canRepay = ['APPROVED', 'ACTIVE', 'OVERDUE'].includes(item.status) && 
                   item.outstandingBalance > 0;

  return (
    <TouchableOpacity 
      style={styles.tableRow} 
      onPress={() => viewLoanSchedule(item)}
    >
      <Text style={styles.tableCell}>{item.startDate}</Text>
      <Text style={[styles.tableCell, styles.amountCell]}>KES {item.amount.toLocaleString('en-KE')}</Text>
      <Text style={[styles.tableCell, getLoanStatusStyle(item.status), { fontWeight: 'bold' }]}>
        {item.isMlApproved ? '🤖 ' : ''}{item.status}
      </Text>
      <Text style={styles.tableCell}>KES {(item.totalPaid ?? 0).toLocaleString('en-KE')}</Text>
      <Text style={styles.tableCell}>KES {item.outstandingBalance.toLocaleString('en-KE')}</Text>
      <Text style={styles.tableCell}>{item.dueDate}</Text>
      <Text style={styles.tableCell}>{item.reason}</Text>
      <Text style={styles.tableCell}>{item.interestRate}%</Text>
      
      {/* ← ADD THIS COLUMN */}
      <View style={[styles.tableCell, { flex: 0.6 }]}>
        {canRepay ? (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => {
              // Stop the parent TouchableOpacity from triggering
              event?.stopPropagation();
              router.push({
                pathname: '/(member)/loan-repayment',
                params: { 
                  loanId: item.id,
                  amount: item.amount.toString(),
                  outstanding: item.outstandingBalance.toString(),
                  dueDate: item.dueDate,
                  interestRate: item.interestRate.toString(),
                  status: item.status
                }
              });
            }}
          >
            <Text style={styles.payButtonText}>💰 Pay</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.paidLabel}>
            {item.status === 'PAID' ? '✅' : '—'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

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

      {/* Scrollable Container for Full Screen */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>My Loans</Text>
            <Text style={styles.subtitleText}>AI-Powered Loan Assessment</Text>
          </View>

          {/* Summary Cards Section */}
          <View style={styles.summaryContainer}>
            {/* Total Contributions Card */}
            <View style={[styles.summaryCard, styles.contributionsCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>💰</Text>
                <Text style={styles.summaryCardLabel}>Total Contributions</Text>
              </View>
              <Text style={styles.summaryCardValue}>KES {totalContributions.toLocaleString('en-KE')}</Text>
              <View style={styles.eligibilityBadge}>
                <Text style={styles.eligibilityBadgeText}>
                  {totalContributions >= MIN_CONTRIBUTION_FOR_LOAN ? '✅ Eligible' : '❌ Not Eligible'}
                </Text>
              </View>
            </View>

            {/* AI Assessment Card */}
            <View style={[styles.summaryCard, styles.aiEligibilityCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>🤖</Text>
                <Text style={styles.summaryCardLabel}>AI Assessment</Text>
              </View>
              
              {mlDecision ? (
                <>
                  <Text style={styles.aiApprovedAmount}>
                    KES {mlDecision.eligibilityAmount?.toLocaleString('en-KE')}
                  </Text>
                  <View style={[
                    styles.riskBadge,
                    { backgroundColor: getRiskColor(mlDecision.loanRisk) + '20' }
                  ]}>
                    <Text style={[styles.riskBadgeText, { color: getRiskColor(mlDecision.loanRisk) }]}>
                      {mlDecision.loanRisk} Risk
                    </Text>
                  </View>
                  <Text style={styles.confidenceText}>
                    {(mlDecision.finalConfidence * 100).toFixed(0)}% Confidence
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.aiReadyText}>Ready for Assessment</Text>
                  <View style={styles.aiFeatures}>
                    <Text style={styles.aiFeature}>• Instant Approval</Text>
                    <Text style={styles.aiFeature}>• Risk-Based Rates</Text>
                    <Text style={styles.aiFeature}>• Fair Evaluation</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* AI Assessment Info Card */}
          <View style={styles.aiInfoCard}>
            <Text style={styles.aiInfoTitle}>🤖 AI Loan Assessment</Text>
            <Text style={styles.aiInfoText}>
              Get instant loan approval using our AI system. We analyze your profile, contributions, and loan purpose for fast, fair decisions with risk-based interest rates.
            </Text>
          </View>

          {/* Filter Buttons Section */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['🗂️ All', '⏳ PENDING', '✅ APPROVED', '🔄 ACTIVE', '💳 PAID', '⏰ OVERDUE', '❌ REJECTED'].map((f) => (
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

        {/* Loans Table - Now inside ScrollView for full screen scrolling */}
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
            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Action</Text> {/* ← ADD THIS */}
          </View>
          <FlatList
            data={filteredLoans}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <LoanTableRow item={item} />}
            scrollEnabled={false}
            ListEmptyComponent={
              !loading && <Text style={styles.empty}>📊 No loans found.</Text>
            }
          />
        </View>
      </ScrollView>

      {/* FAB Button for Requesting New Loan */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabIcon}>🤖</Text>
        <Text style={styles.fabText}>AI Loan</Text>
      </TouchableOpacity>

      {/* STAGE 1: Loan Request Modal Form */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🤖 AI Loan Assessment</Text>
            <Text style={styles.modalSubtitle}>Stage 1: Get Instant AI Decision</Text>
            
            <View style={styles.modalInfoCard}>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Total Contributions:</Text>
                <Text style={styles.modalInfoValue}>KES {totalContributions.toLocaleString('en-KE')}</Text>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Minimum Required:</Text>
                <Text style={styles.modalInfoValue}>KES {MIN_CONTRIBUTION_FOR_LOAN.toLocaleString('en-KE')}</Text>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>AI Assessment:</Text>
                <Text style={styles.modalInfoValue}>Real-time Approval</Text>
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
              placeholder="Reason for Loan (e.g., medical, school fees, business)"
              value={loanReason}
              onChangeText={setLoanReason}
              style={[styles.input, { height: 80 }]}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity onPress={getMlDecision} style={styles.mlAssessmentBtn}>
              <Text style={styles.mlAssessmentText}>🤖 Get AI Assessment</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* STAGE 2: ML Decision Results Modal */}
      <Modal visible={mlDecisionModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.mlDecisionCard}>
            <Text style={styles.mlDecisionTitle}>🤖 AI Loan Decision</Text>
            
            {mlDecision && (
              <>
                <View style={styles.mlDecisionResult}>
                  <Text style={[
                    styles.mlDecisionRecommendation,
                    { 
                      color: mlDecision.finalRecommendation === 'APPROVE' ? '#4CAF50' : 
                             mlDecision.finalRecommendation === 'APPROVE WITH CAUTION' ||
                             mlDecision.finalRecommendation === 'APPROVE_WITH_CAUTION' ? '#FF9800' : 
                             '#F44336' 
                    }
                  ]}>
                    {mlDecision.finalRecommendation === 'APPROVE' ? '✅ APPROVED' :
                    mlDecision.finalRecommendation === 'APPROVE WITH CAUTION' ||
                     mlDecision.finalRecommendation === 'APPROVE_WITH_CAUTION' ? '⚠️ APPROVE WITH MONITORING' : 
                     '❌ REJECTED'}
                  </Text>
                  
                  <Text style={styles.mlDecisionConfidence}>
                    Confidence: {(mlDecision.finalConfidence * 100).toFixed(1)}%
                  </Text>

                  <View style={styles.mlDecisionDetails}>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>Requested Amount:</Text>
                      <Text style={styles.mlDecisionValue}>KES {mlDecision.loanAmountRequested?.toLocaleString('en-KE')}</Text>
                    </View>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>Maximum Eligible:</Text>
                      <Text style={[styles.mlDecisionValue, { color: '#2196F3', fontWeight: 'bold' }]}>
                        KES {mlDecision.eligibilityAmount?.toLocaleString('en-KE')}
                      </Text>
                    </View>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>Risk Level:</Text>
                      <Text style={[styles.mlDecisionValue, { color: getRiskColor(mlDecision.loanRisk) }]}>
                        {mlDecision.loanRisk}
                      </Text>
                    </View>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>AI Interest Rate:</Text>
                      <Text style={styles.mlDecisionValue}>
                        {(() => {
                          try {
                            const rate = calculateMlBasedInterestRate(mlDecision);
                            return `${rate}%`;
                          } catch (error: any) {
                            return `Error: ${error.message}`;
                          }
                        })()}
                        <Text style={{ fontSize: 12, color: '#666' }}>
                          {mlDecision.loanRisk ? ` (${mlDecision.loanRisk} Risk)` : ''}
                        </Text>
                        {getInterestRateFromDetailedExplanations(mlDecision) && (
                          <Text style={{ fontSize: 12, color: '#4CAF50' }}>
                            {' '}
                          </Text>
                        )}
                      </Text>
                    </View>
                    {/* Show Decision Log ID for debugging */}
                    {mlDecisionLogId && (
                      <View style={styles.mlDecisionRow}>
                        <Text style={styles.mlDecisionLabel}>Decision Reference:</Text>
                        <Text style={[styles.mlDecisionValue, { fontSize: 12, color: '#666' }]}>
                          ID: {mlDecisionLogId}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.mlDecisionReasoning}>
                    <Text style={styles.mlDecisionReasoningTitle}>AI Reasoning:</Text>
                    <Text style={styles.mlDecisionReasoningText}>{mlDecision.decisionReasoning}</Text>
                  </View>

                  {/* ✅ ADDED: Detailed Explanations Button */}
                  {mlDecision.detailedExplanations && (
                    <TouchableOpacity 
                      style={styles.detailsButton}
                      onPress={() => setDetailedExplanationsModalVisible(true)}
                    >
                      <Text style={styles.detailsButtonText}>📊 View Detailed Analysis</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {(mlDecision.finalRecommendation === 'APPROVE' || 
                  mlDecision.finalRecommendation === 'APPROVE WITH CAUTION' ||
                  mlDecision.finalRecommendation === 'APPROVE_WITH_CAUTION') && (
                  <TouchableOpacity 
                    onPress={createLoanFromMlDecision} 
                    style={[
                      styles.createLoanBtn,
                      mlDecision.finalRecommendation === 'APPROVE_WITH_CAUTION' && 
                        { backgroundColor: '#FF9800' } // Orange for caution
                    ]}
                    disabled={isSubmittingLoan}
                  >
                    <Text style={styles.createLoanText}>
                      {isSubmittingLoan ? 'Creating Loan...' : 
                       mlDecision.finalRecommendation === 'APPROVE WITH CAUTION' ||
                       mlDecision.finalRecommendation === 'APPROVE_WITH_CAUTION' ? 
                       '⚠️ Create Loan (With Monitoring)' : 
                       '🎉 Create Loan'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => {
                    setMlDecisionModalVisible(false);
                    setMlDecisionLogId(null);
                  }} 
                  style={styles.closeMlDecisionBtn}
                >
                  <Text style={styles.closeMlDecisionText}>
                    {mlDecision.finalRecommendation === 'REJECT' ? 'Close' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ✅ ADDED: Detailed Explanations Modal */}
      <Modal visible={detailedExplanationsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailedModalCard}>
            <Text style={styles.detailedModalTitle}>📊 Detailed Decision Analysis</Text>
            
            {mlDecision?.detailedExplanations && (
              <ScrollView style={styles.detailedScrollView}>
                {mlDecision.detailedExplanations.explanations.map((exp, index) => (
                  <View key={index} style={styles.explanationCard}>
                    <Text style={styles.explanationCategory}>{exp.category}</Text>
                    <Text style={styles.explanationDecision}>Decision: {exp.decision}</Text>
                    <Text style={styles.explanationReason}>Reason: {exp.reason}</Text>
                    <Text style={styles.explanationFactor}>Key Factor: {exp.keyFactor}</Text>
                    <Text style={[
                      styles.explanationImpact,
                      { color: exp.impact === 'Positive' ? '#4CAF50' : 
                              exp.impact === 'Negative' ? '#F44336' : 
                              exp.impact === 'Critical' ? '#D32F2F' : '#666' }
                    ]}>Impact: {exp.impact}</Text>
                  </View>
                ))}
                
                {mlDecision.detailedExplanations.summary && (
                  <View style={styles.summaryAnalysisCard}>
                    <Text style={styles.summaryAnalysisTitle}>🎯 Final Summary</Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Recommendation: </Text>
                      {mlDecision.detailedExplanations.summary.keyRecommendation}
                    </Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Primary Reason: </Text>
                      {mlDecision.detailedExplanations.summary.primaryReason}
                    </Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Interest Rate: </Text>
                      {mlDecision.detailedExplanations.summary.interestRateJustification}
                    </Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Confidence Level: </Text>
                      {mlDecision.detailedExplanations.summary.confidenceLevel}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity 
              onPress={() => setDetailedExplanationsModalVisible(false)} 
              style={styles.closeDetailedModalBtn}
            >
              <Text style={styles.closeDetailedModalText}>Close</Text>
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
                {selectedLoan.isMlApproved && (
                  <>
                    <View style={styles.loanDetailRow}>
                      <Text style={styles.loanDetailLabel}>AI Approved:</Text>
                      <Text style={[styles.loanDetailValue, { color: '#4CAF50' }]}>Yes 🤖</Text>
                    </View>
                    <View style={styles.loanDetailRow}>
                      <Text style={styles.loanDetailLabel}>Risk Level:</Text>
                      <Text style={[styles.loanDetailValue, { color: getRiskColor(selectedLoan.mlRiskLevel || '') }]}>
                        {selectedLoan.mlRiskLevel}
                      </Text>
                    </View>
                  </>
                )}
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
  scrollContainer: {
    flex: 1,
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
    color: '#000000',
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
  subtitleText: {
    fontSize: 14,
    color: '#388E3C',
    marginTop: 5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contributionsCard: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  aiEligibilityCard: {
    backgroundColor: '#F8F9FF',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  summaryCardLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 8,
  },
  aiApprovedAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 6,
  },
  aiReadyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  eligibilityBadge: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  eligibilityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  aiFeatures: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  aiFeature: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  aiInfoCard: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  aiInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 5,
  },
  aiInfoText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 18,
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
    paddingHorizontal: 0,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 10,
    marginBottom: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#388E3C',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderCell: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tableCell: {
    flex: 1,
    fontSize: 11,
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 150,
    backgroundColor: '#2196F3',
    width: 120,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    marginBottom: 5,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
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
  mlAssessmentBtn: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  mlAssessmentText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  mlDecisionCard: {
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
  mlDecisionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  mlDecisionResult: {
    marginBottom: 20,
  },
  mlDecisionRecommendation: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  mlDecisionConfidence: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  mlDecisionDetails: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  mlDecisionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mlDecisionLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  mlDecisionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  mlDecisionReasoning: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  mlDecisionReasoningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 5,
  },
  mlDecisionReasoningText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 18,
  },
  // ✅ ADDED: Detailed explanations styles
  detailsButton: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  detailsButtonText: {
    color: '#1976D2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  createLoanBtn: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  createLoanText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeMlDecisionBtn: {
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  closeMlDecisionText: {
    color: '#666',
    fontWeight: 'bold',
  },
  // ✅ ADDED: Detailed explanations modal styles
  detailedModalCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '95%',
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  detailedModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
    marginBottom: 15,
  },
  detailedScrollView: {
    maxHeight: 400,
  },
  explanationCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  explanationCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  explanationDecision: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 3,
  },
  explanationReason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  explanationFactor: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#777',
    marginBottom: 3,
  },
  explanationImpact: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeDetailedModalBtn: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 15,
  },
  closeDetailedModalText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
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
  summaryAnalysisCard: {
    backgroundColor: '#f0f7ff',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  summaryAnalysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
    textAlign: 'center',
  },
  summaryAnalysisItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  summaryAnalysisLabel: {
    fontWeight: 'bold',
    color: '#555',
  },
  payButton: {
  backgroundColor: '#4CAF50',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  alignItems: 'center',
},
payButtonText: {
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: 'bold',
},
paidLabel: {
  fontSize: 11,
  color: '#1B5E20',
  fontWeight: '600',
  textAlign: 'center',
},
});
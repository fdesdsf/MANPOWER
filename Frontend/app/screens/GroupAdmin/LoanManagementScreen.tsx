import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
  group?: Group;
  phoneNumber?: string;
  password?: string;
  joinDate?: string;
  createdBy?: string;
  modifiedBy?: string;
  createdOn?: string;
  modifiedOn?: string;
  mansoftTenantId?: string;
}

interface Group {
  id: string;
  groupName: string;
  members: Member[];
  description?: string;
  creationDate?: string;
  createdBy?: string;
  modifiedBy?: string;
  createdOn?: string;
  modifiedOn?: string;
  mansoftTenantId?: string;
  status?: string;
}

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
}

interface Loan {
  id: string;
  member: Member;
  amount: number;
  outstandingBalance: number;
  totalPaid: number | null; // Add this line
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  createdOn: string;
  reason: string;
}

export default function LoanManagementScreen() {
  const router = useRouter();
  const { userRole } = useContext(AuthContext)!;

  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingHistorical, setLoadingHistorical] = useState(true);
  const [pendingLoans, setPendingLoans] = useState<Loan[]>([]);
  const [historicalLoans, setHistoricalLoans] = useState<Loan[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [groupAdminId, setGroupAdminId] = useState<string | null>(null);
  const [groupAdminDetails, setGroupAdminDetails] = useState<Member | null>(null);

  const [isContributionsModalVisible, setIsContributionsModalVisible] = useState(false);
  const [selectedMemberName, setSelectedMemberName] = useState('');
  const [selectedMemberContributions, setSelectedMemberContributions] = useState<Contribution[]>([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);

  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [loanToPay, setLoanToPay] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  const [isLoanHistoryModalVisible, setIsLoanHistoryModalVisible] = useState(false);
  const [selectedMemberLoanHistory, setSelectedMemberLoanHistory] = useState<Loan[]>([]);
  const [loanHistoryLoading, setLoanHistoryLoading] = useState(false);

  const fetchLoans = useCallback(async (adminId: string) => {
    try {
      const groupRes = await fetch(`${BASE_URL}/groups/groupadmin/${adminId}`);
      if (!groupRes.ok) {
        throw new Error('Failed to fetch groups for admin.');
      }
      const groupsData: Group[] = await groupRes.json();
      const allMemberIds = groupsData.flatMap(group => group.members?.map(member => member.id) || []);

      const loanRes = await fetch(`${BASE_URL}/loans`);
      if (!loanRes.ok) {
        throw new Error('Failed to fetch all loans.');
      }
      const allLoansData: Loan[] = await loanRes.json();

      const filteredLoans = allLoansData.filter(loan => allMemberIds.includes(loan.member?.id));

      const pending = filteredLoans.filter(loan => loan.status?.toUpperCase() === 'PENDING')
        .sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());
      setPendingLoans(pending);

      const historical = filteredLoans.filter(loan => loan.status?.toUpperCase() !== 'PENDING');
      const sortedHistorical = historical.sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());
      setHistoricalLoans(sortedHistorical);

      setAllLoans([...pending, ...sortedHistorical]);

    } catch (err: any) {
      console.error('Error fetching loans:', err);
      setError('Could not load loan data. Please try again.');
      Alert.alert('Error', 'Failed to load loan data.');
    } finally {
      setLoadingPending(false);
      setLoadingHistorical(false);
    }
  }, []);

  const fetchAdminDetails = async (adminId: string) => {
    try {
      const adminRes = await fetch(`${BASE_URL}/members/${adminId}`);
      if (!adminRes.ok) {
        throw new Error('Failed to fetch admin details.');
      }
      const adminData: Member = await adminRes.json();
      setGroupAdminDetails(adminData);
    } catch (err) {
      console.error('Error fetching admin details:', err);
      Alert.alert('Error', 'Could not fetch admin details.');
    }
  };

  const fetchMemberContributions = async (memberId: string, memberName: string) => {
    setContributionsLoading(true);
    setSelectedMemberName(memberName);
    try {
      const res = await fetch(`${BASE_URL}/contributions/member/${memberId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch member contributions.');
      }
      const contributionsData: Contribution[] = await res.json();
      setSelectedMemberContributions(contributionsData);
      setIsContributionsModalVisible(true);
    } catch (err) {
      console.error('Error fetching member contributions:', err);
      Alert.alert('Error', 'Could not fetch member contributions.');
    } finally {
      setContributionsLoading(false);
    }
  };

  const fetchMemberLoanHistory = (memberId: string, memberName: string) => {
    setSelectedMemberName(memberName);
    setLoanHistoryLoading(true);
    try {
      const memberLoanHistory = allLoans.filter(loan => loan.member.id === memberId)
        .sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());
      setSelectedMemberLoanHistory(memberLoanHistory);
      setIsLoanHistoryModalVisible(true);
    } catch (err) {
      console.error('Error fetching member loan history:', err);
      Alert.alert('Error', 'Could not fetch member loan history.');
    } finally {
      setLoanHistoryLoading(false);
    }
  };

  useEffect(() => {
    const getAdminIdAndFetch = async () => {
      setLoadingPending(true);
      setLoadingHistorical(true);
      const adminId = await AsyncStorage.getItem('userId');
      if (adminId) {
        setGroupAdminId(adminId);
        await Promise.all([
          fetchLoans(adminId),
          fetchAdminDetails(adminId)
        ]);
      } else {
        Alert.alert('Error', 'Group Admin ID not found. Please log in again.');
        router.replace('/(auth)');
      }
    };
    getAdminIdAndFetch();
  }, [fetchLoans]);

  const handleUpdateLoan = async (loanId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    if (!groupAdminId) {
      Alert.alert('Error', 'Cannot update loan. Group Admin ID is missing.');
      return;
    }

    const loanToUpdate = pendingLoans.find(loan => loan.id === loanId);
    if (!loanToUpdate) {
      Alert.alert('Error', 'Loan not found.');
      return;
    }

    const updatedLoanPayload = {
      ...loanToUpdate,
      status: newStatus,
      outstandingBalance: newStatus === 'APPROVED' ? loanToUpdate.amount : 0,
    };

    try {
      const res = await fetch(`${BASE_URL}/loans/${loanId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedLoanPayload),
      });

      if (res.ok) {
        Alert.alert('Success', `Loan application successfully ${newStatus.toLowerCase()}.`);

        setPendingLoans(prevLoans => prevLoans.filter(loan => loan.id !== loanId));
        if (newStatus === 'APPROVED') {
          setHistoricalLoans(prevLoans => [updatedLoanPayload, ...prevLoans]);
        }
        setAllLoans(prevLoans => prevLoans.map(loan => loan.id === loanId ? updatedLoanPayload : loan));

        if (newStatus === 'APPROVED' && groupAdminDetails) {
          const memberName = `${loanToUpdate.member.firstName} ${loanToUpdate.member.lastName}`;
          const loanAmount = loanToUpdate.amount.toLocaleString();
          const adminName = `${groupAdminDetails.firstName} ${groupAdminDetails.lastName}`;
          const adminPhoneNumber = groupAdminDetails.phoneNumber;

          let notificationMessage = `Hello ${memberName}, your loan application for KES ${loanAmount} has been approved. Please contact your group admin, ${adminName}, to discuss the next steps.`;

          if (adminPhoneNumber) {
            notificationMessage += ` You can reach them at ${adminPhoneNumber}.`;
          }

          const notificationPayload = {
            member: loanToUpdate.member,
            messageContent: notificationMessage,
          };

          try {
            const notificationRes = await fetch(`${BASE_URL}/notifications`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(notificationPayload),
            });

            if (notificationRes.ok) {
              console.log('Notification sent successfully.');
            } else {
              console.error('Failed to send notification:', await notificationRes.text());
            }
          } catch (notificationErr) {
            console.error('Error sending notification:', notificationErr);
          }
        }
      } else {
        throw new Error('Failed to update loan status.');
      }
    } catch (err) {
      console.error('Error updating loan:', err);
      Alert.alert('Error', 'Failed to update loan status. Please try again.');
    }
  };

  const handleOpenPayModal = (loan: Loan) => {
    setLoanToPay(loan);
    setPaymentAmount('');
    setIsPayModalVisible(true);
  };

  // ✅ THIS IS THE UPDATED FUNCTION
  const handleRecordPayment = async () => {
    if (!loanToPay) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount.');
      return;
    }

    if (amount > loanToPay.outstandingBalance) {
      Alert.alert('Error', 'Payment amount cannot exceed the outstanding balance.');
      return;
    }

    try {
      // Use the new POST endpoint for payments
      const res = await fetch(`${BASE_URL}/loans/${loanToPay.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentAmount: amount }),
      });

      if (res.ok) {
        const updatedLoan = await res.json();
        Alert.alert('Success', `Payment of KES ${amount.toLocaleString()} recorded successfully.`);
        setIsPayModalVisible(false);
        setLoanToPay(null);

        // Update the state with the new loan object from the server response
        setHistoricalLoans(prevLoans =>
          prevLoans.map(loan =>
            loan.id === updatedLoan.id ? updatedLoan : loan
          )
        );
        setAllLoans(prevLoans =>
          prevLoans.map(loan =>
            loan.id === updatedLoan.id ? updatedLoan : loan
          )
        );
      } else {
        const errorText = await res.text();
        throw new Error(`Failed to record payment: ${errorText}`);
      }
    } catch (err: any) {
      console.error('Error recording payment:', err);
      Alert.alert('Error', err.message || 'Failed to record payment. Please try again.');
    }
  };

  const renderPendingLoanCard = (loan: Loan) => (
    <View key={loan.id} style={styles.loanCard}>
      <View style={styles.loanDetails}>
        <Text style={styles.loanMember}>
          <Text style={styles.boldText}>Member: </Text>
          {loan.member?.firstName} {loan.member?.lastName}
        </Text>
        <Text style={styles.loanAmount}>
          <Text style={styles.boldText}>Amount: </Text>
          KES {loan.amount.toLocaleString()}
        </Text>
        <Text style={styles.loanDate}>
          <Text style={styles.boldText}>Date: </Text>
          {new Date(loan.createdOn).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.loanActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.contributionsButton]}
          onPress={() => fetchMemberContributions(
            loan.member.id,
            `${loan.member.firstName} ${loan.member.lastName}`
          )}
        >
          <Text style={styles.actionButtonText}>Contributions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleUpdateLoan(loan.id, 'APPROVED')}
        >
          <Text style={styles.actionButtonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleUpdateLoan(loan.id, 'REJECTED')}
        >
          <Text style={styles.actionButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistoricalLoanRow = (loan: Loan) => (
    <View key={loan.id} style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2 }]}>
        {loan.member?.firstName} {loan.member?.lastName}
      </Text>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>
        KES {loan.amount.toLocaleString()}
      </Text>
      <Text style={[styles.tableCell, { flex: 1 }]}> {/* ADD THIS NEW CELL */}
KES {(loan.totalPaid ?? 0).toLocaleString()}
      </Text>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>
        KES {loan.outstandingBalance.toLocaleString()}
      </Text>
      <Text style={[
        styles.tableCell,
        styles.statusText,
        { flex: 1.5 },
        loan.status === 'APPROVED' && styles.statusApproved,
        loan.status === 'REJECTED' && styles.statusRejected,
        loan.status === 'PAID' && styles.statusPaid,
      ]}>
        {loan.status}
      </Text>
       <Text style={[styles.tableCell, { flex: 2 }]}>{loan.reason}</Text>
      <View style={[styles.tableCell, { flex: 1.5, flexDirection: 'row', justifyContent: 'center' }]}>
        {loan.status === 'APPROVED' && (
          <TouchableOpacity
            style={[styles.smallActionButton, styles.payButton, { marginRight: 5 }]}
            onPress={() => handleOpenPayModal(loan)}
          >
            <Text style={styles.smallActionButtonText}>Pay</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.smallActionButton, styles.contributionsButton]}
          onPress={() => fetchMemberLoanHistory(
            loan.member.id,
            `${loan.member.firstName} ${loan.member.lastName}`
          )}
        >
          <Text style={styles.smallActionButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Management</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContent}>
          <Text style={styles.sectionTitle}>Pending Applications</Text>
          {loadingPending ? (
            <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : pendingLoans.length === 0 ? (
            <Text style={styles.emptyMessage}>No pending loan applications.</Text>
          ) : (
            pendingLoans.map(renderPendingLoanCard)
          )}

          <Text style={styles.sectionTitle}>All Group Loans</Text>
          {loadingHistorical ? (
            <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : historicalLoans.length === 0 ? (
            <Text style={styles.emptyMessage}>No historical loan data found for this group.</Text>
          ) : (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Member</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Amount</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Paid</Text> {/* ADD THIS LINE */}
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Outstanding</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Status</Text>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Reason</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Actions</Text>
              </View>
              {historicalLoans.map(renderHistoricalLoanRow)}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isContributionsModalVisible}
        onRequestClose={() => {
          setIsContributionsModalVisible(!isContributionsModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>{selectedMemberName}'s Contributions</Text>
            {contributionsLoading ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : selectedMemberContributions.length > 0 ? (
              <ScrollView style={styles.modalContributionsList}>
                {selectedMemberContributions.map((contrib) => (
                  <View key={contrib.id} style={styles.contributionRow}>
                    <View>
                      <Text style={styles.dateText}>
                        {new Date(contrib.transactionDate).toDateString()}
                      </Text>
                      <Text style={styles.paymentText}>
                        Method: {contrib.paymentMethod}
                      </Text>
                    </View>
                    <Text style={styles.amountText}>
                      KES {contrib.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyMessage}>No contributions found for this member.</Text>
            )}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: '#F44336' }]}
              onPress={() => setIsContributionsModalVisible(!isContributionsModalVisible)}
            >
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isLoanHistoryModalVisible}
        onRequestClose={() => {
          setIsLoanHistoryModalVisible(!isLoanHistoryModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>{selectedMemberName}'s Loan History</Text>
            {loanHistoryLoading ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : selectedMemberLoanHistory.length > 0 ? (
              <ScrollView style={styles.modalContributionsList}>
                {selectedMemberLoanHistory.map((loan) => (
                  <View key={loan.id} style={styles.contributionRow}>
                    <View>
                      <Text style={styles.dateText}>
                        Date: {new Date(loan.createdOn).toDateString()}
                      </Text>
                      <Text style={styles.paymentText}>
                        Status: {loan.status}
                      </Text>
                    </View>
                    <Text style={styles.amountText}>
                      KES {loan.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyMessage}>No loan history found for this member.</Text>
            )}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: '#F44336' }]}
              onPress={() => setIsLoanHistoryModalVisible(!isLoanHistoryModalVisible)}
            >
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isPayModalVisible}
        onRequestClose={() => {
          setIsPayModalVisible(!isPayModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            {loanToPay && (
              <>
                <Text style={styles.modalTitle}>Record Payment for {loanToPay.member.firstName} {loanToPay.member.lastName}</Text>
                <Text style={styles.modalText}>Total Amount: <Text style={styles.modalTextHighlight}>KES {loanToPay.amount.toLocaleString()}</Text></Text>
                <Text style={styles.modalText}>Outstanding Balance: <Text style={styles.modalTextHighlight}>KES {loanToPay.outstandingBalance.toLocaleString()}</Text></Text>
                
                <TextInput
                  style={styles.textInput}
                  onChangeText={setPaymentAmount}
                  value={paymentAmount}
                  placeholder="Enter payment amount"
                  keyboardType="numeric"
                />

                <TouchableOpacity
                  style={[styles.payButton, styles.modalButton]}
                  onPress={handleRecordPayment}
                >
                  <Text style={styles.actionButtonText}>Record Payment</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeButton, styles.modalButton]}
                  onPress={() => setIsPayModalVisible(false)}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F0F4F7' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: '#64B5F6',
    elevation: 3,
  },
  backButton: {
    paddingRight: 10,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  mainContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1565C0',
    marginTop: 20,
    marginBottom: 10,
  },
  loanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loanDetails: {
    marginBottom: 15,
  },
  loanMember: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  loanAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 5,
  },
  loanDate: {
    fontSize: 14,
    color: '#777',
  },
  boldText: {
    fontWeight: 'bold',
  },
  loanActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  contributionsButton: {
    backgroundColor: '#FFC107',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyMessage: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 18,
    color: '#F44336',
  },
  loader: {
    marginTop: 20,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 5,
    textAlign: 'center',
  },
  modalTextHighlight: {
    fontWeight: 'bold',
    color: '#1565C0',
  },
  modalContributionsList: {
    width: '100%',
    marginBottom: 15,
  },
  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dateText: {
    fontSize: 14,
    color: '#555',
  },
  paymentText: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  amountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    elevation: 2,
    width: '100%',
    backgroundColor: '#F44336',
  },
  modalButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  textInput: {
    width: '100%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    paddingVertical: 10,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#1565C0',
    textAlign: 'center',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    paddingVertical: 5,
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 5,
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  statusText: {
    fontWeight: 'bold',
  },
  statusApproved: {
    color: '#4CAF50',
  },
  statusRejected: {
    color: '#F44336',
  },
  statusPaid: {
    color: '#9E9E9E',
  },
  smallActionButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignSelf: 'center',
  },
  smallActionButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  payButton: {
    backgroundColor: '#2196F3',
  },
});
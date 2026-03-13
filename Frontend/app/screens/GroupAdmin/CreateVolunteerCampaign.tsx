import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';

const BASE_URL = 'http://192.168.0.101:8080/api';

interface Campaign {
  id: string;
  campaignName: string;
  description: string;
  targetAmount: number | null;
  raisedAmount: number;
  progress: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  createdByName: string;
  createdOn: string;
  contributorCount: number;
  totalContributions: number;
  daysRemaining: number;
  isOpen: boolean;
  isExpired: boolean;
}

type FilterType = 'all' | 'active' | 'closed' | 'completed';

export default function VolunteerCampaignsScreen() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [userId, setUserId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [adminName, setAdminName] = useState('');
  
  // Form fields for creating campaign
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Campaigns list
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  
  // Filter states
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  // Months and years for filters
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => 
    (currentYear - 5 + i).toString()
  );

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [campaigns, filterType, selectedMonth, selectedYear]);

  const loadUserData = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      const group = await AsyncStorage.getItem('userGroupId');
      const groupNameStored = await AsyncStorage.getItem('userGroupName');
      const firstName = await AsyncStorage.getItem('userFirstName');
      const lastName = await AsyncStorage.getItem('userLastName');
      
      setUserId(id || '');
      setGroupId(group || '');
      setGroupName(groupNameStored || '');
      setAdminName(`${firstName || ''} ${lastName || ''}`.trim());
      
      if (group) {
        await fetchCampaigns(group);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async (gId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/volunteer-campaigns/group/${gId}`);
      
      if (response.ok) {
        const data: Campaign[] = await response.json();
        // Sort by created date (newest first)
        data.sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());
        setCampaigns(data);
        setFilteredCampaigns(data);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      Alert.alert('Error', 'Failed to load volunteer campaigns');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (groupId) {
      await fetchCampaigns(groupId);
    }
    setRefreshing(false);
  };

  const handleCreateCampaign = async () => {
    // Validation
    if (!campaignName.trim()) {
      Alert.alert('Validation', 'Campaign name is required.');
      return;
    }

    if (!startDate) {
      Alert.alert('Validation', 'Start date is required.');
      return;
    }

    if (!endDate) {
      Alert.alert('Validation', 'End date is required.');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Validation', 'End date must be after start date.');
      return;
    }

    if (targetAmount && parseFloat(targetAmount) <= 0) {
      Alert.alert('Validation', 'Target amount must be greater than 0.');
      return;
    }

    if (!groupId) {
      Alert.alert('Error', 'Group information not found.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        campaignName: campaignName.trim(),
        description: description.trim() || `Volunteer campaign created by ${adminName}`,
        targetAmount: targetAmount ? parseFloat(targetAmount) : null,
        startDate: startDate,
        endDate: endDate,
        groupId: groupId
      };

      const response = await fetch(`${BASE_URL}/volunteer-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'userId': userId
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        Alert.alert('Success', 'Campaign created successfully!');
        // Reset form
        setCampaignName('');
        setDescription('');
        setTargetAmount('');
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        // Refresh list
        await fetchCampaigns(groupId);
      } else {
        const error = await response.text();
        throw new Error(error || 'Failed to create campaign');
      }
    } catch (error: any) {
      console.error('Create campaign error:', error);
      Alert.alert('Error', error.message || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...campaigns];

    // Filter by status
    switch (filterType) {
      case 'active':
        filtered = filtered.filter(c => c.status === 'ACTIVE' && !c.isExpired);
        break;
      case 'closed':
        filtered = filtered.filter(c => c.status === 'CLOSED' || c.isExpired);
        break;
      case 'completed':
        filtered = filtered.filter(c => c.status === 'COMPLETED');
        break;
      case 'all':
      default:
        break;
    }

    // Filter by month/year
    if (selectedMonth) {
      filtered = filtered.filter(campaign => {
        const date = new Date(campaign.startDate);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return month === selectedMonth;
      });
    }

    if (selectedYear) {
      filtered = filtered.filter(campaign => {
        const date = new Date(campaign.startDate);
        const year = date.getFullYear().toString();
        return year === selectedYear;
      });
    }

    setFilteredCampaigns(filtered);
  };

  const resetFilters = () => {
    setFilterType('all');
    setSelectedMonth('');
    setSelectedYear('');
  };

  const getFilterSummary = () => {
    let summary = 'Showing ';
    if (filterType === 'all') summary += 'all campaigns';
    else if (filterType === 'active') summary += 'active campaigns';
    else if (filterType === 'closed') summary += 'closed/expired campaigns';
    else if (filterType === 'completed') summary += 'completed campaigns';
    
    if (selectedMonth) {
      const monthName = months.find(m => m.value === selectedMonth)?.label;
      summary += ` • ${monthName}`;
    }
    if (selectedYear) summary += ` ${selectedYear}`;
    
    return summary;
  };

  const getStatusColor = (status: string, isExpired: boolean) => {
    if (isExpired) return '#FF9800';
    switch (status) {
      case 'ACTIVE':
        return '#4CAF50';
      case 'COMPLETED':
        return '#2196F3';
      case 'CLOSED':
        return '#9E9E9E';
      case 'CANCELLED':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusText = (campaign: Campaign) => {
    if (campaign.isExpired) return 'EXPIRED';
    return campaign.status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateStats = () => {
    const totalRaised = filteredCampaigns.reduce((sum, c) => sum + c.raisedAmount, 0);
    const activeCount = filteredCampaigns.filter(c => c.status === 'ACTIVE' && !c.isExpired).length;
    return { totalRaised, activeCount };
  };

  const stats = calculateStats();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image 
            source={require('../../../assets/images/logo.png')} 
            style={styles.logo} 
          />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backToHome}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Volunteer Campaigns</Text>
        <Text style={styles.subtitle}>{groupName}</Text>

        {/* CREATE CAMPAIGN SECTION - Like Expense Form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create New Campaign</Text>
          
          <Text style={styles.label}>Campaign Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., School Building Fund - March 2024"
            placeholderTextColor="#999"
            value={campaignName}
            onChangeText={setCampaignName}
            maxLength={200}
          />

          <Text style={styles.label}>Description / Purpose</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe what this campaign is for..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Target Amount (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter target amount"
            placeholderTextColor="#999"
            value={targetAmount}
            onChangeText={setTargetAmount}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Start Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            value={startDate}
            onChangeText={setStartDate}
          />

          <Text style={styles.label}>End Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            value={endDate}
            onChangeText={setEndDate}
          />

          {/* Duration Summary */}
          {startDate && endDate && (
            <View style={styles.durationPreview}>
              <Text style={styles.durationText}>
                📅 Duration: {calculateDays()} days
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[
              styles.createButton,
              (!campaignName.trim() || !startDate || !endDate || submitting) && styles.disabledButton
            ]}
            onPress={handleCreateCampaign}
            disabled={!campaignName.trim() || !startDate || !endDate || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>
                Create Campaign {targetAmount ? `(KES ${parseFloat(targetAmount).toLocaleString()})` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* CAMPAIGN HISTORY SECTION - Like Expense History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Campaign History</Text>
            <Text style={styles.filterSummary}>{getFilterSummary()}</Text>
          </View>

          {/* Filter Controls - Like Expense Screen */}
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Quick Filters:</Text>
            <View style={styles.filterButtons}>
              {(['all', 'active', 'closed', 'completed'] as FilterType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterButton,
                    filterType === type && styles.filterButtonActive
                  ]}
                  onPress={() => setFilterType(type)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filterType === type && styles.filterButtonTextActive
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Month/Year Filters */}
            <View style={styles.monthYearFilterContainer}>
              <Text style={styles.filterLabel}>Filter by date:</Text>
              <View style={styles.pickerRow}>
                <Picker
                  selectedValue={selectedMonth}
                  onValueChange={setSelectedMonth}
                  style={styles.monthPicker}
                >
                  <Picker.Item label="All Months" value="" />
                  {months.map(month => (
                    <Picker.Item key={month.value} label={month.label} value={month.value} />
                  ))}
                </Picker>
                
                <Picker
                  selectedValue={selectedYear}
                  onValueChange={setSelectedYear}
                  style={styles.yearPicker}
                >
                  <Picker.Item label="All Years" value="" />
                  {years.map(year => (
                    <Picker.Item key={year} label={year} value={year} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Reset Filter */}
            {(filterType !== 'all' || selectedMonth || selectedYear) && (
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset Filters</Text>
              </TouchableOpacity>
            )}

            {/* Summary Stats */}
            {filteredCampaigns.length > 0 && (
              <View style={styles.statsSummary}>
                <Text style={styles.statsText}>
                  {filteredCampaigns.length} campaign(s) • KES {stats.totalRaised.toLocaleString()} raised
                </Text>
              </View>
            )}
          </View>

          {/* Campaigns List */}
          {loading ? (
            <ActivityIndicator size="large" color="#2E7D32" style={styles.loader} />
          ) : filteredCampaigns.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No campaigns found</Text>
              {(filterType !== 'all' || selectedMonth || selectedYear) && (
                <TouchableOpacity onPress={resetFilters}>
                  <Text style={styles.resetFilterText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredCampaigns.map((campaign) => (
              <View key={campaign.id} style={styles.campaignRow}>
                <View style={styles.campaignHeader}>
                  <View style={styles.campaignTitleContainer}>
                    <Text style={styles.campaignName}>{campaign.campaignName}</Text>
                    <Text style={styles.campaignDate}>
                      {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(campaign.status, campaign.isExpired) + '20' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(campaign.status, campaign.isExpired) }
                    ]}>
                      {getStatusText(campaign)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.campaignDescription} numberOfLines={2}>
                  {campaign.description}
                </Text>

                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressPercentage}>
                      {campaign.progress.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar,
                        { 
                          width: `${Math.min(campaign.progress, 100)}%`,
                          backgroundColor: campaign.progress >= 100 ? '#4CAF50' : '#2196F3'
                        }
                      ]} 
                    />
                  </View>
                  <View style={styles.amountRow}>
                    <Text style={styles.raisedAmount}>
                      KES {campaign.raisedAmount.toLocaleString()}
                    </Text>
                    <Text style={styles.targetAmount}>
                      {campaign.targetAmount 
                        ? `target: KES ${campaign.targetAmount.toLocaleString()}`
                        : 'no target'}
                    </Text>
                  </View>
                </View>

                <View style={styles.campaignFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerIcon}>👥</Text>
                    <Text style={styles.footerText}>
                      {campaign.contributorCount} contributor(s)
                    </Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerItem}>
                    <Text style={styles.footerIcon}>👤</Text>
                    <Text style={styles.footerText}>
                      {campaign.createdByName?.split(' ')[0] || 'Admin'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#E3F2FD' 
  },
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
  logo: { 
    width: 35, 
    height: 35, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  logoText: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  backToHome: { 
    color: '#1565C0', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  container: { 
    padding: 16, 
    paddingBottom: 100 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#1565C0',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  // Form Styles - EXACT from Expense Screen
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
  durationPreview: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  durationText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#2E7D32',
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
  disabledButton: {
    backgroundColor: '#81C784',
  },
  createButtonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16,
  },
  // History Section - EXACT from Expense Screen
  historySection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    elevation: 2,
  },
  historyHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    marginBottom: 15,
    paddingBottom: 8,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
    textAlign: 'center',
  },
  filterSummary: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },
  // Filter Styles - EXACT from Expense Screen
  filterContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 10,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E9ECEF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#495057',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  monthYearFilterContainer: {
    marginTop: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  monthPicker: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  yearPicker: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  resetButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  statsSummary: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resetFilterText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
  },
  // Campaign Row Styles
  campaignRow: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  campaignTitleContainer: {
    flex: 1,
  },
  campaignName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  campaignDate: {
    fontSize: 11,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  campaignDescription: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
    lineHeight: 18,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  raisedAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  targetAmount: {
    fontSize: 12,
    color: '#666',
  },
  campaignFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#666',
  },
  footerDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
});

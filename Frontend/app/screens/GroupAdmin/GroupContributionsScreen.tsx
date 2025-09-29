import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput, // Added TextInput for the search bar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.103:8080/api';

interface Member {
  firstName: string;
  lastName: string;
}

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  member?: Member;
}

interface Group {
  id: string;
  groupName: string;
  contributions: Contribution[];
  totalAmount: number;
}

export default function GroupContributionsScreen() {
  const router = useRouter();
  const { setUserRole } = useContext(AuthContext)!;
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Effect to fetch initial group and contribution data
  useEffect(() => {
    const fetchGroupContributions = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          setLoading(false);
          return;
        }

        const groupRes = await fetch(`${BASE_URL}/groups/groupadmin/${userId}`);
        if (!groupRes.ok) throw new Error('Failed to fetch groups');

        const groupData = await groupRes.json();
        const updatedGroups: Group[] = [];

        for (const group of groupData) {
          const contributionRes = await fetch(`${BASE_URL}/contributions/group/${group.id}`);
          let contributions: Contribution[] = [];
          let totalAmount = 0;

          if (contributionRes.ok) {
            contributions = await contributionRes.json();
            totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);
          }

          updatedGroups.push({
            id: group.id,
            groupName: group.groupName,
            contributions,
            totalAmount,
          });
        }

        setGroups(updatedGroups);
      } catch (err) {
        console.error('Error fetching group contributions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupContributions();
  }, []);

  // Effect to filter groups based on search query
  useEffect(() => {
    if (searchQuery === '') {
      setFilteredGroups(groups);
      return;
    }

    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = groups
      .map((group) => {
        // Filter contributions within each group
        const filteredContributions = group.contributions.filter((contrib) => {
          const memberName = contrib.member
            ? `${contrib.member.firstName} ${contrib.member.lastName}`.toLowerCase()
            : '';
          const paymentMethod = contrib.paymentMethod?.toLowerCase() || '';
          const transactionDate = new Date(contrib.transactionDate).toDateString().toLowerCase();
          const amount = contrib.amount.toLocaleString().toLowerCase();

          return (
            group.groupName.toLowerCase().includes(lowercasedQuery) ||
            memberName.includes(lowercasedQuery) ||
            paymentMethod.includes(lowercasedQuery) ||
            transactionDate.includes(lowercasedQuery) ||
            amount.includes(lowercasedQuery)
          );
        });

        // Return a new group object with only the matching contributions
        // only if there are any matching contributions.
        if (filteredContributions.length > 0) {
          return {
            ...group,
            contributions: filteredContributions,
          };
        }
        return null; // Don't include groups with no matching contributions
      })
      .filter(Boolean) as Group[]; // Remove any null entries

    setFilteredGroups(filtered);
  }, [searchQuery, groups]); // Re-run this effect when searchQuery or groups change

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.appTitleContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.headerButtonText}>← Home</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Group Contributions</Text>

        {/* Search Input */}
        <TextInput
          style={styles.searchBar}
          placeholder="Search contributions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" />
        ) : (
          filteredGroups.map((group) => (
            <View key={group.id} style={styles.groupCard}>
              <Text style={styles.groupTitle}>{group.groupName}</Text>
              <Text style={styles.totalText}>
                Total Contributions: KES {group.totalAmount.toLocaleString()}
              </Text>

              {group.contributions.length === 0 ? (
                <Text style={styles.noContributions}>No contributions yet</Text>
              ) : (
                group.contributions.map((contrib) => (
                  <View key={contrib.id} style={styles.contributionRow}>
                    <View>
                      <Text style={styles.dateText}>
                        {new Date(contrib.transactionDate).toDateString()}
                      </Text>
                      <Text style={styles.byText}>
                        By:{' '}
                        {contrib.member
                          ? `${contrib.member.firstName} ${contrib.member.lastName}`
                          : 'Unknown'}
                      </Text>
                      <Text style={styles.paymentText}>
                        Payment: {contrib.paymentMethod || 'N/A'}
                      </Text>
                    </View>
                    <Text style={styles.amountText}>
                      KES {contrib.amount.toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Nav */}
      <GroupAdminBottomNav current="group-contributions" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 181, 246, 1)',
    elevation: 3,
  },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  appTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  titleBlack: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  titleGreen: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50', marginLeft: 4 },
  headerButtonText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },

  container: { padding: 20, paddingBottom: 100 },
  screenTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#333' },

  searchBar: {
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
  },

  groupCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
  },
  groupTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#1565C0' },
  totalText: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#4CAF50' },
  noContributions: { fontStyle: 'italic', color: '#888' },
  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 6,
  },
  dateText: { fontSize: 14, color: '#555' },
  byText: { fontSize: 13, color: '#666', marginTop: 2 },
  paymentText: { fontSize: 13, color: '#777', marginTop: 2 },
  amountText: { fontSize: 14, fontWeight: '500', color: '#333', textAlign: 'right' },
});

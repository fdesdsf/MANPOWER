import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL =  'http://192.168.0.103:8080/api';

type Group = {
  id: string;
  groupName: string;
  creationDate: string;
  status: 'Active' | 'Terminated';
};

function ManageGroupsScreen(): React.JSX.Element {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groupAdminId = await AsyncStorage.getItem('userId');
        if (!groupAdminId) throw new Error('No GroupAdmin ID found');

        const response = await fetch(`${API_BASE_URL}/groups/groupadmin/${groupAdminId}`);
        const data = await response.json();
        const formatted: Group[] = data.map((group: any) => ({
          id: group.id,
          groupName: group.groupName,
          creationDate: group.creationDate,
          status: group.status || 'Active',
        }));
        setGroups(formatted);
      } catch (error) {
        console.error('Failed to load groups:', error);
        Alert.alert('Error', 'Could not fetch groups');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  const handleTerminateGroup = (groupId: string) => {
    Alert.alert(
      'Confirm Termination',
      'Are you sure you want to terminate this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/groups/${groupId}/terminate`, {
                method: 'PUT',
              });
              if (!response.ok) throw new Error('Failed to terminate group');

              const updatedGroup = await response.json();
              setGroups((prev) =>
                prev.map((group) =>
                  group.id === updatedGroup.id ? { ...group, status: updatedGroup.status } : group
                )
              );
              Alert.alert('Terminated', 'The group has been terminated.');
            } catch (error) {
              Alert.alert('Error', 'Failed to terminate the group.');
            }
          },
        },
      ]
    );
  };

  const renderGroupItem = ({ item }: { item: Group }) => (
    <View style={styles.groupCard}>
      <Text style={styles.groupName}>{item.groupName}</Text>
      <Text style={styles.groupMeta}>Created on: {item.creationDate}</Text>
      <Text style={styles.groupMeta}>Status: {item.status}</Text>
      {item.status === 'Active' && (
        <TouchableOpacity
          style={styles.terminateButton}
          onPress={() => handleTerminateGroup(item.id)}
        >
          <Text style={styles.terminateText}>Terminate Group</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const filteredGroups = groups.filter(group =>
    group.groupName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with logo and MANPOWER title */}
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
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={styles.container}>
        <Text style={styles.title}>Manage Groups</Text>
        <TextInput
          placeholder="Search group name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#1565C0" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            ListEmptyComponent={
              <Text style={styles.noResultsText}>No matching groups found.</Text>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>

      {/* Bottom nav */}
      <GroupAdminBottomNav current="manage-groups" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
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
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  backToHome: {
    color: '#1565C0',
    fontWeight: 'bold',
    fontSize: 14,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 16,
  },
  groupCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  groupMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  terminateButton: {
    marginTop: 10,
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  terminateText: {
    color: '#fff',
    fontWeight: '600',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 30,
  },
});

export default ManageGroupsScreen;

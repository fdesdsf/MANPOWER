import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  FlatList,
  Pressable,
  Modal,
  Alert,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const mockDocuments = [
  { id: '1', name: 'Financial Report Q2.pdf', group: 'All Groups', type: 'PDF', uri: 'https://example.com/report.pdf' },
  { id: '2', name: 'Meeting Minutes - May.docx', group: 'Group A', type: 'Word', uri: 'https://example.com/minutes.docx' },
  { id: '3', name: 'Budget Plan.xlsx', group: 'Group B', type: 'Excel', uri: 'https://example.com/budget.xlsx' },
];

export default function DocumentManagementScreen(): React.JSX.Element {
  const [showTooltip, setShowTooltip] = useState<{ [key: string]: string | null }>({});
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleDelete = (name: string) => {
    Alert.alert('Delete', `Are you sure you want to delete "${name}"?`);
  };

  const handleDownload = (uri: string) => {
    Linking.openURL(uri).catch(() => Alert.alert('Error', 'Unable to download file.'));
  };

  const handleOpen = (uri: string) => {
    Linking.openURL(uri).catch(() => Alert.alert('Error', 'Unable to open file.'));
  };

  const handleUploadFromDevice = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.assets && res.assets.length > 0) {
        Alert.alert('Uploaded', `Document: ${res.assets[0].name}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document.');
    }
    setUploadModalVisible(false);
  };

  const openUploadOption = (type: string) => {
    if (type === 'From Device') handleUploadFromDevice();
    else {
      setUploadModalVisible(false);
      Alert.alert('Upload', `You selected: ${type}`);
    }
  };

  const filteredDocs = mockDocuments.filter((doc) =>
    (selectedGroup === 'All' || doc.group === selectedGroup) &&
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: typeof mockDocuments[0] }) => (
    <Pressable style={styles.docItem} onPress={() => handleOpen(item.uri)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.docName}>{item.name}</Text>
        <Text style={styles.docGroup}>Group: {item.group}</Text>
      </View>
      <View style={styles.iconGroup}>
        <Pressable
          onPress={() => handleDownload(item.uri)}
          onPressIn={() => setShowTooltip({ ...showTooltip, [item.id]: 'Download' })}
          onPressOut={() => setShowTooltip({ ...showTooltip, [item.id]: null })}
        >
          <Text style={styles.docAction}>⬇️</Text>
          {showTooltip[item.id] === 'Download' && <Text style={styles.tooltip}>Download</Text>}
        </Pressable>

        <Pressable
          onPress={() => handleDelete(item.name)}
          onPressIn={() => setShowTooltip({ ...showTooltip, [item.id]: 'Delete' })}
          onPressOut={() => setShowTooltip({ ...showTooltip, [item.id]: null })}
        >
          <Text style={styles.docAction}>🗑️</Text>
          {showTooltip[item.id] === 'Delete' && <Text style={styles.tooltip}>Delete</Text>}
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(superadmin)/dashboard')}>
          <Text style={styles.homeLink}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>📁 Document Management</Text>
        <Text style={styles.subtitle}>
          Manage uploaded files across all groups: upload, view, filter, open, download, and delete.
        </Text>

        {/* Search & Filter */}
        <TextInput
          style={styles.searchBar}
          placeholder="Search documents..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterRow}>
          {['All', 'Group A', 'Group B'].map((group) => (
            <TouchableOpacity
              key={group}
              style={[
                styles.filterButton,
                selectedGroup === group && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedGroup(group)}
            >
              <Text style={selectedGroup === group ? styles.filterTextActive : styles.filterText}>
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Document List */}
        <FlatList
          data={filteredDocs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />

        {/* Upload Button */}
        <Pressable style={styles.uploadButton} onPress={() => setUploadModalVisible(true)}>
          <Text style={styles.uploadButtonText}>+ Upload New Document</Text>
        </Pressable>
      </View>

      {/* Upload Modal */}
      <Modal animationType="slide" transparent visible={uploadModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Upload Method</Text>

            {['From Device', 'From Cloud', 'From Link'].map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.modalOption}
                onPress={() => openUploadOption(type)}
              >
                <Text style={styles.modalOptionText}>
                  {type === 'From Device' ? '📂' : type === 'From Cloud' ? '☁️' : '🔗'} {type}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Nav */}
      <SuperAdminBottomNav current="documents" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
  },
  logoNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  textLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlack: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  titleRed: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginLeft: 4,
  },
  homeLink: {
    fontSize: 14,
    color: '#D84315',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
  },
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderColor: '#ccc',
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  filterButtonActive: {
    backgroundColor: '#FFCC80',
    borderColor: '#FFA726',
  },
  filterText: {
    color: '#555',
  },
  filterTextActive: {
    color: '#D84315',
    fontWeight: 'bold',
  },
  docItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  docName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  docGroup: {
    fontSize: 13,
    color: '#777',
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 10,
  },
  docAction: {
    fontSize: 22,
    marginHorizontal: 5,
  },
  tooltip: {
    position: 'absolute',
    top: -20,
    backgroundColor: '#333',
    color: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    zIndex: 999,
    left: -10,
  },
  uploadButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2E7D32',
  },
  modalOption: {
    backgroundColor: '#C8E6C9',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalCancel: {
    marginTop: 10,
    color: '#D32F2F',
    fontSize: 14,
  },
});

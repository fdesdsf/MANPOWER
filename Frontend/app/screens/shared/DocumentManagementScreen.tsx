import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const BASE_URL = 'http://192.168.0.101:8080/api';

// Types based on your API
interface GroupMember {
  id: string;
  group: string;
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

interface Group {
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
  members: GroupMember[];
}

interface Document {
  id: string;
  group: Group;
  documentType: string;
  fileName: string;
  filePathUrl: string;
  uploadDate: string;
  uploadedBy: GroupMember;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
}

// User interface based on your login
interface User {
  email: string;
  role: string;
  groupId?: string;
  firstName: string;
  lastName: string;
}

// API service using your BASE_URL
const documentAPI = {
  // Fetch documents based on user role
  async fetchDocuments(userEmail: string): Promise<Document[]> {
    try {
      const response = await fetch(`${BASE_URL}/documents?userEmail=${encodeURIComponent(userEmail)}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to fetch documents');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  },

  // Delete document with user context
  async deleteDocument(id: string, userEmail: string): Promise<void> {
    try {
      const response = await fetch(`${BASE_URL}/documents/${id}?userEmail=${encodeURIComponent(userEmail)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Upload document with user context
  async uploadDocument(documentData: FormData, userEmail: string): Promise<Document> {
    try {
      const url = `${BASE_URL}/documents?userEmail=${encodeURIComponent(userEmail)}`;
      console.log('Uploading to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        body: documentData,
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Upload successful:', result);
      return result;
      
    } catch (error) {
      console.error('Network error:', error);
      throw error;
    }
  },
};

export default function DocumentManagementScreen(): React.JSX.Element {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState<{ [key: string]: string | null }>({});
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Load user data and documents on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userRole = await AsyncStorage.getItem('userRole');
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      const userFirstName = await AsyncStorage.getItem('userFirstName');
      const userLastName = await AsyncStorage.getItem('userLastName');

      if (userEmail && userRole && userFirstName && userLastName) {
        const user: User = {
          email: userEmail,
          role: userRole,
          groupId: userGroupId || undefined,
          firstName: userFirstName,
          lastName: userLastName,
        };
        setCurrentUser(user);
        await loadDocuments(user);
      } else {
        Alert.alert('Error', 'User data not found. Please login again.');
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const loadDocuments = async (user: User) => {
    try {
      setLoading(true);
      const docs = await documentAPI.fetchDocuments(user.email);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message) : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (document: Document) => {
    if (!currentUser) {
      Alert.alert('Error', 'User not found');
      return;
    }

    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentAPI.deleteDocument(document.id, currentUser.email);
              // Remove from local state
              setDocuments(prev => prev.filter(doc => doc.id !== document.id));
              Alert.alert('Success', 'Document deleted successfully');
            } catch (error) {
              Alert.alert('Error', typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message) : 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const handleDownload = (filePathUrl: string) => {
  const absoluteUrl = `${BASE_URL.replace('/api', '')}${filePathUrl}`;
  Linking.openURL(absoluteUrl).catch(() => 
    Alert.alert('Error', 'Unable to download file.')
  );
};

const handleOpen = (filePathUrl: string) => {
  const absoluteUrl = `${BASE_URL.replace('/api', '')}${filePathUrl}`;
  Linking.openURL(absoluteUrl).catch(() => 
    Alert.alert('Error', 'Unable to open file.')
  );
};

  const handleUploadFromDevice = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'User not found');
      return;
    }

    try {
      setUploading(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        
        // Convert file to Blob first
        const response = await fetch(file.uri);
        const blob = await response.blob();
        
        // Create FormData with Blob
        const formData = new FormData();
        formData.append('file', blob, file.name);
        
        // Build URL with user context only
        const fileType = getFileType(file.name);
        const queryParams = new URLSearchParams();
        
        // Add user email for authentication
        queryParams.append('userEmail', currentUser.email);
        
        if (file.name) {
          queryParams.append('fileName', file.name);
        }
        
        if (fileType) {
          queryParams.append('documentType', fileType);
        }

        const url = `${BASE_URL}/documents?${queryParams.toString()}`;

        console.log('Upload URL:', url);
        console.log('Using blob with file:', file.name);
        console.log('User context:', { 
          userEmail: currentUser.email,
          fileName: file.name, 
          documentType: fileType,
        });

        const uploadedDoc = await documentAPI.uploadDocument(formData, currentUser.email);
        
        setDocuments(prev => [uploadedDoc, ...prev]);
        Alert.alert('Success', `Document "${file.name}" uploaded successfully`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert(
        'Upload Failed',
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Could not upload document. Please try again.'
      );
    } finally {
      setUploading(false);
      setUploadModalVisible(false);
    }
  };

  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return 'PDF';
    if (['doc', 'docx'].includes(ext || '')) return 'Word';
    if (['xls', 'xlsx'].includes(ext || '')) return 'Excel';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'Image';
    return 'Other';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getUploaderName = (uploadedBy: GroupMember): string => {
    return `${uploadedBy.firstName} ${uploadedBy.lastName}`.trim() || 'Unknown User';
  };

  // For Group Admin, they only see their group's documents
  // So available groups will only be their group + 'All'
  const userGroup = documents[0]?.group?.groupName || currentUser?.groupId;
  const availableGroups = ['All', userGroup].filter((g): g is string => typeof g === 'string' && !!g);

  const filteredDocs = documents.filter((doc) =>
    (selectedGroup === 'All' || doc.group.groupName === selectedGroup) &&
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openUploadOption = (type: string) => {
    if (type === 'From Device') handleUploadFromDevice();
    else {
      setUploadModalVisible(false);
      Alert.alert('Coming Soon', `${type} upload will be implemented soon`);
    }
  };

  // Check if user can delete document (for UI indication)
  const canUserDeleteDocument = (document: Document): boolean => {
    if (!currentUser) return false;
    
    // Super Admin can delete any document
    if (currentUser.role === 'SuperAdmin') {
      return true;
    }
    
    // Group Admin can only delete documents from their group
    if (currentUser.role === 'GroupAdmin' && 
        currentUser.groupId && 
        document.group.id === currentUser.groupId) {
      return true;
    }
    
    // Regular members cannot delete documents
    return false;
  };

  const renderItem = ({ item }: { item: Document }) => (
    <Pressable style={styles.docItem} onPress={() => handleOpen(item.filePathUrl)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.docName}>{item.fileName}</Text>
        <Text style={styles.docGroup}>Group: {item.group.groupName}</Text>
        <Text style={styles.docMeta}>
          Uploaded by {getUploaderName(item.uploadedBy)} on {formatDate(item.uploadDate)}
        </Text>
        <Text style={styles.docType}>Type: {item.documentType}</Text>
        
        {/* Show group admin badge if document belongs to user's group */}
        {currentUser?.groupId && item.group.id === currentUser.groupId && (
          <Text style={styles.yourGroupBadge}>Your Group</Text>
        )}
      </View>
      <View style={styles.iconGroup}>
        <Pressable
          onPress={() => handleDownload(item.filePathUrl)}
          onPressIn={() => setShowTooltip({ ...showTooltip, [item.id]: 'Download' })}
          onPressOut={() => setShowTooltip({ ...showTooltip, [item.id]: null })}
        >
          <Text style={styles.docAction}>⬇️</Text>
          {showTooltip[item.id] === 'Download' && <Text style={styles.tooltip}>Download</Text>}
        </Pressable>

        {canUserDeleteDocument(item) && (
          <Pressable
            onPress={() => handleDelete(item)}
            onPressIn={() => setShowTooltip({ ...showTooltip, [item.id]: 'Delete' })}
            onPressOut={() => setShowTooltip({ ...showTooltip, [item.id]: null })}
          >
            <Text style={styles.docAction}>🗑️</Text>
            {showTooltip[item.id] === 'Delete' && <Text style={styles.tooltip}>Delete</Text>}
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>JUMUIYA</Text>
            <Text style={styles.titleRed}>CAPITAL</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userInfo}>
            {currentUser.firstName} {currentUser.lastName} ({currentUser.role})
          </Text>
          <TouchableOpacity onPress={() => {
            // Navigate to appropriate dashboard based on role
            if (currentUser.role === 'SuperAdmin') {
              router.push('/(superadmin)/dashboard');
            } else if (currentUser.role === 'GroupAdmin') {
              router.push('/(groupadmin)/dashboard');
            } else {
              router.push('/(member)/dashboard');
            }
          }}>
            <Text style={styles.homeLink}>🏠 Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>📁 Document Management</Text>
        <Text style={styles.subtitle}>
          {currentUser.role === 'GroupAdmin' 
            ? `Manage documents for your group: upload, view, download, and delete files.`
            : currentUser.role === 'SuperAdmin'
            ? 'Manage uploaded files across all groups: upload, view, filter, open, download, and delete.'
            : 'View and download documents from your group.'
          }
        </Text>

        {/* Search & Filter */}
        <TextInput
          style={styles.searchBar}
          placeholder="Search documents..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {/* Only show filter if user has multiple groups or is SuperAdmin */}
        {(availableGroups.length > 1 || currentUser.role === 'SuperAdmin') && (
          <View style={styles.filterRow}>
            {availableGroups.map((group) => (
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
        )}

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading documents...</Text>
          </View>
        ) : (
          /* Document List */
          <FlatList
            data={filteredDocs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery 
                    ? 'No documents found matching your search' 
                    : 'No documents found in your group'
                  }
                </Text>
                <Text style={styles.emptySubtext}>
                  {currentUser.role !== 'Member' ? 'Upload your first document to get started' : 'No documents available yet'}
                </Text>
              </View>
            }
          />
        )}

        {/* Upload Button - Only show for SuperAdmin and GroupAdmin */}
        {(currentUser.role === 'SuperAdmin' || currentUser.role === 'GroupAdmin') && (
          <Pressable 
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]} 
            onPress={() => setUploadModalVisible(true)}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>+ Upload New Document</Text>
            )}
          </Pressable>
        )}
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

            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={() => setUploadModalVisible(false)}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Nav - Will need to update based on user role */}
      {/* <SuperAdminBottomNav current="documents" /> */}
    </SafeAreaView>
  );
}

// ... keep all your existing styles exactly as they were
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
  headerRight: {
    alignItems: 'flex-end',
  },
  userInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
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
    lineHeight: 20,
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
    flexWrap: 'wrap',
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
    fontSize: 12,
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
    marginTop: 2,
  },
  docMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  docType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  yourGroupBadge: {
    fontSize: 10,
    color: '#2E7D32',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
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
  uploadButtonDisabled: {
    backgroundColor: '#81C784',
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
  modalCancelButton: {
    marginTop: 10,
    padding: 8,
  },
  modalCancel: {
    color: '#D32F2F',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
});
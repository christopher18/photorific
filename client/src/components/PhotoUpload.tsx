import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CloudArrowUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import FolderTree from './FolderTree';
import JobProgress, { Job } from './JobProgress';

interface Config {
  folderPath: string;
  awsAccessKey: string;
  awsSecretKey: string;
  bucketName: string;
  region: string;
}

interface PhotoUploadProps {
  config: Config;
  isConfigured: boolean;
  onProgressUpdate: (progress: number) => void;
  onUploadStateChange: (isUploading: boolean) => void;
}

interface Photo {
  id: string;
  name: string;
  size: number;
  path: string;
  relativePath: string;
  lastModified: Date;
  inS3?: boolean;
}

interface FolderData {
  name: string;
  path: string;
  photos: Photo[]; // Note: includes both images and videos
  subfolders: { [key: string]: FolderData };
  photoCount: number; // Note: includes both images and videos
  totalSize: number;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  config,
  isConfigured,
  onProgressUpdate,
  onUploadStateChange
}) => {
  const [folderStructure, setFolderStructure] = useState<FolderData | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ [path: string]: Photo & { inS3: boolean } }>({});
  const [deleteAfterUpload, setDeleteAfterUpload] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<string>('');
  const [totalPhotos, setTotalPhotos] = useState<number>(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());
  const [isSimpleSyncCheck, setIsSimpleSyncCheck] = useState<boolean>(false);
  const [activeFolderUploads, setActiveFolderUploads] = useState<Set<string>>(new Set());
  const [activeFileUploads, setActiveFileUploads] = useState<Set<string>>(new Set());
  
  const wsRef = useRef<WebSocket | null>(null);

  // Helper function to get all photos from folder structure
  const getAllPhotosFromStructure = useCallback((folder: FolderData): Photo[] => {
    let photos = [...folder.photos];
    
    Object.values(folder.subfolders).forEach(subfolder => {
      photos = photos.concat(getAllPhotosFromStructure(subfolder));
    });
    
    return photos;
  }, []);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:9000`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Connected to WebSocket');
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'jobs_list':
            setJobs(data.jobs);
            break;
            
          case 'job_update':
            setJobs(prevJobs => {
              const updatedJobs = prevJobs.filter(job => job.id !== data.job.id);
              return [...updatedJobs, data.job];
            });
            
            // Update progress for active operations
            if (activeJobIds.has(data.job.id)) {
              onProgressUpdate(data.job.progress);
              onUploadStateChange(data.job.status === 'running');
            }
            break;
            
          case 'sync_status_result':
            // If this is a full sync check (all photos), replace the entire sync status
            // If it's a partial check, merge with existing status
            const allPhotos = folderStructure ? getAllPhotosFromStructure(folderStructure) : [];
            const isFullSyncCheck = Object.keys(data.syncStatus).length === allPhotos.length;
            
            if (isFullSyncCheck) {
              setSyncStatus(data.syncStatus);
            } else {
              setSyncStatus(prevSyncStatus => ({
                ...prevSyncStatus,
                ...data.syncStatus
              }));
            }
            
            setActiveJobIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.jobId);
              return newSet;
            });
            break;
            
          case 'upload_result':
            console.log('Upload completed:', data.results);
            setActiveJobIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.jobId);
              return newSet;
            });
            
            // Remove folder from active uploads
            if (data.folderPath) {
              setActiveFolderUploads(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.folderPath);
                return newSet;
              });
            }
            
            // Remove file from active uploads
            if (data.fileId) {
              setActiveFileUploads(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.fileId);
                return newSet;
              });
            }
            
            // Refresh sync status after upload
            if (folderStructure) {
              const allPhotos = getAllPhotosFromStructure(folderStructure);
              checkSyncStatusSimple(allPhotos);
            }
            break;
            
          case 'file_upload_success':
            // Real-time sync status update for individual file uploads
            setSyncStatus(prevSyncStatus => ({
              ...prevSyncStatus,
              [data.relativePath]: {
                ...prevSyncStatus[data.relativePath],
                inS3: true,
                s3Key: data.s3Key
              }
            }));
            break;
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    if (isConfigured) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isConfigured, folderStructure, activeJobIds, onProgressUpdate, onUploadStateChange, getAllPhotosFromStructure]);

  const scanForPhotos = useCallback(async () => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/scan-photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath: config.folderPath }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setFolderStructure(data.folderStructure);
        setTotalPhotos(data.totalPhotos);
        setLastScan(data.scanTime);
        
        // Clear previous sync status when rescanning
        setSyncStatus({});
      } else {
        const error = await response.json();
        console.error('Scan error:', error);
      }
    } catch (error) {
      console.error('Error scanning media files:', error);
    } finally {
      setIsScanning(false);
    }
  }, [config.folderPath]);

  const checkSyncStatus = async (photos: Photo[]) => {
    try {
      const response = await fetch('/api/check-sync-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          config,
          localFiles: photos.map(p => ({ ...p, relativePath: p.relativePath }))
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveJobIds(prev => {
          const newSet = new Set(prev);
          newSet.add(data.jobId);
          return newSet;
        });
      } else {
        console.error('Failed to start sync check');
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    }
  };

  const checkSyncStatusSimple = async (photos: Photo[]) => {
    setIsSimpleSyncCheck(true);
    try {
      const response = await fetch('/api/check-sync-status-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          config,
          localFiles: photos.map(p => ({ ...p, relativePath: p.relativePath }))
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.syncStatus);
      } else {
        console.error('Failed to check sync status');
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    } finally {
      setIsSimpleSyncCheck(false);
    }
  };

  const uploadFolder = async (folderPath: string, photos: Photo[]) => {
    if (photos.length === 0) return;

    try {
      const photoPaths = photos.map(p => p.path);
      
      const response = await fetch('/api/upload-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoPaths,
          config,
          deleteAfterUpload,
          preserveStructure: true,
          folderPath
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveJobIds(prev => {
          const newSet = new Set(prev);
          newSet.add(data.jobId);
          return newSet;
        });
        
        // Track this folder as having an active upload
        setActiveFolderUploads(prev => {
          const newSet = new Set(prev);
          newSet.add(folderPath);
          return newSet;
        });
      } else {
        console.error('Failed to start upload');
      }
    } catch (error) {
      console.error('Error uploading media files:', error);
    }
  };

  const uploadFile = async (photo: Photo) => {
    try {
      const response = await fetch('/api/upload-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoPaths: [photo.path],
          config,
          deleteAfterUpload,
          preserveStructure: true,
          fileId: photo.id // Add file ID to track individual file uploads
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveJobIds(prev => {
          const newSet = new Set(prev);
          newSet.add(data.jobId);
          return newSet;
        });
        
        // Track this file as having an active upload
        setActiveFileUploads(prev => {
          const newSet = new Set(prev);
          newSet.add(photo.id);
          return newSet;
        });
      } else {
        console.error('Failed to start file upload');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const uploadAllUnsynced = async () => {
    if (!folderStructure) return;

    const allPhotos = getAllPhotosFromStructure(folderStructure);
    const unsyncedPhotos = allPhotos.filter(photo => !syncStatus[photo.relativePath]?.inS3);
    
    if (unsyncedPhotos.length > 0) {
      await uploadFolder('all', unsyncedPhotos);
    }
  };

  const checkAllSync = async () => {
    if (!folderStructure) return;
    
    const allPhotos = getAllPhotosFromStructure(folderStructure);
    await checkSyncStatusSimple(allPhotos);
  };

  const dismissJob = (jobId: string) => {
    setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
  };

  const hasActiveJobs = activeJobIds.size > 0;
  const isCheckingSync = isSimpleSyncCheck || jobs.some(job => job.type === 'sync_check' && job.status === 'running');
  const isUploading = jobs.some(job => job.type === 'upload' && job.status === 'running');

  useEffect(() => {
    if (isConfigured) {
      scanForPhotos();
    }
  }, [scanForPhotos, isConfigured]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalSyncStats = () => {
    if (!folderStructure) return { total: 0, synced: 0, unsynced: 0 };
    
    const allPhotos = getAllPhotosFromStructure(folderStructure);
    const syncedCount = allPhotos.filter(photo => syncStatus[photo.relativePath]?.inS3).length;
    
    return {
      total: allPhotos.length,
      synced: syncedCount,
      unsynced: allPhotos.length - syncedCount
    };
  };

  const syncStats = getTotalSyncStats();

  return (
    <div className="space-y-6">
      {/* Job Progress Section */}
      {jobs.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Active Operations</h3>
          <JobProgress jobs={jobs} onDismiss={dismissJob} />
        </div>
      )}

      {/* Header Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={scanForPhotos}
              disabled={!isConfigured || isScanning || hasActiveJobs}
              className={`btn-secondary flex items-center space-x-2 ${
                (isScanning || hasActiveJobs) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ArrowPathIcon className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Folders'}</span>
            </button>
            
            {folderStructure && (
              <button
                onClick={checkAllSync}
                disabled={!isConfigured || isCheckingSync || hasActiveJobs}
                className={`btn-secondary flex items-center space-x-2 ${
                  (isCheckingSync || hasActiveJobs) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ArrowPathIcon className={`h-4 w-4 ${isCheckingSync ? 'animate-spin' : ''}`} />
                <span>{isCheckingSync ? 'Checking...' : 'Check All Sync'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={deleteAfterUpload}
                onChange={(e) => setDeleteAfterUpload(e.target.checked)}
                disabled={hasActiveJobs}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Delete locally after upload</span>
            </label>

            {syncStats.unsynced > 0 && (
              <button
                onClick={uploadAllUnsynced}
                disabled={!isConfigured || isUploading || hasActiveJobs}
                className={`btn-primary flex items-center space-x-2 ${
                  (isUploading || hasActiveJobs) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <CloudArrowUpIcon className="h-4 w-4" />
                <span>Upload All Unsynced ({syncStats.unsynced})</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        {folderStructure && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{totalPhotos}</div>
              <div className="text-sm text-blue-600">Total Media Files</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{syncStats.synced}</div>
              <div className="text-sm text-green-600">Synced</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-600">{syncStats.unsynced}</div>
              <div className="text-sm text-yellow-600">Unsynced</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-600">{formatFileSize(folderStructure.totalSize)}</div>
              <div className="text-sm text-gray-600">Total Size</div>
            </div>
          </div>
        )}

        {lastScan && (
          <div className="mt-2 text-xs text-gray-500">
            Last scanned: {new Date(lastScan).toLocaleString()}
          </div>
        )}

        <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded p-2">
          💡 Large files over 100MB (like HD videos) are automatically uploaded using streaming to handle any file size.
        </div>
      </div>

      {/* Folder Tree */}
      {folderStructure ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <FolderTree
            folderStructure={folderStructure}
            config={config}
            syncStatus={syncStatus}
            onUploadFolder={uploadFolder}
            onUploadFile={uploadFile}
            onCheckSync={checkSyncStatus}
            deleteAfterUpload={deleteAfterUpload}
            activeUploads={activeFolderUploads}
            activeFileUploads={activeFileUploads}
          />
        </div>
      ) : (
        <div className="text-center py-12">
          <ArrowPathIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No folder structure loaded</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isConfigured 
              ? 'Click "Scan Folders" to build the folder tree and check for photos and videos.'
              : 'Configure your settings first, then scan for folders.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload; 
import React, { useState } from 'react';
import { 
  FolderIcon, 
  FolderOpenIcon, 
  CloudArrowUpIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';

interface Config {
  folderPath: string;
  awsAccessKey: string;
  awsSecretKey: string;
  bucketName: string;
  region: string;
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
  photos: Photo[];
  subfolders: { [key: string]: FolderData };
  photoCount: number;
  totalSize: number;
}

interface FolderTreeProps {
  folderStructure: FolderData;
  config: Config;
  syncStatus: { [path: string]: Photo & { inS3: boolean } };
  onUploadFolder: (folderPath: string, photos: Photo[]) => void;
  onUploadFile: (photo: Photo) => void;
  onCheckSync: (photos: Photo[]) => void;
  deleteAfterUpload: boolean;
  activeUploads: Set<string>;
  activeFileUploads: Set<string>;
}

const FolderTree: React.FC<FolderTreeProps> = ({
  folderStructure,
  config,
  syncStatus,
  onUploadFolder,
  onUploadFile,
  onCheckSync,
  deleteAfterUpload,
  activeUploads,
  activeFileUploads
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAllPhotosInFolder = (folder: FolderData): Photo[] => {
    let photos = [...folder.photos];
    
    Object.values(folder.subfolders).forEach(subfolder => {
      photos = photos.concat(getAllPhotosInFolder(subfolder));
    });
    
    return photos;
  };

  const getSyncStats = (photos: Photo[]) => {
    const totalPhotos = photos.length;
    const syncedPhotos = photos.filter(photo => syncStatus[photo.relativePath]?.inS3).length;
    const unsyncedPhotos = totalPhotos - syncedPhotos;
    
    return { totalPhotos, syncedPhotos, unsyncedPhotos };
  };

  const renderFolder = (folder: FolderData, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.path);
    const allPhotos = getAllPhotosInFolder(folder);
    const { totalPhotos, syncedPhotos, unsyncedPhotos } = getSyncStats(allPhotos);
    
    const syncPercentage = totalPhotos > 0 ? (syncedPhotos / totalPhotos) * 100 : 0;
    const isFullySynced = unsyncedPhotos === 0 && totalPhotos > 0;
    const hasPhotos = totalPhotos > 0;
    const hasActiveUpload = activeUploads.has(folder.path);

    return (
      <div key={folder.path} className="select-none">
        {/* Folder Header */}
        <div 
          className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
            depth > 0 ? 'ml-6' : ''
          }`}
          onClick={() => toggleFolder(folder.path)}
        >
          {/* Folder Icon */}
          <div className="flex-shrink-0">
            {isExpanded ? (
              <FolderOpenIcon className="h-5 w-5 text-blue-500" />
            ) : (
              <FolderIcon className="h-5 w-5 text-blue-500" />
            )}
          </div>

          {/* Folder Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-gray-900 truncate">
                {folder.name || 'Root'}
              </h3>
              
              {/* Sync Status Badge */}
              {hasPhotos && (
                <div className="flex items-center space-x-1">
                  {isFullySynced ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  ) : unsyncedPhotos > 0 ? (
                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                  ) : null}
                  
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isFullySynced 
                      ? 'bg-green-100 text-green-700'
                      : unsyncedPhotos > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {syncedPhotos}/{totalPhotos} synced
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center">
                <PhotoIcon className="h-4 w-4 mr-1" />
                {totalPhotos} photos
              </span>
              <span>{formatFileSize(folder.totalSize)}</span>
              
              {/* Sync Progress Bar */}
              {hasPhotos && (
                <div className="flex-1 max-w-xs">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isFullySynced ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${syncPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {hasPhotos && (
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onCheckSync(allPhotos)}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                title="Check sync status"
              >
                Check Sync
              </button>
              
              {unsyncedPhotos > 0 && (
                <button
                  onClick={() => {
                    if (!hasActiveUpload) {
                      const unsyncedPhotos = allPhotos.filter(photo => !syncStatus[photo.relativePath]?.inS3);
                      onUploadFolder(folder.path, unsyncedPhotos);
                    }
                  }}
                  disabled={hasActiveUpload}
                  className={`text-xs px-3 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                    hasActiveUpload 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={hasActiveUpload ? 'Upload in progress...' : `Upload ${unsyncedPhotos} unsynced photos`}
                >
                  <CloudArrowUpIcon className={`h-3 w-3 ${hasActiveUpload ? 'animate-spin' : ''}`} />
                  <span>{hasActiveUpload ? 'Uploading...' : `Upload (${unsyncedPhotos})`}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Subfolders */}
        {isExpanded && Object.values(folder.subfolders).length > 0 && (
          <div className="ml-4">
            {Object.values(folder.subfolders)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(subfolder => renderFolder(subfolder, depth + 1))}
          </div>
        )}

        {/* Photos List (only show if expanded and has photos) */}
        {isExpanded && folder.photos.length > 0 && (
          <div className="ml-8 mt-2 space-y-1">
            {folder.photos.slice(0, 10).map(photo => {
              const isInS3 = syncStatus[photo.relativePath]?.inS3;
              const hasActiveFileUpload = activeFileUploads.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className="flex items-center space-x-2 py-1 px-2 text-sm text-gray-600 hover:bg-gray-50 rounded"
                >
                  <PhotoIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1 truncate">{photo.name}</span>
                  <span className="text-xs">{formatFileSize(photo.size)}</span>
                  
                  {/* Individual upload button for unsynced files */}
                  {!isInS3 && (
                    <button
                      onClick={() => {
                        if (!hasActiveFileUpload) {
                          onUploadFile(photo);
                        }
                      }}
                      disabled={hasActiveFileUpload}
                      className={`text-xs px-2 py-1 rounded transition-colors flex items-center space-x-1 ${
                        hasActiveFileUpload 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      title={hasActiveFileUpload ? 'Uploading...' : 'Upload this file'}
                    >
                      <CloudArrowUpIcon className={`h-2 w-2 ${hasActiveFileUpload ? 'animate-spin' : ''}`} />
                      <span>{hasActiveFileUpload ? 'Uploading' : 'Upload'}</span>
                    </button>
                  )}
                  
                  {isInS3 ? (
                    <CheckCircleIcon className="h-3 w-3 text-green-500" />
                  ) : !hasActiveFileUpload ? (
                    <div className="w-3 h-3 border border-gray-300 rounded-full" />
                  ) : null}
                </div>
              );
            })}
            {folder.photos.length > 10 && (
              <div className="text-xs text-gray-400 pl-5">
                ...and {folder.photos.length - 10} more photos
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {renderFolder(folderStructure)}
    </div>
  );
};

export default FolderTree;
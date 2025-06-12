const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 9000;

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Job management system
const jobs = new Map();

class Job {
  constructor(id, type, totalItems) {
    this.id = id;
    this.type = type;
    this.status = 'running';
    this.progress = 0;
    this.totalItems = totalItems;
    this.completedItems = 0;
    this.failedItems = 0;
    this.startTime = new Date();
    this.currentItem = null;
    this.errors = [];
  }

  updateProgress(completedItems, currentItem = null, error = null) {
    this.completedItems = completedItems;
    this.currentItem = currentItem;
    this.progress = Math.round((completedItems / this.totalItems) * 100);
    
    if (error) {
      this.failedItems++;
      this.errors.push(error);
    }

    this.broadcastUpdate();
  }

  complete() {
    this.status = 'completed';
    this.progress = 100;
    this.currentItem = null;
    this.broadcastUpdate();
  }

  fail(error) {
    this.status = 'failed';
    this.errors.push(error);
    this.broadcastUpdate();
  }

  broadcastUpdate() {
    const update = {
      type: 'job_update',
      job: {
        id: this.id,
        type: this.type,
        status: this.status,
        progress: this.progress,
        totalItems: this.totalItems,
        completedItems: this.completedItems,
        failedItems: this.failedItems,
        currentItem: this.currentItem,
        errors: this.errors,
        duration: Date.now() - this.startTime
      }
    };

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(update));
      }
    });
  }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send current jobs to new client
  const currentJobs = Array.from(jobs.values()).map(job => ({
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    totalItems: job.totalItems,
    completedItems: job.completedItems,
    failedItems: job.failedItems,
    currentItem: job.currentItem,
    errors: job.errors,
    duration: Date.now() - job.startTime
  }));

  ws.send(JSON.stringify({
    type: 'jobs_list',
    jobs: currentJobs
  }));

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
fs.ensureDirSync('uploads');

// Helper function to expand tilde to home directory
const expandTilde = (filePath) => {
  if (filePath.startsWith('~/')) {
    return path.join(require('os').homedir(), filePath.slice(2));
  }
  return filePath;
};

// Helper function to get supported image extensions
const getSupportedExtensions = () => {
  return [
    // Standard image formats
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.heic', '.heif',
    
    // RAW formats - Canon
    '.cr2', '.cr3', '.crw',
    
    // RAW formats - Nikon
    '.nef', '.nrw',
    
    // RAW formats - Sony
    '.arw', '.srf', '.sr2',
    
    // RAW formats - Adobe/Generic
    '.dng',
    
    // RAW formats - Fujifilm
    '.raf',
    
    // RAW formats - Olympus
    '.orf',
    
    // RAW formats - Panasonic
    '.rw2', '.raw',
    
    // RAW formats - Pentax/Ricoh
    '.pef', '.ptx',
    
    // RAW formats - Leica
    '.dng', '.rwl',
    
    // RAW formats - Phase One
    '.iiq',
    
    // RAW formats - Hasselblad
    '.3fr',
    
    // RAW formats - Mamiya
    '.mef',
    
    // RAW formats - Kodak
    '.dcr', '.kdc',
    
    // RAW formats - Minolta
    '.mrw',
    
    // RAW formats - Samsung
    '.srw',
    
    // RAW formats - Sigma
    '.x3f',
    
    // RAW formats - Epson
    '.erf',
    
    // Video formats
    '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.mts', '.m2ts', '.mpg', '.mpeg', '.m2v', '.asf', '.rm', '.rmvb', '.vob', '.ts', '.f4v'
  ];
};

// Helper function to check if file is a media file (image or video)
const isImageFile = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return getSupportedExtensions().includes(ext);
};

// Helper function to get MIME type for media files (images and videos)
const getImageMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  // Standard image formats
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.tiff':
    case '.tif':
      return 'image/tiff';
    case '.webp':
      return 'image/webp';
    case '.heic':
    case '.heif':
      return 'image/heic';
    
    // Video formats
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.avi':
      return 'video/x-msvideo';
    case '.mkv':
      return 'video/x-matroska';
    case '.wmv':
      return 'video/x-ms-wmv';
    case '.flv':
      return 'video/x-flv';
    case '.webm':
      return 'video/webm';
    case '.m4v':
      return 'video/x-m4v';
    case '.3gp':
      return 'video/3gpp';
    case '.mts':
    case '.m2ts':
      return 'video/mp2t';
    case '.mpg':
    case '.mpeg':
      return 'video/mpeg';
    case '.m2v':
      return 'video/mpeg';
    case '.asf':
      return 'video/x-ms-asf';
    case '.rm':
      return 'application/vnd.rn-realmedia';
    case '.rmvb':
      return 'application/vnd.rn-realmedia-vbr';
    case '.vob':
      return 'video/x-ms-vob';
    case '.ts':
      return 'video/mp2t';
    case '.f4v':
      return 'video/x-f4v';
    
    // RAW formats - use application/octet-stream for RAW files
    case '.cr2':
    case '.cr3':
    case '.crw':
    case '.nef':
    case '.nrw':
    case '.arw':
    case '.srf':
    case '.sr2':
    case '.dng':
    case '.raf':
    case '.orf':
    case '.rw2':
    case '.raw':
    case '.pef':
    case '.ptx':
    case '.rwl':
    case '.iiq':
    case '.3fr':
    case '.mef':
    case '.dcr':
    case '.kdc':
    case '.mrw':
    case '.srw':
    case '.x3f':
    case '.erf':
      return 'application/octet-stream';
    
    default:
      return 'application/octet-stream';
  }
};

// API endpoint to scan for photos and videos
app.post('/api/scan-photos', async (req, res) => {
  try {
    const { folderPath } = req.body;
    const expandedPath = expandTilde(folderPath);

    if (!fs.existsSync(expandedPath)) {
      return res.status(400).json({ error: 'Folder path does not exist' });
    }

    const folderStructure = {};
    let totalPhotos = 0;

    // Recursive function to build folder structure
    const scanDirectory = async (dirPath, relativePath = '') => {
      const items = await fs.readdir(dirPath);
      const folderData = {
        name: path.basename(dirPath),
        path: relativePath,
        photos: [], // Note: 'photos' includes both images and videos for consistency
        subfolders: {},
        photoCount: 0, // Note: count includes both images and videos
        totalSize: 0
      };

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        const relativeItemPath = path.join(relativePath, item);

        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          const subfolder = await scanDirectory(itemPath, relativeItemPath);
          folderData.subfolders[item] = subfolder;
          folderData.photoCount += subfolder.photoCount;
          folderData.totalSize += subfolder.totalSize;
        } else if (stats.isFile() && isImageFile(item)) {
          const photo = {
            id: uuidv4(),
            name: item,
            size: stats.size,
            path: itemPath,
            relativePath: relativeItemPath,
            lastModified: stats.mtime
          };
          folderData.photos.push(photo);
          folderData.photoCount++;
          folderData.totalSize += stats.size;
          totalPhotos++;
        }
      }

      return folderData;
    };

    const rootFolder = await scanDirectory(expandedPath);

    res.json({ 
      folderStructure: rootFolder,
      totalPhotos, // Note: includes both photos and videos
      scanTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error scanning media files:', error);
    res.status(500).json({ error: 'Failed to scan media files' });
  }
});

// API endpoint to test AWS connection
app.post('/api/test-connection', async (req, res) => {
  try {
    const { awsAccessKey, awsSecretKey, bucketName, region } = req.body;

    // Configure AWS
    AWS.config.update({
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretKey,
      region: region
    });

    const s3 = new AWS.S3();

    // Test connection by checking if bucket exists
    await s3.headBucket({ Bucket: bucketName }).promise();

    res.json({ success: true });
  } catch (error) {
    console.error('AWS connection test failed:', error);
    res.status(400).json({ error: 'Connection failed', details: error.message });
  }
});

// API endpoint to upload photo to S3
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    const { config, deleteAfterUpload } = req.body;
    const photoFile = req.file;

    if (!photoFile) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Configure AWS
    AWS.config.update({
      accessKeyId: config.awsAccessKey,
      secretAccessKey: config.awsSecretKey,
      region: config.region
    });

    const s3 = new AWS.S3();

    // Check file size to determine upload method
    const stats = await fs.stat(photoFile.path);
    const fileSize = stats.size;
    const isLargeFile = fileSize > 100 * 1024 * 1024; // 100MB threshold
    
    // Get the base folder name for S3 prefix
    const baseFolderName = path.basename(expandTilde(config.folderPath));
    
    // Generate S3 key (filename)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const s3Key = `${baseFolderName}/${timestamp}_${photoFile.originalname}`; // Use dynamic folder name

    let uploadResult;

    if (isLargeFile) {
      // Use streaming upload for large files
      console.log(`Streaming upload for large file: ${photoFile.originalname} (${(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB)`);
      
      const fileStream = fs.createReadStream(photoFile.path);
      
      const uploadParams = {
        Bucket: config.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: photoFile.mimetype || getImageMimeType(photoFile.originalname),
      };

      uploadResult = await s3.upload(uploadParams).promise();
    } else {
      // Use regular upload for smaller files
      console.log(`Regular upload for file: ${photoFile.originalname} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      const fileContent = await fs.readFile(photoFile.path);
      
      const uploadParams = {
        Bucket: config.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: photoFile.mimetype || getImageMimeType(photoFile.originalname),
      };

      uploadResult = await s3.upload(uploadParams).promise();
    }

    // Clean up temporary file
    await fs.remove(photoFile.path);

    // Delete original file if requested
    if (deleteAfterUpload === 'true') {
      const originalPath = req.body.originalPath;
      if (originalPath && fs.existsSync(originalPath)) {
        await fs.remove(originalPath);
      }
    }

    res.json({ success: true, s3Key });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// API endpoint to upload multiple photos (batch processing)
app.post('/api/upload-photos-batch', async (req, res) => {
  try {
    const { photoPaths, config, deleteAfterUpload } = req.body;

    // Configure AWS
    AWS.config.update({
      accessKeyId: config.awsAccessKey,
      secretAccessKey: config.awsSecretKey,
      region: config.region
    });

    const s3 = new AWS.S3();
    const results = [];

    // Get the base folder name for S3 prefix
    const baseFolderName = path.basename(expandTilde(config.folderPath));

    for (const photoPath of photoPaths) {
      try {
        // Check file size to determine upload method
        const stats = await fs.stat(photoPath);
        const fileSize = stats.size;
        const isLargeFile = fileSize > 100 * 1024 * 1024; // 100MB threshold
        
        const filename = path.basename(photoPath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const s3Key = `${baseFolderName}/${timestamp}_${filename}`; // Use dynamic folder name

        let uploadResult;

        if (isLargeFile) {
          // Use streaming upload for large files
          console.log(`Streaming upload for large file: ${filename} (${(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB)`);
          
          const fileStream = fs.createReadStream(photoPath);
          
          const uploadParams = {
            Bucket: config.bucketName,
            Key: s3Key,
            Body: fileStream,
            ContentType: getImageMimeType(filename),
          };

          uploadResult = await s3.upload(uploadParams).promise();
        } else {
          // Use regular upload for smaller files
          console.log(`Regular upload for file: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
          const fileContent = await fs.readFile(photoPath);
          
          const uploadParams = {
            Bucket: config.bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: getImageMimeType(filename),
          };

          uploadResult = await s3.upload(uploadParams).promise();
        }

        // Delete original file if requested
        if (deleteAfterUpload) {
          await fs.remove(photoPath);
        }

        results.push({ success: true, path: photoPath, s3Key });
      } catch (error) {
        console.error(`Failed to upload ${photoPath}:`, error);
        results.push({ success: false, path: photoPath, error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Batch upload failed:', error);
    res.status(500).json({ error: 'Batch upload failed', details: error.message });
  }
});

// API endpoint to check sync status with S3 (simple version without job tracking)
app.post('/api/check-sync-status-simple', async (req, res) => {
  try {
    const { config, localFiles } = req.body;

    // Configure AWS
    AWS.config.update({
      accessKeyId: config.awsAccessKey,
      secretAccessKey: config.awsSecretKey,
      region: config.region
    });

    const s3 = new AWS.S3();

    // Get the base folder name for S3 prefix
    const baseFolderName = path.basename(expandTilde(config.folderPath));

    // List all objects in the S3 bucket with the dynamic prefix
    const s3Objects = new Set();
    let continuationToken;
    
    do {
      const params = {
        Bucket: config.bucketName,
        Prefix: `${baseFolderName}/`,
        ContinuationToken: continuationToken
      };

      const response = await s3.listObjectsV2(params).promise();
      
      response.Contents?.forEach(obj => {
        // Remove the dynamic prefix to match local relative paths
        const relativePath = obj.Key.replace(new RegExp(`^${baseFolderName}/`), '');
        s3Objects.add(relativePath);
      });

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Compare local files with S3 objects
    const syncStatus = {};
    for (const file of localFiles) {
      syncStatus[file.relativePath] = {
        ...file,
        inS3: s3Objects.has(file.relativePath),
        s3Key: `${baseFolderName}/${file.relativePath}`
      };
    }

    res.json({ 
      syncStatus,
      s3ObjectCount: s3Objects.size
    });

  } catch (error) {
    console.error('Error checking sync status:', error);
    res.status(500).json({ error: 'Failed to check sync status' });
  }
});

// API endpoint to check sync status with S3 (with job tracking)
app.post('/api/check-sync-status', async (req, res) => {
  try {
    const { config, localFiles } = req.body;
    const jobId = uuidv4();
    const job = new Job(jobId, 'sync_check', localFiles.length);
    jobs.set(jobId, job);

    // Send immediate response with job ID
    res.json({ jobId, message: 'Sync check started' });

    // Configure AWS
    AWS.config.update({
      accessKeyId: config.awsAccessKey,
      secretAccessKey: config.awsSecretKey,
      region: config.region
    });

    const s3 = new AWS.S3();

    // Get the base folder name for S3 prefix
    const baseFolderName = path.basename(expandTilde(config.folderPath));

    // List all objects in the S3 bucket with the dynamic prefix
    const s3Objects = new Set();
    let continuationToken;
    
    do {
      const params = {
        Bucket: config.bucketName,
        Prefix: `${baseFolderName}/`,
        ContinuationToken: continuationToken
      };

      const response = await s3.listObjectsV2(params).promise();
      
      response.Contents?.forEach(obj => {
        // Remove the dynamic prefix to match local relative paths
        const relativePath = obj.Key.replace(new RegExp(`^${baseFolderName}/`), '');
        s3Objects.add(relativePath);
      });

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Compare local files with S3 objects
    const syncStatus = {};
    for (let i = 0; i < localFiles.length; i++) {
      const file = localFiles[i];
      syncStatus[file.relativePath] = {
        ...file,
        inS3: s3Objects.has(file.relativePath),
        s3Key: `${baseFolderName}/${file.relativePath}`
      };
      
      job.updateProgress(i + 1, file.name);
      
      // Small delay to prevent overwhelming the UI
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Send final result via WebSocket
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'sync_status_result',
          jobId,
          syncStatus,
          s3ObjectCount: s3Objects.size
        }));
      }
    });

    job.complete();
    
    // Clean up job after 30 seconds
    setTimeout(() => jobs.delete(jobId), 30000);

  } catch (error) {
    console.error('Error checking sync status:', error);
    const jobId = req.body.jobId;
    if (jobId && jobs.has(jobId)) {
      jobs.get(jobId).fail(error.message);
    }
    res.status(500).json({ error: 'Failed to check sync status' });
  }
});

// API endpoint to upload folder(s) to S3 (with job tracking)
app.post('/api/upload-folder', async (req, res) => {
  try {
    const { photoPaths, config, deleteAfterUpload, preserveStructure = true, folderPath, fileId } = req.body;
    const jobId = uuidv4();
    const job = new Job(jobId, 'upload', photoPaths.length);
    jobs.set(jobId, job);

    // Send immediate response with job ID
    res.json({ jobId, message: 'Upload started' });

    // Configure AWS
    AWS.config.update({
      accessKeyId: config.awsAccessKey,
      secretAccessKey: config.awsSecretKey,
      region: config.region
    });

    const s3 = new AWS.S3();
    const results = [];

    // Get the base folder name for S3 prefix (e.g., "videos" from "/Users/user/videos")
    const baseFolderName = path.basename(expandTilde(config.folderPath));

    for (let i = 0; i < photoPaths.length; i++) {
      const photoPath = photoPaths[i];
      const filename = path.basename(photoPath);
      
      job.updateProgress(i, filename);

      try {
        // Check file size to determine upload method
        const stats = await fs.stat(photoPath);
        const fileSize = stats.size;
        const isLargeFile = fileSize > 100 * 1024 * 1024; // 100MB threshold
        
        const relativePath = path.relative(expandTilde(config.folderPath), photoPath);
        
        // Use dynamic folder name instead of hardcoded "photos"
        const s3Key = preserveStructure 
          ? `${baseFolderName}/${relativePath.replace(/\\/g, '/')}` // Use actual folder name
          : `${baseFolderName}/${Date.now()}_${filename}`;

        let uploadResult;

        if (isLargeFile) {
          // Use streaming upload for large files
          console.log(`Streaming upload for large file: ${filename} (${(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB)`);
          
          const fileStream = fs.createReadStream(photoPath);
          
          const uploadParams = {
            Bucket: config.bucketName,
            Key: s3Key,
            Body: fileStream,
            ContentType: getImageMimeType(filename),
          };

          // Add progress tracking for large files
          const managedUpload = s3.upload(uploadParams);
          
          managedUpload.on('httpUploadProgress', (progress) => {
            const progressPercent = Math.round((progress.loaded / progress.total) * 100);
            // Update job with file-level progress for large files
            job.updateProgress(i, `${filename} (${progressPercent}%)`);
          });

          uploadResult = await managedUpload.promise();
        } else {
          // Use regular upload for smaller files
          console.log(`Regular upload for file: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
          const fileContent = await fs.readFile(photoPath);
          
          const uploadParams = {
            Bucket: config.bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: getImageMimeType(filename),
          };

          uploadResult = await s3.upload(uploadParams).promise();
        }

        // Delete original file if requested
        if (deleteAfterUpload) {
          await fs.remove(photoPath);
        }

        results.push({ success: true, path: photoPath, s3Key, relativePath });
        
        // Send real-time sync status update for this file
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'file_upload_success',
              jobId,
              relativePath,
              s3Key,
              folderPath,
              fileId
            }));
          }
        });
        
      } catch (error) {
        console.error(`Failed to upload ${photoPath}:`, error);
        results.push({ success: false, path: photoPath, error: error.message });
        job.updateProgress(i + 1, filename, error.message);
        continue;
      }
      
      job.updateProgress(i + 1, filename);
    }

    // Send final result via WebSocket
    const wsMessage = {
      type: 'upload_result',
      jobId,
      results
    };
    
    // Add folderPath if it exists (folder upload)
    if (folderPath) {
      wsMessage.folderPath = folderPath;
    }
    
    // Add fileId if it exists (individual file upload)
    if (fileId) {
      wsMessage.fileId = fileId;
    }

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(wsMessage));
      }
    });

    job.complete();
    
    // Clean up job after 30 seconds
    setTimeout(() => jobs.delete(jobId), 30000);

  } catch (error) {
    console.error('Folder upload failed:', error);
    const jobId = req.body.jobId;
    if (jobId && jobs.has(jobId)) {
      jobs.get(jobId).fail(error.message);
    }
    res.status(500).json({ error: 'Folder upload failed', details: error.message });
  }
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`🚀 Photorific server running on port ${PORT}`);
});
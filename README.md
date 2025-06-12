# Photorific 📸

A modern, flat-design photo backup application that seamlessly uploads your photos to Amazon S3.

## Features

- 🎨 **Modern Flat Design** - Clean, minimalist interface built with React and Tailwind CSS
- 📁 **Configurable Photo Folder** - Set any local folder path (default: `~/photos`)
- ☁️ **AWS S3 Integration** - Secure backup to your personal S3 bucket
- 🗑️ **Optional Local Deletion** - Choose whether to delete photos locally after backup
- 📊 **Progress Tracking** - Real-time upload progress with visual feedback
- 🔒 **Secure Credentials** - AWS credentials stored locally in browser only

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- AWS Account with S3 bucket

### Installation

1. **Install Dependencies**
   ```bash
   npm run install-all
   ```

2. **Configure AWS Credentials**
   - Create an IAM user in AWS Console with S3 permissions
   - Note down Access Key ID and Secret Access Key
   - Create an S3 bucket for your photos

3. **Start the Application**
   ```bash
   npm run dev
   ```
   This will start both the backend server (port 5000) and React frontend (port 3000).

4. **Open the App**
   Navigate to `http://localhost:3000` in your browser.

### Configuration

1. **Go to Configuration Tab** - Click the gear icon in the navigation
2. **Set Photo Folder** - Enter the path to your photos (e.g., `~/Photos` or `/Users/yourname/Pictures`)
3. **Enter AWS Credentials**:
   - AWS Access Key ID
   - AWS Secret Access Key
   - S3 Bucket Name
   - AWS Region
4. **Test Connection** - Verify your settings work
5. **Save Configuration**

### Usage

1. **Scan for Photos** - Click "Scan for Photos" to find images in your configured folder
2. **Select Photos** - Click individual photos or "Select All"
3. **Choose Options** - Optionally enable "Delete locally after upload"
4. **Upload** - Click "Upload Selected" to backup to S3

## Security

- AWS credentials are stored locally in your browser only
- No credentials are sent to any external servers except AWS directly
- Create a dedicated IAM user with minimal S3 permissions for maximum security

## Supported File Types

- JPEG/JPG
- PNG
- GIF
- BMP
- TIFF
- WebP
- HEIC
- RAW

## Development

```bash
# Install dependencies
npm run install-all

# Start development servers
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT License - Feel free to use and modify as needed! 
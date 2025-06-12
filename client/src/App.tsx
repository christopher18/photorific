import React, { useState, useEffect } from 'react';
import PhotoUpload from './components/PhotoUpload';
import Configuration from './components/Configuration';
import ProgressBar from './components/ProgressBar';
import { CloudArrowUpIcon, CogIcon } from '@heroicons/react/24/outline';

interface Config {
  folderPath: string;
  awsAccessKey: string;
  awsSecretKey: string;
  bucketName: string;
  region: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'config'>('upload');
  const [config, setConfig] = useState<Config>({
    folderPath: '~/photos',
    awsAccessKey: '',
    awsSecretKey: '',
    bucketName: '',
    region: 'us-east-1'
  });
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    // Load config from localStorage
    const savedConfig = localStorage.getItem('photorific-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const saveConfig = (newConfig: Config) => {
    setConfig(newConfig);
    localStorage.setItem('photorific-config', JSON.stringify(newConfig));
  };

  const isConfigured = Boolean(config.awsAccessKey && config.awsSecretKey && config.bucketName);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-primary-500 p-2 rounded-lg">
                <CloudArrowUpIcon className="h-6 w-6 text-white" />
              </div>
              <h1 className="ml-3 text-2xl font-bold text-gray-900">Photorific</h1>
            </div>
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'upload'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Upload Photos
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'config'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CogIcon className="inline h-4 w-4 mr-1" />
                Configuration
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConfigured && activeTab === 'upload' && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Please configure your AWS credentials and bucket settings before uploading photos.
                  <button
                    onClick={() => setActiveTab('config')}
                    className="ml-2 font-medium text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Go to Configuration
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="mb-6">
            <ProgressBar progress={uploadProgress} />
          </div>
        )}

        {activeTab === 'upload' && (
          <PhotoUpload
            config={config}
            isConfigured={isConfigured}
            onProgressUpdate={setUploadProgress}
            onUploadStateChange={setIsUploading}
          />
        )}

        {activeTab === 'config' && (
          <Configuration
            config={config}
            onConfigSave={saveConfig}
          />
        )}
      </main>
    </div>
  );
}

export default App;

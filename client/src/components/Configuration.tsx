import React, { useState } from 'react';
import { FolderOpenIcon, KeyIcon, CloudIcon } from '@heroicons/react/24/outline';

interface Config {
  folderPath: string;
  awsAccessKey: string;
  awsSecretKey: string;
  bucketName: string;
  region: string;
}

interface ConfigurationProps {
  config: Config;
  onConfigSave: (config: Config) => void;
}

const Configuration: React.FC<ConfigurationProps> = ({ config, onConfigSave }) => {
  const [formData, setFormData] = useState<Config>(config);
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (field: keyof Config, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onConfigSave(formData);
    setConnectionStatus('idle');
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const awsRegions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-west-2', label: 'Europe (London)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">Configuration</h2>
        <p className="mt-2 text-gray-600">
          Set up your photo folder and AWS S3 credentials to start backing up your photos.
        </p>
      </div>

      <div className="space-y-6">
        {/* Photo Folder Configuration */}
        <div className="card">
          <div className="flex items-center mb-4">
            <FolderOpenIcon className="h-5 w-5 text-primary-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Photo Folder</h3>
          </div>
          
          <div>
            <label htmlFor="folderPath" className="block text-sm font-medium text-gray-700 mb-2">
              Photos Folder Path
            </label>
            <input
              id="folderPath"
              type="text"
              value={formData.folderPath}
              onChange={(e) => handleInputChange('folderPath', e.target.value)}
              placeholder="~/photos"
              className="input-field"
            />
            <p className="mt-2 text-sm text-gray-500">
              Specify the path to your photos folder. Use ~ for your home directory.
            </p>
          </div>
        </div>

        {/* AWS Configuration */}
        <div className="card">
          <div className="flex items-center mb-4">
            <CloudIcon className="h-5 w-5 text-primary-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">AWS S3 Configuration</h3>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="awsAccessKey" className="block text-sm font-medium text-gray-700 mb-2">
                  AWS Access Key ID
                </label>
                <input
                  id="awsAccessKey"
                  type="text"
                  value={formData.awsAccessKey}
                  onChange={(e) => handleInputChange('awsAccessKey', e.target.value)}
                  placeholder="AKIA..."
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="awsSecretKey" className="block text-sm font-medium text-gray-700 mb-2">
                  AWS Secret Access Key
                </label>
                <div className="relative">
                  <input
                    id="awsSecretKey"
                    type={showSecretKey ? 'text' : 'password'}
                    value={formData.awsSecretKey}
                    onChange={(e) => handleInputChange('awsSecretKey', e.target.value)}
                    placeholder="Enter your secret key"
                    className="input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <KeyIcon className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bucketName" className="block text-sm font-medium text-gray-700 mb-2">
                  S3 Bucket Name
                </label>
                <input
                  id="bucketName"
                  type="text"
                  value={formData.bucketName}
                  onChange={(e) => handleInputChange('bucketName', e.target.value)}
                  placeholder="my-photo-bucket"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-2">
                  AWS Region
                </label>
                <select
                  id="region"
                  value={formData.region}
                  onChange={(e) => handleInputChange('region', e.target.value)}
                  className="input-field"
                >
                  {awsRegions.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Security Note</h4>
            <p className="text-sm text-blue-700">
              Your AWS credentials are stored locally in your browser and are never sent to any external servers except AWS directly.
              For security, create an IAM user with only S3 permissions for the specific bucket you want to use.
            </p>
          </div>
        </div>

        {/* Connection Test & Save */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={testConnection}
            disabled={testingConnection || !formData.awsAccessKey || !formData.awsSecretKey || !formData.bucketName}
            className="btn-secondary flex-1"
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            className="btn-primary flex-1"
          >
            Save Configuration
          </button>
        </div>

        {/* Connection Status */}
        {connectionStatus !== 'idle' && (
          <div className={`p-4 rounded-lg ${
            connectionStatus === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm ${
              connectionStatus === 'success' 
                ? 'text-green-700' 
                : 'text-red-700'
            }`}>
              {connectionStatus === 'success' 
                ? '✅ Connection successful! Your AWS credentials are working correctly.'
                : '❌ Connection failed. Please check your AWS credentials and bucket name.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuration; 
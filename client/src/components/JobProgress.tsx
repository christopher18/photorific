import React from 'react';
import { 
  CloudArrowUpIcon, 
  ArrowPathIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  XCircleIcon 
} from '@heroicons/react/24/outline';

export interface Job {
  id: string;
  type: 'sync_check' | 'upload';
  status: 'running' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  currentItem: string | null;
  errors: string[];
  duration: number;
}

interface JobProgressProps {
  jobs: Job[];
  onDismiss: (jobId: string) => void;
}

const JobProgress: React.FC<JobProgressProps> = ({ jobs, onDismiss }) => {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getJobIcon = (job: Job) => {
    if (job.status === 'completed') {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    } else if (job.status === 'failed') {
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    } else if (job.type === 'sync_check') {
      return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
    } else {
      return <CloudArrowUpIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  const getJobTitle = (job: Job) => {
    if (job.type === 'sync_check') {
      return 'Checking Sync Status';
    } else {
      return 'Uploading Photos';
    }
  };

  const getStatusColor = (job: Job) => {
    switch (job.status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getProgressBarColor = (job: Job) => {
    switch (job.status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <div
          key={job.id}
          className={`border rounded-lg p-4 ${getStatusColor(job)} transition-all duration-200`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              {getJobIcon(job)}
              <div>
                <h3 className="font-medium text-gray-900">{getJobTitle(job)}</h3>
                <p className="text-sm text-gray-600">
                  {job.status === 'running' && job.currentItem && (
                    <span>Processing: {job.currentItem}</span>
                  )}
                  {job.status === 'completed' && (
                    <span>Completed successfully</span>
                  )}
                  {job.status === 'failed' && (
                    <span>Failed with errors</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right text-sm">
                <div className="font-medium text-gray-900">
                  {job.completedItems} / {job.totalItems}
                </div>
                <div className="text-gray-500">
                  {formatDuration(job.duration)}
                </div>
              </div>

              {(job.status === 'completed' || job.status === 'failed') && (
                <button
                  onClick={() => onDismiss(job.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Dismiss"
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{job.progress}% complete</span>
              {job.failedItems > 0 && (
                <span className="text-red-600">{job.failedItems} failed</span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(job)}`}
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Errors (if any) */}
          {job.errors.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center space-x-2 mb-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">
                  Errors ({job.errors.length})
                </span>
              </div>
              <div className="max-h-20 overflow-y-auto">
                {job.errors.slice(0, 3).map((error, index) => (
                  <p key={index} className="text-xs text-red-600 mb-1">
                    {error}
                  </p>
                ))}
                {job.errors.length > 3 && (
                  <p className="text-xs text-red-500">
                    ...and {job.errors.length - 3} more errors
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default JobProgress; 
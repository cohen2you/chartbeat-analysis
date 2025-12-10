'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, FileCheck } from 'lucide-react';

interface CSVInputProps {
  onDataChange: (csvData: string[], fileNames: string[]) => void;
}

export default function CSVInput({ onDataChange }: CSVInputProps) {
  const [files, setFiles] = useState<Array<{ id: number; file: File; content: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const processFile = async (file: File): Promise<string> => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      throw new Error('Please upload a CSV file');
    }
    return await file.text();
  };

  const addFiles = useCallback(async (newFiles: File[]) => {
    const processedFiles = await Promise.all(
      newFiles.map(async (file) => {
        const content = await processFile(file);
        return {
          id: Date.now() + Math.random(),
          file,
          content,
        };
      })
    );
    
    setFiles(prev => [...prev, ...processedFiles]);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      await addFiles(selectedFiles);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.name.toLowerCase().endsWith('.csv')
    );

    if (droppedFiles.length > 0) {
      await addFiles(droppedFiles);
    }
  }, [addFiles]);

  const removeFile = (id: number) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Update parent whenever files change
  useEffect(() => {
    const csvData = files.map(f => f.content);
    const fileNames = files.map(f => f.file.name);
    onDataChange(csvData, fileNames);
  }, [files, onDataChange]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
          }
          bg-white dark:bg-gray-800
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`
            p-4 rounded-full transition-colors
            ${isDragging 
              ? 'bg-blue-100 dark:bg-blue-900/40' 
              : 'bg-gray-100 dark:bg-gray-700'
            }
          `}>
            <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
              {isDragging ? 'Drop CSV files here' : 'Drag & drop CSV files here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              or click to browse
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Select CSV Files
            </button>
          </div>
          
          <p className="text-xs text-gray-400 dark:text-gray-500">
            You can upload multiple CSV files at once
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Uploaded Files ({files.length})
          </h3>
          {files.map((fileItem) => (
            <div
              key={fileItem.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {fileItem.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(fileItem.file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(fileItem.id)}
                className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                aria-label="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

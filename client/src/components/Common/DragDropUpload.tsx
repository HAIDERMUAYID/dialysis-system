/**
 * Drag & Drop Upload Component
 * مكون رفع ملفات مع دعم السحب والإفلات
 */

import React, { useState, useCallback } from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined, FileOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import './DragDropUpload.css';

const { Dragger } = Upload;

interface DragDropUploadProps {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number; // in MB
  multiple?: boolean;
  disabled?: boolean;
  tip?: string;
}

export const DragDropUpload: React.FC<DragDropUploadProps> = ({
  onUpload,
  accept = '*/*',
  maxSize = 10, // 10MB default
  multiple = false,
  disabled = false,
  tip,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleChange: UploadProps['onChange'] = (info) => {
    const { status, originFileObj } = info.file;

    if (status === 'uploading') {
      setUploading(true);
    }

    if (status === 'done') {
      message.success(`${info.file.name} تم رفع الملف بنجاح`);
      setUploading(false);
      setFileList([]);
    } else if (status === 'error') {
      message.error(`${info.file.name} فشل رفع الملف`);
      setUploading(false);
    }

    // Update file list
    let newFileList = [...info.fileList];
    newFileList = newFileList.map((file) => {
      if (file.response) {
        file.url = file.response.url;
      }
      return file;
    });
    setFileList(newFileList);
  };

  const customRequest: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    const fileObj = file as File;

    try {
      // Validate file size
      const fileSizeMB = fileObj.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        throw new Error(`حجم الملف يجب أن يكون أقل من ${maxSize} MB`);
      }

      await onUpload(fileObj);
      onSuccess?.('OK', fileObj);
    } catch (error: any) {
      onError?.(error);
      message.error(error.message || 'فشل رفع الملف');
    }
  };

  return (
    <div className="drag-drop-upload-container">
      <Dragger
        customRequest={customRequest}
        onChange={handleChange}
        fileList={fileList}
        accept={accept}
        multiple={multiple}
        disabled={disabled || uploading}
        className="drag-drop-upload"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          اضغط أو اسحب الملفات هنا للرفع
        </p>
        <p className="ant-upload-hint">
          {tip || `يمكنك رفع ملف واحد أو أكثر. الحد الأقصى للحجم: ${maxSize} MB`}
        </p>
      </Dragger>
    </div>
  );
};

// Simple Drag Drop Zone Component
interface DragDropZoneProps {
  onDrop: (files: FileList) => void;
  accept?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const DragDropZone: React.FC<DragDropZoneProps> = ({
  onDrop,
  accept,
  children,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onDrop(files);
    }
  }, [onDrop, disabled]);

  return (
    <div
      className={`drag-drop-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <div className="drag-drop-overlay">
          <div className="drag-drop-message">
            <FileOutlined />
            <span>افلت الملفات هنا</span>
          </div>
        </div>
      )}
    </div>
  );
};

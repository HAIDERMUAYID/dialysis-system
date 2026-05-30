import React, { useEffect, useState } from 'react';
import { Modal, Upload, Avatar, Button, Space, message, Typography } from 'antd';
import { CameraOutlined, UserOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';

interface ProfilePhotoModalProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  photoUrl?: string | null;
  onSuccess: (photoUrl: string) => void;
}

const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  open,
  onClose,
  userName,
  photoUrl,
  onSuccess,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setSelectedFile(null);
      setUploading(false);
    }
  }, [open]);

  const displayUrl = previewUrl || photoUrl || undefined;

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    onClose();
  };

  const handleSave = async () => {
    if (!selectedFile) {
      message.warning('اختر صورة أولاً');
      return;
    }

    try {
      setUploading(true);
      const form = new FormData();
      form.append('photo', selectedFile);
      const { data } = await axios.post<{ photo_url?: string; photoUrl?: string }>(
        '/api/auth/profile-photo',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const nextUrl = data.photoUrl || data.photo_url;
      if (!nextUrl) throw new Error('لم يُرجع الخادم رابط الصورة');
      message.success('تم تحديث الصورة الشخصية');
      onSuccess(nextUrl);
      handleClose();
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'فشل رفع الصورة';
      message.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CameraOutlined />
          <span>الصورة الشخصية</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose}>إلغاء</Button>
          <Button type="primary" loading={uploading} disabled={!selectedFile} onClick={handleSave}>
            حفظ الصورة
          </Button>
        </Space>
      }
      width={420}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Avatar size={96} src={displayUrl} icon={<UserOutlined />} />
        {userName && (
          <Typography.Text strong>{userName}</Typography.Text>
        )}
        <Upload
          accept="image/jpeg,image/png,image/webp,image/gif"
          showUploadList={false}
          beforeUpload={(file) => {
            const maxMb = 4;
            if (file.size / (1024 * 1024) > maxMb) {
              message.error(`حجم الصورة يجب أن يكون أقل من ${maxMb} MB`);
              return Upload.LIST_IGNORE;
            }
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            return false;
          }}
        >
          <Button icon={uploading ? <LoadingOutlined /> : <CameraOutlined />}>
            {selectedFile ? 'اختيار صورة أخرى' : 'اختيار صورة'}
          </Button>
        </Upload>
        <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
          JPEG أو PNG أو WebP — حتى 4 MB
        </Typography.Text>
      </div>
    </Modal>
  );
};

export default ProfilePhotoModal;

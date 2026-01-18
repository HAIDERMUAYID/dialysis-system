/**
 * Keyboard Shortcuts Hook
 * يوفر اختصارات لوحة المفاتيح للواجهة
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Global shortcuts hook
export const useGlobalShortcuts = () => {
  const navigate = useNavigate();

  useKeyboardShortcuts([
    {
      key: '/',
      ctrl: true,
      action: () => {
        // Focus search
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="بحث"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: 'التركيز على البحث',
    },
    {
      key: 'n',
      ctrl: true,
      action: () => {
        // New patient/visit based on current route
        const path = window.location.pathname;
        if (path.includes('/inquiry')) {
          // Trigger new patient modal
          const newPatientBtn = document.querySelector('[data-action="new-patient"]') as HTMLElement;
          if (newPatientBtn) newPatientBtn.click();
        }
      },
      description: 'إضافة جديد',
    },
    {
      key: 's',
      ctrl: true,
      action: () => {
        // Save current form
        const saveBtn = document.querySelector('[data-action="save"], button[type="submit"]') as HTMLElement;
        if (saveBtn && !saveBtn.hasAttribute('disabled')) {
          saveBtn.click();
        }
      },
      description: 'حفظ',
    },
    {
      key: 'Escape',
      action: () => {
        // Close modals
        const closeBtn = document.querySelector('[aria-label="Close"], .ant-modal-close') as HTMLElement;
        if (closeBtn) closeBtn.click();
      },
      description: 'إغلاق',
      preventDefault: false,
    },
    {
      key: '?',
      shift: true,
      action: () => {
        // Show shortcuts help
        message.info({
          content: 'اضغط Ctrl+? لعرض جميع الاختصارات',
          duration: 3,
        });
      },
      description: 'عرض المساعدة',
    },
  ]);
};

// Dashboard-specific shortcuts
export const useDashboardShortcuts = (role: string) => {
  const navigate = useNavigate();

  useKeyboardShortcuts([
    {
      key: '1',
      ctrl: true,
      action: () => {
        if (role === 'admin') navigate('/admin');
        else if (role === 'inquiry') navigate('/inquiry');
        else if (role === 'lab' || role === 'lab_manager') navigate('/lab');
        else if (role === 'pharmacist' || role === 'pharmacy_manager') navigate('/pharmacist');
        else if (role === 'doctor') navigate('/doctor');
      },
      description: 'الانتقال إلى Dashboard',
    },
    {
      key: 'r',
      ctrl: true,
      action: () => {
        // Refresh data
        window.location.reload();
      },
      description: 'تحديث البيانات',
    },
  ]);
};

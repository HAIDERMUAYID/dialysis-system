import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'antd';
import {
  DownloadOutlined,
  CloseOutlined,
  MobileOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import './PwaInstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 7;

const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIosHint, setIsIosHint] = useState(false);

  const isStandalone = useMemo(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    []
  );

  const isIosSafari = useMemo(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const safari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    return ios && safari;
  }, []);

  useEffect(() => {
    if (isStandalone) return;
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    const dismissedStillValid =
      Number.isFinite(dismissedAt) &&
      dismissedAt > 0 &&
      Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    if (dismissedStillValid) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setOpen(true);
    };

    const onInstalled = () => {
      setOpen(false);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const iosFallbackTimer = window.setTimeout(() => {
      if (!deferredPrompt && isIosSafari) {
        setIsIosHint(true);
        setOpen(true);
      }
    }, 1400);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(iosFallbackTimer);
    };
  }, [isStandalone, deferredPrompt, isIosSafari]);

  const onInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setOpen(false);
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    setDeferredPrompt(null);
  };

  const onClose = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
  };

  if (!open || isStandalone) return null;

  return (
    <div className="pwa-install-prompt" role="dialog" aria-label="تثبيت التطبيق">
      <div className="pwa-install-prompt__icon">
        {isIosHint ? <ShareAltOutlined /> : <MobileOutlined />}
      </div>
      <div className="pwa-install-prompt__content">
        <strong>تثبيت التطبيق على الهاتف</strong>
        {isIosHint ? (
          <span>
            في iPhone: اضغط زر المشاركة <ShareAltOutlined /> ثم اختر "Add to Home Screen".
          </span>
        ) : (
          <span>ثبّت D-IRS للوصول المباشر من شاشة الهاتف وتشغيله بملء الشاشة.</span>
        )}
      </div>
      {!isIosHint && (
        <Button type="primary" icon={<DownloadOutlined />} size="small" onClick={onInstall}>
          تثبيت
        </Button>
      )}
      <Button size="small" icon={<CloseOutlined />} onClick={onClose} />
    </div>
  );
};

export default PwaInstallPrompt;

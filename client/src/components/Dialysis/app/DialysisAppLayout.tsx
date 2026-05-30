import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Drawer,
  Button,
  Select,
  Space,
  Typography,
  Avatar,
  Dropdown,
  Tooltip,
  Modal,
  Form,
  Input,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  HddOutlined,
  InboxOutlined,
  FundOutlined,
  SafetyCertificateOutlined,
  MenuOutlined,
  LogoutOutlined,
  ArrowLeftOutlined,
  MedicineBoxOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  UserOutlined,
  BarChartOutlined,
  PlusOutlined,
  BankOutlined,
  LockOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { usePermission } from '../../../hooks/usePermission';
import { ALL_MY_HOSPITALS, useDialysisContext } from './dialysisContext';
import { DIALYSIS_MOBILE_MQ } from './useDialysisMobile';
import { dialysisHaptic, prefersReducedMotion } from './useDialysisHaptic';
import { useDialysisPageDirection } from './useDialysisPageDirection';
import DialysisBrandLogo from './DialysisBrandLogo';
import DialysisWelcomeBanner from './DialysisWelcomeBanner';
import ChangePasswordModal from '../../Common/ChangePasswordModal';
import ProfilePhotoModal from '../../Common/ProfilePhotoModal';
import { DIALYSIS_SYSTEM_TITLE, DIALYSIS_SYSTEM_TITLE_SHORT } from './dialysisBrand';
import './dialysis-brand.css';
import './dialysis-app.css';
import './dialysis-mobile-polish.css';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

interface NavItem {
  key: string;
  to: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  group?: 'main' | 'setup' | 'admin';
}

const ALL_ITEMS: NavItem[] = [
  { key: 'overview', to: '/dialysis', label: 'نظرة عامة', icon: <DashboardOutlined />, permission: 'dialysis:view', group: 'main' },
  { key: 'patients', to: '/dialysis/patients', label: 'المرضى', icon: <TeamOutlined />, permission: 'dialysis:view', group: 'main' },
  { key: 'sessions', to: '/dialysis/sessions', label: 'الجلسات', icon: <CalendarOutlined />, permission: 'dialysis:view', group: 'main' },
  {
    key: 'pharmacy',
    to: '/dialysis/pharmacy',
    label: 'صيدلية الغسل',
    icon: <MedicineBoxOutlined />,
    permission: 'dialysis:pharmacy:view',
    group: 'main',
  },
  {
    key: 'pharmacy-stock',
    to: '/dialysis/pharmacy-stock',
    label: 'مخزن صيدلية الغسل',
    icon: <DatabaseOutlined />,
    permission: 'dialysis:pharmacy:view',
    group: 'main',
  },
  { key: 'reports', to: '/dialysis/reports', label: 'التقارير', icon: <BarChartOutlined />, permission: 'dialysis:view', group: 'main' },
  { key: 'live', to: '/dialysis/live', label: 'القاعة (نشط)', icon: <ThunderboltOutlined />, permission: 'dialysis:view', group: 'main' },

  { key: 'halls', to: '/dialysis/halls', label: 'القاعات والأسرة', icon: <ApartmentOutlined />, permission: 'dialysis:view', group: 'setup' },
  { key: 'shifts', to: '/dialysis/shifts', label: 'شفتات الغسل', icon: <ClockCircleOutlined />, permission: 'dialysis:view', group: 'setup' },
  { key: 'machines', to: '/dialysis/machines', label: 'الأجهزة', icon: <HddOutlined />, permission: 'dialysis:view', group: 'setup' },
  { key: 'inventory', to: '/dialysis/inventory', label: 'المستودع والمواد', icon: <InboxOutlined />, permission: 'dialysis:view', group: 'setup' },

  { key: 'statistics', to: '/dialysis/statistics', label: 'الإحصاء والمطابقة', icon: <FundOutlined />, permission: 'dialysis:reconciliation', group: 'admin' },
  { key: 'access', to: '/dialysis/access', label: 'إدارة الوصول', icon: <SafetyCertificateOutlined />, permission: 'dialysis:access:manage', group: 'admin' },
];

/** عناصر للشريط السفلي على الموبايل — القاعة النشطة للطاقم اليومي */
const MOBILE_BOTTOM = ['overview', 'patients', 'sessions', 'live'];

/** أعرض من هذا العرض نعتبر الجهاز هاتفاً/تابلت صغيراً — يتوافق مع useDialysisMobile */
const MOBILE_MQ = DIALYSIS_MOBILE_MQ;

const DialysisAppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updateUser } = useAuth();
  const { hospitals, hospitalId, setHospitalId, refreshHospitals } = useDialysisContext();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    document.documentElement.classList.add('d-app-html');
    document.body.classList.add('d-app-body-lock');
    return () => {
      mq.removeEventListener('change', sync);
      document.documentElement.classList.remove('d-app-html');
      document.body.classList.remove('d-app-body-lock');
    };
  }, []);

  useEffect(() => {
    if (isMobile) {
      document.body.classList.add('d-app-mobile');
    } else {
      document.body.classList.remove('d-app-mobile');
    }
    return () => document.body.classList.remove('d-app-mobile');
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    dialysisHaptic('nav');
  }, [location.pathname, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const header = document.querySelector('.d-app-header');
    const onScroll = () => {
      header?.classList.toggle('is-scrolled', window.scrollY > 6);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  // فلترة العناصر حسب الصلاحية. ملاحظة: hooks لا تستدعى داخل map، لذلك نستدعيها هنا.
  const canView = usePermission('dialysis:view');
  const permPharmView = usePermission('dialysis:pharmacy:view');
  const permPharmDisp = usePermission('dialysis:pharmacy:dispense');
  const permPharmInv = usePermission('dialysis:pharmacy:inventory');
  const canPharmacyNav = permPharmView || permPharmDisp || permPharmInv;
  const canRecon = usePermission('dialysis:reconciliation');
  const canAccess = usePermission('dialysis:access:manage');
  const canManageHospital = usePermission('dialysis:hospital:manage');
  const canStatsEntry = usePermission('dialysis:stats:entry');
  const canStatsBulk = usePermission('dialysis:stats:bulk');

  const [newHospitalOpen, setNewHospitalOpen] = useState(false);
  const [newHospitalSaving, setNewHospitalSaving] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [hospitalDrawerOpen, setHospitalDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hospitalForm] = Form.useForm<{
    name: string;
    code?: string;
    province?: string;
    directorate?: string;
    address?: string;
  }>();

  const submitNewHospital = async () => {
    try {
      const v = await hospitalForm.validateFields();
      setNewHospitalSaving(true);
      const { data } = await axios.post<{
        id: number;
        name: string;
        code?: string | null;
      }>('/api/dialysis/hospitals', {
        name: v.name.trim(),
        code: v.code?.trim() || undefined,
        province: v.province?.trim() || undefined,
        directorate: v.directorate?.trim() || undefined,
        address: v.address?.trim() || undefined,
      });
      message.success('تم إنشاء المستشفى وتهيئة المستودعات الافتراضية');
      setNewHospitalOpen(false);
      hospitalForm.resetFields();
      await refreshHospitals();
      setHospitalId(data.id);
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'فشل إنشاء المستشفى';
      message.error(msg);
    } finally {
      setNewHospitalSaving(false);
    }
  };

  const items = ALL_ITEMS.filter((it) => {
    if (!it.permission) return true;
    if (it.key === 'statistics') return canRecon || canStatsEntry || canStatsBulk;
    if (it.permission === 'dialysis:view') return canView;
    if (it.permission === 'dialysis:pharmacy:view') return canPharmacyNav || canView;
    if (it.permission === 'dialysis:reconciliation') return canRecon;
    if (it.permission === 'dialysis:access:manage') return canAccess;
    return true;
  }).filter((it) => {
    if (canView) return true;
    if (!canPharmacyNav) return false;
    return it.key === 'pharmacy' || it.key === 'pharmacy-stock';
  });

  const groups: Array<{ key: string; title: string; items: NavItem[] }> = [
    { key: 'main', title: 'العمليات اليومية', items: items.filter((i) => i.group === 'main') },
    { key: 'setup', title: 'الإعداد', items: items.filter((i) => i.group === 'setup') },
    { key: 'admin', title: 'الإدارة', items: items.filter((i) => i.group === 'admin') },
  ].filter((g) => g.items.length > 0);

  const activeKey =
    items.find((i) => {
      if (i.to === '/dialysis') return location.pathname === '/dialysis' || location.pathname === '/dialysis/';
      return location.pathname.startsWith(i.to);
    })?.key ?? 'overview';

  const menuItems: MenuProps['items'] = groups.flatMap((g) => [
    { key: `g-${g.key}`, label: g.title, type: 'group' as const },
    ...g.items.map((it) => ({
      key: it.key,
      icon: it.icon,
      label: it.label,
      onClick: () => {
        navigate(it.to);
        setMobileNavOpen(false);
      },
    })),
  ]);

  const userAvatarSrc = user?.photoUrl
    ? `${user.photoUrl}${user.photoUrl.includes('?') ? '&' : '?'}v=${photoVersion}`
    : undefined;

  const mobileNavKeys = canView ? MOBILE_BOTTOM : canPharmacyNav ? ['pharmacy', 'pharmacy-stock'] : MOBILE_BOTTOM;

  const hospitalOptions = useMemo(
    () => [
      ...(hospitals.length > 1
        ? [{ value: ALL_MY_HOSPITALS, label: 'جميع المستشفيات (مدموج)' }]
        : []),
      ...hospitals.map((h) => ({
        value: h.id,
        label: `${h.name}${h.code ? ` · ${h.code}` : ''}`,
      })),
    ],
    [hospitals]
  );

  const currentHospitalLabel = useMemo(() => {
    if (hospitalId === ALL_MY_HOSPITALS) return 'جميع المستشفيات';
    const match = hospitals.find((h) => h.id === hospitalId);
    if (!match) return 'اختر المستشفى';
    return match.code ? `${match.name} · ${match.code}` : match.name;
  }, [hospitalId, hospitals]);

  const currentHospitalShortLabel = useMemo(() => {
    if (hospitalId === ALL_MY_HOSPITALS) return 'جميع المستشفيات';
    const match = hospitals.find((h) => h.id === hospitalId);
    if (!match) return 'المستشفى';
    return match.code || match.name;
  }, [hospitalId, hospitals]);

  const isOverviewPage =
    location.pathname === '/dialysis' || location.pathname === '/dialysis/';

  const pageDirection = useDialysisPageDirection(location.pathname);

  const hospitalPicker = (
    <>
      <Select
        size={isMobile ? 'large' : 'middle'}
        className="d-app-hospital-select"
        placeholder="اختر المستشفى"
        value={hospitalId ?? undefined}
        onChange={(value) => {
          setHospitalId(value);
          setHospitalDrawerOpen(false);
        }}
        showSearch={!isMobile}
        optionFilterProp="label"
        options={hospitalOptions}
      />
      <Space size="small" className="d-app-hospital-bar__actions">
        {canManageHospital && (
          <Tooltip title="مستشفى جديد">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setHospitalDrawerOpen(false);
                setNewHospitalOpen(true);
              }}
            >
              مستشفى جديد
            </Button>
          </Tooltip>
        )}
        <Tooltip title="تحديث قائمة المستشفيات">
          <Button icon={<ReloadOutlined />} onClick={() => refreshHospitals()} />
        </Tooltip>
      </Space>
    </>
  );

  const userMenu: MenuProps['items'] = [
    {
      key: 'hospital-scope',
      icon: <BankOutlined />,
      label: (
        <span className="d-app-user-menu-hospital">
          <span className="d-app-user-menu-hospital__label">نطاق العمل</span>
          <span className="d-app-user-menu-hospital__value">{currentHospitalShortLabel}</span>
        </span>
      ),
      onClick: () => {
        dialysisHaptic('tap');
        setHospitalDrawerOpen(true);
      },
    },
    { type: 'divider' },
    {
      key: 'home',
      icon: <ArrowLeftOutlined />,
      label: 'العودة للنظام الرئيسي',
      onClick: () => navigate('/'),
    },
    {
      key: 'profile-photo',
      icon: <CameraOutlined />,
      label: 'الصورة الشخصية',
      onClick: () => setProfilePhotoOpen(true),
    },
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: 'تغيير كلمة المرور',
      onClick: () => setChangePasswordOpen(true),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'تسجيل الخروج',
      onClick: () => logout(),
      danger: true,
    },
  ];

  const closeUserMenu = () => setUserMenuOpen(false);

  const runUserMenuAction = (action: () => void) => {
    closeUserMenu();
    action();
  };

  const sidebar = (
    <div className="d-app-sidebar-inner">
      <div className="d-app-brand">
        <DialysisBrandLogo size={collapsed && !isMobile ? 'md' : 'lg'} />
        {(!collapsed || isMobile) && (
          <div className="d-brand-text">
            <div className="d-brand-title">{DIALYSIS_SYSTEM_TITLE_SHORT}</div>
            <div className="d-brand-sub">{DIALYSIS_SYSTEM_TITLE}</div>
          </div>
        )}
      </div>
      {!isMobile && !collapsed && (
        <div className="d-app-sidebar-hospital">
          <Text type="secondary" className="d-app-hospital-bar__label">
            نطاق العمل
          </Text>
          {hospitalPicker}
        </div>
      )}
      {isMobile && (
        <div className="d-app-sidebar-hospital d-app-sidebar-hospital--mobile">
          <Text type="secondary" className="d-app-hospital-bar__label">
            نطاق العمل
          </Text>
          {hospitalPicker}
        </div>
      )}
      <Menu
        mode="inline"
        items={menuItems}
        selectedKeys={[activeKey]}
        className="d-app-menu"
        inlineCollapsed={collapsed && !isMobile}
      />
    </div>
  );

  const desktopSider = (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={240}
      theme="light"
      className="d-app-sider"
      breakpoint="lg"
      trigger={null}
    >
      {sidebar}
    </Sider>
  );

  const mobileBottom = isMobile ? (
    <nav className="d-bottom-nav">
      {items
        .filter((i) => mobileNavKeys.includes(i.key))
        .map((i) => (
          <NavLink
            key={i.key}
            to={i.to}
            end={i.to === '/dialysis'}
            className={({ isActive }) => `d-bottom-item${isActive ? ' active' : ''}`}
            onClick={() => dialysisHaptic('nav')}
          >
            <span className="d-bottom-icon">{i.icon}</span>
            <span className="d-bottom-label">
              {i.key === 'live' ? 'القاعة' : i.label}
            </span>
          </NavLink>
        ))}
      <button
        type="button"
        className="d-bottom-item"
        onClick={() => {
          dialysisHaptic('tap');
          setMobileNavOpen(true);
        }}
      >
        <span className="d-bottom-icon"><MenuOutlined /></span>
        <span className="d-bottom-label">المزيد</span>
      </button>
    </nav>
  ) : null;

  return (
    <>
    <Layout className={`d-app-root${isMobile ? ' d-app-mobile' : ''}`}>
      {!isMobile && desktopSider}

      {isMobile && (
        <Drawer
          placement="right"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={280}
          styles={{ body: { padding: 0 } }}
          closable={false}
        >
          {sidebar}
        </Drawer>
      )}

      <Layout className="d-app-body">
        <Header className={`d-app-header${isMobile ? ' d-app-header--mobile' : ''}`}>
          <div className="d-app-header-row d-app-header-row--main">
            <div className="d-app-header-left">
              {isMobile && (
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => {
                    dialysisHaptic('tap');
                    setMobileNavOpen(true);
                  }}
                  aria-label="فتح القائمة"
                />
              )}
              {!isMobile && (
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => setCollapsed((v) => !v)}
                  aria-label="طي القائمة الجانبية"
                />
              )}
              <DialysisBrandLogo size="sm" className="d-app-header-logo" />
              <Text strong className="d-app-page-title">
                {items.find((i) => i.key === activeKey)?.label || DIALYSIS_SYSTEM_TITLE}
              </Text>
            </div>
            {!isMobile && (
              <Dropdown
                menu={{ items: userMenu }}
                placement="bottomLeft"
                trigger={['click']}
                getPopupContainer={() => document.body}
                overlayStyle={{ zIndex: 1300 }}
              >
                <Button type="text" className="d-app-user-btn" aria-label="قائمة الحساب">
                  <Avatar size="small" src={userAvatarSrc} icon={<UserOutlined />} />
                  <span style={{ marginInlineStart: 8 }}>{user?.name}</span>
                </Button>
              </Dropdown>
            )}
            {isMobile && (
              <Button
                type="text"
                className="d-app-user-btn"
                aria-label="فتح قائمة الحساب"
                onClick={() => {
                  dialysisHaptic('tap');
                  setUserMenuOpen(true);
                }}
              >
                <Avatar size="small" src={userAvatarSrc} icon={<UserOutlined />} />
              </Button>
            )}
          </div>
        </Header>

        <Content className={`d-app-content${isMobile ? ' has-bottom-nav' : ''}`}>
          {hospitalId == null ? (
            <div className="d-empty">
              <MedicineBoxOutlined style={{ fontSize: 36, color: '#722ed1' }} />
              <Typography.Title level={4} style={{ marginTop: 12 }}>
                اختر المستشفى للبدء
              </Typography.Title>
              <Text type="secondary">
                {isMobile
                  ? 'افتح القائمة (☰) أو حسابك واختر «نطاق العمل».'
                  : 'اختر المستشفى من القائمة الجانبية لعرض البيانات.'}
              </Text>
              {canManageHospital && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={() => setNewHospitalOpen(true)}
                >
                  إنشاء مستشفى جديد
                </Button>
              )}
            </div>
          ) : (
            <>
              {isOverviewPage && <DialysisWelcomeBanner isMobile={isMobile} />}
              <div
                key={location.pathname}
                className={
                  isMobile
                    ? `d-page-transition d-page-transition--mobile d-page-transition--mobile-${pageDirection}`
                    : 'd-page-transition'
                }
              >
                <Outlet />
              </div>
            </>
          )}
        </Content>

        {isMobile && (
          <>
            <Drawer
              placement="bottom"
              open={hospitalDrawerOpen}
              onClose={() => setHospitalDrawerOpen(false)}
              height="auto"
              title="نطاق العمل"
              className="d-app-hospital-drawer"
              destroyOnClose
            >
              <Text type="secondary" className="d-app-hospital-drawer__current">
                {currentHospitalLabel}
              </Text>
              <div className="d-app-hospital-drawer__body">{hospitalPicker}</div>
            </Drawer>

            <Drawer
              placement="bottom"
              open={userMenuOpen}
              onClose={closeUserMenu}
              height="auto"
              title="حسابي"
              className="d-app-user-drawer"
              destroyOnClose
              zIndex={1300}
            >
              <button
                type="button"
                className="d-app-user-drawer__profile"
                onClick={() =>
                  runUserMenuAction(() => setProfilePhotoOpen(true))
                }
              >
                <Avatar size={64} src={userAvatarSrc} icon={<UserOutlined />} />
                <span className="d-app-user-drawer__name">{user?.name || 'المستخدم'}</span>
                <Text type="secondary" className="d-app-user-drawer__photo-hint">
                  اضغط لتغيير الصورة الشخصية
                </Text>
              </button>

              <div className="d-app-user-drawer__actions">
                <Button
                  block
                  size="large"
                  icon={<BankOutlined />}
                  onClick={() =>
                    runUserMenuAction(() => setHospitalDrawerOpen(true))
                  }
                >
                  نطاق العمل — {currentHospitalShortLabel}
                </Button>
                <Button
                  block
                  size="large"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => runUserMenuAction(() => navigate('/'))}
                >
                  العودة للنظام الرئيسي
                </Button>
                <Button
                  block
                  size="large"
                  icon={<CameraOutlined />}
                  onClick={() =>
                    runUserMenuAction(() => setProfilePhotoOpen(true))
                  }
                >
                  الصورة الشخصية
                </Button>
                <Button
                  block
                  size="large"
                  icon={<LockOutlined />}
                  onClick={() =>
                    runUserMenuAction(() => setChangePasswordOpen(true))
                  }
                >
                  تغيير كلمة المرور
                </Button>
                <Button
                  block
                  size="large"
                  danger
                  icon={<LogoutOutlined />}
                  onClick={() => runUserMenuAction(() => logout())}
                >
                  تسجيل الخروج
                </Button>
              </div>
            </Drawer>
          </>
        )}
      </Layout>

    </Layout>

      {isMobile &&
        mobileBottom &&
        typeof document !== 'undefined' &&
        createPortal(mobileBottom, document.body)}

      <Modal
        title="مستشفى جديد — وحدة الغسيل الكلوي"
        open={newHospitalOpen}
        onCancel={() => {
          setNewHospitalOpen(false);
          hospitalForm.resetFields();
        }}
        okText="إنشاء"
        cancelText="إلغاء"
        confirmLoading={newHospitalSaving}
        onOk={submitNewHospital}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          يُنشأ سجل مستشفى نشط مع مستودعي مستلزمات عامة وصيدلية افتراضيين. يمكنك بعدها ربط الموظفين
          بالمستشفى من «إدارة الوصول».
        </Text>
        <Form form={hospitalForm} layout="vertical" requiredMark="optional">
          <Form.Item
            name="name"
            label="اسم المستشفى / وحدة الكلى"
            rules={[{ required: true, message: 'أدخل الاسم' }]}
          >
            <Input placeholder="مثال: مستشفى الحكيم — قسم الغسيل" />
          </Form.Item>
          <Form.Item name="code" label="رمز مختصر (اختياري)">
            <Input placeholder="مثال: NAJAF-HAKIM" />
          </Form.Item>
          <Form.Item name="province" label="المحافظة">
            <Input placeholder="النجف" />
          </Form.Item>
          <Form.Item name="directorate" label="المديرية / الدائرة">
            <Input placeholder="مديرية صحة النجف" />
          </Form.Item>
          <Form.Item name="address" label="العنوان">
            <Input placeholder="عنوان اختياري" />
          </Form.Item>
        </Form>
      </Modal>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />

      <ProfilePhotoModal
        open={profilePhotoOpen}
        onClose={() => setProfilePhotoOpen(false)}
        userName={user?.name}
        photoUrl={user?.photoUrl}
        onSuccess={(photoUrl) => {
          updateUser({ photoUrl });
          setPhotoVersion(Date.now());
        }}
      />
    </>
  );
};

export default DialysisAppLayout;

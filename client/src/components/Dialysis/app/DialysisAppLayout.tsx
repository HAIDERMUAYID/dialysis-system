import React, { useState, useEffect } from 'react';
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
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { usePermission } from '../../../hooks/usePermission';
import { ALL_MY_HOSPITALS, useDialysisContext } from './dialysisContext';
import { DIALYSIS_MOBILE_MQ } from './useDialysisMobile';
import DialysisBrandLogo from './DialysisBrandLogo';
import { DIALYSIS_SYSTEM_TITLE, DIALYSIS_SYSTEM_TITLE_SHORT } from './dialysisBrand';
import './dialysis-brand.css';
import './dialysis-app.css';

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

/** عناصر للشريط السفلي على الموبايل — «التقارير» بدل «القاعة النشطة» للوصول السريع */
const MOBILE_BOTTOM = ['overview', 'patients', 'sessions', 'reports'];

/** أعرض من هذا العرض نعتبر الجهاز هاتفاً/تابلت صغيراً — يتوافق مع useDialysisMobile */
const MOBILE_MQ = DIALYSIS_MOBILE_MQ;

const DialysisAppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
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

  const userMenu: MenuProps['items'] = [
    {
      key: 'home',
      icon: <ArrowLeftOutlined />,
      label: 'العودة للنظام الرئيسي',
      onClick: () => navigate('/'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'تسجيل الخروج',
      onClick: () => logout(),
      danger: true,
    },
  ];

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

  const mobileNavKeys = canView ? MOBILE_BOTTOM : canPharmacyNav ? ['pharmacy', 'pharmacy-stock'] : MOBILE_BOTTOM;

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
          >
            <span className="d-bottom-icon">{i.icon}</span>
            <span className="d-bottom-label">{i.label}</span>
          </NavLink>
        ))}
      <button
        type="button"
        className="d-bottom-item"
        onClick={() => setMobileNavOpen(true)}
      >
        <span className="d-bottom-icon"><MenuOutlined /></span>
        <span className="d-bottom-label">المزيد</span>
      </button>
    </nav>
  ) : null;

  return (
    <>
    <Layout className="d-app-root">
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
                  onClick={() => setMobileNavOpen(true)}
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
              <Space wrap size="small" className="d-app-header-actions">
                <Select
                  size="middle"
                  style={{ minWidth: 240 }}
                  placeholder="المستشفى"
                  value={hospitalId ?? undefined}
                  onChange={setHospitalId}
                  options={[
                    ...(hospitals.length > 1
                      ? [
                          {
                            value: ALL_MY_HOSPITALS,
                            label: 'جميع المستشفيات (مدموج)',
                          },
                        ]
                      : []),
                    ...hospitals.map((h) => ({
                      value: h.id,
                      label: `${h.name}${h.code ? ` · ${h.code}` : ''}`,
                    })),
                  ]}
                />
                {canManageHospital && (
                  <Tooltip title="إضافة مستشفى جديد (وحدة غسيل)">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setNewHospitalOpen(true)}
                    >
                      مستشفى جديد
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="تحديث">
                  <Button icon={<ReloadOutlined />} onClick={() => refreshHospitals()} />
                </Tooltip>
                <Dropdown menu={{ items: userMenu }} placement="bottomLeft">
                  <Button type="text" className="d-app-user-btn">
                    <Avatar size="small" icon={<UserOutlined />} />
                    <span style={{ marginInlineStart: 8 }}>{user?.name}</span>
                  </Button>
                </Dropdown>
              </Space>
            )}
            {isMobile && (
              <Space size="small">
                {canManageHospital && (
                  <Tooltip title="مستشفى جديد">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setNewHospitalOpen(true)}
                    />
                  </Tooltip>
                )}
                <Tooltip title="تحديث">
                  <Button icon={<ReloadOutlined />} onClick={() => refreshHospitals()} />
                </Tooltip>
                <Dropdown menu={{ items: userMenu }} placement="bottomLeft">
                  <Button type="text" className="d-app-user-btn">
                    <Avatar size="small" icon={<UserOutlined />} />
                  </Button>
                </Dropdown>
              </Space>
            )}
          </div>
          {isMobile && (
            <div className="d-app-header-row d-app-header-row--bar">
              <Select
                size="large"
                className="d-app-hospital-select"
                placeholder="المستشفى"
                value={hospitalId ?? undefined}
                onChange={setHospitalId}
                options={[
                  ...(hospitals.length > 1
                    ? [{ value: ALL_MY_HOSPITALS, label: 'جميع المستشفيات (مدموج)' }]
                    : []),
                  ...hospitals.map((h) => ({
                    value: h.id,
                    label: `${h.name}${h.code ? ` · ${h.code}` : ''}`,
                  })),
                ]}
              />
            </div>
          )}
        </Header>

        <Content className={`d-app-content${isMobile ? ' has-bottom-nav' : ''}`}>
          {hospitalId == null ? (
            <div className="d-empty">
              <MedicineBoxOutlined style={{ fontSize: 36, color: '#722ed1' }} />
              <Typography.Title level={4} style={{ marginTop: 12 }}>
                اختر المستشفى للبدء
              </Typography.Title>
              <Text type="secondary">يجب اختيار مستشفى من الأعلى لعرض البيانات.</Text>
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
            <div key={location.pathname} className="d-page-transition">
              <Outlet />
            </div>
          )}
        </Content>

        {mobileBottom}
      </Layout>
    </Layout>

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
    </>
  );
};

export default DialysisAppLayout;

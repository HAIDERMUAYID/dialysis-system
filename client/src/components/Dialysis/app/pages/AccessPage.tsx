import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Input,
  Space,
  Modal,
  Button,
  Checkbox,
  Radio,
  Typography,
  message,
  Empty,
  Tabs,
  Popconfirm,
  Form,
  Select,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  PlusOutlined,
  StopOutlined,
  UserAddOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useDialysisContext } from '../dialysisContext';
import { useDialysisMobile } from '../useDialysisMobile';
import { usePermission } from '../../../../hooks/usePermission';
import { useAuth } from '../../../../context/AuthContext';

const { Text, Title } = Typography;

interface PermDef {
  id: number;
  name: string;
  displayName: string;
  category?: string | null;
}

interface UserAccess {
  id: number;
  username: string;
  name: string;
  role: string;
  roleDisplay?: string | null;
  isActive: number;
  /** لم يُستخدم — صلاحيات الغسيل من المنح المباشر فقط */
  rolePermissions: string[];
  directPermissions: string[];
  effectivePermissions: string[];
  dialysisHospitalAccess?: {
    hospitalIds: number[];
    primaryHospitalId: number | null;
  };
}

interface HospitalDirectoryRow {
  id: number;
  name: string;
  code?: string | null;
  province?: string | null;
  directorate?: string | null;
  user_count: number;
  users: Array<{
    userId: number;
    username: string;
    name: string;
    role: string;
    roleDisplay: string | null;
    isPrimary: number;
    isActive: number;
  }>;
}

interface UserPoolRow {
  id: number;
  username: string;
  name: string;
  role: string;
  roleDisplay: string | null;
}

/** يطابق تصنيفات seed.js — لعرض مجمّع حسب الصفحة/الوحدة حتى قبل تشغيل البذرة على قواعد قديمة */
const DIALYSIS_PERM_CATEGORY_FALLBACK: Record<string, string> = {
  'dialysis:view': 'd01_overview',
  'dialysis:scope:all_hospitals': 'd01_overview',
  'dialysis:hospital:manage': 'd02_hospital',
  'dialysis:patient:create': 'd03_patients',
  'dialysis:patient:edit': 'd03_patients',
  'dialysis:patient:delete': 'd03_patients',
  'dialysis:location:manage': 'd04_structure',
  'dialysis:session:create': 'd05_sessions',
  'dialysis:session:edit': 'd05_sessions',
  'dialysis:session:delete': 'd05_sessions',
  'dialysis:stats:entry': 'd06_stats',
  'dialysis:stats:bulk': 'd06_stats',
  'dialysis:reconciliation': 'd06_stats',
  'dialysis:pharmacy:view': 'd07_pharmacy',
  'dialysis:pharmacy:dispense': 'd07_pharmacy',
  'dialysis:pharmacy:inventory': 'd07_pharmacy',
  'dialysis:access:manage': 'd08_access',
};

const DIALYSIS_SECTION_TITLE_AR: Record<string, string> = {
  d01_overview: 'الوصول العام والنطاق الجغرافي',
  d02_hospital: 'مستشفيات D-IRS (التسجيل والإدارة)',
  d03_patients: 'المرضى — إضافة وتعديل وحذف',
  d04_structure: 'القاعات والأسرة، الشفتات، الأجهزة، والمستودع',
  d05_sessions: 'الجلسات والقاعة النشطة',
  d06_stats: 'التقارير، الإحصاء اليومي، والمطابقة',
  d07_pharmacy: 'صيدلية الغسل والمخزن',
  d08_access: 'إدارة الوصول والصلاحيات',
  dialysis: 'صلاحيات الغسل الكلوي',
  general: 'عام',
  other: 'أخرى',
};

function dialysisSectionTitle(categoryKey: string): string {
  return DIALYSIS_SECTION_TITLE_AR[categoryKey] ?? categoryKey;
}

const AccessPage: React.FC = () => {
  const { hospitals, refreshHospitals } = useDialysisContext();
  const { user: authUser } = useAuth();
  const canManage = usePermission('dialysis:access:manage');
  const canManageHospital = usePermission('dialysis:hospital:manage');
  const isMobile = useDialysisMobile();
  const canGrantAllHospitalsScope =
    authUser?.role === 'admin' || !!authUser?.dialysisCanSeeAllHospitals;

  const [accessTab, setAccessTab] = useState<string>('by-hospital');
  const [perms, setPerms] = useState<PermDef[]>([]);
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [hospitalDirectory, setHospitalDirectory] = useState<HospitalDirectoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [search, setSearch] = useState('');
  const [hospSearch, setHospSearch] = useState('');

  const [editing, setEditing] = useState<UserAccess | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editHospitalIds, setEditHospitalIds] = useState<Set<number>>(new Set());
  const [editPrimaryHospitalId, setEditPrimaryHospitalId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [memberModal, setMemberModal] = useState<{
    open: boolean;
    hospitalId: number | null;
    hospitalName: string;
  }>({ open: false, hospitalId: null, hospitalName: '' });
  const [memberUserId, setMemberUserId] = useState<number | null>(null);
  const [memberPrimary, setMemberPrimary] = useState(false);
  const [userPool, setUserPool] = useState<UserPoolRow[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);

  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUserSubmitting, setNewUserSubmitting] = useState(false);
  const [newUserForm] = Form.useForm<{
    username: string;
    password: string;
    name: string;
    hospital_ids: number[];
    primary_hospital_id?: number;
  }>();

  const loadUsersAndPerms = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const [p, u] = await Promise.all([
        axios.get<PermDef[]>('/api/dialysis/access/permissions'),
        axios.get<UserAccess[]>('/api/dialysis/access/users', { params: { search } }),
      ]);
      setPerms(p.data);
      setUsers(u.data);
    } catch {
      message.error('فشل جلب بيانات المستخدمين');
    } finally {
      setLoading(false);
    }
  }, [canManage, search]);

  const loadHospitalsDirectory = useCallback(async () => {
    if (!canManage) return;
    setLoadingHospitals(true);
    try {
      const { data } = await axios.get<HospitalDirectoryRow[]>(
        '/api/dialysis/access/hospitals-directory',
        { params: { search: hospSearch.trim() || undefined } }
      );
      setHospitalDirectory(data);
    } catch {
      message.error('فشل جلب دليل المستشفيات');
    } finally {
      setLoadingHospitals(false);
    }
  }, [canManage, hospSearch]);

  useEffect(() => {
    loadUsersAndPerms();
  }, [loadUsersAndPerms]);

  useEffect(() => {
    loadHospitalsDirectory();
  }, [loadHospitalsDirectory]);

  const openEdit = (u: UserAccess) => {
    setEditing(u);
    setSelected(new Set(u.directPermissions));
    const h = u.dialysisHospitalAccess?.hospitalIds ?? [];
    setEditHospitalIds(new Set(h));
    setEditPrimaryHospitalId(u.dialysisHospitalAccess?.primaryHospitalId ?? null);
  };

  const openEditByUserId = async (userId: number) => {
    try {
      const { data } = await axios.get<UserAccess>(`/api/dialysis/access/users/${userId}`);
      openEdit(data);
    } catch {
      message.error('تعذر تحميل بيانات المستخدم');
    }
  };

  const refreshAll = async () => {
    await loadUsersAndPerms();
    await loadHospitalsDirectory();
    await refreshHospitals();
  };

  const openMemberModal = async (h: HospitalDirectoryRow) => {
    setMemberModal({ open: true, hospitalId: h.id, hospitalName: h.name });
    setMemberUserId(null);
    setMemberPrimary(false);
    setPoolLoading(true);
    try {
      const { data } = await axios.get<UserPoolRow[]>('/api/dialysis/access/user-pool', {
        params: { exclude_hospital_id: h.id },
      });
      setUserPool(data);
    } catch {
      message.error('تعذر جلب قائمة المستخدمين');
      setUserPool([]);
    } finally {
      setPoolLoading(false);
    }
  };

  const submitAddMember = async () => {
    if (!memberModal.hospitalId || !memberUserId) {
      message.warning('اختر مستخدماً');
      return;
    }
    setMemberSaving(true);
    try {
      await axios.post('/api/dialysis/access/hospital-members', {
        user_id: memberUserId,
        hospital_id: memberModal.hospitalId,
        is_primary: memberPrimary,
      });
      message.success('تم ربط الموظف بالمستشفى');
      setMemberModal({ open: false, hospitalId: null, hospitalName: '' });
      await refreshAll();
    } catch (e: unknown) {
      message.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'فشل الربط'
      );
    } finally {
      setMemberSaving(false);
    }
  };

  const removeFromHospital = async (hospitalId: number, userId: number) => {
    try {
      await axios.delete('/api/dialysis/access/hospital-members', {
        data: { user_id: userId, hospital_id: hospitalId },
      });
      message.success('تم إزالة الموظف من هذا المستشفى');
      await refreshAll();
    } catch (e: unknown) {
      message.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'فشل الإزالة'
      );
    }
  };

  const deactivateHospital = async (hospitalId: number) => {
    try {
      await axios.patch(`/api/dialysis/hospitals/${hospitalId}`, { is_active: 0 });
      message.success('تم تعطيل المستشفى (يمكن إعادة تفعيله لاحقاً من قاعدة البيانات أو بإضافة أمر تفعيل)');
      await refreshAll();
    } catch (e: unknown) {
      message.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'فشل التعطيل'
      );
    }
  };

  const removeDialysisAccess = async (userId: number) => {
    try {
      await axios.delete(`/api/dialysis/access/users/${userId}/dialysis`);
      message.success('تمت إزالة ربط المستشفيات وكل منح صلاحيات الغسيل المخزنة لهذا المستخدم');
      await refreshAll();
    } catch (e: unknown) {
      message.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'فشل الإزالة'
      );
    }
  };

  const submitNewUser = async () => {
    try {
      const v = await newUserForm.validateFields();
      const hidList = v.hospital_ids || [];
      if (!hidList.length) {
        message.warning('اختر مستشفى واحداً على الأقل');
        return;
      }
      let primary = v.primary_hospital_id;
      if (hidList.length === 1) primary = hidList[0];
      if (hidList.length > 1 && (primary == null || !hidList.includes(primary))) {
        message.warning('حدد المستشفى الافتراضي');
        return;
      }
      setNewUserSubmitting(true);
      await axios.post('/api/dialysis/access/users', {
        username: v.username.trim(),
        password: v.password,
        name: v.name.trim(),
        hospital_ids: hidList,
        primary_hospital_id: primary,
        permissions: ['dialysis:view'],
      });
      message.success(
        'تم إنشاء حساب «موظف وحدة الغسيل» وربطه بالمستشفى مع صلاحية العرض — من دون ربط بدور النظام الرئيسي'
      );
      setNewUserOpen(false);
      newUserForm.resetFields();
      await refreshAll();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'فشل إنشاء المستخدم'
      );
    } finally {
      setNewUserSubmitting(false);
    }
  };

  const toggleHospitalPick = (id: number, checked: boolean) => {
    setEditHospitalIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
    if (!checked) {
      setEditPrimaryHospitalId((p) => (p === id ? null : p));
    }
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const hidList = Array.from(editHospitalIds);
    let primary = editPrimaryHospitalId;
    if (hidList.length === 1) {
      primary = hidList[0];
    }
    if (hidList.length && (primary == null || !hidList.includes(primary))) {
      message.warning('اختر المستشفى الافتراضي ضمن المحدد');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`/api/dialysis/access/users/${editing.id}`, {
        permissions: Array.from(selected),
        hospital_ids: hidList,
        primary_hospital_id: primary,
      });
      message.success('تم تحديث الصلاحيات والمستشفيات');
      setEditing(null);
      await refreshAll();
    } catch {
      message.error('فشل تحديث الصلاحيات');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return <Empty description="لا تملك صلاحية إدارة الوصول" />;
  }

  // تجميع الصلاحيات حسب الفئة (صفحة/وحدة) ثم ترتيب ثابت للأقسام
  const permGroups: Record<string, PermDef[]> = {};
  perms.forEach((p) => {
    if (p.name === 'dialysis:scope:all_hospitals' && !canGrantAllHospitalsScope) return;
    const cat =
      p.category?.trim() ||
      DIALYSIS_PERM_CATEGORY_FALLBACK[p.name] ||
      (p.name.startsWith('dialysis:') ? 'other' : 'general');
    if (!permGroups[cat]) permGroups[cat] = [];
    permGroups[cat].push(p);
  });
  const sortedPermSections = Object.entries(permGroups).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const userTableColumns: ColumnsType<UserAccess> = [
    { title: 'الاسم', dataIndex: 'name', key: 'n' },
    { title: 'المستخدم', dataIndex: 'username', key: 'u' },
    {
      title: 'الدور',
      key: 'r',
      render: (_, r) => r.roleDisplay || r.role,
      responsive: ['md'],
    },
    {
      title: 'حالة',
      dataIndex: 'isActive',
      key: 'st',
      width: 80,
      render: (a: number) =>
        a ? (
          <Tag className="d-access-tag d-access-tag--ok">نشط</Tag>
        ) : (
          <Tag className="d-access-tag d-access-tag--muted">معطل</Tag>
        ),
    },
    {
      title: 'المستشفيات (غسيل)',
      key: 'hosp',
      responsive: ['md'],
      render: (_, r) => {
        const ids = r.dialysisHospitalAccess?.hospitalIds ?? [];
        if (!ids.length) {
          return <Tag className="d-access-tag d-access-tag--muted">غير مربوط</Tag>;
        }
        return (
          <Space wrap size={[4, 4]}>
            {ids.map((id) => (
              <Tag key={id} className="d-access-tag d-access-tag--hospital">
                {hospitals.find((h) => h.id === id)?.name || `#${id}`}
                {r.dialysisHospitalAccess?.primaryHospitalId === id ? ' · افتراضي' : ''}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'صلاحيات الغسيل (مخزنة)',
      key: 'eff',
      render: (_, r) =>
        r.role === 'admin' ? (
          <Tag className="d-access-tag d-access-tag--perm-role" title="مدير النظام">
            مدير النظام — وصول كامل تلقائياً
          </Tag>
        ) : (
          <Space wrap size={[4, 4]}>
            {r.effectivePermissions.length === 0 && (
              <Tag className="d-access-tag d-access-tag--muted">بدون منح غسيل</Tag>
            )}
            {r.effectivePermissions.map((p) => {
              const label =
                perms.find((x) => x.name === p)?.displayName ?? p.replace('dialysis:', '');
              return (
                <Tag key={p} className="d-access-tag d-access-tag--perm-direct" title={p}>
                  {label.length > 48 ? `${label.slice(0, 46)}…` : label}
                </Tag>
              );
            })}
          </Space>
        ),
    },
    {
      title: 'إجراءات',
      key: 'a',
      width: isMobile ? 100 : 220,
      fixed: 'right',
      render: (_, r) => (
        <Space wrap size={[4, 4]}>
          <Button
            size="small"
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={() => openEdit(r)}
          >
            تعديل
          </Button>
          <Popconfirm
            title="إزالة وصول الغسيل؟"
            description="يُحذف ربط المستشفيات وكل صلاحيات الغسيل الممنوحة من شاشة إدارة الوصول."
            okText="نعم"
            cancelText="إلغاء"
            disabled={r.id === authUser?.id}
            onConfirm={() => removeDialysisAccess(r.id)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={r.id === authUser?.id}
            >
              إزالة
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="d-page-header">
        <h2>إدارة الوصول — وحدة الغسيل</h2>
        <Text className="sub">
          عرض المستشفيات والموظفين المرتبطين بكل مستشفى (مناسب لإشراف المديرية)، أو إدارة الصلاحيات
          حسب المستخدم. إنشاء مستشفى جديد من شريط العنوان (زر «مستشفى جديد») إن وُجدت الصلاحية.
        </Text>
      </div>

      <Tabs
        activeKey={accessTab}
        onChange={setAccessTab}
        className="d-access-tabs"
        items={[
          {
            key: 'by-hospital',
            label: 'المستشفيات والموظفون',
            children: (
              <div className="d-card">
                <div className="d-toolbar">
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="بحث: اسم المستشفى، الرمز، المحافظة، المديرية"
                    value={hospSearch}
                    onChange={(e) => setHospSearch(e.target.value)}
                    className="grow d-toolbar-input-grow"
                  />
                  <Button icon={<ReloadOutlined />} onClick={() => loadHospitalsDirectory()}>
                    تحديث
                  </Button>
                </div>
                <div className="d-table-scroll">
                  <Table<HospitalDirectoryRow>
                    rowKey="id"
                    loading={loadingHospitals}
                    dataSource={hospitalDirectory}
                    size={isMobile ? 'small' : 'middle'}
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    expandable={{
                      expandedRowRender: (record) => (
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => openMemberModal(record)}
                          >
                            إضافة موظف لهذا المستشفى
                          </Button>
                          {record.users.length === 0 ? (
                            <Text type="secondary">
                              لا يوجد موظف مرتبط بهذا المستشفى في نظام الغسيل.
                            </Text>
                          ) : (
                            <Table
                              size="small"
                              rowKey="userId"
                              pagination={false}
                              dataSource={record.users}
                              columns={[
                                { title: 'الاسم', dataIndex: 'name', key: 'nm' },
                                { title: 'المستخدم', dataIndex: 'username', key: 'un' },
                                {
                                  title: 'الدور',
                                  key: 'rl',
                                  render: (_: unknown, u: HospitalDirectoryRow['users'][0]) =>
                                    u.roleDisplay || u.role,
                                },
                                {
                                  title: 'افتراضي',
                                  key: 'pr',
                                  width: 90,
                                  render: (_: unknown, u: HospitalDirectoryRow['users'][0]) =>
                                    u.isPrimary ? (
                                      <Tag className="d-access-tag d-access-tag--ok">افتراضي</Tag>
                                    ) : (
                                      '—'
                                    ),
                                },
                                {
                                  title: 'حالة',
                                  key: 'ac',
                                  width: 88,
                                  render: (_: unknown, u: HospitalDirectoryRow['users'][0]) =>
                                    u.isActive ? (
                                      <Tag className="d-access-tag d-access-tag--ok">نشط</Tag>
                                    ) : (
                                      <Tag className="d-access-tag d-access-tag--muted">معطل</Tag>
                                    ),
                                },
                                {
                                  title: '',
                                  key: 'ed',
                                  width: 140,
                                  render: (_: unknown, u: HospitalDirectoryRow['users'][0]) => (
                                    <Button
                                      size="small"
                                      type="primary"
                                      onClick={() => openEditByUserId(u.userId)}
                                    >
                                      تعديل الصلاحيات
                                    </Button>
                                  ),
                                },
                                {
                                  title: '',
                                  key: 'rm',
                                  width: 100,
                                  render: (_: unknown, u: HospitalDirectoryRow['users'][0]) => (
                                    <Popconfirm
                                      title="إزالة الموظف من هذا المستشفى؟"
                                      okText="نعم"
                                      cancelText="إلغاء"
                                      onConfirm={() => removeFromHospital(record.id, u.userId)}
                                    >
                                      <Button size="small" danger icon={<DeleteOutlined />}>
                                        إزالة
                                      </Button>
                                    </Popconfirm>
                                  ),
                                },
                              ]}
                            />
                          )}
                        </Space>
                      ),
                    }}
                    columns={[
                      { title: 'المستشفى / وحدة الكلى', dataIndex: 'name', key: 'nm' },
                      {
                        title: 'الرمز',
                        dataIndex: 'code',
                        key: 'cd',
                        width: 120,
                        render: (c: string | null | undefined) => c || '—',
                      },
                      {
                        title: 'المحافظة',
                        dataIndex: 'province',
                        key: 'pv',
                        responsive: ['md'],
                        render: (c: string | null | undefined) => c || '—',
                      },
                      {
                        title: 'المديرية',
                        dataIndex: 'directorate',
                        key: 'dr',
                        responsive: ['lg'],
                        render: (c: string | null | undefined) => c || '—',
                      },
                      {
                        title: 'عدد الموظفين',
                        dataIndex: 'user_count',
                        key: 'uc',
                        width: 110,
                        render: (n: number) => (
                          <Tag className="d-access-tag d-access-tag--perm-role">{n}</Tag>
                        ),
                      },
                      ...(canManageHospital
                        ? [
                            {
                              title: 'تعطيل',
                              key: 'adm',
                              width: 110,
                              render: (_: unknown, h: HospitalDirectoryRow) => (
                                <Popconfirm
                                  title="تعطيل هذا المستشفى في النظام؟"
                                  description="لا يُحذف السجل؛ يُخفى عن القوائم النشطة. البيانات تبقى في قاعدة البيانات."
                                  okText="تعطيل"
                                  cancelText="إلغاء"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => deactivateHospital(h.id)}
                                >
                                  <Button size="small" danger icon={<StopOutlined />}>
                                    تعطيل
                                  </Button>
                                </Popconfirm>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                  وسّع الصف لإضافة موظف أو إدارته. «تعطيل المستشفى» يتطلب صلاحية إدارة مستشفيات الغسيل.
                </Text>
              </div>
            ),
          },
          {
            key: 'by-user',
            label: 'حسب المستخدم',
            children: (
              <div className="d-card">
                <div className="d-toolbar">
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="بحث: اسم المستخدم أو الاسم الكامل"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="grow d-toolbar-input-grow"
                  />
                  <Button icon={<ReloadOutlined />} onClick={() => loadUsersAndPerms()}>
                    تحديث
                  </Button>
                  <Button type="primary" icon={<UserAddOutlined />} onClick={() => setNewUserOpen(true)}>
                    إضافة مستخدم
                  </Button>
                </div>
                <div className="d-table-scroll">
                  <Table<UserAccess>
                    rowKey="id"
                    loading={loading}
                    dataSource={users}
                    size={isMobile ? 'small' : 'middle'}
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 12, showSizeChanger: false }}
                    columns={userTableColumns}
                  />
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                  <Tag className="d-access-tag d-access-tag--perm-role">صلاحية دور</Tag> = ممنوحة عبر دور
                  المستخدم (لا تُحذف من هنا).
                  <Tag className="d-access-tag d-access-tag--perm-direct" style={{ marginInlineStart: 8 }}>
                    منح مباشر
                  </Tag>{' '}
                  = ممنوحة فقط لهذا المستخدم.
                </Text>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={memberModal.hospitalName ? `ربط موظف — ${memberModal.hospitalName}` : 'ربط موظف'}
        open={memberModal.open}
        onCancel={() => {
          setMemberModal({ open: false, hospitalId: null, hospitalName: '' });
          setMemberUserId(null);
        }}
        onOk={submitAddMember}
        confirmLoading={memberSaving}
        okText="ربط"
        cancelText="إلغاء"
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          قائمة بالمستخدمين النشطين الذين لا يملكون وصولاً لهذا المستشفى بعد.
        </Text>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ width: '100%' }}>
            <Text strong>المستخدم</Text>
            <Select
              showSearch
              optionFilterProp="label"
              loading={poolLoading}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="اختر مستخدماً"
              allowClear
              value={memberUserId ?? undefined}
              onChange={(v) => setMemberUserId(v ?? null)}
              options={userPool.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.username}) — ${u.roleDisplay || u.role}`,
              }))}
            />
          </div>
          <Checkbox checked={memberPrimary} onChange={(e) => setMemberPrimary(e.target.checked)}>
            جعل هذا المستشفى الافتراضي عند دخول الموظف للغسيل
          </Checkbox>
        </Space>
      </Modal>

      <Modal
        title="مستخدم جديد — وحدة الغسيل"
        open={newUserOpen}
        onCancel={() => {
          setNewUserOpen(false);
          newUserForm.resetFields();
        }}
        onOk={submitNewUser}
        confirmLoading={newUserSubmitting}
        okText="إنشاء"
        cancelText="إلغاء"
        width={isMobile ? 'calc(100vw - 24px)' : 520}
        destroyOnClose
      >
        <Form form={newUserForm} layout="vertical" requiredMark="optional">
          <Form.Item
            name="username"
            label="اسم المستخدم"
            rules={[{ required: true, message: 'مطلوب' }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label="كلمة المرور"
            rules={[{ required: true, min: 6, message: '6 أحرف على الأقل' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="name" label="الاسم الكامل" rules={[{ required: true, message: 'مطلوب' }]}>
            <Input />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="نظام الدخول لهذا الحساب"
            description={
              <>
                <strong>الغسل الكلوي (D-IRS) فقط</strong> — يفتح صفحة وحدة الغسل مباشرة بعد تسجيل
                الدخول.
                <br />
                لإنشاء مستخدم للنظام الرئيسي (الكلية الصناعية — استعلامات، مختبر، صيدلية، طبيب)
                استخدم لوحة المدير في النظام الرئيسي.
              </>
            }
          />
          <Form.Item
            name="hospital_ids"
            label="المستشفيات"
            rules={[{ required: true, message: 'اختر مستشفى واحداً على الأقل' }]}
          >
            <Checkbox.Group options={hospitals.map((h) => ({ label: h.name, value: h.id }))} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.hospital_ids !== c.hospital_ids}>
            {({ getFieldValue }) => {
              const ids = (getFieldValue('hospital_ids') || []) as number[];
              if (ids.length <= 1) return null;
              return (
                <Form.Item
                  name="primary_hospital_id"
                  label="المستشفى الافتراضي"
                  rules={[{ required: true, message: 'مطلوب عند اختيار أكثر من مستشفى' }]}
                >
                  <Radio.Group>
                    {ids.map((id) => (
                      <Radio key={id} value={id}>
                        {hospitals.find((x) => x.id === id)?.name || id}
                      </Radio>
                    ))}
                  </Radio.Group>
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          يُمنح تلقائياً عرض وحدة الغسيل (dialysis:view). الدخول للنظام الرئيسي غير مفعّل لهذا النوع من
          الحسابات إلا إذا غيّر المدير دوره لاحقاً من إدارة المستخدمين.
        </Text>
      </Modal>

      <Modal
        title={editing ? `صلاحيات الغسل الكلوي — ${editing.name}` : ''}
        open={!!editing}
        onCancel={() => {
          setEditing(null);
          setEditHospitalIds(new Set());
          setEditPrimaryHospitalId(null);
        }}
        onOk={saveEdit}
        okText="حفظ"
        confirmLoading={saving}
        width={isMobile ? 'calc(100vw - 24px)' : 640}
        centered
        styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
      >
        {editing && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">
              صلاحيات وحدة الغسيل تُحدَّد هنا فقط (تُخزَّن كمنح مباشر). دور النظام الرئيسي (
              <Tag className="d-access-tag d-access-tag--perm-role">{editing.roleDisplay || editing.role}</Tag>
              ) لا يمنح صلاحيات غسيل — فعّل أو ألغِ كل بند بالأسفل.
              {editing.role === 'admin' && (
                <>
                  {' '}
                  <strong>ملاحظة:</strong> حسابك مدير نظام ويملك وصولاً كاملاً بغض النظر عن هذه القائمة.
                </>
              )}
            </Text>

            <div>
              <Title level={5} style={{ marginBottom: 8 }}>
                مستشفيات وحدة الغسيل لهذا المستخدم
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                يظهر هنا فقط المستشفيات التي تملك صلاحية التعامل معها. المستخدم بدون مستشفى مرتبط لا يستطيع
                جلب البيانات.
              </Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {hospitals.map((h) => (
                  <Checkbox
                    key={h.id}
                    checked={editHospitalIds.has(h.id)}
                    onChange={(e) => toggleHospitalPick(h.id, e.target.checked)}
                  >
                    {h.name}
                  </Checkbox>
                ))}
              </Space>
              {editHospitalIds.size > 1 && (
                <div style={{ marginTop: 12 }}>
                  <Text strong>المستشفى الافتراضي عند فتح النظام:</Text>
                  <Radio.Group
                    style={{ display: 'block', marginTop: 8 }}
                    value={editPrimaryHospitalId ?? undefined}
                    onChange={(e) => setEditPrimaryHospitalId(e.target.value)}
                  >
                    {Array.from(editHospitalIds).map((id) => {
                      const name = hospitals.find((x) => x.id === id)?.name || `#${id}`;
                      return (
                        <Radio key={id} value={id}>
                          {name}
                        </Radio>
                      );
                    })}
                  </Radio.Group>
                </div>
              )}
            </div>

            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              الصلاحيات أدناه مرتبة حسب الصفحة أو الوحدة في النظام. فعّل ما يجب أن يمتلكه المستخدم؛ بدون
              التفعيل يُرفض الإجراء في الواجهة والخادم.
            </Text>

            {sortedPermSections.map(([cat, list]) => (
              <div key={cat}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  {dialysisSectionTitle(cat)}
                </Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {list
                    .slice()
                    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'))
                    .map((p) => {
                      const checked = selected.has(p.name);
                      const actionHint = (() => {
                        const tail = p.name.split(':').pop() || '';
                        const map: Record<string, string> = {
                          view: 'عرض',
                          manage: 'إدارة',
                          create: 'إنشاء',
                          edit: 'تعديل',
                          delete: 'حذف',
                          dispense: 'صرف',
                          inventory: 'مخزون',
                          entry: 'إدخال يومي',
                          bulk: 'إدخال جماعي',
                          reconciliation: 'مطابقة',
                          all_hospitals: 'كل المستشفيات',
                        };
                        return map[tail] ?? '';
                      })();
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            border: '1px solid #f0f0f3',
                            borderRadius: 8,
                            background: '#fff',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Checkbox checked={checked} onChange={() => toggle(p.name)}>
                              <strong>{p.displayName}</strong>
                            </Checkbox>
                            <div
                              style={{
                                marginInlineStart: 24,
                                color: '#6b7280',
                                fontSize: 12,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ fontFamily: 'monospace' }}>{p.name}</span>
                              {actionHint ? (
                                <span className="d-access-perm-hint">{actionHint}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </Space>
              </div>
            ))}
          </Space>
        )}
      </Modal>
    </>
  );
};

export default AccessPage;

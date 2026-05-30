import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Tag,
  Drawer,
  message,
  Typography,
  Space,
  Pagination,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ALL_MY_HOSPITALS, useDialysisContext, useEffectiveDialysisHospitalId } from '../dialysisContext';
import { useDialysisMobile } from '../useDialysisMobile';
import DialysisPullRefresh from '../DialysisPullRefresh';
import DialysisMobileFab from '../DialysisMobileFab';
import DialysisMobileSkeleton from '../DialysisMobileSkeleton';
import { usePermission } from '../../../../hooks/usePermission';
import DialysisPatientDetailModal from '../../DialysisPatientDetailModal';
import DialysisPatientIntakePanel from '../../DialysisPatientIntakePanel';
import { weekdayLabelAr } from '../../dialysisConstants';
import './patients-page.css';

const { Text } = Typography;

interface ScheduleRow {
  id: number;
  dayOfWeek: number;
  shiftSlot?: { id: number; name: string } | null;
  location?: { id: number; hallName: string; bedCode: string } | null;
}

interface Row {
  id: number;
  hospitalId?: number;
  hospital?: { id: number; name: string; code?: string | null } | null;
  fullName: string;
  kind: string;
  phone?: string | null;
  nationalId?: string | null;
  internalRecordNumber?: string | null;
  created_by_display?: string | null;
  dialysisStartDate?: string | null;
  sessionsPerWeek?: number | null;
  schedules?: ScheduleRow[];
}

function scheduleChipText(s: ScheduleRow): string {
  const day = weekdayLabelAr(s.dayOfWeek);
  const shift = s.shiftSlot?.name?.trim();
  const loc =
    s.location != null
      ? [s.location.hallName, s.location.bedCode].filter(Boolean).join(' ')
      : '';
  const parts = [day];
  if (shift) parts.push(shift);
  if (loc) parts.push(loc);
  return parts.join(' · ');
}

const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hospitalId } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;
  const isMobile = useDialysisMobile();
  const canCreate = usePermission('dialysis:patient:create');
  const canEdit = usePermission('dialysis:patient:edit');
  const canDelete = usePermission('dialysis:patient:delete');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailHospitalId, setDetailHospitalId] = useState<number | null>(null);
  const [cardPage, setCardPage] = useState(1);
  const cardPageSize = 8;

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const { data } = await axios.get<Row[]>('/api/dialysis/patients', {
        params: { hospital_id: hospitalId },
      });
      setRows(data);
    } catch {
      message.error('فشل جلب المرضى');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.fullName?.toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.nationalId || '').toLowerCase().includes(q) ||
        (r.internalRecordNumber || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const mobileSlice = useMemo(() => {
    const start = (cardPage - 1) * cardPageSize;
    return filtered.slice(start, start + cardPageSize);
  }, [filtered, cardPage, cardPageSize]);

  useEffect(() => {
    setCardPage(1);
  }, [search]);

  const pageBody = (
    <div className="d-patients-page">
      <div className="d-page-header d-patients-hero">
        <h2>المرضى</h2>
        <Text className="sub">
          قائمة مرضى وحدة الغسل مع عرض أيام الغسل والمواعيد.
        </Text>
      </div>

      <div className="d-card">
        <div className={`d-toolbar${isMobile ? ' d-toolbar--stack' : ''}`}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="بحث: الاسم، رقم الملف، الهاتف، الهوية"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="grow d-toolbar-input-grow"
          />
          {!isMobile && (
            <Button icon={<ReloadOutlined />} onClick={load}>
              تحديث
            </Button>
          )}
          {canCreate && !isMobile && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={mergedScope}
              title={
                mergedScope
                  ? 'لإضافة مريض جديد اختر مستشفى واحداً من القائمة'
                  : undefined
              }
              onClick={() => setDrawerOpen(true)}
            >
              مريض جديد
            </Button>
          )}
          {isMobile && (
            <Button icon={<ReloadOutlined />} onClick={load}>
              تحديث
            </Button>
          )}
        </div>
        {isMobile && loading ? (
          <DialysisMobileSkeleton rows={4} />
        ) : isMobile ? (
          <Spin spinning={loading}>
            <div className="d-patients-cards">
              {mobileSlice.map((r) => (
                <article key={r.id} className="d-patient-card">
                  <div className="d-patient-card-top">
                    <div className="d-patient-card-name">{r.fullName}</div>
                    <Tag color={r.kind === 'PERSISTENT' ? 'green' : 'orange'}>
                      {r.kind === 'PERSISTENT' ? 'دائم' : 'طوارئ'}
                    </Tag>
                  </div>
                  {mergedScope && r.hospital?.name ? (
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="geekblue">{r.hospital.name}</Tag>
                    </div>
                  ) : null}
                  <dl className="d-patient-card-meta">
                    <div>
                      <dt>رقم الملف</dt>
                      <dd>{r.internalRecordNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>الهاتف</dt>
                      <dd>{r.phone ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>الهوية</dt>
                      <dd>{r.nationalId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>جلسات/أسبوع</dt>
                      <dd>{r.sessionsPerWeek != null ? r.sessionsPerWeek : '—'}</dd>
                    </div>
                  </dl>
                  <div className="d-patient-card-schedule">
                    <div className="d-patient-card-schedule-title">أيام الغسل والموقع</div>
                    {r.schedules && r.schedules.length > 0 ? (
                      <div className="d-patient-card-schedule-tags">
                        {r.schedules.map((s) => (
                          <span key={s.id} className="d-patient-card-schedule-chip">
                            {scheduleChipText(s)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="d-patient-card-schedule-empty">
                        {r.kind === 'PERSISTENT'
                          ? 'لا يوجد جدول غسل أسبوعي مسجّل — أضف المواعيد من تعديل المريض.'
                          : 'مريض طوارئ — غالباً بدون جدول ثابت.'}
                      </span>
                    )}
                  </div>
                  <div className="d-patient-card-actions">
                    <Button
                      type="primary"
                      icon={<FileSearchOutlined />}
                      onClick={() =>
                        navigate(`/dialysis/patients/${r.id}`, {
                          state: { hospitalId: r.hospitalId ?? undefined },
                        })
                      }
                    >
                      السجل الطبي
                    </Button>
                    {canEdit && (
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => {
                          setDetailId(r.id);
                          setDetailHospitalId(r.hospitalId ?? null);
                          setDetailOpen(true);
                        }}
                      >
                        تعديل
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {filtered.length > cardPageSize ? (
              <div className="d-patients-pagination">
                <Pagination
                  current={cardPage}
                  pageSize={cardPageSize}
                  total={filtered.length}
                  onChange={setCardPage}
                  size="small"
                  showSizeChanger={false}
                />
              </div>
            ) : null}
          </Spin>
        ) : (
        <div className="d-table-scroll">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          columns={[
            { title: 'الاسم', dataIndex: 'fullName', key: 'name' },
            ...(mergedScope
              ? [
                  {
                    title: 'المستشفى',
                    key: 'hosp',
                    width: 200,
                    render: (_: unknown, r: Row) =>
                      r.hospital?.name ? (
                        <Tag color="geekblue">{r.hospital.name}</Tag>
                      ) : (
                        '—'
                      ),
                  },
                ]
              : []),
            {
              title: 'النوع',
              dataIndex: 'kind',
              key: 'kind',
              width: 100,
              render: (k: string) => (
                <Tag color={k === 'PERSISTENT' ? 'green' : 'orange'}>
                  {k === 'PERSISTENT' ? 'دائم' : 'طوارئ'}
                </Tag>
              ),
            },
            {
              title: 'أيام الغسل',
              key: 'schedules',
              width: 200,
              ellipsis: true,
              render: (_: unknown, r: Row) => {
                if (!r.schedules?.length) {
                  return <Text type="secondary">—</Text>;
                }
                const seen = new Set<number>();
                const labels: string[] = [];
                for (const s of r.schedules) {
                  if (seen.has(s.dayOfWeek)) continue;
                  seen.add(s.dayOfWeek);
                  labels.push(weekdayLabelAr(s.dayOfWeek));
                }
                return labels.join('، ');
              },
            },
            { title: 'الملف', dataIndex: 'internalRecordNumber', key: 'rec', width: 110 },
            { title: 'الهاتف', dataIndex: 'phone', key: 'phone', width: 130 },
            { title: 'الهوية', dataIndex: 'nationalId', key: 'nid', width: 140, responsive: ['md'] },
            { title: 'أنشئ بواسطة', dataIndex: 'created_by_display', key: 'cb', responsive: ['lg'] },
            {
              title: 'إجراءات',
              key: 'act',
              width: canEdit ? 200 : 120,
              fixed: 'right',
              render: (_, r) => (
                <Space size="small" wrap>
                  <Button
                    type="link"
                    size="small"
                    icon={<FileSearchOutlined />}
                    onClick={() =>
                      navigate(`/dialysis/patients/${r.id}`, {
                        state: { hospitalId: r.hospitalId ?? undefined },
                      })
                    }
                  >
                    السجل الطبي
                  </Button>
                  {canEdit && (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setDetailId(r.id);
                        setDetailHospitalId(r.hospitalId ?? null);
                        setDetailOpen(true);
                      }}
                    >
                      تعديل
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
        </div>
        )}
      </div>

      {canCreate && (
        <Drawer
          title="إضافة مريض غسيل جديد"
          placement={isMobile ? 'bottom' : 'right'}
          height={isMobile ? '92%' : undefined}
          width={isMobile ? undefined : 560}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <DialysisPatientIntakePanel
            variant="plain"
            hospitalId={
              typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId ?? 0
            }
            canCreate={canCreate}
            onPatientCreated={() => {
              setDrawerOpen(false);
              load();
            }}
          />
        </Drawer>
      )}

      <DialysisPatientDetailModal
        open={detailOpen}
        patientId={detailId}
        hospitalId={
          detailHospitalId ??
          (typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId)
        }
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => {
          setDetailOpen(false);
          setDetailId(null);
          setDetailHospitalId(null);
        }}
        onSaved={() => load()}
      />
    </div>
  );

  if (isMobile) {
    const fab = canCreate ? (
      <DialysisMobileFab
        icon={<PlusOutlined />}
        label="مريض"
        ariaLabel="إضافة مريض جديد"
        visible
        onClick={() => {
          if (mergedScope) {
            message.warning('اختر مستشفى واحداً من القائمة (☰) أو من حسابك قبل إضافة مريض');
            return;
          }
          setDrawerOpen(true);
        }}
      />
    ) : null;

    return (
      <>
        <DialysisPullRefresh onRefresh={load} disabled={hospitalId == null}>
          {pageBody}
        </DialysisPullRefresh>
        {fab}
      </>
    );
  }

  return pageBody;
};

export default PatientsPage;

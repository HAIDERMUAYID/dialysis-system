import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Tag,
  Drawer,
  message,
  Typography,
  Space,
  Spin,
  Select,
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  EditOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilterOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ALL_MY_HOSPITALS, useDialysisContext, useEffectiveDialysisHospitalId } from '../dialysisContext';
import {
  buildPatientListFilters,
  useDialysisFaceStats,
  useDialysisPatients,
  useInvalidateDialysisPatients,
  type DialysisPatientRow,
} from '../hooks';
import { useDialysisMobile } from '../useDialysisMobile';
import DialysisPullRefresh from '../DialysisPullRefresh';
import DialysisMobileFab from '../DialysisMobileFab';
import DialysisMobileSkeleton from '../DialysisMobileSkeleton';
import { useDialysisOverlayLock } from '../useDialysisOverlayLock';
import { usePermission } from '../../../../hooks/usePermission';
import DialysisPatientDetailModal from '../../DialysisPatientDetailModal';
import DialysisPatientIntakePanel from '../../DialysisPatientIntakePanel';
import { weekdayLabelAr } from '../../dialysisConstants';
import DialysisFaceStatusBanner from '../DialysisFaceStatusBanner';
import DialysisMergedScopeBanner from '../DialysisMergedScopeBanner';
import DialysisPageHeader from '../DialysisPageHeader';
import { useDialysisPersistedState } from '../useDialysisPersistedState';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import './patients-page.css';

const { Text } = Typography;

interface ScheduleRow {
  id: number;
  dayOfWeek: number;
  shiftSlot?: { id: number; name: string } | null;
  location?: { id: number; hallName: string; bedCode: string } | null;
}

interface Row extends DialysisPatientRow {}

type FaceFilter = 'all' | 'yes' | 'no' | 'needs_reenroll';
type SessionsFilter = 'all' | 'none' | 'has';
type LastSessionFilter = 'all' | 'none' | '7d' | '30d' | '90d' | 'older30d';

interface PatientFiltersPersist {
  faceFilter: FaceFilter;
  sessionsFilter: SessionsFilter;
  lastSessionFilter: LastSessionFilter;
  search: string;
}

const DEFAULT_PATIENT_FILTERS: PatientFiltersPersist = {
  faceFilter: 'all',
  sessionsFilter: 'all',
  lastSessionFilter: 'all',
  search: '',
};

function formatSessionDate(value?: string | null): string {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD') : '—';
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

const DESKTOP_PAGE_SIZE = 12;
const MOBILE_PAGE_SIZE = 8;

const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hospitalId } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;
  const isMobile = useDialysisMobile();
  const canCreate = usePermission('dialysis:patient:create');
  const canEdit = usePermission('dialysis:patient:edit');
  const canDelete = usePermission('dialysis:patient:delete');

  const invalidatePatients = useInvalidateDialysisPatients();
  const [filters, setFilters] = useDialysisPersistedState<PatientFiltersPersist>(
    'd-patients-filters',
    DEFAULT_PATIENT_FILTERS,
    hospitalId
  );
  const { faceFilter, sessionsFilter, lastSessionFilter, search } = filters;
  const setFaceFilter = (v: FaceFilter) => setFilters((f) => ({ ...f, faceFilter: v }));
  const setSessionsFilter = (v: SessionsFilter) => setFilters((f) => ({ ...f, sessionsFilter: v }));
  const setLastSessionFilter = (v: LastSessionFilter) =>
    setFilters((f) => ({ ...f, lastSessionFilter: v }));
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput, 320);
  const [desktopPage, setDesktopPage] = useState(1);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailHospitalId, setDetailHospitalId] = useState<number | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(false);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch }));
  }, [debouncedSearch, setFilters]);

  useEffect(() => {
    setDesktopPage(1);
  }, [hospitalId, debouncedSearch, faceFilter, sessionsFilter, lastSessionFilter]);

  const listFilters = useMemo(
    () =>
      buildPatientListFilters({
        search: debouncedSearch,
        faceFilter,
        sessionsFilter,
        lastSessionFilter,
      }),
    [debouncedSearch, faceFilter, sessionsFilter, lastSessionFilter]
  );

  const {
    rows,
    total,
    loading,
    loadingMore,
    refetch: reloadList,
    fetchNextPage,
  } = useDialysisPatients({
    hospitalId,
    filters: listFilters,
    isMobile,
    desktopPage,
    desktopPageSize: DESKTOP_PAGE_SIZE,
    mobilePageSize: MOBILE_PAGE_SIZE,
  });

  const faceStats = useDialysisFaceStats(hospitalId, total);

  useEffect(() => {
    if (!isMobile) return undefined;
    const node = loadMoreRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { rootMargin: '160px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobile, fetchNextPage, rows.length]);

  const refreshPatients = async () => {
    await invalidatePatients();
    await reloadList();
  };

  useDialysisOverlayLock(isMobile && (drawerOpen || detailOpen));

  const hasActiveFilters =
    faceFilter !== 'all' || sessionsFilter !== 'all' || lastSessionFilter !== 'all';

  const clearFilters = () => {
    setSearchInput('');
    setFilters((f) => ({
      ...f,
      search: '',
      faceFilter: 'all',
      sessionsFilter: 'all',
      lastSessionFilter: 'all',
    }));
  };

  const activeFilterCount = [
    faceFilter !== 'all',
    sessionsFilter !== 'all',
    lastSessionFilter !== 'all',
  ].filter(Boolean).length;

  const filterControls = (
    <>
      <Select
        value={faceFilter}
        onChange={setFaceFilter}
        className="d-patients-filter-select"
        aria-label="تصفية حسب حالة بصمة الوجه"
        options={[
          { value: 'all', label: 'بصمة الوجه: الكل' },
          { value: 'yes', label: 'مسجّلة (حديثة)' },
          { value: 'no', label: 'غير مسجّلة' },
          { value: 'needs_reenroll', label: 'يحتاج تحديث بصمة' },
        ]}
      />
      <Select
        value={sessionsFilter}
        onChange={setSessionsFilter}
        className="d-patients-filter-select"
        aria-label="تصفية حسب عدد الجلسات"
        options={[
          { value: 'all', label: 'عدد الجلسات: الكل' },
          { value: 'has', label: 'لديه جلسات' },
          { value: 'none', label: 'بدون جلسات' },
        ]}
      />
      <Select
        value={lastSessionFilter}
        onChange={setLastSessionFilter}
        className="d-patients-filter-select"
        aria-label="تصفية حسب آخر جلسة مسجّلة"
        options={[
          { value: 'all', label: 'آخر جلسة: الكل' },
          { value: '7d', label: 'خلال 7 أيام' },
          { value: '30d', label: 'خلال 30 يوماً' },
          { value: '90d', label: 'خلال 90 يوماً' },
          { value: 'older30d', label: 'أقدم من 30 يوماً' },
          { value: 'none', label: 'بدون جلسة مسجّلة' },
        ]}
      />
      {hasActiveFilters ? (
        <Button type="link" size="small" onClick={clearFilters}>
          مسح الفلاتر
        </Button>
      ) : null}
    </>
  );

  const pageBody = (
    <div className="d-patients-page">
      <DialysisPageHeader
        title="المرضى"
        subtitle="قائمة مرضى وحدة الغسل مع عرض أيام الغسل والمواعيد."
        className="d-patients-hero"
      />

      <DialysisMergedScopeBanner className="d-patients-merged-banner" />

      <DialysisFaceStatusBanner
        patientsWithoutFace={faceStats.withoutFace}
        patientsNeedsReenroll={faceStats.needsReenroll}
        totalPatients={faceStats.totalPatients || total}
        className="d-patients-face-banner"
      />

      <div className="d-card">
        <div className={`d-toolbar${isMobile ? ' d-toolbar--stack' : ''}`}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="بحث: الاسم، رقم الملف، الهاتف، الهوية"
            aria-label="بحث عن مريض بالاسم أو رقم الملف أو الهاتف"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="grow d-toolbar-input-grow"
          />
          {!isMobile && (
            <Button icon={<ReloadOutlined />} onClick={() => void refreshPatients()}>
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
            <Button icon={<ReloadOutlined />} onClick={() => void refreshPatients()}>
              تحديث
            </Button>
          )}
        </div>
        {isMobile ? (
          <Collapse
            ghost
            className="d-patients-filters-collapse"
            aria-label="فلاتر متقدمة لقائمة المرضى"
            items={[
              {
                key: 'filters',
                label: (
                  <span className="d-patients-filters-collapse__label">
                    <FilterOutlined />
                    فلاتر متقدمة
                    {activeFilterCount > 0 ? (
                      <Tag color="processing" className="d-patients-filters-collapse__count">
                        {activeFilterCount}
                      </Tag>
                    ) : null}
                    <Tag className="d-patients-filters-collapse__results">{total} نتيجة</Tag>
                  </span>
                ),
                children: (
                  <div className="d-patients-filters d-patients-filters--stack">{filterControls}</div>
                ),
              },
            ]}
          />
        ) : (
          <div className="d-patients-filters">
            {filterControls}
            <Tag color="blue" className="d-patients-results-chip">
              {total} نتيجة
            </Tag>
          </div>
        )}
        {isMobile && loading ? (
          <DialysisMobileSkeleton rows={4} />
        ) : isMobile ? (
          <Spin spinning={loading}>
            <div className="d-patients-cards">
              {rows.map((r) => (
                <article
                  key={r.id}
                  className={`d-patient-card${
                    r.hasFaceEnrolled
                      ? r.needsFaceReenroll
                        ? ' d-patient-card--face-outdated'
                        : ''
                      : ' d-patient-card--no-face'
                  }`}
                >
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
                    <div>
                      <dt>بصمة الوجه</dt>
                      <dd>
                        {r.hasFaceEnrolled ? (
                          r.needsFaceReenroll ? (
                            <Tag color="warning" icon={<CloseCircleOutlined />}>
                              يحتاج تحديث
                            </Tag>
                          ) : (
                            <Tag color="success" icon={<CheckCircleOutlined />}>
                              مسجّلة ✓
                            </Tag>
                          )
                        ) : (
                          <Tag icon={<CloseCircleOutlined />}>غير مسجّلة</Tag>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>عدد الجلسات</dt>
                      <dd>{r.sessionTotal ?? 0}</dd>
                    </div>
                    <div>
                      <dt>آخر جلسة</dt>
                      <dd>{formatSessionDate(r.lastSessionDate)}</dd>
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
            {rows.length < total ? (
              <div ref={loadMoreRef} className="d-patients-load-more" aria-hidden={!loadingMore}>
                {loadingMore ? <Spin size="small" /> : null}
              </div>
            ) : null}
          </Spin>
        ) : (
        <div className="d-table-scroll">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: desktopPage,
            pageSize: DESKTOP_PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: (page) => setDesktopPage(page),
          }}
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
            {
              title: 'بصمة الوجه',
              key: 'face',
              width: 120,
              render: (_: unknown, r: Row) =>
                r.hasFaceEnrolled ? (
                  r.needsFaceReenroll ? (
                    <Tag color="warning" icon={<CameraOutlined />}>
                      يحتاج تحديث
                    </Tag>
                  ) : (
                    <Tag color="success" icon={<CameraOutlined />}>
                      مسجّلة ✓
                    </Tag>
                  )
                ) : (
                  <Tag color="default" className="d-tag-muted">
                    غير مسجّلة
                  </Tag>
                ),
            },
            {
              title: 'عدد الجلسات',
              dataIndex: 'sessionTotal',
              key: 'sessionTotal',
              width: 110,
              sorter: (a: Row, b: Row) => (a.sessionTotal ?? 0) - (b.sessionTotal ?? 0),
              render: (n: number | undefined) => (
                <Text strong={Boolean(n)}>{n ?? 0}</Text>
              ),
            },
            {
              title: 'آخر جلسة',
              dataIndex: 'lastSessionDate',
              key: 'lastSessionDate',
              width: 120,
              sorter: (a: Row, b: Row) => {
                const ta = a.lastSessionDate ? dayjs(a.lastSessionDate).valueOf() : 0;
                const tb = b.lastSessionDate ? dayjs(b.lastSessionDate).valueOf() : 0;
                return ta - tb;
              },
              render: (v: string | null | undefined) => formatSessionDate(v),
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
          className={`d-patient-create-drawer${isMobile ? ' d-patient-create-drawer--mobile' : ''}`}
          title="إضافة مريض غسيل جديد"
          placement={isMobile ? 'bottom' : 'right'}
          height={isMobile ? '94%' : undefined}
          width={isMobile ? undefined : 560}
          zIndex={isMobile ? 1310 : 1000}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          destroyOnClose
          maskClosable={!isMobile}
          footer={
            <div className="d-patient-create-drawer__footer">
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                form="d-patient-intake-form"
                loading={intakeLoading}
              >
                حفظ المريض
              </Button>
              <Button size="large" onClick={() => setDrawerOpen(false)} disabled={intakeLoading}>
                إلغاء
              </Button>
            </div>
          }
        >
          <DialysisPatientIntakePanel
            variant="plain"
            hideInlineSubmit
            onLoadingChange={setIntakeLoading}
            hospitalId={
              typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId ?? 0
            }
            canCreate={canCreate}
              onPatientCreated={() => {
              setDrawerOpen(false);
              void refreshPatients();
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
        onSaved={() => void refreshPatients()}
      />
    </div>
  );

  if (isMobile) {
    const fab = canCreate ? (
      <DialysisMobileFab
        icon={<PlusOutlined />}
        label="مريض"
        ariaLabel="إضافة مريض جديد"
        visible={!drawerOpen && !detailOpen}
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
        <DialysisPullRefresh onRefresh={refreshPatients} disabled={hospitalId == null || drawerOpen || detailOpen}>
          {pageBody}
        </DialysisPullRefresh>
        {fab}
      </>
    );
  }

  return pageBody;
};

export default PatientsPage;

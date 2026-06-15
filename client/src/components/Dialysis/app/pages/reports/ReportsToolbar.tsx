import React from 'react';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilterOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Badge, Button, DatePicker, Drawer } from 'antd';
import type { Dayjs } from 'dayjs';
import ReportsFilters from './ReportsFilters';
import type { PatientLookupRow, ReportReconFilter } from './reportsPageTypes';

export interface ReportsToolbarProps {
  isMobile: boolean;
  reportDateFrom: Dayjs;
  setReportDateFrom: (d: Dayjs) => void;
  reportDateTo: Dayjs;
  setReportDateTo: (d: Dayjs) => void;
  filterHall: string;
  setFilterHall: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterShift: string;
  setFilterShift: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterRecon: ReportReconFilter;
  setFilterRecon: (v: ReportReconFilter) => void;
  filterPatientMatch: string;
  setFilterPatientMatch: (v: string) => void;
  filterPatientId: number | undefined;
  setFilterPatientId: (v: number | undefined) => void;
  hallOptions: string[];
  reportPatientOptions: PatientLookupRow[];
  reportLoading: boolean;
  loadReportData: () => void | Promise<void>;
  resetReportFilters: () => void;
  activeExtraFilterCount: number;
  filtersDrawerOpen: boolean;
  setFiltersDrawerOpen: (open: boolean) => void;
  exportReportExcel: () => void | Promise<void>;
  downloadReportPdf: () => void | Promise<void>;
  printReport: (openPrintDialog?: boolean) => void | Promise<void>;
  pdfLoading: boolean;
}

const ReportsToolbar: React.FC<ReportsToolbarProps> = ({
  isMobile,
  reportDateFrom,
  setReportDateFrom,
  reportDateTo,
  setReportDateTo,
  filterHall,
  setFilterHall,
  filterType,
  setFilterType,
  filterShift,
  setFilterShift,
  filterStatus,
  setFilterStatus,
  filterRecon,
  setFilterRecon,
  filterPatientMatch,
  setFilterPatientMatch,
  filterPatientId,
  setFilterPatientId,
  hallOptions,
  reportPatientOptions,
  reportLoading,
  loadReportData,
  resetReportFilters,
  activeExtraFilterCount,
  filtersDrawerOpen,
  setFiltersDrawerOpen,
  exportReportExcel,
  downloadReportPdf,
  printReport,
  pdfLoading,
}) => {
  const filtersEl = (
    <ReportsFilters
      filterHall={filterHall}
      setFilterHall={setFilterHall}
      filterType={filterType}
      setFilterType={setFilterType}
      filterShift={filterShift}
      setFilterShift={setFilterShift}
      filterStatus={filterStatus}
      setFilterStatus={setFilterStatus}
      filterRecon={filterRecon}
      setFilterRecon={setFilterRecon}
      filterPatientMatch={filterPatientMatch}
      setFilterPatientMatch={setFilterPatientMatch}
      filterPatientId={filterPatientId}
      setFilterPatientId={setFilterPatientId}
      hallOptions={hallOptions}
      reportPatientOptions={reportPatientOptions}
    />
  );

  const exportButtons = (
    <>
      <Button icon={<FileExcelOutlined />} onClick={exportReportExcel}>
        Excel
      </Button>
      <Button icon={<DownloadOutlined />} onClick={downloadReportPdf} loading={pdfLoading}>
        PDF
      </Button>
      <Button
        type={isMobile ? 'primary' : 'default'}
        ghost={isMobile}
        icon={<PrinterOutlined />}
        onClick={() => printReport()}
      >
        طباعة
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div className="d-report-mobile-sticky">
          <div className="d-report-mobile-dates">
            <DatePicker
              value={reportDateFrom}
              onChange={(d) => d && setReportDateFrom(d.startOf('day'))}
              format="YYYY-MM-DD"
              placeholder="من تاريخ"
            />
            <DatePicker
              value={reportDateTo}
              onChange={(d) => d && setReportDateTo(d.endOf('day'))}
              format="YYYY-MM-DD"
              placeholder="إلى تاريخ"
            />
          </div>
          <div className="d-report-mobile-actions">
            <Button
              type="primary"
              icon={<FilterOutlined />}
              onClick={() => setFiltersDrawerOpen(true)}
            >
              فلاتر
              {activeExtraFilterCount > 0 ? (
                <Badge count={activeExtraFilterCount} style={{ marginInlineStart: 6 }} />
              ) : null}
            </Button>
            <Button icon={<ReloadOutlined />} loading={reportLoading} onClick={loadReportData}>
              تحديث
            </Button>
            <div className="d-report-mobile-actions__wide">
              {exportButtons}
              <Button onClick={resetReportFilters}>مسح</Button>
            </div>
          </div>
        </div>
        <Drawer
          title="فلاتر التقرير"
          placement="bottom"
          height="85%"
          open={filtersDrawerOpen}
          onClose={() => setFiltersDrawerOpen(false)}
          className="d-report-filters-drawer"
          destroyOnHidden={false}
        >
          {filtersEl}
          <div className="d-report-filters-drawer__actions">
            <Button
              type="primary"
              onClick={() => {
                setFiltersDrawerOpen(false);
                loadReportData();
              }}
            >
              تطبيق
            </Button>
            <Button
              onClick={() => {
                resetReportFilters();
                setFiltersDrawerOpen(false);
              }}
            >
              مسح الكل
            </Button>
          </div>
        </Drawer>
      </>
    );
  }

  return (
    <div className="d-toolbar">
      <DatePicker
        value={reportDateFrom}
        onChange={(d) => d && setReportDateFrom(d.startOf('day'))}
        format="YYYY-MM-DD"
        placeholder="من تاريخ"
      />
      <DatePicker
        value={reportDateTo}
        onChange={(d) => d && setReportDateTo(d.endOf('day'))}
        format="YYYY-MM-DD"
        placeholder="إلى تاريخ"
      />
      {filtersEl}
      <Button onClick={resetReportFilters}>مسح الفلاتر</Button>
      <Button icon={<ReloadOutlined />} loading={reportLoading} onClick={loadReportData}>
        تحديث
      </Button>
      <span className="grow" />
      {exportButtons}
    </div>
  );
};

export default ReportsToolbar;

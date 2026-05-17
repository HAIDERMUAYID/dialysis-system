import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin } from 'antd';
import {
  TeamOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  hospitalId: number | null;
  onNavigate?: (tab: string) => void;
}

/** لوحة قيادة مصغّرة لعرض حجم النشاط في وحدة الغسل */
const DialysisOverviewPanel: React.FC<Props> = ({ hospitalId }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    patients: 0,
    locations: 0,
    shiftSlots: 0,
    machines: 0,
    activeSessions: 0,
    todaySessions: 0,
  });

  const load = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const [patients, locs, slots, machines, active, sessionsToday] = await Promise.all([
        axios.get('/api/dialysis/patients', { params: { hospital_id: hospitalId } }),
        axios.get('/api/dialysis/locations', { params: { hospital_id: hospitalId } }),
        axios.get('/api/dialysis/shift-slots', { params: { hospital_id: hospitalId } }),
        axios.get('/api/dialysis/machines', { params: { hospital_id: hospitalId } }),
        axios.get('/api/dialysis/sessions/active', { params: { hospital_id: hospitalId } }),
        axios.get('/api/dialysis/sessions', { params: { hospital_id: hospitalId, date: today } }),
      ]);
      setStats({
        patients: Array.isArray(patients.data) ? patients.data.length : 0,
        locations: Array.isArray(locs.data) ? locs.data.length : 0,
        shiftSlots: Array.isArray(slots.data) ? slots.data.length : 0,
        machines: Array.isArray(machines.data) ? machines.data.length : 0,
        activeSessions: Array.isArray(active.data) ? active.data.length : 0,
        todaySessions: Array.isArray(sessionsToday.data) ? sessionsToday.data.length : 0,
      });
    } catch {
      setStats({
        patients: 0,
        locations: 0,
        shiftSlots: 0,
        machines: 0,
        activeSessions: 0,
        todaySessions: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hospitalId) {
    return (
      <Card>
        <Text type="secondary">اختر المستشفى لعرض مؤشرات الوحدة.</Text>
      </Card>
    );
  }

  return (
    <Spin spinning={loading}>
      <Card title="نظرة عامة — وحدة الغسل الكلوي (D-IRS)" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          مؤشرات سريعة: مرضى مسجّلون، أسرة/أجهزة، جلسات اليوم والجلسات النشطة.
        </Text>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card size="small">
              <Statistic title="مرضى الغسل المسجّلون" value={stats.patients} prefix={<TeamOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small">
              <Statistic title="مواقع أسرة (قاعات)" value={stats.locations} prefix={<ApartmentOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small">
              <Statistic title="شفتات معرّفة" value={stats.shiftSlots} prefix={<ClockCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small">
              <Statistic title="أجهزة غسل" value={stats.machines} prefix={<ThunderboltOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small">
              <Statistic title="جلسات نشطة الآن" value={stats.activeSessions} prefix={<ThunderboltOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small">
              <Statistic title={`جلسات اليوم (${dayjs().format('YYYY-MM-DD')})`} value={stats.todaySessions} prefix={<CalendarOutlined />} />
            </Card>
          </Col>
        </Row>
      </Card>
    </Spin>
  );
};

export default DialysisOverviewPanel;

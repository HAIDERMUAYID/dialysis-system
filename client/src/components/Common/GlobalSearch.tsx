import React, { useState, useEffect } from 'react';
import { Input, Card, Tabs, List, Tag, Empty, Spin, Typography, Space, Button } from 'antd';
import { SearchOutlined, UserOutlined, FileTextOutlined, ExperimentOutlined, ShoppingOutlined, MedicineBoxOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import './GlobalSearch.css';

const { TabPane } = Tabs;
const { Text, Title } = Typography;

interface SearchResult {
  id: number;
  type: string;
  [key: string]: any;
}

interface SearchResults {
  patients: SearchResult[];
  visits: SearchResult[];
  users: SearchResult[];
  lab_results: SearchResult[];
  prescriptions: SearchResult[];
  diagnoses: SearchResult[];
}

const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (query.length >= 2) {
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 500); // Debounce

      return () => clearTimeout(timeoutId);
    } else {
      setResults(null);
    }
  }, [query]);

  const performSearch = async () => {
    if (query.length < 2) return;

    setLoading(true);
    try {
      const response = await axios.get('/api/search/global', {
        params: { q: query, limit: 20 }
      });
      setResults(response.data.results);
    } catch (error: any) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'patient': return <UserOutlined style={{ color: '#1890ff' }} />;
      case 'visit': return <FileTextOutlined style={{ color: '#52c41a' }} />;
      case 'user': return <UserOutlined style={{ color: '#722ed1' }} />;
      case 'lab_result': return <ExperimentOutlined style={{ color: '#fa8c16' }} />;
      case 'prescription': return <ShoppingOutlined style={{ color: '#13c2c2' }} />;
      case 'diagnosis': return <MedicineBoxOutlined style={{ color: '#eb2f96' }} />;
      default: return <FileTextOutlined />;
    }
  };

  const renderPatientItem = (item: SearchResult) => (
    <List.Item>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {getIcon('patient')}
          <Text strong>{item.name}</Text>
          <Tag color="blue">مريض</Tag>
        </Space>
        <Space split>
          {item.national_id && <Text type="secondary">هوية: {item.national_id}</Text>}
          {item.phone && <Text type="secondary">هاتف: {item.phone}</Text>}
          {item.age && <Text type="secondary">عمر: {item.age}</Text>}
        </Space>
      </Space>
    </List.Item>
  );

  const renderVisitItem = (item: SearchResult) => (
    <List.Item>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {getIcon('visit')}
          <Text strong>{item.visit_number}</Text>
          <Tag color={item.status === 'completed' ? 'green' : 'orange'}>
            {item.status === 'completed' ? 'مكتملة' : 'قيد المعالجة'}
          </Tag>
        </Space>
        <Text type="secondary">مريض: {item.patient_name || 'غير محدد'}</Text>
        {item.created_at && (
          <Text type="secondary">
            <ClockCircleOutlined /> {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
          </Text>
        )}
      </Space>
    </List.Item>
  );

  const renderUserItem = (item: SearchResult) => (
    <List.Item>
      <Space>
        {getIcon('user')}
        <Text strong>{item.name || item.username}</Text>
        <Tag color="purple">{item.role}</Tag>
        {item.email && <Text type="secondary">{item.email}</Text>}
      </Space>
    </List.Item>
  );

  const renderLabResultItem = (item: SearchResult) => (
    <List.Item>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {getIcon('lab_result')}
          <Text strong>{item.test_name}</Text>
          <Tag color="orange">تحليل</Tag>
        </Space>
        <Text>النتيجة: {item.result}</Text>
        {item.patient_name && <Text type="secondary">مريض: {item.patient_name}</Text>}
      </Space>
    </List.Item>
  );

  const renderPrescriptionItem = (item: SearchResult) => (
    <List.Item>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {getIcon('prescription')}
          <Text strong>{item.medication_name}</Text>
          <Tag color="cyan">دواء</Tag>
        </Space>
        {item.dosage && <Text>الجرعة: {item.dosage}</Text>}
        {item.patient_name && <Text type="secondary">مريض: {item.patient_name}</Text>}
      </Space>
    </List.Item>
  );

  const renderDiagnosisItem = (item: SearchResult) => (
    <List.Item>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {getIcon('diagnosis')}
          <Text strong>{item.diagnosis}</Text>
          <Tag color="magenta">تشخيص</Tag>
        </Space>
        {item.doctor_name && <Text type="secondary">طبيب: {item.doctor_name}</Text>}
        {item.patient_name && <Text type="secondary">مريض: {item.patient_name}</Text>}
      </Space>
    </List.Item>
  );

  const totalResults = results ? Object.values(results).reduce((sum, arr) => sum + arr.length, 0) : 0;

  return (
    <Card className="global-search-card" style={{ marginBottom: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Input
          size="large"
          placeholder="ابحث في النظام (مرضى، زيارات، تحاليل، أدوية، تشخيصات...)"
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
        />

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" tip="جاري البحث..." />
          </div>
        )}

        {!loading && query.length >= 2 && results && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5} style={{ margin: 0 }}>
                نتائج البحث: {totalResults} نتيجة
              </Title>
            </div>

            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <TabPane tab={`الكل (${totalResults})`} key="all">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {results.patients.length > 0 && (
                    <Card size="small" title={<Space><UserOutlined /> المرضى ({results.patients.length})</Space>}>
                      <List
                        dataSource={results.patients}
                        renderItem={renderPatientItem}
                        locale={{ emptyText: 'لا توجد نتائج' }}
                      />
                    </Card>
                  )}
                  {results.visits.length > 0 && (
                    <Card size="small" title={<Space><FileTextOutlined /> الزيارات ({results.visits.length})</Space>}>
                      <List
                        dataSource={results.visits}
                        renderItem={renderVisitItem}
                        locale={{ emptyText: 'لا توجد نتائج' }}
                      />
                    </Card>
                  )}
                  {results.lab_results.length > 0 && (
                    <Card size="small" title={<Space><ExperimentOutlined /> التحاليل ({results.lab_results.length})</Space>}>
                      <List
                        dataSource={results.lab_results}
                        renderItem={renderLabResultItem}
                        locale={{ emptyText: 'لا توجد نتائج' }}
                      />
                    </Card>
                  )}
                  {results.prescriptions.length > 0 && (
                    <Card size="small" title={<Space><ShoppingOutlined /> الأدوية ({results.prescriptions.length})</Space>}>
                      <List
                        dataSource={results.prescriptions}
                        renderItem={renderPrescriptionItem}
                        locale={{ emptyText: 'لا توجد نتائج' }}
                      />
                    </Card>
                  )}
                  {results.diagnoses.length > 0 && (
                    <Card size="small" title={<Space><MedicineBoxOutlined /> التشخيصات ({results.diagnoses.length})</Space>}>
                      <List
                        dataSource={results.diagnoses}
                        renderItem={renderDiagnosisItem}
                        locale={{ emptyText: 'لا توجد نتائج' }}
                      />
                    </Card>
                  )}
                  {totalResults === 0 && (
                    <Empty description="لا توجد نتائج للبحث" />
                  )}
                </Space>
              </TabPane>

              <TabPane tab={`المرضى (${results.patients.length})`} key="patients">
                <List
                  dataSource={results.patients}
                  renderItem={renderPatientItem}
                  locale={{ emptyText: 'لا توجد نتائج' }}
                />
              </TabPane>

              <TabPane tab={`الزيارات (${results.visits.length})`} key="visits">
                <List
                  dataSource={results.visits}
                  renderItem={renderVisitItem}
                  locale={{ emptyText: 'لا توجد نتائج' }}
                />
              </TabPane>

              <TabPane tab={`التحاليل (${results.lab_results.length})`} key="lab_results">
                <List
                  dataSource={results.lab_results}
                  renderItem={renderLabResultItem}
                  locale={{ emptyText: 'لا توجد نتائج' }}
                />
              </TabPane>

              <TabPane tab={`الأدوية (${results.prescriptions.length})`} key="prescriptions">
                <List
                  dataSource={results.prescriptions}
                  renderItem={renderPrescriptionItem}
                  locale={{ emptyText: 'لا توجد نتائج' }}
                />
              </TabPane>

              <TabPane tab={`التشخيصات (${results.diagnoses.length})`} key="diagnoses">
                <List
                  dataSource={results.diagnoses}
                  renderItem={renderDiagnosisItem}
                  locale={{ emptyText: 'لا توجد نتائج' }}
                />
              </TabPane>
            </Tabs>
          </>
        )}

        {!loading && query.length >= 2 && !results && (
          <Empty description="ابدأ بالكتابة للبحث..." />
        )}
      </Space>
    </Card>
  );
};

export default GlobalSearch;

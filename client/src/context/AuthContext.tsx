import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  role: string;
  name: string;
  /** أسماء الصلاحيات من جدول permissions (مثل dialysis:view) */
  permissions?: string[];
  /** نطاق مستشفيات وحدة الغسيل (من الخادم بعد تسجيل الدخول و /me) */
  dialysisHospitalIds?: number[];
  dialysisCanSeeAllHospitals?: boolean;
  dialysisPrimaryHospitalId?: number | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      if (token && userStr) {
        try {
          const userData = JSON.parse(userStr) as User;
          if (!cancelled) {
            setUser(userData);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }

          try {
            const { data } = await axios.get<{
              id: number;
              username: string;
              role: string;
              name: string;
              permissions: string[];
              dialysisHospitalIds?: number[];
              dialysisCanSeeAllHospitals?: boolean;
              dialysisPrimaryHospitalId?: number | null;
            }>('/api/auth/me');
            const merged: User = {
              ...userData,
              id: data.id,
              username: data.username,
              role: data.role,
              name: data.name,
              permissions: data.permissions ?? [],
              dialysisHospitalIds: data.dialysisHospitalIds,
              dialysisCanSeeAllHospitals: data.dialysisCanSeeAllHospitals,
              dialysisPrimaryHospitalId: data.dialysisPrimaryHospitalId,
            };
            if (!cancelled) {
              localStorage.setItem('user', JSON.stringify(merged));
              setUser(merged);
            }
          } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              delete axios.defaults.headers.common['Authorization'];
              if (!cancelled) setUser(null);
            }
          }
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log('Attempting to login with username:', username);
      console.log('API Base URL:', axios.defaults.baseURL);

      const response = await axios.post('/api/auth/login', { username, password });
      console.log('Login response:', response.status);
      const { token, user: nextUser } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(nextUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(nextUser as User);
      return nextUser as User;
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error config:', error.config);

      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('ERR_NETWORK')) {
        const apiUrl = axios.defaults.baseURL || 'غير محدد';
        throw new Error(`لا يمكن الاتصال بالخادم (${apiUrl}). تأكد من أن الخادم يعمل بشكل صحيح وأن REACT_APP_API_URL مضبوط بشكل صحيح في Render.`);
      }

      if (error.message?.includes('CORS') || error.code === 'ERR_CORS') {
        throw new Error('خطأ في CORS. تأكد من أن CLIENT_URL مضبوط بشكل صحيح في Backend على Render.');
      }

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('انتهت مهلة الاتصال. الخادم قد يكون نائماً (Free Plan). انتظر 30-60 ثانية وحاول مرة أخرى.');
      }

      if (error.response) {
        const status = error.response.status;
        const errorMessage = error.response.data?.error || error.response.statusText || 'فشل تسجيل الدخول';

        if (status === 403) {
          throw new Error('تم رفض الطلب. تأكد من أن الخادم يعمل بشكل صحيح وقاعدة البيانات مهيأة');
        } else if (status === 401) {
          throw new Error(errorMessage || 'اسم المستخدم أو كلمة المرور غير صحيحة');
        } else if (status === 500) {
          throw new Error(errorMessage || 'خطأ في الخادم. تحقق من سجلات الخادم في Render');
        } else if (status === 404) {
          throw new Error('نقطة النهاية غير موجودة. تأكد من أن Backend يعمل على: ' + (axios.defaults.baseURL || 'غير محدد'));
        } else {
          throw new Error(`${errorMessage} (Status: ${status})`);
        }
      }

      throw new Error(error.message || 'فشل تسجيل الدخول. تحقق من اتصال الإنترنت وإعدادات Render');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

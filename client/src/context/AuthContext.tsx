import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  role: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
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
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log('Attempting to login with username:', username);
      console.log('API Base URL:', axios.defaults.baseURL);
      
      const response = await axios.post('/api/auth/login', { username, password });
      console.log('Login response:', response.status);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error config:', error.config);
      
      // Network errors
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('ERR_NETWORK')) {
        const apiUrl = axios.defaults.baseURL || 'غير محدد';
        throw new Error(`لا يمكن الاتصال بالخادم (${apiUrl}). تأكد من أن الخادم يعمل بشكل صحيح وأن REACT_APP_API_URL مضبوط بشكل صحيح في Render.`);
      }
      
      // CORS errors
      if (error.message?.includes('CORS') || error.code === 'ERR_CORS') {
        throw new Error('خطأ في CORS. تأكد من أن CLIENT_URL مضبوط بشكل صحيح في Backend على Render.');
      }
      
      // Timeout errors
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('انتهت مهلة الاتصال. الخادم قد يكون نائماً (Free Plan). انتظر 30-60 ثانية وحاول مرة أخرى.');
      }
      
      if (error.response) {
        // Server responded with error status
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

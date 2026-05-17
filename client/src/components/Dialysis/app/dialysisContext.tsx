import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import axios from 'axios';
import { message } from 'antd';
import { useAuth } from '../../../context/AuthContext';

const HOSPITAL_KEY = 'dialysis_hospital_id';
/** دمج بيانات كل المستشفيات المسموح بها في قائمة واحدة (يُرسل للـ API كـ hospital_id=all_my) */
export const ALL_MY_HOSPITALS = 'all_my' as const;
export type DialysisHospitalScope = number | typeof ALL_MY_HOSPITALS;

export interface HospitalRow {
  id: number;
  name: string;
  code?: string | null;
}

interface Ctx {
  hospitals: HospitalRow[];
  hospitalId: DialysisHospitalScope | null;
  setHospitalId: (id: DialysisHospitalScope) => void;
  refreshHospitals: () => Promise<void>;
  loading: boolean;
}

const DialysisCtx = createContext<Ctx | undefined>(undefined);

export const DialysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [hospitalId, setHospitalIdState] = useState<DialysisHospitalScope | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<HospitalRow[]>('/api/dialysis/hospitals');
      setHospitals(data);
      const stored = localStorage.getItem(HOSPITAL_KEY);
      const primary = user?.dialysisPrimaryHospitalId;
      const inList = (id: number) => data.some((h) => h.id === id);

      let next: DialysisHospitalScope | null = null;
      if (stored === ALL_MY_HOSPITALS && data.length > 1) {
        next = ALL_MY_HOSPITALS;
      } else if (stored && stored !== ALL_MY_HOSPITALS) {
        const sid = parseInt(stored, 10);
        if (!Number.isNaN(sid) && inList(sid)) {
          next = sid;
        }
      }
      if (next == null) {
        if (primary != null && inList(primary)) {
          next = primary;
        } else if (data.length) {
          next = data[0].id;
        }
      }
      if (next != null) {
        setHospitalIdState(next);
        localStorage.setItem(HOSPITAL_KEY, String(next));
      } else {
        setHospitalIdState(null);
      }
    } catch {
      message.error('تعذر تحميل قائمة المستشفيات');
    } finally {
      setLoading(false);
    }
  }, [user?.dialysisPrimaryHospitalId]);

  useEffect(() => {
    refreshHospitals();
  }, [refreshHospitals]);

  const setHospitalId = useCallback((id: DialysisHospitalScope) => {
    setHospitalIdState(id);
    localStorage.setItem(HOSPITAL_KEY, String(id));
  }, []);

  const value = useMemo(
    () => ({ hospitals, hospitalId, setHospitalId, refreshHospitals, loading }),
    [hospitals, hospitalId, setHospitalId, refreshHospitals, loading]
  );

  return <DialysisCtx.Provider value={value}>{children}</DialysisCtx.Provider>;
};

export const useDialysisContext = (): Ctx => {
  const c = useContext(DialysisCtx);
  if (!c) throw new Error('useDialysisContext خارج DialysisProvider');
  return c;
};

/** يبني axios params مع hospital_id الحالي تلقائياً */
export function useHospitalParams(extra?: Record<string, unknown>) {
  const { hospitalId } = useDialysisContext();
  return useMemo(
    () => ({
      hospital_id: hospitalId ?? undefined,
      ...(extra || {}),
    }),
    [hospitalId, extra]
  );
}

/** مستشفى واحد للعمليات التي تتطلب hospital_id رقمياً (إنشاء سجل، إلخ) عند عرض «كل المستشفيات» */
export function useEffectiveDialysisHospitalId(): number | null {
  const { hospitals, hospitalId } = useDialysisContext();
  const { user } = useAuth();
  return useMemo(() => {
    if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) {
      const p = user?.dialysisPrimaryHospitalId;
      if (p != null && hospitals.some((h) => h.id === p)) return p;
      return hospitals[0]?.id ?? null;
    }
    return hospitalId;
  }, [hospitalId, hospitals, user?.dialysisPrimaryHospitalId]);
}

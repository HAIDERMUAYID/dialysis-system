export interface DialysisAccessTemplate {
  key: string;
  label: string;
  description: string;
  permissions: string[];
}

export const DIALYSIS_ACCESS_TEMPLATES: DialysisAccessTemplate[] = [
  {
    key: 'nurse',
    label: 'ممرض ميداني',
    description: 'مرضى، جلسات، القاعة النشطة — بدون حذف',
    permissions: [
      'dialysis:view',
      'dialysis:patient:create',
      'dialysis:patient:edit',
      'dialysis:session:create',
      'dialysis:session:edit',
    ],
  },
  {
    key: 'supervisor',
    label: 'مشرف وحدة',
    description: 'كل عمليات الممرض + حذف جلسات/مرضى',
    permissions: [
      'dialysis:view',
      'dialysis:patient:create',
      'dialysis:patient:edit',
      'dialysis:patient:delete',
      'dialysis:session:create',
      'dialysis:session:edit',
      'dialysis:session:delete',
      'dialysis:location:manage',
    ],
  },
  {
    key: 'pharmacist',
    label: 'صيدلي',
    description: 'صيدلية الغسل والمخزن فقط',
    permissions: [
      'dialysis:pharmacy:view',
      'dialysis:pharmacy:dispense',
      'dialysis:pharmacy:inventory',
    ],
  },
  {
    key: 'reconciliation',
    label: 'طبيب مطابقة',
    description: 'تقارير وإحصاء ومطابقة',
    permissions: ['dialysis:view', 'dialysis:reconciliation', 'dialysis:stats:entry'],
  },
];

export function permissionsForTemplateKey(key: string): string[] {
  return DIALYSIS_ACCESS_TEMPLATES.find((t) => t.key === key)?.permissions ?? ['dialysis:view'];
}

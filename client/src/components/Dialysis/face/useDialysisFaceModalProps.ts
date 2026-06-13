import type { ModalProps } from 'antd';
import { useDialysisMobile } from '../app/useDialysisMobile';

/** خصائص Modal متوافقة مع الهاتف (فوق الشريط السفلي والدرج) */
export function useDialysisFaceModalProps(nestedInDrawer = false): Pick<
  ModalProps,
  'width' | 'centered' | 'zIndex' | 'getContainer' | 'wrapClassName' | 'style' | 'styles'
> {
  const isMobile = useDialysisMobile();

  if (isMobile) {
    return {
      width: '100%',
      centered: false,
      zIndex: 1450,
      wrapClassName: 'd-face-modal-wrap--mobile d-face-modal-wrap--sheet',
      style: { top: 0, padding: 0, margin: 0, maxWidth: '100vw' },
      styles: {
        content: {
          borderRadius: '24px 24px 0 0',
          margin: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
          maxHeight: '96dvh',
          display: 'flex',
          flexDirection: 'column',
        },
        body: {
          flex: 1,
          minHeight: 0,
          maxHeight: 'calc(96dvh - 52px - env(safe-area-inset-top))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 16px 16px',
        },
        header: {
          padding: '14px 16px 10px',
          marginBottom: 0,
          borderBottom: '1px solid #eef2f7',
        },
      },
    };
  }

  return {
    width: 'min(440px, calc(100vw - 24px))',
    centered: true,
    zIndex: nestedInDrawer ? 1100 : 1320,
    getContainer: nestedInDrawer ? false : undefined,
  };
}

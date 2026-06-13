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
      wrapClassName: 'd-face-modal-wrap--mobile',
      style: { top: 0, padding: 0, margin: 0, maxWidth: '100vw' },
      styles: {
        content: {
          borderRadius: '20px 20px 0 0',
          margin: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
          maxHeight: '100dvh',
        },
        body: {
          maxHeight: 'calc(100dvh - 56px - env(safe-area-inset-top))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
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

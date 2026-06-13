import React from 'react';
import { Button, Tag } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { faceCameraFacingLabel } from './useDialysisFaceCamera';
import type { FaceCameraFacing } from './dialysisFaceRuntime';

interface Props {
  facing: FaceCameraFacing;
  onFlip: () => void;
  disabled?: boolean;
}

const DialysisFaceCameraControls: React.FC<Props> = ({ facing, onFlip, disabled }) => (
  <div className="d-face-camera-controls">
    <Tag className="d-face-camera-controls__tag">{faceCameraFacingLabel(facing)}</Tag>
    <Button
      type="default"
      size="small"
      icon={<SyncOutlined />}
      disabled={disabled}
      onClick={onFlip}
      className="d-face-camera-controls__flip"
    >
      تبديل الكامره
    </Button>
  </div>
);

export default DialysisFaceCameraControls;

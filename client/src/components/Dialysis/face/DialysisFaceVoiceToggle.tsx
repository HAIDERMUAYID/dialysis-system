import React from 'react';
import { Button, Tooltip } from 'antd';
import { AudioMutedOutlined, SoundOutlined } from '@ant-design/icons';
import {
  isDialysisFaceVoiceEnabled,
  setDialysisFaceVoiceEnabled,
} from './dialysisFaceVoice';

interface Props {
  className?: string;
}

const DialysisFaceVoiceToggle: React.FC<Props> = ({ className }) => {
  const [enabled, setEnabled] = React.useState(() => isDialysisFaceVoiceEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setDialysisFaceVoiceEnabled(next);
  };

  return (
    <Tooltip title={enabled ? 'إيقاف التلميحات الصوتية' : 'تفعيل التلميحات الصوتية'}>
      <Button
        type="text"
        size="small"
        className={className}
        aria-label={enabled ? 'إيقاف التلميحات الصوتية' : 'تفعيل التلميحات الصوتية'}
        aria-pressed={enabled}
        icon={enabled ? <SoundOutlined /> : <AudioMutedOutlined />}
        onClick={toggle}
      />
    </Tooltip>
  );
};

export default DialysisFaceVoiceToggle;

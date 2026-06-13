import React from 'react';
import { Alert } from 'antd';
import { FACE_CAPTURE_TIPS } from './dialysisFaceConfig';

const DialysisFaceInstructions: React.FC = () => (
  <Alert
    type="info"
    showIcon
    className="d-face-instructions"
    message="للتعرف على الوجه والملامح — وليس الملابس أو المكان"
    description={
      <ul className="d-face-instructions__list">
        {FACE_CAPTURE_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    }
  />
);

export default DialysisFaceInstructions;

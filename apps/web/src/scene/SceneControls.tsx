import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Vector3 } from 'three';

const CAMERA_HOME = new Vector3(5.8, 3.3, 6.4);
const COMPARISON_CAMERA_HOME = new Vector3(8.8, 5.1, 10.4);
const CAMERA_TARGET = new Vector3(0, 0, 0);

interface SceneControlsProps {
  resetRevision: number;
  reducedMotion: boolean;
  comparison?: boolean;
}

export function SceneControls({
  resetRevision,
  reducedMotion,
  comparison = false,
}: SceneControlsProps) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.copy(comparison ? COMPARISON_CAMERA_HOME : CAMERA_HOME);
    camera.lookAt(CAMERA_TARGET);
    camera.updateProjectionMatrix();
  }, [camera, comparison, resetRevision]);

  return (
    <OrbitControls
      key={resetRevision}
      makeDefault
      target={[0, 0, 0]}
      enableDamping={!reducedMotion}
      dampingFactor={0.06}
      enablePan={false}
      minDistance={comparison ? 8.5 : 5.2}
      maxDistance={comparison ? 17 : 12}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.7}
      minAzimuthAngle={-Math.PI * 0.9}
      maxAzimuthAngle={Math.PI * 0.9}
    />
  );
}

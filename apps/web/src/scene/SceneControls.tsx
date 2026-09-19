import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Vector3 } from 'three';

const CAMERA_HOME = new Vector3(5.8, 3.3, 6.4);
const CAMERA_TARGET = new Vector3(0, 0, 0);

interface SceneControlsProps {
  resetRevision: number;
  reducedMotion: boolean;
}

export function SceneControls({
  resetRevision,
  reducedMotion,
}: SceneControlsProps) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.copy(CAMERA_HOME);
    camera.lookAt(CAMERA_TARGET);
    camera.updateProjectionMatrix();
  }, [camera, resetRevision]);

  return (
    <OrbitControls
      key={resetRevision}
      makeDefault
      target={[0, 0, 0]}
      enableDamping={!reducedMotion}
      dampingFactor={0.06}
      enablePan={false}
      minDistance={5.2}
      maxDistance={12}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.7}
      minAzimuthAngle={-Math.PI * 0.9}
      maxAzimuthAngle={Math.PI * 0.9}
    />
  );
}

import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import type { Experiment } from '../../../../contracts/recording';

const CAMERA_HOME = new Vector3(5.8, 3.3, 6.4);
const COMPARISON_CAMERA_HOME = new Vector3(8.8, 5.1, 10.4);
const CAMERA_TARGET = new Vector3(0, 0, 0);
const TRANSITION_SECONDS = 0.85;

const ROLE_CAMERA_POSITIONS: Record<Experiment['role'], Vector3> = {
  baseline: CAMERA_HOME,
  candidate: new Vector3(6.15, 2.85, 6.05),
  verification: new Vector3(5.45, 4.05, 6.35),
  control: new Vector3(6.35, 3.05, 5.75),
};

interface SceneControlsProps {
  resetRevision: number;
  reducedMotion: boolean;
  comparison?: boolean;
  focusRole?: Experiment['role'] | null;
  transitionKey?: string | null;
}

export function SceneControls({
  resetRevision,
  reducedMotion,
  comparison = false,
  focusRole = null,
  transitionKey = null,
}: SceneControlsProps) {
  const camera = useThree((state) => state.camera);
  const [transitioning, setTransitioning] = useState(false);
  const elapsedRef = useRef(0);
  const startRef = useRef(new Vector3());
  const destination = useMemo(
    () =>
      (
        comparison
          ? COMPARISON_CAMERA_HOME
          : focusRole
            ? ROLE_CAMERA_POSITIONS[focusRole]
            : CAMERA_HOME
      ).clone(),
    [comparison, focusRole],
  );

  useEffect(() => {
    if (reducedMotion) {
      camera.position.copy(destination);
      camera.lookAt(CAMERA_TARGET);
      camera.updateProjectionMatrix();
      setTransitioning(false);
      return;
    }
    startRef.current.copy(camera.position);
    elapsedRef.current = 0;
    setTransitioning(true);
  }, [
    camera,
    destination,
    reducedMotion,
    resetRevision,
    transitionKey,
  ]);

  useFrame((_state, delta) => {
    if (!transitioning) return;
    elapsedRef.current += Math.min(delta, 0.05);
    const progress = Math.min(1, elapsedRef.current / TRANSITION_SECONDS);
    const eased = 1 - (1 - progress) ** 3;
    camera.position.lerpVectors(startRef.current, destination, eased);
    camera.lookAt(CAMERA_TARGET);
    if (progress >= 1) {
      camera.position.copy(destination);
      camera.updateProjectionMatrix();
      setTransitioning(false);
    }
  });

  return (
    <OrbitControls
      key={resetRevision}
      makeDefault
      target={[0, 0, 0]}
      enabled={!transitioning}
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

import { useMemo } from 'react';
import { AdditiveBlending, DoubleSide, Quaternion, Vector3 } from 'three';
import { useSceneViewport } from './SceneCanvas';
import type { HeatingEnvelope } from './heatingProfile';

interface HeatingOverlayProps {
  envelope: HeatingEnvelope;
  majorRadius: number;
  minorRadius: number;
  cutawayArc: number;
  rotation: [number, number, number];
}

export function HeatingOverlay({
  envelope,
  majorRadius,
  minorRadius,
  cutawayArc,
  rotation,
}: HeatingOverlayProps) {
  const { quality } = useSceneViewport();
  const faceQuaternion = useMemo(() => {
    const tangent = new Vector3(
      -Math.sin(cutawayArc),
      Math.cos(cutawayArc),
      0,
    );
    return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tangent);
  }, [cutawayArc]);
  const facePosition: [number, number, number] = [
    majorRadius * Math.cos(cutawayArc),
    majorRadius * Math.sin(cutawayArc),
    0,
  ];

  return (
    <group rotation={rotation}>
      <mesh userData={{ encoding: 'configured heating location in rho' }}>
        <torusGeometry
          args={[
            majorRadius,
            minorRadius * envelope.locationRho,
            7,
            quality.tubularSegments,
            cutawayArc,
          ]}
        />
        <meshBasicMaterial
          color="#f0ad58"
          transparent
          opacity={0.38}
          wireframe
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <group position={facePosition} quaternion={faceQuaternion}>
        <mesh
          position={[0, 0, -0.012]}
          userData={{
            location_rho: envelope.locationRho,
            width_rho: envelope.widthRho,
            encoding: 'configured envelope, not measured deposition',
          }}
        >
          <ringGeometry
            args={[
              minorRadius * envelope.innerRho,
              minorRadius * envelope.outerRho,
              quality.level === 'compact' ? 36 : 64,
            ]}
          />
          <meshBasicMaterial
            color="#e8a64f"
            transparent
            opacity={0.42}
            depthWrite={false}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh position={[0, 0, -0.016]}>
          <ringGeometry
            args={[
              minorRadius * Math.max(0, envelope.locationRho - 0.008),
              minorRadius * Math.min(1, envelope.locationRho + 0.008),
              quality.level === 'compact' ? 36 : 64,
            ]}
          />
          <meshBasicMaterial color="#ffcf82" side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

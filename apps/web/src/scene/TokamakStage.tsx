import type {
  ProfileFrame,
  Recording,
} from '../../../../contracts/recording';
import { PlasmaVolume } from './PlasmaVolume';
import { useSceneViewport } from './SceneCanvas';

interface TokamakStageProps {
  geometry: Recording['geometry'];
  frame: ProfileFrame | null;
  temperatureScale: [number, number];
}

function getVisualDimensions(geometry: Recording['geometry']) {
  const ratio =
    geometry.major_radius_m > 0
      ? geometry.minor_radius_m / geometry.major_radius_m
      : 0.32;
  return {
    majorRadius: 2.65,
    minorRadius: Math.min(1.2, Math.max(0.55, 2.65 * ratio)),
  };
}

export function TokamakStage({
  geometry,
  frame,
  temperatureScale,
}: TokamakStageProps) {
  const { quality } = useSceneViewport();
  const { majorRadius, minorRadius } = getVisualDimensions(geometry);
  const cutawayArc = Math.PI * 1.72;
  const torusRotation: [number, number, number] = [
    Math.PI / 2,
    0,
    -Math.PI * 0.14,
  ];

  return (
    <group>
      <ambientLight intensity={0.24} color="#8ab9bd" />
      <hemisphereLight args={['#9debf0', '#071113', 0.75]} />
      <directionalLight
        position={[4.2, 6.5, 4.8]}
        intensity={2.25}
        color="#d7fbff"
        castShadow={quality.shadows}
      />
      <pointLight
        position={[-4, 1.5, -2.5]}
        intensity={24}
        distance={12}
        decay={2}
        color="#d49a54"
      />

      {frame ? (
        <PlasmaVolume
          frame={frame}
          majorRadius={majorRadius}
          minorRadius={minorRadius}
          cutawayArc={cutawayArc}
          temperatureScale={temperatureScale}
          rotation={torusRotation}
        />
      ) : null}

      <mesh rotation={torusRotation} receiveShadow>
        <torusGeometry
          args={[
            majorRadius,
            minorRadius,
            quality.radialSegments,
            quality.tubularSegments,
            cutawayArc,
          ]}
        />
        <meshPhysicalMaterial
          color="#16383d"
          emissive="#07191c"
          emissiveIntensity={0.8}
          roughness={0.28}
          metalness={0.42}
          transparent
          opacity={0.24}
          depthWrite={false}
          wireframe
        />
      </mesh>

      <mesh rotation={torusRotation} scale={1.035}>
        <torusGeometry
          args={[
            majorRadius,
            minorRadius,
            Math.max(12, quality.radialSegments / 2),
            Math.max(48, quality.tubularSegments / 2),
            cutawayArc,
          ]}
        />
        <meshStandardMaterial
          color="#2b676d"
          emissive="#0b2428"
          emissiveIntensity={0.55}
          roughness={0.34}
          metalness={0.68}
          transparent
          opacity={0.16}
          depthWrite={false}
          side={2}
        />
      </mesh>

      <mesh position={[0, 0, 0]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.24, 5.6, 32]} />
        <meshStandardMaterial
          color="#173237"
          metalness={0.74}
          roughness={0.32}
        />
      </mesh>

      <gridHelper
        args={[13, quality.level === 'compact' ? 18 : 30, '#1a454a', '#0a2023']}
        position={[0, -minorRadius - 0.72, 0]}
      />
    </group>
  );
}

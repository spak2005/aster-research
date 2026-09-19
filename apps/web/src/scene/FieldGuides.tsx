import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useSceneViewport } from './SceneCanvas';

interface FieldGuidesProps {
  majorRadius: number;
  minorRadius: number;
  elongation: number;
  cutawayArc: number;
  rotation: [number, number, number];
}

export function FieldGuides({
  majorRadius,
  minorRadius,
  elongation,
  cutawayArc,
  rotation,
}: FieldGuidesProps) {
  const { quality } = useSceneViewport();
  const guides = useMemo(
    () =>
      Array.from({ length: quality.fieldLineCount }, (_, guideIndex) => {
        const phase =
          (guideIndex / Math.max(1, quality.fieldLineCount)) * Math.PI * 2;
        const guideRadius = minorRadius * (0.68 + (guideIndex % 2) * 0.12);
        const pointCount = quality.level === 'compact' ? 54 : 90;
        return Array.from({ length: pointCount }, (_unused, pointIndex) => {
          const u = (pointIndex / (pointCount - 1)) * cutawayArc;
          const schematicPoloidalAngle = phase + u * 1.2;
          return new Vector3(
            (majorRadius + guideRadius * Math.cos(schematicPoloidalAngle)) *
              Math.cos(u),
            (majorRadius + guideRadius * Math.cos(schematicPoloidalAngle)) *
              Math.sin(u),
            guideRadius * Math.sin(schematicPoloidalAngle),
          );
        });
      }),
    [
      cutawayArc,
      majorRadius,
      minorRadius,
      quality.fieldLineCount,
      quality.level,
    ],
  );

  return (
    <group
      rotation={rotation}
      scale={[1, 1, elongation]}
      userData={{
        encoding: 'schematic magnetic guide lines, not solver field output',
      }}
    >
      {guides.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index % 3 === 0 ? '#c9914e' : '#4fa7ab'}
          lineWidth={quality.level === 'compact' ? 0.45 : 0.65}
          transparent
          opacity={index % 3 === 0 ? 0.18 : 0.14}
          depthWrite={false}
        />
      ))}
    </group>
  );
}

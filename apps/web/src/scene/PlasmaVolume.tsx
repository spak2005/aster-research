import { useMemo } from 'react';
import {
  AdditiveBlending,
  DoubleSide,
  Quaternion,
  Vector3,
} from 'three';
import type { ProfileFrame } from '../../../../contracts/recording';
import { useSceneViewport } from './SceneCanvas';
import { temperatureColor } from './temperatureScale';

interface PlasmaVolumeProps {
  frame: ProfileFrame;
  majorRadius: number;
  minorRadius: number;
  cutawayArc: number;
  temperatureScale: [number, number];
  rotation: [number, number, number];
}

function sampleSeries(rho: number[], values: number[], target: number) {
  if (target <= (rho[0] ?? 0)) return values[0] ?? 0;
  for (let index = 1; index < rho.length; index += 1) {
    const upperRho = rho[index];
    const lowerRho = rho[index - 1];
    if (
      upperRho !== undefined &&
      lowerRho !== undefined &&
      target <= upperRho
    ) {
      const span = upperRho - lowerRho;
      const mix = span > 0 ? (target - lowerRho) / span : 0;
      return (values[index - 1] ?? 0) * (1 - mix) + (values[index] ?? 0) * mix;
    }
  }
  return values[values.length - 1] ?? 0;
}

function combinedTemperature(frame: ProfileFrame, rho: number) {
  const electron = sampleSeries(
    frame.rho,
    frame.electron_temperature_kev,
    rho,
  );
  const ion = sampleSeries(frame.rho, frame.ion_temperature_kev, rho);
  return (electron + ion) / 2;
}

export function PlasmaVolume({
  frame,
  majorRadius,
  minorRadius,
  cutawayArc,
  temperatureScale,
  rotation,
}: PlasmaVolumeProps) {
  const { quality } = useSceneViewport();
  const layerCount = quality.level === 'compact' ? 6 : 9;
  const layers = useMemo(
    () =>
      Array.from({ length: layerCount }, (_, index) => {
        const rho = (index + 1) / layerCount;
        const temperature = combinedTemperature(frame, rho);
        return {
          rho,
          temperature,
          color: temperatureColor(temperature, temperatureScale),
        };
      }),
    [frame, layerCount, temperatureScale],
  );

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
      {layers.map(({ rho, color }, index) => (
        <mesh key={rho}>
          <torusGeometry
            args={[
              majorRadius,
              minorRadius * rho,
              Math.max(12, Math.floor(quality.radialSegments * 0.7)),
              quality.tubularSegments,
              cutawayArc,
            ]}
          />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.46 + (1 - rho) * 0.22}
            roughness={0.5}
            metalness={0.05}
            transparent
            opacity={0.055 + index * 0.008}
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
          />
        </mesh>
      ))}

      <group position={facePosition} quaternion={faceQuaternion}>
        {layers.map(({ rho, temperature, color }, index) => {
          const innerRho = index / layerCount;
          return (
            <mesh
              key={`face-${rho}`}
              position={[0, 0, -index * 0.0005]}
              userData={{
                rho,
                temperature_kev: temperature,
                encoding: 'mean electron and ion temperature',
              }}
            >
              <ringGeometry
                args={[
                  minorRadius * innerRho,
                  minorRadius * rho,
                  quality.level === 'compact' ? 36 : 64,
                  1,
                ]}
              />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.34}
                roughness={0.58}
                metalness={0.02}
                side={DoubleSide}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

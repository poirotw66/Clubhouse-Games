/**
 * Infinite wavy road centerline along depth z.
 * Lateral offset and derivatives drive mesh, car placement, and camera sway.
 */

export function trackOffset(z: number): number {
  return (
    Math.sin(z * 0.028) * 7.5 +
    Math.sin(z * 0.067 + 1.7) * 3.2 +
    Math.sin(z * 0.013 + 0.4) * 4.0
  );
}

/** First derivative dx/dz — heading proxy. */
export function trackSlope(z: number): number {
  return (
    Math.cos(z * 0.028) * 7.5 * 0.028 +
    Math.cos(z * 0.067 + 1.7) * 3.2 * 0.067 +
    Math.cos(z * 0.013 + 0.4) * 4.0 * 0.013
  );
}

/** Second derivative — curvature proxy for camera roll / sway. */
export function trackCurvature(z: number): number {
  return (
    -Math.sin(z * 0.028) * 7.5 * 0.028 * 0.028 +
    -Math.sin(z * 0.067 + 1.7) * 3.2 * 0.067 * 0.067 +
    -Math.sin(z * 0.013 + 0.4) * 4.0 * 0.013 * 0.013
  );
}

export function trackHeading(z: number): number {
  return Math.atan(trackSlope(z));
}

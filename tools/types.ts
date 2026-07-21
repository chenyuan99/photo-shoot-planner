export type Coordinates = { latitude: number; longitude: number };

export type Candidate = Coordinates & {
  name: string;
  bortleClass?: number;
  horizonScore?: number;
  accessScore?: number;
  foregroundScore?: number;
  notes?: string;
};

export type CameraProfile = {
  camera: string;
  sensor: "full-frame" | "aps-c" | "micro-four-thirds" | "other";
  cropFactor: number;
  focalLengthMm: number;
  maxAperture: number;
  stabilization?: boolean;
  tripod?: boolean;
};

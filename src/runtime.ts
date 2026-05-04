export type TransportMode = "http" | "stdio";

let transportMode: TransportMode = "http";

export function setTransportMode(mode: TransportMode): void {
  transportMode = mode;
}

export function getTransportMode(): TransportMode {
  return transportMode;
}

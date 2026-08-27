import type { NodeId } from '../types/dependency.js';

export type NodeIdParts = {
  type: string;
  name: string;
};

/** Create a canonical Type:Name identifier. The name may contain colons. */
export function createNodeId(type: string, name: string): NodeId {
  const normalizedType = type.trim();
  const normalizedName = name.trim();
  if (!normalizedType || !normalizedName) {
    throw new TypeError('NodeId requires a non-empty type and name');
  }
  return `${normalizedType}:${normalizedName}`;
}

/** Parse a NodeId using only the first colon as the structural separator. */
export function parseNodeId(nodeId: string): NodeIdParts | undefined {
  const separator = nodeId.indexOf(':');
  if (separator < 1 || separator === nodeId.length - 1) return undefined;

  const type = nodeId.slice(0, separator).trim();
  const name = nodeId.slice(separator + 1).trim();
  return type && name ? { type, name } : undefined;
}

/** Normalize whitespace around the type and name, or return undefined if invalid. */
export function normalizeNodeId(nodeId: string): NodeId | undefined {
  const parts = parseNodeId(nodeId);
  return parts ? createNodeId(parts.type, parts.name) : undefined;
}

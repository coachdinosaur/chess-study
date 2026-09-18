/**
 * Schema-v1 curriculum package emit types — mirrors the Dart runtime schema
 * in lib/opening_trainer/adaptive/curriculum_package.dart exactly.
 */

export const CURRICULUM_SCHEMA_VERSION = 1;

export type RoleName =
  | 'MAINLINE'
  | 'THEORETICAL_ALTERNATIVE'
  | 'PRACTICAL_ALTERNATIVE'
  | 'QUIET_DEVIATION'
  | 'MOVE_ORDER_DEVIATION'
  | 'TRAP'
  | 'PUNISHMENT'
  | 'REPERTOIRE'
  | 'REPERTOIRE_ALTERNATIVE'
  | 'SIDELINE';

export type ReviewStateName = 'DRAFT' | 'VERIFIED';

export type MoveQualityLabelName =
  | 'EXCELLENT'
  | 'GOOD'
  | 'OK'
  | 'INACCURACY'
  | 'MISTAKE'
  | 'BLUNDER';

export type SideName = 'white' | 'black';

export interface SourceRefJson {
  chapter?: number;
  page?: number;
  variation?: string;
}

export interface PositionJson {
  id: string;
  key: string;
  fen: string;
  checkpoint: boolean;
  terminal: boolean;
  note?: string;
  context?: { openingName?: string; eco?: string };
  sourceRefs?: SourceRefJson[];
}

export interface EdgeJson {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  uci: string;
  san: string;
  mover: SideName;
  evalRef?: { cp?: number; mate?: number; pv?: string[] };
  humanRef?: { games?: number; share?: number };
  bookCovered: boolean;
  note?: string;
  sourceRefs?: SourceRefJson[];
}

export interface VariationJson {
  id: string;
  title: string;
  side: SideName;
  rootNodeId: string;
  chapterRefs?: number[];
  recommendedPlyRange?: [number, number];
  unlockLevel?: number;
  /**
   * Two-tier hierarchy (plan §4.8): depth-0 "branch" records are the
   * selectable paths in the picker (grouped by chapterSystem); depth-1+
   * "leaf" records exist for mastery granularity and hang under a branch
   * via parentId. label is the source index label (A1, B21, ...).
   * Absent on single-tier packages — treat as depth-0 ungrouped.
   */
  parentId?: string;
  depth?: number;
  chapterSystem?: string;
  label?: string;
}

export interface VariationPolicyJson {
  variationId: string;
  edgeId: string;
  role: RoleName;
  minLevel: number;
  importance: number;
  punishEligible: boolean;
  expectedLabel?: MoveQualityLabelName;
  reviewState: ReviewStateName;
}

export interface PackageJson {
  schemaVersion: number;
  packageId: string;
  enginePolicyId: string;
  family: { name: string; ecoHints: string[] };
  variations: VariationJson[];
  positions: PositionJson[];
  edges: EdgeJson[];
  variationPolicy: VariationPolicyJson[];
}

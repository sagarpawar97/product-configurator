// ── API: /remaining-values ───────────────────────────────────
export interface SegmentOption {
  value: string;
  /** UDC description; null when the value doesn't come from a UDC list */
  text: string | null;
}

export interface RemainingSegment {
  name: string;
  required: boolean;
  /** Default or calc-rule value so far ('' when none) */
  current: string;
  values: SegmentOption[];
}

export interface RemainingValuesResponse {
  kit?: string;
  item?: string;
  branch?: string;
  resolvedSoFar?: string;
  segments: Record<string, RemainingSegment>;
}

// ── API: /validate ───────────────────────────────────────────
export interface PriceLine {
  rule: string;
  desc: string;
  price: string;
  item?: string;
}

export interface RuleMessage {
  rule?: string;
  seq?: string;
  segment?: string;
  severity?: string;
  errorId?: string;
  message?: string;
  ruleText?: string;
  segmentValues?: string;
  customMessage?: string;
}

export interface ValidateResponse {
  valid: boolean;
  price: number | null;
  priced?: boolean;
  priceLines?: PriceLine[];
  missingRequired?: string[];
  violatedRules?: Array<string | { rule: string }>;
  warningRules?: Array<string | { rule: string }>;
  invalidUdc?: string[];
  invalidRange?: string[];
  invalidExtvarCombinations?: string[];
  ruleMessages?: RuleMessage[];
  resolvedConfig?: string;
  kit?: string;
}

// ── App state ────────────────────────────────────────────────
/** A segment as shown in the form */
export interface Field {
  seg: string;
  name: string;
  required: boolean;
  current: string;
  values: SegmentOption[];
  /** No allowed values → can't be chosen */
  disabled: boolean;
  /** Grouped segments (e.g. 901–914) shown as one field */
  members?: string[];
  groupRange?: string;
}

/** seg → value */
export type SegmentValues = Record<string, string>;

export type MessageTone = 'danger' | 'warning';
export type MessageGroup = 'rule' | 'combination' | 'required' | 'range' | 'warning' | 'udc';

export interface ValidationMessage {
  id: string;
  tone: MessageTone;
  group: MessageGroup;
  rule?: string;
  errorId?: string;
  segs: string[];
  text: string;
  details: string[];
}

// ── Public ───────────────────────────────────────────────────
export interface ConfiguratorCartLine {
  item: string;
  branch: string;
  /** Order string, e.g. "1 484|5 LA|50 26D|…|" */
  config: string;
  resolvedConfig?: string;
  price: number;
  kit?: string;
}

export interface ConfiguratorProps {
  /** Show the modal */
  open: boolean;
  /** Called on ×, Cancel, Esc, backdrop click, and after Add to Cart */
  onClose: () => void;
  /** JDE item (segment 1). Default "484" */
  itemId?: string;
  /** Branch/plant. Default "SAR100" */
  branch?: string;
  /** Called on Add to Cart, then onClose() */
  onAddToCart?: (line: ConfiguratorCartLine) => void;
}

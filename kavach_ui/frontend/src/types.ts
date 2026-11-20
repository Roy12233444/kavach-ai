export type TabKey = "shield" | "proof" | "compare" | "logs";

export type AgentRole =
  | "general_agent"
  | "support_agent"
  | "coding_agent"
  | "analyst_agent";

export type VerdictType = "PASS" | "WARN" | "KILL";

export interface DiskStatus {
  file_name: string;
  disk_path: string;
  exists: boolean;
  byte_size: number;
  sha256: string | null;
  baseline_sha256: string;
  intact: boolean;
  last_modified: number | null;
  last_readback: string;
  raw_bytes: number[];
  baseline_note: string;
}

export interface BankingStatus {
  db_file: string;
  exists: boolean;
  table?: string;
  total_accounts: number;
  total_balance_inr: number;
  formatted_balance: string;
  status: string;
}

export interface TripCounts {
  R8_SARASVATI: number;
  R3_MITRA: number;
  R10_INDRA: number;
  R6_VARUNA: number;
  R2_YAMA: number;
  [key: string]: number;
}

export interface Scoreboard {
  fired: number;
  killed: number;
  warned: number;
  passed: number;
  bypass_found: number;
}

export interface AttackLogItem {
  id: string;
  timestamp: string;
  text: string;
  session_id: string;
  agent_role: string;
  verdict: VerdictType;
  rule: string | null;
  violation_type: string | null;
  details: string;
  latency_ms: number;
  source: string;
  bypass_reported: boolean;
}

export interface WalEntry {
  timestamp: string;
  lsn: number;
  lsn_label: string;
  kind: "boot" | "pass" | "warn" | "kill" | "disk" | "reset" | string;
  message: string;
}

export interface ReplayStep {
  step?: number;
  id: string;
  name: string;
  status: VerdictType;
  duration_ms: number;
  detail: string;
}

export interface CheckResponse {
  verdict: VerdictType;
  latency_ms: number;
  session_id: string;
  agent_role: string;
  violation_type?: string | null;
  rule?: string | null;
  details?: string;
  message?: string;
  session_burned: boolean;
  replay_steps: ReplayStep[];
  log_entry: AttackLogItem;
  disk: DiskStatus;
}

export interface ProofWorldUnguarded {
  status: "DESTROYED" | "EXECUTED";
  file_size: number;
  sha256: string | null;
  latency_ms: number;
  raw_bytes: number[];
  message: string;
}

export interface ProofWorldGuarded {
  status: string;
  verdict: VerdictType;
  rule?: string | null;
  details?: string;
  file_size: number;
  sha256: string | null;
  latency_ms: number;
  raw_bytes: number[];
  message: string;
}

export interface ProofCompareResponse {
  unguarded: ProofWorldUnguarded;
  guarded: ProofWorldGuarded;
  replay_steps: ReplayStep[];
  scoreboard: Scoreboard;
  attack_log: AttackLogItem[];
}

export interface HostAlert {
  id: string;
  timestamp: string;
  source: string;
  severity: "CRITICAL" | "INFO";
  category: string;
  title: string;
  message: string;
  disk: DiskStatus;
  banking: BankingStatus;
}

export interface LiveSyncEvent {
  text: string;
  agent_role: string;
  source: string;
  verdict: VerdictType;
  rule: string | null;
  latency_ms: number;
  details: string;
  would_destroy_unguarded: boolean;
}

export interface ToastItem {
  id: string;
  level: "critical" | "warn" | "info";
  title: string;
  message: string;
  badge?: string;
  meta?: string;
}

export interface ProtoStatusResponse {
  engine: string;
  semantic_engine?: string;
  gemini_live?: boolean;
  host_watcher_active?: boolean;
  mode: string;
  lan_ip: string;
  port: number;
  jury_url: string;
  lsn: number;
  trip_counts: TripCounts;
  scoreboard: Scoreboard;
  attack_log: AttackLogItem[];
  wal: WalEntry[];
  killed_sessions: string[];
  disk: DiskStatus;
  banking: BankingStatus;
}

export interface WsMessage {
  type: "snapshot" | "telemetry";
  lsn: number;
  wal?: WalEntry[];
  entry?: WalEntry;
  trip_counts?: TripCounts;
  scoreboard?: Scoreboard;
  attack_log?: AttackLogItem[];
  killed_sessions?: string[];
  disk?: DiskStatus;
  banking?: BankingStatus;
  last_check?: AttackLogItem;
  replay_steps?: ReplayStep[];
  host_alert?: HostAlert;
  live_sync?: LiveSyncEvent;
}

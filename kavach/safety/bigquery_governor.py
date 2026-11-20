"""
KAVACH AI — Phase 4.3 BigQuery Runaway Cost Governor (Rule R5: Dharma)
Google DeepMind × Google Cloud Startup Buildathon India 2026

Deterministic FinOps & Cloud Billing Equilibrium Layer:
  • Inspects BigQuery SQL queries before GCP dispatch (< 0.5 ms).
  • Computes columnar projection factor + partition pruning factor against enterprise catalog.
  • Flags the classic BigQuery trap: `LIMIT N` on unpartitioned `SELECT *` does NOT reduce billing.
  • Halts runaway queries exceeding the configurable per-query USD budget cap ($5.00 default)
    under canonical Rule R5_DHARMA and generates a partition-pruned safe SQL rewrite.
"""
from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional

BIGQUERY_USD_PER_TB = 6.25
DEFAULT_BUDGET_CAP_USD = 5.00
TB_TO_BYTES = 1024**4  # BigQuery billing uses binary tebibytes (TiB = 1024^4 bytes)
GB_TO_TB = 1.0 / 1024.0


@dataclass(frozen=True)
class BigQueryTableMeta:
    table_id: str
    dataset: str
    description: str
    total_tb: float
    column_count: int
    partition_column: str
    clustering_keys: tuple[str, ...]
    row_count_approx: str
    safe_columns: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "table_id": self.table_id,
            "dataset": self.dataset,
            "description": self.description,
            "total_tb": self.total_tb,
            "column_count": self.column_count,
            "partition_column": self.partition_column,
            "clustering_keys": list(self.clustering_keys),
            "row_count_approx": self.row_count_approx,
            "safe_columns": list(self.safe_columns),
            "full_scan_usd": round(self.total_tb * BIGQUERY_USD_PER_TB, 2),
        }


BIGQUERY_TABLE_CATALOG: dict[str, BigQueryTableMeta] = {
    "prod_telemetry.events_100tb": BigQueryTableMeta(
        table_id="prod_telemetry.events_100tb",
        dataset="prod_telemetry",
        description="Production application click & API telemetry lake",
        total_tb=42.80,
        column_count=128,
        partition_column="event_date",
        clustering_keys=("user_id", "event_type"),
        row_count_approx="84.2B rows",
        safe_columns=("event_id", "user_id", "event_type"),
    ),
    "billing.raw_clickstream_50tb": BigQueryTableMeta(
        table_id="billing.raw_clickstream_50tb",
        dataset="billing",
        description="Ad-tech & metering raw clickstream warehouse",
        total_tb=18.40,
        column_count=96,
        partition_column="ingest_date",
        clustering_keys=("session_id", "country"),
        row_count_approx="39.1B rows",
        safe_columns=("click_id", "session_id", "revenue_usd"),
    ),
    "core_banking.upi_transactions_25tb": BigQueryTableMeta(
        table_id="core_banking.upi_transactions_25tb",
        dataset="core_banking",
        description="Core settlement UPI transaction archive (masked views)",
        total_tb=12.60,
        column_count=64,
        partition_column="txn_date",
        clustering_keys=("account_id", "status"),
        row_count_approx="21.8B rows",
        safe_columns=("txn_id", "account_id", "amount_inr"),
    ),
    "analytics.daily_kpi_summary": BigQueryTableMeta(
        table_id="analytics.daily_kpi_summary",
        dataset="analytics",
        description="Pre-aggregated daily KPI materialized summary",
        total_tb=0.008,
        column_count=14,
        partition_column="report_date",
        clustering_keys=("region",),
        row_count_approx="14.2M rows",
        safe_columns=("report_date", "region", "active_users"),
    ),
}


@dataclass
class BigQueryCostDecision:
    is_bigquery_query: bool
    verdict: str  # "PASS" | "KILL"
    rule: Optional[str] = None
    estimated_tb: float = 0.0
    estimated_gb: float = 0.0
    estimated_bytes: int = 0
    estimated_cost_usd: float = 0.0
    budget_cap_usd: float = DEFAULT_BUDGET_CAP_USD
    cost_saved_usd: float = 0.0
    tables_matched: list[str] = field(default_factory=list)
    risk_factors: list[str] = field(default_factory=list)
    details: str = ""
    safe_rewrite_sql: Optional[str] = None
    rewrite_estimated_cost_usd: Optional[float] = None
    latency_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_bigquery_query": self.is_bigquery_query,
            "verdict": self.verdict,
            "rule": self.rule,
            "estimated_tb": self.estimated_tb,
            "estimated_gb": self.estimated_gb,
            "estimated_bytes": self.estimated_bytes,
            "estimated_cost_usd": self.estimated_cost_usd,
            "budget_cap_usd": self.budget_cap_usd,
            "cost_saved_usd": self.cost_saved_usd,
            "tables_matched": self.tables_matched,
            "risk_factors": self.risk_factors,
            "details": self.details,
            "safe_rewrite_sql": self.safe_rewrite_sql,
            "rewrite_estimated_cost_usd": self.rewrite_estimated_cost_usd,
            "latency_ms": self.latency_ms,
        }


SELECT_FROM_RE = re.compile(r"\bSELECT\b(?P<cols>[\s\S]+?)\bFROM\b", re.IGNORECASE)
TABLE_REF_RE = re.compile(
    r"\b(?:FROM|JOIN)\s+[`'\"]?(?P<table>[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){1,2})[`'\"]?",
    re.IGNORECASE,
)
WHERE_CLAUSE_RE = re.compile(
    r"\bWHERE\b(?P<cond>[\s\S]+?)(?:\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|\bLIMIT\b|;|$)",
    re.IGNORECASE,
)
CROSS_JOIN_RE = re.compile(r"\bCROSS\s+JOIN\b", re.IGNORECASE)
LIMIT_RE = re.compile(r"\bLIMIT\s+\d+\b", re.IGNORECASE)
EXPLICIT_TB_SUFFIX_RE = re.compile(r"(?:_|-)(\d+(?:\.\d+)?)tb\b", re.IGNORECASE)

BIGQUERY_DATASET_HINTS = (
    "prod_telemetry.",
    "billing.",
    "core_banking.upi_",
    "analytics.daily_kpi",
    "bigquery-public-data.",
)


class BigQueryCostGovernor:
    """Deterministic pre-dispatch FinOps governor enforcing Rule R5 (Dharma)."""

    def __init__(self, usd_per_tb: float = BIGQUERY_USD_PER_TB) -> None:
        self.usd_per_tb = float(usd_per_tb)

    @staticmethod
    def _normalize_table_name(raw_name: str) -> str:
        cleaned = raw_name.strip().strip("`'\"").lower()
        parts = cleaned.split(".")
        if len(parts) >= 3:
            # Strip GCP project prefix: project.dataset.table -> dataset.table
            return ".".join(parts[-2:])
        return cleaned

    def _resolve_table_meta(self, table_ref: str) -> Optional[BigQueryTableMeta]:
        norm = self._normalize_table_name(table_ref)
        if norm in BIGQUERY_TABLE_CATALOG:
            return BIGQUERY_TABLE_CATALOG[norm]

        tb_match = EXPLICIT_TB_SUFFIX_RE.search(norm)
        is_bq_hint = any(norm.startswith(prefix) for prefix in BIGQUERY_DATASET_HINTS) or (
            "bigquery" in table_ref.lower()
        )
        if tb_match or is_bq_hint:
            est_tb = float(tb_match.group(1)) if tb_match else 12.0
            dataset = norm.split(".")[0] if "." in norm else "warehouse"
            return BigQueryTableMeta(
                table_id=norm,
                dataset=dataset,
                description="Dynamic BigQuery multi-terabyte dataset",
                total_tb=est_tb,
                column_count=64,
                partition_column="event_date",
                clustering_keys=("id",),
                row_count_approx="Multi-billion rows",
                safe_columns=("id", "event_timestamp", "status"),
            )
        return None

    def is_bigquery_sql(self, text: str) -> bool:
        if not text or not re.search(r"\bSELECT\b", text, re.IGNORECASE):
            return False
        refs = [m.group("table") for m in TABLE_REF_RE.finditer(text)]
        if not refs:
            return False
        return any(self._resolve_table_meta(ref) is not None for ref in refs)

    @staticmethod
    def _split_select_columns(cols_raw: str) -> tuple[bool, list[str]]:
        stripped = cols_raw.strip()
        if re.match(r"^(?:DISTINCT\s+)?(?:\*|[A-Za-z0-9_]+\.\*)$", stripped, re.IGNORECASE) or (
            re.search(r"(?:^|,)\s*\*\s*(?:,|$)", stripped) is not None
        ):
            return True, ["*"]
        cols = [c.strip() for c in stripped.split(",") if c.strip()]
        return False, cols

    @staticmethod
    def _detect_partition_factor(sql: str, partition_col: str) -> tuple[float, list[str]]:
        where_match = WHERE_CLAUSE_RE.search(sql)
        if not where_match:
            return 1.0, ["NO_PARTITION_FILTER"]
        where_body = where_match.group("cond")
        part_pattern = re.compile(
            rf"\b{re.escape(partition_col)}\b\s*(?:=|>=|<=|>|<|\bBETWEEN\b|\bIN\b)",
            re.IGNORECASE,
        )
        if not part_pattern.search(where_body):
            return 1.0, ["NO_PARTITION_FILTER"]

        if re.search(rf"\b{re.escape(partition_col)}\b\s*=", where_body, re.IGNORECASE):
            return 1.0 / 365.0, []
        return 7.0 / 365.0, ["MULTI_DAY_PARTITION_RANGE"]

    def _compute_single_query_tb(
        self,
        sql: str,
        resolved_tables: list[BigQueryTableMeta],
        cols_raw: str,
        is_star: bool,
        cols: list[str],
    ) -> tuple[float, list[str]]:
        risks: list[str] = []
        if is_star:
            risks.append("SELECT_STAR_FULL_WIDTH")

        has_cross_join = bool(CROSS_JOIN_RE.search(sql))
        if has_cross_join:
            risks.append("CROSS_JOIN_SCAN_AMPLIFICATION")

        has_limit = bool(LIMIT_RE.search(sql))
        total_tb = 0.0
        unpartitioned_seen = False

        for meta in resolved_tables:
            col_factor = (
                1.0
                if is_star
                else max(0.05, min(1.0, len(cols) / max(meta.column_count, 1)))
            )
            part_factor, part_risks = self._detect_partition_factor(sql, meta.partition_column)
            for rk in part_risks:
                if rk not in risks:
                    risks.append(rk)
            if part_factor >= 0.99:
                unpartitioned_seen = True
            total_tb += meta.total_tb * col_factor * part_factor

        if has_cross_join:
            total_tb *= 2.0

        if has_limit and (is_star or unpartitioned_seen):
            risks.append("LIMIT_DOES_NOT_REDUCE_SCAN")

        return total_tb, risks

    @staticmethod
    def _build_safe_rewrite(primary: BigQueryTableMeta) -> str:
        cols_str = ", ".join(primary.safe_columns)
        return (
            f"SELECT {cols_str}\n"
            f"FROM `{primary.table_id}`\n"
            f"WHERE {primary.partition_column} = CURRENT_DATE()\n"
            f"LIMIT 100;"
        )

    def evaluate(
        self,
        sql: str,
        budget_cap_usd: Optional[float] = None,
    ) -> BigQueryCostDecision:
        t0 = time.perf_counter()
        cap = float(
            budget_cap_usd
            if budget_cap_usd is not None
            else os.getenv("KAVACH_BQ_BUDGET_CAP_USD", str(DEFAULT_BUDGET_CAP_USD))
        )

        if not self.is_bigquery_sql(sql):
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
            return BigQueryCostDecision(
                is_bigquery_query=False,
                verdict="PASS",
                budget_cap_usd=cap,
                latency_ms=latency_ms,
            )

        refs = [m.group("table") for m in TABLE_REF_RE.finditer(sql)]
        resolved: list[BigQueryTableMeta] = []
        seen_ids: set[str] = set()
        for ref in refs:
            meta = self._resolve_table_meta(ref)
            if meta is not None and meta.table_id not in seen_ids:
                resolved.append(meta)
                seen_ids.add(meta.table_id)

        select_match = SELECT_FROM_RE.search(sql)
        cols_raw = select_match.group("cols") if select_match else "*"
        is_star, cols = self._split_select_columns(cols_raw)

        estimated_tb, risks = self._compute_single_query_tb(
            sql, resolved, cols_raw, is_star, cols
        )
        estimated_tb = round(estimated_tb, 4)
        estimated_gb = round(estimated_tb * 1024.0, 2)
        estimated_bytes = int(round(estimated_tb * TB_TO_BYTES))
        estimated_cost_usd = round(estimated_tb * self.usd_per_tb, 2)

        primary = resolved[0]
        safe_rewrite = self._build_safe_rewrite(primary)
        rw_tb, _ = self._compute_single_query_tb(
            safe_rewrite, [primary], ", ".join(primary.safe_columns), False, list(primary.safe_columns)
        )
        rw_cost_usd = round(rw_tb * self.usd_per_tb, 4)

        latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)
        matched_ids = [m.table_id for m in resolved]

        if estimated_cost_usd > cap:
            notes = []
            if "SELECT_STAR_FULL_WIDTH" in risks:
                notes.append("unbounded SELECT * column scan")
            if "NO_PARTITION_FILTER" in risks:
                notes.append(f"missing partition predicate on `{primary.partition_column}`")
            if "CROSS_JOIN_SCAN_AMPLIFICATION" in risks:
                notes.append("CROSS JOIN scan amplification")
            if "LIMIT_DOES_NOT_REDUCE_SCAN" in risks:
                notes.append("LIMIT does not reduce BigQuery on-demand bytes billed")
            reason_summary = "; ".join(notes) if notes else "scan cost exceeds FinOps threshold"

            return BigQueryCostDecision(
                is_bigquery_query=True,
                verdict="KILL",
                rule="R5_DHARMA",
                estimated_tb=estimated_tb,
                estimated_gb=estimated_gb,
                estimated_bytes=estimated_bytes,
                estimated_cost_usd=estimated_cost_usd,
                budget_cap_usd=cap,
                cost_saved_usd=estimated_cost_usd,
                tables_matched=matched_ids,
                risk_factors=risks,
                details=(
                    f"Rule R5 (Dharma) halted BigQuery dispatch: projected {estimated_tb:.2f} TB scan "
                    f"(${estimated_cost_usd:,.2f}) exceeds ${cap:.2f} budget cap ({reason_summary})."
                ),
                safe_rewrite_sql=safe_rewrite,
                rewrite_estimated_cost_usd=rw_cost_usd,
                latency_ms=latency_ms,
            )

        return BigQueryCostDecision(
            is_bigquery_query=True,
            verdict="PASS",
            rule=None,
            estimated_tb=estimated_tb,
            estimated_gb=estimated_gb,
            estimated_bytes=estimated_bytes,
            estimated_cost_usd=estimated_cost_usd,
            budget_cap_usd=cap,
            cost_saved_usd=0.0,
            tables_matched=matched_ids,
            risk_factors=risks,
            details=(
                f"FinOps dry-run approved: {estimated_gb:.2f} GB scan "
                f"(${estimated_cost_usd:.4f}) within ${cap:.2f} query budget cap."
            ),
            safe_rewrite_sql=None,
            rewrite_estimated_cost_usd=None,
            latency_ms=latency_ms,
        )

    @staticmethod
    def get_catalog() -> list[dict[str, Any]]:
        return [meta.to_dict() for meta in BIGQUERY_TABLE_CATALOG.values()]

    @staticmethod
    def get_presets() -> list[dict[str, Any]]:
        return [
            {
                "id": "bq_runaway_star",
                "label": "Runaway SELECT * (42.8 TB · $267.50)",
                "tone": "danger",
                "sql": "SELECT * FROM prod_telemetry.events_100tb LIMIT 100;",
            },
            {
                "id": "bq_deceptive_limit",
                "label": "Deceptive LIMIT 10 ($115.00)",
                "tone": "danger",
                "sql": "SELECT * FROM billing.raw_clickstream_50tb ORDER BY ingest_date DESC LIMIT 10;",
            },
            {
                "id": "bq_cross_join",
                "label": "Cross-Join Explosion ($765.00)",
                "tone": "danger",
                "sql": (
                    "SELECT * FROM prod_telemetry.events_100tb a "
                    "CROSS JOIN billing.raw_clickstream_50tb b;"
                ),
            },
            {
                "id": "bq_safe_partitioned",
                "label": "Partitioned Query ($0.02 PASS)",
                "tone": "safe",
                "sql": (
                    "SELECT txn_id, account_id, amount_inr "
                    "FROM core_banking.upi_transactions_25tb "
                    "WHERE txn_date = CURRENT_DATE() LIMIT 50;"
                ),
            },
        ]


_DEFAULT_GOVERNOR: Optional[BigQueryCostGovernor] = None


def get_bigquery_governor() -> BigQueryCostGovernor:
    global _DEFAULT_GOVERNOR
    if _DEFAULT_GOVERNOR is None:
        _DEFAULT_GOVERNOR = BigQueryCostGovernor()
    return _DEFAULT_GOVERNOR

"""
KAVACH AI — Live OS Host Integrity & SQLite Watcher
Monitors physical canary files and core_banking.db out-of-band so external
PowerShell, File Explorer, or rogue process modifications fire real-time alerts.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger("kavach.host_watcher")


class HostIntegrityWatcher:
    """Async background monitor detecting out-of-band OS filesystem & DB changes."""

    def __init__(
        self,
        disk_reader: Callable[[], dict[str, Any]],
        banking_reader: Callable[[], dict[str, Any]],
        on_alert: Callable[[dict[str, Any]], Awaitable[None]],
        poll_interval_sec: float = 0.8,
    ) -> None:
        self._disk_reader = disk_reader
        self._banking_reader = banking_reader
        self._on_alert = on_alert
        self._poll_interval_sec = max(0.2, float(poll_interval_sec))

        self._task: Optional[asyncio.Task[None]] = None
        self._disk_fp: Optional[tuple[Any, ...]] = None
        self._disk_intact: bool = True
        self._banking_fp: Optional[tuple[Any, ...]] = None
        self._seq: int = 0

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    @staticmethod
    def _make_disk_fp(disk: dict[str, Any]) -> tuple[Any, ...]:
        return (
            bool(disk.get("exists")),
            int(disk.get("byte_size") or 0),
            disk.get("sha256"),
        )

    @staticmethod
    def _make_banking_fp(banking: dict[str, Any]) -> tuple[Any, ...]:
        return (
            bool(banking.get("exists")),
            int(banking.get("total_accounts") or 0),
            float(banking.get("total_balance_inr") or 0.0),
        )

    def sync_baseline(self) -> None:
        """Capture current OS disk & SQLite fingerprints so intentional API mutations don't double-fire."""
        try:
            disk = self._disk_reader()
            banking = self._banking_reader()
            self._disk_fp = self._make_disk_fp(disk)
            self._disk_intact = bool(disk.get("intact"))
            self._banking_fp = self._make_banking_fp(banking)
        except Exception as exc:
            logger.debug("Baseline sync failed: %s", exc)

    def start(self) -> None:
        if self.is_running:
            return
        if self._disk_fp is None or self._banking_fp is None:
            self.sync_baseline()
        self._task = asyncio.create_task(self._run_loop(), name="kavach-host-watcher")

    async def stop(self) -> None:
        task = self._task
        self._task = None
        if task is None:
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    def _build_alert(
        self,
        severity: str,
        category: str,
        title: str,
        message: str,
        disk: dict[str, Any],
        banking: dict[str, Any],
    ) -> dict[str, Any]:
        self._seq += 1
        return {
            "id": f"host_{int(time.time() * 1000)}_{self._seq}",
            "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
            "source": "os_watcher",
            "severity": severity,
            "category": category,
            "title": title,
            "message": message,
            "disk": disk,
            "banking": banking,
        }

    async def _poll_once(self) -> None:
        disk = self._disk_reader()
        banking = self._banking_reader()

        curr_disk_fp = self._make_disk_fp(disk)
        curr_disk_intact = bool(disk.get("intact"))
        curr_bank_fp = self._make_banking_fp(banking)

        prev_disk_fp = self._disk_fp
        prev_disk_intact = self._disk_intact
        prev_bank_fp = self._banking_fp

        self._disk_fp = curr_disk_fp
        self._disk_intact = curr_disk_intact
        self._banking_fp = curr_bank_fp

        if prev_disk_fp is not None and curr_disk_fp != prev_disk_fp:
            prev_exists = bool(prev_disk_fp[0])
            curr_exists = bool(curr_disk_fp[0])
            if prev_exists and not curr_exists:
                await self._on_alert(
                    self._build_alert(
                        severity="CRITICAL",
                        category="disk_deleted",
                        title="HOST FILE TAMPERING DETECTED",
                        message="production_database.txt was deleted externally outside KAVACH (0 bytes remaining)!",
                        disk=disk,
                        banking=banking,
                    )
                )
            elif not prev_disk_intact and curr_disk_intact:
                await self._on_alert(
                    self._build_alert(
                        severity="INFO",
                        category="disk_restored",
                        title="Host Canary Restored",
                        message="production_database.txt restored externally with valid 95-byte SHA-256 baseline.",
                        disk=disk,
                        banking=banking,
                    )
                )
            elif curr_exists and not curr_disk_intact:
                await self._on_alert(
                    self._build_alert(
                        severity="CRITICAL",
                        category="disk_mutated",
                        title="HOST FILE MUTATION DETECTED",
                        message=(
                            f"production_database.txt was modified externally ({curr_disk_fp[1]} bytes) "
                            "— SHA-256 baseline mismatch!"
                        ),
                        disk=disk,
                        banking=banking,
                    )
                )

        if prev_bank_fp is not None and curr_bank_fp != prev_bank_fp:
            await self._on_alert(
                self._build_alert(
                    severity="CRITICAL",
                    category="banking_changed",
                    title="CORE BANKING LEDGER CHANGED",
                    message=(
                        f"core_banking.db changed externally "
                        f"({banking.get('total_accounts', 0)} accts, {banking.get('formatted_balance', '₹0.00 INR')})."
                    ),
                    disk=disk,
                    banking=banking,
                )
            )

    async def _run_loop(self) -> None:
        while True:
            await asyncio.sleep(self._poll_interval_sec)
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.debug("Host watcher poll skipped: %s", exc)

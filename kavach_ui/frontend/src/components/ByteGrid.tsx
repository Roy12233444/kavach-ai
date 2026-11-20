interface ByteGridProps {
  rawBytes: number[];
  destroyed?: boolean;
  totalCells?: number;
}

export function ByteGrid({
  rawBytes,
  destroyed = false,
  totalCells = 95,
}: ByteGridProps) {
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const hasByte = !destroyed && i < rawBytes.length;
    if (!hasByte) {
      return {
        index: i,
        bg: destroyed ? "rgba(220, 38, 38, 0.14)" : "rgba(226, 232, 240, 0.7)",
        border: destroyed ? "1px solid rgba(220, 38, 38, 0.3)" : "1px solid rgba(203, 213, 225, 0.8)",
        title: destroyed ? `Byte #${i}: WIPED (0x00)` : `Byte #${i}: empty`,
      };
    }

    const byteVal = rawBytes[i];
    const norm = Math.max(0.24, Math.min(1, (byteVal - 24) / 110));
    const alpha = (0.35 + norm * 0.6).toFixed(2);
    const char = byteVal >= 32 && byteVal <= 126 ? String.fromCharCode(byteVal) : ".";
    return {
      index: i,
      bg: `rgba(37, 99, 235, ${alpha})`,
      border: "1px solid rgba(37, 99, 235, 0.25)",
      title: `Byte #${String(i).padStart(2, "0")}: 0x${byteVal
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()} ('${char}')`,
    };
  });

  return (
    <div
      className={`grid grid-cols-12 gap-1 p-2 rounded-xl border ${
        destroyed
          ? "bg-red-50/70 border-red-200"
          : "bg-blue-50/70 border-blue-100"
      }`}
    >
      {cells.map((cell) => (
        <div
          key={cell.index}
          title={cell.title}
          style={{ backgroundColor: cell.bg, border: cell.border }}
          className="aspect-square rounded-[3px] transition-transform duration-150 hover:scale-125"
        />
      ))}
    </div>
  );
}

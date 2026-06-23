"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";
import {
  getPointBalance,
  getPointTransactionHistory,
  type PointBalance,
  type PointTransactionRecord,
} from "@/lib/api/points";

type FilterType = "all" | "added" | "used";

function mapTransactionType(t: string): "added" | "used" {
  return t === "earn" || t === "adjust" ? "added" : "used";
}

export default function PointsHistoryPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [records, setRecords] = useState<PointTransactionRecord[]>([]);
  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const profile = useAppSelector((s) => s.auth.profile);

  useEffect(() => {
    const load = async () => {
      try {
        const [txns, bal] = await Promise.all([
          getPointTransactionHistory(),
          getPointBalance(),
        ]);
        setRecords(txns);
        setBalance(bal);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return records;
    return records.filter(
      (r) => mapTransactionType(r.transaction_type) === filter,
    );
  }, [filter, records]);

  const displayBalance = balance?.balance ?? profile?.points ?? 0;
  const pointsVnd = displayBalance * 1000;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Points History
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your loyalty points activity
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center min-w-[140px]">
          <p className="text-xs text-muted-foreground">Available Points</p>
          <p className="text-3xl font-bold text-primary">{displayBalance}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatMoney(pointsVnd)}
          </p>
          {balance && (
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <p>
                Earned:{" "}
                <span className="font-medium text-green-600">
                  +{balance.total_earned}
                </span>
              </p>
              <p>
                Redeemed:{" "}
                <span className="font-medium text-primary">
                  -{balance.total_redeemed}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {(["all", "added", "used"] as const).map((type) => (
          <Button
            key={type}
            variant={filter === type ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(type)}
            className="capitalize"
          >
            {type}
          </Button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No point history.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => {
                const displayType = mapTransactionType(record.transaction_type);
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      {record.created_at
                        ? new Date(record.created_at)
                            .toISOString()
                            .split("T")[0]
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-50 truncate">
                      {record.note || record.booking_code || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          displayType === "added"
                            ? "bg-green-100 text-green-700"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {displayType}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        record.points > 0 ? "text-green-600" : "text-primary",
                      )}
                    >
                      {record.points > 0 ? "+" : ""}
                      {record.points}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

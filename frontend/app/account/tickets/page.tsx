"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TicketReceipt } from "@/components/ticket-receipt";
import { getBookedTickets, type AccountBookedTicket } from "@/lib/api/account";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  used: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  completed: "bg-muted text-muted-foreground",
  pending: "bg-primary/10 text-primary",
};

const formatSeatLabel = (label: string, type: string) => {
  if (type?.toLowerCase() === "couple") {
    const match = label.match(/^([A-Z])(\d+)$/);
    if (match) {
      const row = match[1];
      const num = parseInt(match[2], 10);
      return `${label}-${row}${num + 1}`;
    }
  }
  return label;
};

export default function BookedTicketsPage() {
  const role = useAppSelector((s) => s.auth.role);
  const profile = useAppSelector((s) => s.auth.profile);
  const isAuthed = useMemo(
    () => role !== "guest" && !!profile,
    [role, profile],
  );

  const [tickets, setTickets] = useState<AccountBookedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] =
    useState<AccountBookedTicket | null>(null);

  // Fetch only after user is authenticated refetch when auth becomes available
  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      if (!isAuthed) {
        // user not authenticated yet keep spinner and wait
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await getBookedTickets();
        if (!cancelled) {
          setTickets(data);
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? "Failed to load booked tickets.";
        setErrorMessage(msg);
        if (/unauthorized|401/i.test(msg)) {
          toast.error("Session expired. Please log in again.");
        } else {
          toast.error("Could not load booked tickets.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTickets();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  if (!isAuthed) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Please log in to view your bookings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">Loading booked tickets...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Booked Tickets
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View all your past and upcoming bookings
          </p>
        </div>
        {errorMessage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              location.reload();
            }}
          >
            Retry
          </Button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        {errorMessage && (
          <div className="border-b p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            You have no bookings yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Movie</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <TableCell className="font-mono text-xs">
                    {ticket.id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {ticket.movieTitle}
                  </TableCell>
                  <TableCell>{ticket.bookingDate}</TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                      maximumFractionDigits: 0,
                    }).format(Number(ticket.total || 0))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        statusColors[ticket.status] ??
                        "bg-muted text-muted-foreground"
                      }
                    >
                      {ticket.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={!!selectedTicket}
        onOpenChange={() => setSelectedTicket(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <TicketReceipt
              bookingId={selectedTicket.id}
              movieTitle={selectedTicket.movieTitle}
              startTime={selectedTicket.showDate ? `${selectedTicket.showDate} ${selectedTicket.showTime}` : ""}
              endTime=""
              hall={selectedTicket.hall}
              seats={
                selectedTicket.tickets.length > 0
                  ? selectedTicket.tickets
                      .map((t) => formatSeatLabel(t.seatLabel, t.seatType ?? ""))
                      .join(", ")
                  : selectedTicket.seats
              }
              customerName={selectedTicket.customerName}
              totalAmount={Number(selectedTicket.total || 0)}
              discountAmount={Number(selectedTicket.discountAmount || 0)}
              finalAmount={Number(selectedTicket.finalAmount || selectedTicket.total || 0)}
              pointsEarned={selectedTicket.pointsEarned}
              pointsUsed={selectedTicket.pointsUsed}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

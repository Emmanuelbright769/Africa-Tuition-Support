import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Global post-login announcement. Persistence and acknowledgement are server-owned. */
export function TransactionPinAnnouncement() {
  const [open, setOpen] = useState(false);
  const { data: status } = useQuery<{ hasPin: boolean; isLocked: boolean; announcementPending: boolean }>({
    queryKey: ["/api/security/transaction-pin/status"],
    queryFn: () => apiRequest("GET", "/api/security/transaction-pin/status").then(r => r.json()),
  });
  useEffect(() => { if (status?.announcementPending) setOpen(true); }, [status?.announcementPending]);
  const acknowledge = () => {
    setOpen(false);
    apiRequest("POST", "/api/security/transaction-pin/announcement-seen")
      .finally(() => queryClient.invalidateQueries({ queryKey: ["/api/security/transaction-pin/status"] }));
  };
  const setup = () => {
    try { localStorage.setItem("tsia_open_transaction_pin_settings", "1"); } catch {}
    window.dispatchEvent(new Event("tsia:open-transaction-pin-settings"));
    acknowledge();
  };
  return <Dialog open={open} onOpenChange={next => { if (!next) acknowledge(); }}>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Payments now use a transaction PIN</DialogTitle>
        <DialogDescription>All outgoing payments are protected by a 4-digit transaction PIN instead of an emailed code.</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={acknowledge}>Not now</Button>
        <Button className="flex-1 bg-tsia-green text-white" onClick={setup}>Set up PIN</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
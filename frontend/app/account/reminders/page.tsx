import { UserReminders } from "@/components/account/user-reminders";
import { Separator } from "@/components/ui/separator";

export default function AccountRemindersPage() {
  return (
    <div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Movie Reminders
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Movies you are subscribed to for release day alerts.
        </p>
      </div>

      <Separator className="my-4" />

      <UserReminders />
    </div>
  );
}

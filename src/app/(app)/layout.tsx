import { BottomNav } from "@/components/bottom-nav";
import { HouseholdProvider } from "@/components/household";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-6 pb-28">{children}</main>
      <BottomNav />
    </HouseholdProvider>
  );
}

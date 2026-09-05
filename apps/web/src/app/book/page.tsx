import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import BookingForm from "./booking-form";

export const metadata = { title: "Book a slot — BrothersSportsZone" };

// Server wrapper: only logged-in users can book. The form itself is a client
// component because it fetches live slot availability and submits.
export default async function BookPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Book a slot</h1>
      <BookingForm />
    </main>
  );
}

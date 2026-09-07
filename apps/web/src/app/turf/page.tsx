import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { r2Url } from "@/lib/r2";

// MVP is single-venue: turf is a one-row table (unique index on (true)).
// Dynamic metadata from the row, with a static fallback if the row is missing.
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data: turf } = await supabase.from("turf").select("name, description").limit(1).maybeSingle();

  const title = turf?.name ? `${turf.name} — BrothersSportsZone` : "Our turf — BrothersSportsZone";
  const description =
    turf?.description ?? "Book your football slot at BrothersSportsZone.";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function TurfPage() {
  const supabase = await createClient();
  const { data: turf } = await supabase
    .from("turf")
    .select("name, description, photos_r2_keys, contact_email, contact_phone")
    .limit(1)
    .maybeSingle();

  const photoKeys = Array.isArray(turf?.photos_r2_keys) ? (turf!.photos_r2_keys as string[]) : [];
  const photoUrls = photoKeys
    .map((key) => (typeof key === "string" ? r2Url(key) : null))
    .filter((url): url is string => url !== null);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {!turf ? (
        // turf row missing (unseeded DB) — degrade gracefully.
        <p className="py-16 text-center opacity-60">Turf profile coming soon.</p>
      ) : (
        <>
          <h1 className="text-3xl font-semibold">{turf.name}</h1>

          {photoUrls.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {photoUrls.map((url) => (
                <div key={url} className="relative aspect-video overflow-hidden rounded-lg">
                  <Image
                    src={url}
                    alt={`${turf.name} photo`}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            // No photos seeded and/or R2 public URL not configured yet —
            // placeholder instead of broken images.
            <div className="mt-6 flex aspect-video items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
              Photos coming soon
            </div>
          )}

          {turf.description && (
            <p className="mt-6 whitespace-pre-line leading-relaxed">{turf.description}</p>
          )}

          {(turf.contact_email || turf.contact_phone) && (
            <div className="mt-8 rounded-lg border p-4">
              <h2 className="font-medium">Contact</h2>
              {turf.contact_phone && <p className="mt-1 text-sm">{turf.contact_phone}</p>}
              {turf.contact_email && <p className="text-sm">{turf.contact_email}</p>}
            </div>
          )}

          <a
            href="/book"
            className="mt-8 inline-block rounded bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Book a slot
          </a>
        </>
      )}
    </main>
  );
}

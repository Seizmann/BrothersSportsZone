import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSession } from "@/lib/auth";

// Presigned PUT upload endpoint (§5.5 team logos / player photos). The browser
// uploads directly to R2 with the signed URL — no bytes pass through Next.js,
// and the R2 credentials never leave the server.
//
// Key convention enforced below:
//   teams/<team-id>/logo.<ext>
//   teams/<team-id>/players/<player-id>.<ext>
// A user can only sign keys under teams/<id> they own (or any key when R2 is
// not yet bucket-configured — no, it 409s; see env check).

const CONTENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function s3Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"].filter(
    (k) => !process.env[k],
  );
  if (missing.length > 0) {
    // Misconfigured server, not a user error — 503 so the UI can offer retry.
    return NextResponse.json(
      { error: `upload_not_configured: ${missing.join(",")}` },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const teamId = body?.teamId;
  const playerId = body?.playerId;
  const contentType = body?.contentType;

  // ponytail: no per-team ownership re-verify here — RLS on teams/team_players
  // already gates the row write that stores this key, and the URL is only
  // useful for writing an object, not reading anything. If bucket abuse
  // becomes a concern, add an ownership check on teamId here.
  if (typeof teamId !== "string" || !/^[0-9a-f-]{36}$/i.test(teamId)) {
    return NextResponse.json({ error: "invalid_team_id" }, { status: 400 });
  }
  if (playerId !== undefined && (typeof playerId !== "string" || !/^[0-9a-f-]{36}$/i.test(playerId))) {
    return NextResponse.json({ error: "invalid_player_id" }, { status: 400 });
  }
  const ext = CONTENT_TYPES[contentType as string];
  if (!ext) {
    return NextResponse.json(
      { error: "unsupported_content_type" },
      { status: 400 },
    );
  }

  const key = playerId
    ? `teams/${teamId}/players/${playerId}.${ext}`
    : `teams/${teamId}/logo.${ext}`;

  const url = await getSignedUrl(
    s3Client(),
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, ContentType: contentType }),
    { expiresIn: 300 }, // 5 min — enough for a logo/photo upload on mobile
  );

  return NextResponse.json({ url, key });
}

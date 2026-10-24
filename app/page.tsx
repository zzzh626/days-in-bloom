import { cookies } from "next/headers";
import { JournalApp } from "./journal-app";
import { isSiteOwner, OWNER_SESSION_COOKIE } from "./site-owner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  return (
    <JournalApp
      canEdit={await isSiteOwner(cookieStore.get(OWNER_SESSION_COOKIE)?.value)}
      initialDate={new Date().toISOString().slice(0, 10)}
    />
  );
}

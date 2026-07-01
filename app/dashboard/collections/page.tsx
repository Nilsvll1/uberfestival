import { redirect } from "next/navigation";

// Collections live inside the main dashboard; redirect there.
export default function CollectionsIndexPage() {
  redirect("/dashboard#collections");
}

import { redirect } from "next/navigation";

// Root page — redirect to login (or dashboard if authenticated via middleware)
export default function Home() {
  redirect("/login");
}

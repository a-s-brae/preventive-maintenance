import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <Link href="/" className="link mt-4 inline-block">Back to dashboard</Link>
    </main>
  );
}

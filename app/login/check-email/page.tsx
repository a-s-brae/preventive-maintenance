import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center sm:p-8">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-neutral-600">A sign-in link is on its way. It expires in 24 hours.</p>
        <Link href="/login" className="link mt-4 inline-block text-sm">
          Use a different email
        </Link>
      </div>
    </main>
  );
}
